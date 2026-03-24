import { parse as parseYaml, stringify as stringifyYaml } from "yaml";
import { z } from "../../lib/zod";

import { createToolError, createToolSuccess } from "../../tool-helpers";
import type { JsonValue } from "../json-format/tool";

export const dataFormatSchema = z.enum([
  "json",
  "yaml",
  "toml",
  "xml",
  "csv",
  "properties",
  "html",
  "http"
]);

export type DataFormat = z.infer<typeof dataFormatSchema>;

export const formatConvertInputSchema = z.object({
  source: z.string().min(1, "请输入待转换内容。"),
  sourceFormat: z.union([dataFormatSchema, z.literal("auto")]).default("auto"),
  targetFormat: dataFormatSchema,
  indent: z.number().int().min(0).max(8).default(2)
});

export type FormatConvertInput = z.infer<typeof formatConvertInputSchema>;

export interface FormatConvertOutput {
  sourceFormat: DataFormat;
  targetFormat: DataFormat;
  result: string;
  lineCount: number;
}

type JsonObject = { [key: string]: JsonValue };
type MarkupChild =
  | {
      type: "element";
      node: MarkupNode;
    }
  | {
      type: "text";
      value: string;
    };

interface MarkupNode {
  name: string;
  attributes: Record<string, string>;
  children: MarkupChild[];
}

const htmlVoidTags = new Set([
  "area",
  "base",
  "br",
  "col",
  "embed",
  "hr",
  "img",
  "input",
  "link",
  "meta",
  "param",
  "source",
  "track",
  "wbr"
]);

const isJsonObject = (value: JsonValue | undefined): value is JsonObject =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const isScalar = (value: JsonValue) =>
  value === null || typeof value === "string" || typeof value === "number" || typeof value === "boolean";

const normalizeToJsonValue = (value: unknown): JsonValue => {
  if (
    value === null ||
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean"
  ) {
    return value;
  }

  if (Array.isArray(value)) {
    return value.map((item) => normalizeToJsonValue(item));
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  if (value instanceof Set) {
    return Array.from(value, (item) => normalizeToJsonValue(item));
  }

  if (value instanceof Map) {
    return Object.fromEntries(
      Array.from(value.entries(), ([key, item]) => [
        String(key),
        normalizeToJsonValue(item)
      ]),
    );
  }

  if (typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([key, item]) => [
        key,
        normalizeToJsonValue(item)
      ]),
    );
  }

  return String(value);
};

const removeInlineComment = (line: string) => {
  let quote: "'" | "\"" | null = null;
  let escapeNext = false;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];

    if (escapeNext) {
      escapeNext = false;
      continue;
    }

    if (char === "\\") {
      escapeNext = true;
      continue;
    }

    if (quote) {
      if (char === quote) {
        quote = null;
      }

      continue;
    }

    if (char === "\"" || char === "'") {
      quote = char;
      continue;
    }

    if (char === "#") {
      return line.slice(0, index).trimEnd();
    }
  }

  return line;
};

const splitTopLevel = (value: string, delimiter = ",") => {
  const items: string[] = [];
  let current = "";
  let quote: "'" | "\"" | null = null;
  let escapeNext = false;
  let depth = 0;

  for (let index = 0; index < value.length; index += 1) {
    const char = value[index];

    if (escapeNext) {
      current += char;
      escapeNext = false;
      continue;
    }

    if (char === "\\") {
      current += char;
      escapeNext = true;
      continue;
    }

    if (quote) {
      current += char;

      if (char === quote) {
        quote = null;
      }

      continue;
    }

    if (char === "\"" || char === "'") {
      current += char;
      quote = char;
      continue;
    }

    if (char === "[" || char === "{") {
      depth += 1;
      current += char;
      continue;
    }

    if (char === "]" || char === "}") {
      depth = Math.max(0, depth - 1);
      current += char;
      continue;
    }

    if (char === delimiter && depth === 0) {
      items.push(current.trim());
      current = "";
      continue;
    }

    current += char;
  }

  if (current.trim() || value.endsWith(delimiter)) {
    items.push(current.trim());
  }

  return items.filter((item) => item.length > 0);
};

