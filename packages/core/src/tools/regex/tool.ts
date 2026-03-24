import { z } from "../../lib/zod";

import { createToolError, createToolSuccess } from "../../tool-helpers";

export interface RegexMatchItem {
  value: string;
  index: number;
  groups: string[];
  namedGroups: Record<string, string>;
}

export interface RegexOutput {
  matchCount: number;
  matches: RegexMatchItem[];
  replaced: string;
}

const regexInputSchema = z.object({
  pattern: z.string().min(1, "请输入正则表达式。"),
  flags: z.string().default(""),
  source: z.string().default(""),
  replacement: z.string().default("")
});

const supportedFlags = new Set(["d", "g", "i", "m", "s", "u", "y"]);

const normalizeFlags = (value: string) => {
  const chars = value.split("");
  const deduped = new Set<string>();

  for (const char of chars) {
    if (!supportedFlags.has(char)) {
      throw new Error(`不支持的 flags: ${char}`);
    }

    if (deduped.has(char)) {
      throw new Error(`重复的 flags: ${char}`);
    }

    deduped.add(char);
  }

  return Array.from(deduped).join("");
};

export const evaluateRegex = (input: z.infer<typeof regexInputSchema>) => {
  const parsedInput = regexInputSchema.safeParse(input);

  if (!parsedInput.success) {
    return createToolError({
      code: "INVALID_INPUT",
      message: "正则输入参数不合法。",
      details: parsedInput.error.issues[0]?.message
    });
  }

  try {
    const { pattern, source, replacement } = parsedInput.data;
    const flags = normalizeFlags(parsedInput.data.flags);
    const regex = new RegExp(pattern, flags);
    const flagsForMatches = flags.includes("g") ? flags : `${flags}g`;
    const matchRegex = new RegExp(pattern, flagsForMatches);
    const matches = Array.from(source.matchAll(matchRegex)).slice(0, 200);

    return createToolSuccess<RegexOutput>({
      matchCount: matches.length,
      matches: matches.map((item) => ({
        value: item[0] ?? "",
        index: item.index ?? 0,
        groups: item.slice(1).map((group) => group ?? ""),
        namedGroups:
          Object.fromEntries(
            Object.entries(item.groups ?? {}).map(([key, value]) => [
              key,
              value ?? ""
            ]),
          ) ?? {}
      })),
      replaced: replacement ? source.replace(regex, replacement) : source
    });
  } catch (error) {
    return createToolError({
      code: "REGEX_FAILED",
      message: "正则表达式执行失败。",
      details: error instanceof Error ? error.message : "未知错误。"
    });
  }
};
