import { z } from "../../lib/zod";

import { createToolError, createToolSuccess } from "../../tool-helpers";

export const xmlFormatModeSchema = z.enum(["pretty", "compact"]);

export type XmlFormatMode = z.infer<typeof xmlFormatModeSchema>;

export const xmlFormatInputSchema = z.object({
  source: z.string().min(1, "请输入 XML 内容。"),
  indent: z.number().int().min(0).max(8).default(2),
  mode: xmlFormatModeSchema.default("pretty"),
});

export type XmlFormatInput = z.infer<typeof xmlFormatInputSchema>;

export interface XmlFormatOutput {
  formatted: string;
  lineCount: number;
}

type XmlToken =
  | { type: "declaration"; value: string }
  | { type: "processing"; value: string }
  | { type: "doctype"; value: string }
  | { type: "comment"; value: string }
  | { type: "cdata"; value: string }
  | { type: "start-tag"; value: string; name: string }
  | { type: "end-tag"; value: string; name: string }
  | { type: "self-closing-tag"; value: string; name: string }
  | { type: "text"; value: string };

const isNameChar = (char: string) => /[A-Za-z0-9_:\-.]/.test(char);

const readName = (source: string, start: number) => {
  let index = start;

  while (index < source.length && isNameChar(source[index] ?? "")) {
    index += 1;
  }

  return source.slice(start, index);
};

const readTagName = (rawTag: string) => {
  const trimmed = rawTag
    .replace(/^<\/?/, "")
    .replace(/\/?\s*>$/, "")
    .trim();

  return readName(trimmed, 0);
};

const readUntilSequence = (source: string, start: number, terminator: string) => {
  const end = source.indexOf(terminator, start);

  if (end < 0) {
    throw new Error(`缺少结束标记 ${terminator}`);
  }

  return {
    value: source.slice(start, end + terminator.length),
    nextIndex: end + terminator.length,
  };
};

const readQuotedTagEnd = (source: string, start: number) => {
  let index = start;
  let quote: "'" | '"' | null = null;

  while (index < source.length) {
    const char = source[index];

    if (quote) {
      if (char === quote) {
        quote = null;
      }

      index += 1;
      continue;
    }

    if (char === '"' || char === "'") {
      quote = char;
      index += 1;
      continue;
    }

    if (char === ">") {
      return index;
    }

    index += 1;
  }

  throw new Error("标签未正确闭合");
};

const readDoctype = (source: string, start: number) => {
  let index = start + 9;
  let quote: "'" | '"' | null = null;
  let bracketDepth = 0;

  while (index < source.length) {
    const char = source[index];

    if (quote) {
      if (char === quote) {
        quote = null;
      }

      index += 1;
      continue;
    }

    if (char === '"' || char === "'") {
      quote = char;
      index += 1;
      continue;
    }

    if (char === "[") {
      bracketDepth += 1;
      index += 1;
      continue;
    }

    if (char === "]") {
      bracketDepth = Math.max(0, bracketDepth - 1);
      index += 1;
      continue;
    }

    if (char === ">" && bracketDepth === 0) {
      return {
        value: source.slice(start, index + 1),
        nextIndex: index + 1,
      };
    }

    index += 1;
  }

  throw new Error("DOCTYPE 未正确闭合");
};