const setNestedValue = (target: JsonObject, path: string[], value: JsonValue) => {
  let cursor = target;

  path.forEach((segment, index) => {
    if (index === path.length - 1) {
      cursor[segment] = value;
      return;
    }

    const current = cursor[segment];

    if (!isJsonObject(current)) {
      cursor[segment] = {};
    }

    cursor = cursor[segment] as JsonObject;
  });
};

const ensureNestedObject = (target: JsonObject, path: string[]) => {
  let cursor = target;

  path.forEach((segment) => {
    const current = cursor[segment];

    if (!isJsonObject(current)) {
      cursor[segment] = {};
    }

    cursor = cursor[segment] as JsonObject;
  });

  return cursor;
};

const ensureNestedArrayTable = (target: JsonObject, path: string[]) => {
  let cursor = target;

  path.forEach((segment, index) => {
    if (index === path.length - 1) {
      const current = cursor[segment];

      if (!Array.isArray(current)) {
        cursor[segment] = [];
      }

      const nextItem: JsonObject = {};
      (cursor[segment] as JsonValue[]).push(nextItem);
      cursor = nextItem;
      return;
    }

    const current = cursor[segment];

    if (!isJsonObject(current)) {
      cursor[segment] = {};
    }

    cursor = cursor[segment] as JsonObject;
  });

  return cursor;
};

const parseTomlValue = (rawValue: string): JsonValue => {
  const value = rawValue.trim();

  if (
    (value.startsWith("\"") && value.endsWith("\"")) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    const unquoted = value.slice(1, -1);
    return value.startsWith("\"")
      ? unquoted
          .replace(/\\n/g, "\n")
          .replace(/\\r/g, "\r")
          .replace(/\\t/g, "\t")
          .replace(/\\"/g, "\"")
          .replace(/\\\\/g, "\\")
      : unquoted;
  }

  if (value.startsWith("[") && value.endsWith("]")) {
    const inner = value.slice(1, -1).trim();

    if (!inner) {
      return [];
    }

    return splitTopLevel(inner).map((item) => parseTomlValue(item));
  }

  if (value === "true" || value === "false") {
    return value === "true";
  }

  if (/^[+-]?\d+(?:\.\d+)?$/.test(value)) {
    return Number(value);
  }

  return value;
};

const parseToml = (source: string): JsonValue => {
  const root: JsonObject = {};
  let current = root;

  source.split(/\r?\n/).forEach((rawLine) => {
    const withoutComment = removeInlineComment(rawLine).trim();

    if (!withoutComment) {
      return;
    }

    const arrayTableMatch = withoutComment.match(/^\[\[(.+)\]\]$/);

    if (arrayTableMatch) {
      current = ensureNestedArrayTable(
        root,
        arrayTableMatch[1]!.split(".").map((item) => item.trim()),
      );
      return;
    }

    const tableMatch = withoutComment.match(/^\[(.+)\]$/);

    if (tableMatch) {
      current = ensureNestedObject(
        root,
        tableMatch[1]!.split(".").map((item) => item.trim()),
      );
      return;
    }

    const equalIndex = withoutComment.indexOf("=");

    if (equalIndex <= 0) {
      throw new Error(`无法解析 TOML 行: ${rawLine}`);
    }

    const key = withoutComment.slice(0, equalIndex).trim();
    const value = withoutComment.slice(equalIndex + 1).trim();

    setNestedValue(current, key.split(".").map((item) => item.trim()), parseTomlValue(value));
  });

  return root;
};

const stringifyTomlScalar = (value: JsonValue): string => {
  if (value === null) {
    return "\"\"";
  }

  if (typeof value === "string") {
    return JSON.stringify(value);
  }

  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }

  if (Array.isArray(value) && value.every((item) => isScalar(item))) {
    return `[${value.map((item) => stringifyTomlScalar(item)).join(", ")}]`;
  }

  throw new Error("当前数据结构不能直接序列化为 TOML 标量。");
};

