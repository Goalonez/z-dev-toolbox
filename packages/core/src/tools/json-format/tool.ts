import { z } from "../../lib/zod";

import { createToolError, createToolSuccess } from "../../tool-helpers";

export const jsonFormatModeSchema = z.enum([
  "pretty",
  "compact",
]);
export const jsonSortOrderSchema = z.enum(["none", "asc", "desc"]);
export const jsonKeyNamingSchema = z.enum([
  "preserve",
  "camel",
  "pascal",
  "snake",
  "kebab",
  "constant",
]);
export const jsonEscapeModeSchema = z.enum(["none", "escape", "unescape"]);

export type JsonFormatMode = z.infer<typeof jsonFormatModeSchema>;
export type JsonSortOrder = z.infer<typeof jsonSortOrderSchema>;
export type JsonKeyNaming = z.infer<typeof jsonKeyNamingSchema>;
export type JsonEscapeMode = z.infer<typeof jsonEscapeModeSchema>;

export type JsonValue =
  | string
  | number
  | boolean
  | null
  | JsonValue[]
  | {
      [key: string]: JsonValue;
    };

export const jsonFormatInputSchema = z.object({
  source: z.string().min(1, "请输入 JSON 内容。"),
  indent: z.number().int().min(0).max(8).default(2),
  mode: jsonFormatModeSchema.default("pretty"),
  escapeMode: jsonEscapeModeSchema.default("none"),
  sortOrder: jsonSortOrderSchema.default("none"),
  keyNaming: jsonKeyNamingSchema.default("preserve"),
});

export type JsonFormatInput = z.infer<typeof jsonFormatInputSchema>;

export interface JsonFormatOutput {
  formatted: string;
  lineCount: number;
  sortOrder: JsonSortOrder;
  value: JsonValue;
  objectCount: number;
  arrayCount: number;
}

const isJsonObject = (
  value: JsonValue,
): value is { [key: string]: JsonValue } =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const toTitleCase = (value: string) =>
  value.charAt(0).toUpperCase() + value.slice(1);

const splitKeyWords = (value: string) => {
  const normalized = value
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/([A-Z])([A-Z][a-z])/g, "$1 $2")
    .replace(/[^A-Za-z0-9]+/g, " ")
    .trim();

  if (!normalized) {
    return [];
  }

  return normalized.split(/\s+/).map((item) => item.toLowerCase());
};

const renameKey = (key: string, naming: JsonKeyNaming) => {
  if (naming === "preserve") {
    return key;
  }

  const words = splitKeyWords(key);

  if (words.length === 0) {
    return key;
  }

  if (naming === "camel") {
    return words
      .map((word, index) => (index === 0 ? word : toTitleCase(word)))
      .join("");
  }

  if (naming === "pascal") {
    return words.map(toTitleCase).join("");
  }

  if (naming === "snake") {
    return words.join("_");
  }

  if (naming === "kebab") {
    return words.join("-");
  }

  return words.join("_").toUpperCase();
};

const transformJsonKeys = (
  value: JsonValue,
  naming: JsonKeyNaming,
): JsonValue => {
  if (Array.isArray(value)) {
    return value.map((item) => transformJsonKeys(item, naming));
  }

  if (!isJsonObject(value)) {
    return value;
  }

  return Object.entries(value).reduce<{ [key: string]: JsonValue }>(
    (result, [key, item]) => {
      result[renameKey(key, naming)] = transformJsonKeys(item, naming);
      return result;
    },
    {},
  );
};

const jsonKeyCollator = new Intl.Collator(undefined, {
  numeric: false,
  sensitivity: "variant",
});

const sortJsonObjectEntries = (
  entries: Array<[string, JsonValue]>,
  sortOrder: JsonSortOrder,
) => {
  if (sortOrder === "none") {
    return entries;
  }

  return [...entries].sort(([left], [right]) =>
    sortOrder === "asc"
      ? jsonKeyCollator.compare(left, right)
      : jsonKeyCollator.compare(right, left),
  );
};

const countContainers = (
  value: JsonValue,
): {
  objectCount: number;
  arrayCount: number;
} => {
  if (Array.isArray(value)) {
    return value.reduce<{
      objectCount: number;
      arrayCount: number;
    }>(
      (result, item) => {
        const nested = countContainers(item);

        return {
          objectCount: result.objectCount + nested.objectCount,
          arrayCount: result.arrayCount + nested.arrayCount,
        };
      },
      {
        objectCount: 0,
        arrayCount: 1,
      },
    );
  }

  if (!isJsonObject(value)) {
    return {
      objectCount: 0,
      arrayCount: 0,
    };
  }

  return Object.values(value).reduce<{
    objectCount: number;
    arrayCount: number;
  }>(
    (result, item) => {
      const nested = countContainers(item);

      return {
        objectCount: result.objectCount + nested.objectCount,
        arrayCount: result.arrayCount + nested.arrayCount,
      };
    },
    {
      objectCount: 1,
      arrayCount: 0,
    },
  );
};