const tokenizeXml = (source: string): XmlToken[] => {
  const tokens: XmlToken[] = [];
  let index = 0;

  while (index < source.length) {
    if (source[index] !== "<") {
      const nextTag = source.indexOf("<", index);
      const textEnd = nextTag < 0 ? source.length : nextTag;
      const value = source.slice(index, textEnd);

      if (value.length > 0) {
        tokens.push({ type: "text", value });
      }

      index = textEnd;
      continue;
    }

    if (source.startsWith("<!--", index)) {
      const { value, nextIndex } = readUntilSequence(source, index, "-->");
      tokens.push({ type: "comment", value });
      index = nextIndex;
      continue;
    }

    if (source.startsWith("<![CDATA[", index)) {
      const { value, nextIndex } = readUntilSequence(source, index, "]]>");
      tokens.push({ type: "cdata", value });
      index = nextIndex;
      continue;
    }

    if (source.startsWith("<?xml", index)) {
      const { value, nextIndex } = readUntilSequence(source, index, "?>");
      tokens.push({ type: "declaration", value });
      index = nextIndex;
      continue;
    }

    if (source.startsWith("<?", index)) {
      const { value, nextIndex } = readUntilSequence(source, index, "?>");
      tokens.push({ type: "processing", value });
      index = nextIndex;
      continue;
    }

    if (source.startsWith("<!DOCTYPE", index)) {
      const { value, nextIndex } = readDoctype(source, index);
      tokens.push({ type: "doctype", value });
      index = nextIndex;
      continue;
    }

    if (source.startsWith("</", index)) {
      const tagEnd = readQuotedTagEnd(source, index + 2);
      const rawTag = source.slice(index, tagEnd + 1);
      const name = readTagName(rawTag);

      if (!name) {
        throw new Error("结束标签缺少名称");
      }

      tokens.push({
        type: "end-tag",
        value: rawTag,
        name,
      });
      index = tagEnd + 1;
      continue;
    }

    if (source.startsWith("<!", index)) {
      throw new Error("不支持的 XML 声明");
    }

    const tagEnd = readQuotedTagEnd(source, index + 1);
    const rawTag = source.slice(index, tagEnd + 1);
    const tagBody = rawTag.slice(1, -1).trim();
    const selfClosing = /\/\s*$/.test(tagBody);
    const name = readTagName(rawTag);

    if (!name) {
      throw new Error("开始标签缺少名称");
    }

    tokens.push({
      type: selfClosing ? "self-closing-tag" : "start-tag",
      value: rawTag,
      name,
    });
    index = tagEnd + 1;
  }

  return tokens;
};

const normalizeTextContent = (value: string, mode: XmlFormatMode) => {
  if (mode === "compact") {
    return value.replace(/\s+/g, " ").trim();
  }

  return value.trim();
};

const formatXmlTokens = (
  tokens: XmlToken[],
  mode: XmlFormatMode,
  indent: number,
) => {
  const lines: string[] = [];
  const stack: string[] = [];
  const indentation = (depth: number) =>
    mode === "compact" || indent <= 0 ? "" : " ".repeat(depth * indent);

  const pushLine = (value: string, depth: number) => {
    const normalized = mode === "compact" ? value.trim() : value.trim();

    if (!normalized) {
      return;
    }

    lines.push(`${indentation(depth)}${normalized}`);
  };

  for (const token of tokens) {
    if (token.type === "text") {
      const value = normalizeTextContent(token.value, mode);

      if (!value) {
        continue;
      }

      pushLine(value, stack.length);
      continue;
    }

    if (
      token.type === "declaration" ||
      token.type === "processing" ||
      token.type === "doctype" ||
      token.type === "comment" ||
      token.type === "cdata"
    ) {
      pushLine(token.value, stack.length);
      continue;
    }

    if (token.type === "start-tag") {
      pushLine(token.value, stack.length);
      stack.push(token.name);
      continue;
    }

    if (token.type === "self-closing-tag") {
      pushLine(token.value, stack.length);
      continue;
    }

    const current = stack.pop();

    if (current !== token.name) {
      throw new Error(`标签闭合不匹配：期望 </${current ?? ""}>，实际为 </${token.name}>`);
    }

    pushLine(token.value, stack.length);
  }

  if (stack.length > 0) {
    throw new Error(`存在未闭合标签：<${stack[stack.length - 1]}>`);
  }

  return mode === "compact" ? lines.join("") : lines.join("\n");
};

export const formatXml = (input: XmlFormatInput) => {
  const parsedInput = xmlFormatInputSchema.safeParse(input);

  if (!parsedInput.success) {
    return createToolError({
      code: "INVALID_INPUT",
      message: "输入参数不合法。",
      details: parsedInput.error.issues[0]?.message,
    });
  }

  const { source, indent, mode } = parsedInput.data;

  try {
    const tokens = tokenizeXml(source);
    const formatted = formatXmlTokens(tokens, mode, indent);

    if (!formatted) {
      return createToolError({
        code: "FORMAT_EMPTY_RESULT",
        message: "格式化结果为空。",
      });
    }

    return createToolSuccess<XmlFormatOutput>({
      formatted,
      lineCount: formatted.split("\n").length,
    });
  } catch (error) {
    return createToolError({
      code: "INVALID_XML",
      message: "XML 解析失败。",
      details: error instanceof Error ? error.message : "未知错误。",
    });
  }
};