const isArrayOfObjects = (value: JsonValue) =>
  Array.isArray(value) && value.every((item) => isJsonObject(item));

const appendTomlTable = (
  value: JsonObject,
  path: string[],
  lines: string[],
) => {
  const scalarEntries = Object.entries(value).filter(([, item]) => {
    if (isJsonObject(item)) {
      return false;
    }

    if (isArrayOfObjects(item)) {
      return false;
    }

    if (Array.isArray(item)) {
      return item.every((child) => isScalar(child));
    }

    return true;
  });

  const objectEntries = Object.entries(value).filter(([, item]) => isJsonObject(item));
  const arrayTableEntries = Object.entries(value).filter(([, item]) => isArrayOfObjects(item));

  if (path.length > 0) {
    lines.push(`[${path.join(".")}]`);
  }

  scalarEntries.forEach(([key, item]) => {
    lines.push(`${key} = ${stringifyTomlScalar(item)}`);
  });

  objectEntries.forEach(([key, item]) => {
    if (lines.length > 0 && lines[lines.length - 1] !== "") {
      lines.push("");
    }

    appendTomlTable(item as JsonObject, [...path, key], lines);
  });

  arrayTableEntries.forEach(([key, item]) => {
    (item as JsonValue[]).forEach((child) => {
      if (lines.length > 0 && lines[lines.length - 1] !== "") {
        lines.push("");
      }

      lines.push(`[[${[...path, key].join(".")}]]`);
      appendTomlTable(child as JsonObject, [], lines);
    });
  });
};

const stringifyToml = (value: JsonValue) => {
  if (!isJsonObject(value)) {
    throw new Error("只有对象结构可以转换为 TOML。");
  }

  const lines: string[] = [];
  appendTomlTable(value, [], lines);

  return lines.join("\n").trim();
};

const unescapePropertyValue = (value: string) =>
  value
    .replace(/\\n/g, "\n")
    .replace(/\\r/g, "\r")
    .replace(/\\t/g, "\t")
    .replace(/\\\\/g, "\\");

const parseProperties = (source: string): JsonValue => {
  const result: JsonObject = {};

  source.split(/\r?\n/).forEach((rawLine) => {
    const line = rawLine.trim();

    if (!line || line.startsWith("#") || line.startsWith("!")) {
      return;
    }

    const delimiterIndex = line.search(/[:=]/);

    if (delimiterIndex < 0) {
      result[line] = "";
      return;
    }

    const key = line.slice(0, delimiterIndex).trim();
    const value = line.slice(delimiterIndex + 1).trim();

    result[key] = unescapePropertyValue(value);
  });

  return result;
};

const flattenProperties = (
  value: JsonValue,
  path = "",
  target: Record<string, string> = {},
) => {
  if (Array.isArray(value)) {
    target[path] = value.every((item) => isScalar(item))
      ? value.map((item) => String(item ?? "")).join(",")
      : JSON.stringify(value);
    return target;
  }

  if (!isJsonObject(value)) {
    target[path] = value === null ? "" : String(value);
    return target;
  }

  Object.entries(value).forEach(([key, item]) => {
    const nextPath = path ? `${path}.${key}` : key;
    flattenProperties(item, nextPath, target);
  });

  return target;
};

const stringifyProperties = (value: JsonValue) => {
  if (!isJsonObject(value)) {
    throw new Error("只有对象结构可以转换为 properties。");
  }

  return Object.entries(flattenProperties(value))
    .map(([key, item]) => `${key}=${item}`)
    .join("\n");
};