const normalizeLooseEscapedString = (value: string) =>
  value
    .replace(/\\\\/g, "\\")
    .replace(/\\"/g, '"')
    .replace(/\\n/g, "\n")
    .replace(/\\r/g, "\r")
    .replace(/\\t/g, "\t")
    .replace(/\\\//g, "/");

const parseEscapedJson = (source: string): JsonValue => {
  try {
    const parsed = JSON.parse(source) as JsonValue;

    if (typeof parsed !== "string") {
      return parsed;
    }

    try {
      return JSON.parse(parsed) as JsonValue;
    } catch {
      return parsed;
    }
  } catch {
    const looseValue = normalizeLooseEscapedString(source);

    try {
      return JSON.parse(looseValue) as JsonValue;
    } catch {
      return looseValue;
    }
  }
};

const stringifyJsonValue = ({
  value,
  indent,
  depth,
  compact,
  sortOrder,
}: {
  value: JsonValue;
  indent: number;
  depth: number;
  compact: boolean;
  sortOrder: JsonSortOrder;
}): string => {
  if (!Array.isArray(value) && !isJsonObject(value)) {
    return JSON.stringify(value);
  }

  const shouldCompact = compact || indent <= 0;

  if (Array.isArray(value)) {
    if (value.length === 0) {
      return "[]";
    }

    if (shouldCompact) {
      return `[${value
        .map((item) =>
          stringifyJsonValue({
            value: item,
            indent,
            depth: depth + 1,
            compact: true,
            sortOrder,
          }),
        )
        .join(",")}]`;
    }

    const currentIndent = " ".repeat(depth * indent);
    const childIndent = " ".repeat((depth + 1) * indent);

    return `[
${value
  .map(
    (item) =>
      `${childIndent}${stringifyJsonValue({
        value: item,
        indent,
        depth: depth + 1,
        compact: false,
        sortOrder,
      })}`,
  )
  .join(",\n")}
${currentIndent}]`;
  }

  const entries = sortJsonObjectEntries(Object.entries(value), sortOrder);

  if (entries.length === 0) {
    return "{}";
  }

  if (shouldCompact) {
    return `{${entries
      .map(
        ([key, item]) =>
          `${JSON.stringify(key)}:${stringifyJsonValue({
            value: item,
            indent,
            depth: depth + 1,
            compact: true,
            sortOrder,
          })}`,
      )
      .join(",")}}`;
  }

  const currentIndent = " ".repeat(depth * indent);
  const childIndent = " ".repeat((depth + 1) * indent);

  return `{
${entries
  .map(
    ([key, item]) =>
      `${childIndent}${JSON.stringify(key)}: ${stringifyJsonValue({
        value: item,
        indent,
        depth: depth + 1,
        compact: false,
        sortOrder,
      })}`,
  )
  .join(",\n")}
${currentIndent}}`;
};

const escapeJsonText = (value: string) =>
  value.replace(/\\/g, "\\\\").replace(/"/g, '\\"');

const stringifyJson = (
  value: JsonValue,
  mode: JsonFormatMode,
  indent: number,
  sortOrder: JsonSortOrder,
) => {
  if (mode === "compact") {
    return stringifyJsonValue({
      value,
      indent,
      depth: 0,
      compact: true,
      sortOrder,
    });
  }

  return stringifyJsonValue({
    value,
    indent,
    depth: 0,
    compact: false,
    sortOrder,
  });
};

export const formatJson = (input: JsonFormatInput) => {
  const parsedInput = jsonFormatInputSchema.safeParse(input);

  if (!parsedInput.success) {
    return createToolError({
      code: "INVALID_INPUT",
      message: "输入参数不合法。",
      details: parsedInput.error.issues[0]?.message,
    });
  }

  const { source, indent, mode, escapeMode, sortOrder, keyNaming } =
    parsedInput.data;

  try {
    const parsed =
      escapeMode === "unescape"
        ? parseEscapedJson(source)
        : (JSON.parse(source) as JsonValue);
    const transformed = transformJsonKeys(parsed, keyNaming);
    const formattedJson = stringifyJson(transformed, mode, indent, sortOrder);
    const formatted =
      escapeMode === "escape" ? escapeJsonText(formattedJson) : formattedJson;

    if (!formatted) {
      return createToolError({
        code: "FORMAT_EMPTY_RESULT",
        message: "格式化结果为空。",
      });
    }

    const { objectCount, arrayCount } = countContainers(transformed);

    return createToolSuccess<JsonFormatOutput>({
      formatted,
      lineCount: formatted.split("\n").length,
      sortOrder,
      value: transformed,
      objectCount,
      arrayCount,
    });
  } catch (error) {
    return createToolError({
      code: "INVALID_JSON",
      message: "JSON 解析失败。",
      details: error instanceof Error ? error.message : "未知错误。",
    });
  }
};
