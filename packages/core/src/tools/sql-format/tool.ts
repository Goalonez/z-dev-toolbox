import { z } from "../../lib/zod";

import { createToolError, createToolSuccess } from "../../tool-helpers";

import {
  format as formatSqlWithLibrary,
  supportedDialects,
  type IdentifierCase,
  type KeywordCase,
  type SqlLanguage,
} from "sql-formatter";

export const sqlFormatModeSchema = z.enum(["pretty", "compact"]);
export const sqlKeywordCaseSchema = z.enum(["preserve", "upper", "lower"]);
export const sqlIdentifierCaseSchema = z.enum(["preserve", "upper", "lower"]);

const supportedDialectSet = new Set(supportedDialects);

export const sqlDialectSchema = z.custom<SqlLanguage>(
  (value) => typeof value === "string" && supportedDialectSet.has(value),
  {
    message: "不支持的 SQL 方言。",
  },
);

export type SqlFormatMode = z.infer<typeof sqlFormatModeSchema>;
export type SqlKeywordCase = z.infer<typeof sqlKeywordCaseSchema>;
export type SqlIdentifierCase = z.infer<typeof sqlIdentifierCaseSchema>;
export type SqlDialect = z.infer<typeof sqlDialectSchema>;

export const sqlFormatInputSchema = z.object({
  source: z.string().min(1, "请输入 SQL 内容。"),
  mode: sqlFormatModeSchema.default("pretty"),
  dialect: sqlDialectSchema.default("sql"),
  tabWidth: z.number().int().min(1).max(8).default(2),
  keywordCase: sqlKeywordCaseSchema.default("preserve"),
  identifierCase: sqlIdentifierCaseSchema.default("preserve"),
});

export type SqlFormatInput = z.infer<typeof sqlFormatInputSchema>;

export interface SqlFormatOutput {
  formatted: string;
  lineCount: number;
  dialect: SqlDialect;
  mode: SqlFormatMode;
  tabWidth: number;
  keywordCase: SqlKeywordCase;
  identifierCase: SqlIdentifierCase;
}

const formatCompactSql = (value: string) =>
  value
    .replace(/\s+/g, " ")
    .replace(/\s*([(),;])\s*/g, "$1 ")
    .replace(/\s+/g, " ")
    .trim();

const normalizeCompactResult = (value: string) =>
  formatCompactSql(value).replace(/\s*;$/u, ";").trim();

const normalizeFormattedResult = (value: string, mode: SqlFormatMode) =>
  mode === "compact" ? normalizeCompactResult(value) : value.trim();

const toLineCount = (value: string) => (value ? value.split("\n").length : 0);

export const formatSql = (input: SqlFormatInput) => {
  const parsedInput = sqlFormatInputSchema.safeParse(input);

  if (!parsedInput.success) {
    return createToolError({
      code: "INVALID_INPUT",
      message: "SQL 输入参数不合法。",
      details: parsedInput.error.issues[0]?.message,
    });
  }

  const { source, mode, dialect, tabWidth, keywordCase, identifierCase } =
    parsedInput.data;

  try {
    const formatted = formatSqlWithLibrary(source, {
      language: dialect,
      tabWidth,
      keywordCase: keywordCase as KeywordCase,
      identifierCase: identifierCase as IdentifierCase,
    });
    const normalized = normalizeFormattedResult(formatted, mode);

    if (!normalized) {
      return createToolError({
        code: "FORMAT_EMPTY_RESULT",
        message: "格式化结果为空。",
      });
    }

    return createToolSuccess<SqlFormatOutput>({
      formatted: normalized,
      lineCount: toLineCount(normalized),
      dialect,
      mode,
      tabWidth,
      keywordCase,
      identifierCase,
    });
  } catch (error) {
    return createToolError({
      code: "INVALID_SQL",
      message: "SQL 格式化失败。",
      details: error instanceof Error ? error.message : "未知错误。",
    });
  }
};

export const sqlDialectOptions = supportedDialects as SqlDialect[];