const parseCsv = (source: string): JsonValue => {
  const rows: string[][] = [];
  let currentCell = "";
  let currentRow: string[] = [];
  let inQuotes = false;

  const pushCell = () => {
    currentRow.push(currentCell);
    currentCell = "";
  };

  const pushRow = () => {
    rows.push(currentRow);
    currentRow = [];
  };

  for (let index = 0; index < source.length; index += 1) {
    const char = source[index]!;
    const next = source[index + 1];

    if (inQuotes) {
      if (char === "\"" && next === "\"") {
        currentCell += "\"";
        index += 1;
        continue;
      }

      if (char === "\"") {
        inQuotes = false;
        continue;
      }

      currentCell += char;
      continue;
    }

    if (char === "\"") {
      inQuotes = true;
      continue;
    }

    if (char === ",") {
      pushCell();
      continue;
    }

    if (char === "\n") {
      pushCell();
      pushRow();
      continue;
    }

    if (char === "\r") {
      continue;
    }

    currentCell += char;
  }

  if (currentCell.length > 0 || currentRow.length > 0) {
    pushCell();
    pushRow();
  }

  if (rows.length === 0) {
    return [];
  }

  const headerRow = rows[0] ?? [];
  const dataRows = rows.slice(1);
  const uniqueHeaders = new Set(headerRow);
  const hasHeader =
    headerRow.every((item) => item.trim().length > 0) &&
    uniqueHeaders.size === headerRow.length;

  if (!hasHeader) {
    return rows;
  }

  return dataRows.map((row) =>
    Object.fromEntries(
      headerRow.map((key, index) => [key, row[index] ?? ""]),
    ),
  );
};

const stringifyCsvCell = (value: JsonValue) => {
  const text = value === null ? "" : String(value);

  if (/[",\n\r]/.test(text)) {
    return `"${text.replace(/"/g, "\"\"")}"`;
  }

  return text;
};

const stringifyCsv = (value: JsonValue) => {
  if (!Array.isArray(value)) {
    throw new Error("只有数组结构可以转换为 CSV。");
  }

  if (value.length === 0) {
    return "";
  }

  if (value.every((item) => Array.isArray(item))) {
    return value
      .map((row) =>
        (row as JsonValue[]).map((cell) => stringifyCsvCell(cell)).join(","),
      )
      .join("\n");
  }

  if (value.every((item) => isJsonObject(item))) {
    const headers = Array.from(
      value.reduce((result, item) => {
        Object.keys(item as JsonObject).forEach((key) => result.add(key));
        return result;
      }, new Set<string>()),
    );

    const body = value.map((item) =>
      headers
        .map((header) => stringifyCsvCell((item as JsonObject)[header] ?? ""))
        .join(","),
    );

    return [headers.map((item) => stringifyCsvCell(item)).join(","), ...body].join("\n");
  }

  return value.map((item) => stringifyCsvCell(item)).join("\n");
};

const appendMarkupText = (target: MarkupNode, value: string) => {
  const normalized = value.trim();

  if (!normalized) {
    return;
  }

  target.children.push({
    type: "text",
    value: normalized
  });
};

const parseAttributes = (value: string) => {
  const attributes: Record<string, string> = {};
  const pattern =
    /([^\s=/>]+)(?:\s*=\s*("(?:[^"]*)"|'(?:[^']*)'|[^\s"'=<>`]+))?/g;

  for (const match of value.matchAll(pattern)) {
    const rawKey = match[1];

    if (!rawKey) {
      continue;
    }

    const rawValue = match[2];

    if (!rawValue) {
      attributes[rawKey] = "true";
      continue;
    }

    attributes[rawKey] =
      rawValue.startsWith("\"") || rawValue.startsWith("'")
        ? rawValue.slice(1, -1)
        : rawValue;
  }

  return attributes;
};

const findMarkupTagEnd = (source: string, start: number) => {
  let quote: "'" | "\"" | null = null;

  for (let index = start; index < source.length; index += 1) {
    const char = source[index];

    if (quote) {
      if (char === quote) {
        quote = null;
      }

      continue;
    }

    if (char === "\"" || char === "'") {
      quote = char;
      continue;
    }

    if (char === ">") {
      return index;
    }
  }

  return -1;
};

const parseMarkup = (source: string, mode: "xml" | "html") => {
  let index = 0;
  const stack: MarkupNode[] = [];
  let root: MarkupNode | null = null;

  while (index < source.length) {
    if (source.startsWith("<!--", index)) {
      const commentEnd = source.indexOf("-->", index + 4);

      if (commentEnd < 0) {
        throw new Error("标记注释没有正确结束。");
      }

      index = commentEnd + 3;
      continue;
    }

    if (source.startsWith("<![CDATA[", index)) {
      const cdataEnd = source.indexOf("]]>", index + 9);

      if (cdataEnd < 0) {
        throw new Error("CDATA 片段没有正确结束。");
      }

      const current = stack.at(-1);

      if (!current) {
        throw new Error("无效的 CDATA 位置。");
      }

      appendMarkupText(current, source.slice(index + 9, cdataEnd));
      index = cdataEnd + 3;
      continue;
    }

    if (source.startsWith("<?", index)) {
      const instructionEnd = source.indexOf("?>", index + 2);

      if (instructionEnd < 0) {
        throw new Error("处理指令没有正确结束。");
      }

      index = instructionEnd + 2;
      continue;
    }

    if (/^<!doctype/i.test(source.slice(index))) {
      const doctypeEnd = source.indexOf(">", index + 2);

      if (doctypeEnd < 0) {
        throw new Error("DOCTYPE 没有正确结束。");
      }

      index = doctypeEnd + 1;
      continue;
    }

    if (source[index] === "<") {
      if (source[index + 1] === "/") {
        const closeEnd = source.indexOf(">", index + 2);

        if (closeEnd < 0) {
          throw new Error("结束标签没有正确结束。");
        }

        const tagName = source.slice(index + 2, closeEnd).trim().toLowerCase();
        const current = stack.pop();

        if (!current || current.name.toLowerCase() !== tagName) {
          throw new Error(`标签闭合不匹配: ${tagName}`);
        }

        index = closeEnd + 1;
        continue;
      }

      const tagEnd = findMarkupTagEnd(source, index + 1);

      if (tagEnd < 0) {
        throw new Error("开始标签没有正确结束。");
      }

      let rawTag = source.slice(index + 1, tagEnd).trim();
      const selfClosing = rawTag.endsWith("/");

      if (selfClosing) {
        rawTag = rawTag.slice(0, -1).trim();
      }

      const [rawName, ...attributeParts] = rawTag.split(/\s+/);

      if (!rawName) {
        throw new Error("发现空标签。");
      }

      const node: MarkupNode = {
        name: rawName,
        attributes: parseAttributes(attributeParts.join(" ")),
        children: []
      };

      const parent = stack.at(-1);

      if (parent) {
        parent.children.push({
          type: "element",
          node
        });
      } else if (!root) {
        root = node;
      } else {
        throw new Error("检测到多个根节点。");
      }

      const isVoidTag =
        mode === "html" && htmlVoidTags.has(rawName.toLowerCase());

      if (!selfClosing && !isVoidTag) {
        stack.push(node);
      }

      index = tagEnd + 1;
      continue;
    }

    const textEnd = source.indexOf("<", index);
    const current = stack.at(-1);

    if (current) {
      appendMarkupText(
        current,
        source.slice(index, textEnd >= 0 ? textEnd : source.length),
      );
    }

    index = textEnd >= 0 ? textEnd : source.length;
  }

  if (stack.length > 0) {
    throw new Error(`标签没有闭合: ${stack[stack.length - 1]!.name}`);
  }

  if (!root) {
    throw new Error("未找到有效的根节点。");
  }

  return root;
};

const markupNodeToJson = (node: MarkupNode): JsonValue => {
  const elementChildren = node.children.filter(
    (child): child is { type: "element"; node: MarkupNode } =>
      child.type === "element",
  );
  const textContent = node.children
    .filter((child): child is { type: "text"; value: string } => child.type === "text")
    .map((child) => child.value)
    .join(" ")
    .trim();

  if (
    Object.keys(node.attributes).length === 0 &&
    elementChildren.length === 0 &&
    textContent
  ) {
    return textContent;
  }

  const result: JsonObject = {};

  Object.entries(node.attributes).forEach(([key, item]) => {
    result[`@${key}`] = item;
  });

  if (textContent) {
    result["#text"] = textContent;
  }

  elementChildren.forEach(({ node: childNode }) => {
    const nextValue = markupNodeToJson(childNode);
    const current = result[childNode.name];

    if (current === undefined) {
      result[childNode.name] = nextValue;
      return;
    }

    if (Array.isArray(current)) {
      current.push(nextValue);
      return;
    }

    result[childNode.name] = [current, nextValue];
  });

  return result;
};

const parseMarkupObject = (source: string, mode: "xml" | "html"): JsonValue => {
  const root = parseMarkup(source, mode);

  return {
    [root.name]: markupNodeToJson(root)
  };
};

const escapeMarkupText = (value: string) =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

const escapeMarkupAttribute = (value: string) =>
  escapeMarkupText(value).replace(/"/g, "&quot;");

const renderMarkupNode = ({
  tagName,
  value,
  depth,
  indent,
  mode
}: {
  tagName: string;
  value: JsonValue;
  depth: number;
  indent: number;
  mode: "xml" | "html";
}): string => {
  const pad = " ".repeat(depth * indent);

  if (Array.isArray(value)) {
    return value
      .map((item) =>
        renderMarkupNode({
          tagName,
          value: item,
          depth,
          indent,
          mode
        }),
      )
      .join("\n");
  }

  if (!isJsonObject(value)) {
    return `${pad}<${tagName}>${escapeMarkupText(String(value ?? ""))}</${tagName}>`;
  }

  const attributeEntries = Object.entries(value).filter(([key]) => key.startsWith("@"));
  const textValue =
    typeof value["#text"] === "string" ? (value["#text"] as string) : "";
  const childEntries = Object.entries(value).filter(
    ([key]) => !key.startsWith("@") && key !== "#text",
  );
  const attributes = attributeEntries
    .map(([key, item]) => ` ${key.slice(1)}="${escapeMarkupAttribute(String(item))}"`)
    .join("");

  if (childEntries.length === 0) {
    if (!textValue) {
      if (mode === "html" && htmlVoidTags.has(tagName.toLowerCase())) {
        return `${pad}<${tagName}${attributes}>`;
      }

      return `${pad}<${tagName}${attributes} />`;
    }

    return `${pad}<${tagName}${attributes}>${escapeMarkupText(textValue)}</${tagName}>`;
  }

  const children = childEntries
    .flatMap(([key, item]) =>
      renderMarkupNode({
        tagName: key,
        value: item,
        depth: depth + 1,
        indent,
        mode
      }).split("\n"),
    )
    .filter((item) => item.length > 0);

  const textLine = textValue
    ? `${" ".repeat((depth + 1) * indent)}${escapeMarkupText(textValue)}`
    : "";

  return [
    `${pad}<${tagName}${attributes}>`,
    textLine,
    ...children,
    `${pad}</${tagName}>`
  ]
    .filter((item) => item.length > 0)
    .join("\n");
};

const stringifyMarkup = (
  value: JsonValue,
  mode: "xml" | "html",
  indent: number,
) => {
  if (!isJsonObject(value)) {
    throw new Error("只有对象结构可以转换为标记格式。");
  }

  const entries = Object.entries(value);

  if (entries.length !== 1) {
    throw new Error("XML / HTML 需要单个根节点对象。");
  }

  const [tagName, rootValue] = entries[0]!;

  return renderMarkupNode({
    tagName,
    value: rootValue,
    depth: 0,
    indent,
    mode
  });
};

const parseHttp = (source: string): JsonValue => {
  const lines = source.split(/\r?\n/);
  const firstLine = lines[0]?.trim();

  if (!firstLine) {
    throw new Error("HTTP 内容为空。");
  }

  const separatorIndex = lines.findIndex((line, index) => index > 0 && line.trim() === "");
  const headerLines = lines.slice(1, separatorIndex >= 0 ? separatorIndex : lines.length);
  const body = separatorIndex >= 0 ? lines.slice(separatorIndex + 1).join("\n") : "";
  const headers = Object.fromEntries(
    headerLines
      .filter((line) => line.trim().length > 0)
      .map((line) => {
        const colonIndex = line.indexOf(":");

        if (colonIndex < 0) {
          throw new Error(`无效的 HTTP 头: ${line}`);
        }

        return [
          line.slice(0, colonIndex).trim(),
          line.slice(colonIndex + 1).trim()
        ];
      }),
  );

  const contentType =
    headers["Content-Type"] ??
    headers["content-type"] ??
    headers["contentType"] ??
    "";
  let parsedBody: JsonValue = body;

  if (body.trim()) {
    if (contentType.includes("json") || /^[[{"]/.test(body.trim())) {
      try {
        parsedBody = JSON.parse(body) as JsonValue;
      } catch {
        parsedBody = body;
      }
    }
  }

  const requestMatch = firstLine.match(/^([A-Z]+)\s+(\S+)\s+(HTTP\/\d(?:\.\d)?)$/);

  if (requestMatch) {
    return {
      kind: "request",
      method: requestMatch[1]!,
      target: requestMatch[2]!,
      version: requestMatch[3]!,
      headers,
      body: parsedBody
    };
  }

  const responseMatch = firstLine.match(/^(HTTP\/\d(?:\.\d)?)\s+(\d{3})(?:\s+(.+))?$/);

  if (responseMatch) {
    return {
      kind: "response",
      version: responseMatch[1]!,
      statusCode: Number(responseMatch[2]),
      statusText: responseMatch[3] ?? "",
      headers,
      body: parsedBody
    };
  }

  throw new Error("无法识别 HTTP 起始行。");
};

const stringifyHttp = (value: JsonValue, indent: number) => {
  if (!isJsonObject(value)) {
    throw new Error("只有对象结构可以转换为 HTTP。");
  }

  const isRequest =
    value.kind === "request" ||
    (typeof value.method === "string" &&
      typeof value.target === "string" &&
      typeof value.version === "string");
  const isResponse =
    value.kind === "response" ||
    (typeof value.version === "string" &&
      typeof value.statusCode === "number");

  if (!isRequest && !isResponse) {
    throw new Error("当前对象不符合 HTTP 请求或响应结构。");
  }

  const headers = isJsonObject(value.headers) ? { ...value.headers } : {};
  const body = value.body;
  let bodyText = "";

  if (body !== undefined && body !== "") {
    if (typeof body === "string") {
      bodyText = body;
    } else {
      bodyText = JSON.stringify(body, null, indent);

      if (!headers["Content-Type"] && !headers["content-type"]) {
        headers["Content-Type"] = "application/json";
      }
    }
  }

  const startLine = isRequest
    ? `${value.method} ${value.target} ${value.version}`
    : `${value.version} ${value.statusCode}${value.statusText ? ` ${value.statusText}` : ""}`;
  const headerText = Object.entries(headers)
    .map(([key, item]) => `${key}: ${String(item)}`)
    .join("\n");

  return [startLine, headerText, bodyText ? "" : null, bodyText]
    .filter((item) => item !== null)
    .join("\n")
    .trimEnd();
};

const detectFormat = (source: string): DataFormat | null => {
  const trimmed = source.trim();

  if (!trimmed) {
    return null;
  }

  if (
    /^([A-Z]+)\s+\S+\s+HTTP\/\d(?:\.\d)?$/m.test(trimmed.split(/\r?\n/, 1)[0] ?? "") ||
    /^HTTP\/\d(?:\.\d)?\s+\d{3}/m.test(trimmed.split(/\r?\n/, 1)[0] ?? "")
  ) {
    return "http";
  }

  if (/^<!doctype html/i.test(trimmed) || /^<html[\s>]/i.test(trimmed)) {
    return "html";
  }

  if (/^<\?xml/i.test(trimmed)) {
    return "xml";
  }

  if (/^<[^!?][^>]*>/.test(trimmed)) {
    return /<(html|head|body|meta|link|script|style)\b/i.test(trimmed)
      ? "html"
      : "xml";
  }

  if (/^[[{"]/.test(trimmed)) {
    try {
      JSON.parse(trimmed);
      return "json";
    } catch {
      void 0;
    }
  }

  const lines = source.split(/\r?\n/).filter((line) => line.trim().length > 0);

  if (
    lines.length >= 2 &&
    lines.slice(0, 2).every((line) => line.includes(","))
  ) {
    return "csv";
  }

  if (
    /^\s*\[\[?.+\]\]?\s*$/m.test(source) ||
    /^\s*[\w.-]+\s*=\s*(\[[^\]]*\]|".*"|'.*'|true|false|[+-]?\d+(?:\.\d+)?)\s*$/m.test(source)
  ) {
    return "toml";
  }

  if (/^\s*[\w.-]+\s*[:=]\s*.+$/m.test(source)) {
    return "properties";
  }

  try {
    const parsed = parseYaml(source);

    if (parsed !== null && parsed !== undefined && typeof parsed !== "string") {
      return "yaml";
    }
  } catch {
    void 0;
  }

  return null;
};

const parseByFormat = (format: DataFormat, source: string): JsonValue => {
  switch (format) {
    case "json":
      return JSON.parse(source) as JsonValue;
    case "yaml":
      return normalizeToJsonValue(parseYaml(source));
    case "toml":
      return parseToml(source);
    case "xml":
      return parseMarkupObject(source, "xml");
    case "csv":
      return parseCsv(source);
    case "properties":
      return parseProperties(source);
    case "html":
      return parseMarkupObject(source, "html");
    case "http":
      return parseHttp(source);
  }
};

const stringifyByFormat = (
  format: DataFormat,
  value: JsonValue,
  indent: number,
) => {
  switch (format) {
    case "json":
      return JSON.stringify(value, null, indent);
    case "yaml":
      return stringifyYaml(value);
    case "toml":
      return stringifyToml(value);
    case "xml":
      return stringifyMarkup(value, "xml", indent);
    case "csv":
      return stringifyCsv(value);
    case "properties":
      return stringifyProperties(value);
    case "html":
      return stringifyMarkup(value, "html", indent);
    case "http":
      return stringifyHttp(value, indent);
  }
};

export const convertDataFormat = (input: FormatConvertInput) => {
  const parsedInput = formatConvertInputSchema.safeParse(input);

  if (!parsedInput.success) {
    return createToolError({
      code: "INVALID_INPUT",
      message: "输入参数不合法。",
      details: parsedInput.error.issues[0]?.message
    });
  }

  const {
    source,
    sourceFormat,
    targetFormat,
    indent
  } = parsedInput.data;
  const detectedFormat =
    sourceFormat === "auto" ? detectFormat(source) : sourceFormat;

  if (!detectedFormat) {
    return createToolError({
      code: "FORMAT_DETECT_FAILED",
      message: "无法自动识别源格式。"
    });
  }

  try {
    const parsed = parseByFormat(detectedFormat, source);
    const result = stringifyByFormat(targetFormat, parsed, indent);

    return createToolSuccess<FormatConvertOutput>({
      sourceFormat: detectedFormat,
      targetFormat,
      result,
      lineCount: result ? result.split("\n").length : 0
    });
  } catch (error) {
    return createToolError({
      code: "FORMAT_CONVERT_FAILED",
      message: "格式转换失败。",
      details: error instanceof Error ? error.message : "未知错误。"
    });
  }
};
