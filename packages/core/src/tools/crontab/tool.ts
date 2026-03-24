import { z } from "../../lib/zod";

import { createToolError, createToolSuccess } from "../../tool-helpers";
import {
  formatDateTime,
  startOfNextMinute,
  startOfNextSecond
} from "../../utils/date";

type CronPrecision = "minute" | "second";
type CronFieldName =
  | "second"
  | "minute"
  | "hour"
  | "dayOfMonth"
  | "month"
  | "dayOfWeek";

interface ParsedCronField {
  raw: string;
  values: number[];
  any: boolean;
}

interface FieldConfig {
  name: CronFieldName;
  min: number;
  max: number;
  names?: Record<string, number>;
}

export interface CronFieldSummary {
  name: CronFieldName;
  label: string;
  raw: string;
  summary: string;
}

export interface CronRunPreview {
  epochMilliseconds: number;
  localDateTime: string;
  utcDateTime: string;
}

export interface CronOutput {
  precision: CronPrecision;
  normalizedExpression: string;
  fields: CronFieldSummary[];
  nextRuns: CronRunPreview[];
}

const fieldLabels: Record<CronFieldName, string> = {
  second: "秒",
  minute: "分钟",
  hour: "小时",
  dayOfMonth: "日",
  month: "月",
  dayOfWeek: "周"
};

const cronInputSchema = z.object({
  expression: z.string().trim().min(1, "请输入 crontab 表达式。"),
  count: z.number().int().min(1).max(20).default(15),
  fromTimestamp: z.number().int().default(() => Date.now())
});

const monthNames: Record<string, number> = {
  JAN: 1,
  FEB: 2,
  MAR: 3,
  APR: 4,
  MAY: 5,
  JUN: 6,
  JUL: 7,
  AUG: 8,
  SEP: 9,
  OCT: 10,
  NOV: 11,
  DEC: 12
};

const weekNames: Record<string, number> = {
  SUN: 0,
  MON: 1,
  TUE: 2,
  WED: 3,
  THU: 4,
  FRI: 5,
  SAT: 6
};

const minutePrecisionFieldConfigs: FieldConfig[] = [
  { name: "minute", min: 0, max: 59 },
  { name: "hour", min: 0, max: 23 },
  { name: "dayOfMonth", min: 1, max: 31 },
  { name: "month", min: 1, max: 12, names: monthNames },
  { name: "dayOfWeek", min: 0, max: 6, names: weekNames }
];

const secondPrecisionFieldConfigs: FieldConfig[] = [
  { name: "second", min: 0, max: 59 },
  ...minutePrecisionFieldConfigs
];

const normalizeNamedValue = (
  token: string,
  names?: Record<string, number>,
  fieldName?: CronFieldName,
): number => {
  const upper = token.toUpperCase();

  if (names?.[upper] !== undefined) {
    return names[upper]!;
  }

  const numeric = Number(token);

  if (!Number.isInteger(numeric)) {
    throw new Error(`字段 ${fieldName ?? ""} 包含非法值: ${token}`);
  }

  if (fieldName === "dayOfWeek" && numeric === 7) {
    return 0;
  }

  return numeric;
};

const describeField = (label: string, raw: string) => {
  if (raw === "*" || raw === "?") {
    return `任意${label}`;
  }

  if (/^\*\/\d+$/.test(raw)) {
    return `每 ${raw.slice(2)} 个${label}`;
  }

  if (raw.includes(",")) {
    return `多个${label}值: ${raw}`;
  }

  if (raw.includes("-") && raw.includes("/")) {
    return `范围步进: ${raw}`;
  }

  if (raw.includes("-")) {
    return `范围: ${raw}`;
  }

  if (raw.includes("/")) {
    return `步进: ${raw}`;
  }

  return `固定${label}: ${raw}`;
};

const parseCronField = (
  raw: string,
  name: CronFieldName,
  min: number,
  max: number,
  names?: Record<string, number>,
): ParsedCronField => {
  const normalized = raw.trim().toUpperCase();

  if (normalized === "*" || normalized === "?") {
    return {
      raw: normalized,
      values: Array.from({ length: max - min + 1 }, (_, index) => index + min),
      any: true
    };
  }

  const values = new Set<number>();

  for (const segment of normalized.split(",")) {
    const [base, stepToken] = segment.split("/");
    const step = stepToken ? Number(stepToken) : 1;
    const segmentBase = base ?? "*";

    if (!Number.isInteger(step) || step <= 0) {
      throw new Error(`${fieldLabels[name]} 的步进值无效: ${segment}`);
    }

    const expandRange = (rangeStart: number, rangeEnd: number) => {
      if (rangeStart < min || rangeEnd > max || rangeStart > rangeEnd) {
        throw new Error(`${fieldLabels[name]} 超出范围: ${segment}`);
      }

      for (let value = rangeStart; value <= rangeEnd; value += step) {
        values.add(value);
      }
    };

    if (segmentBase === "*") {
      expandRange(min, max);
      continue;
    }

    if (segmentBase.includes("-")) {
      const [startToken, endToken] = segmentBase.split("-");
      const rangeStart = normalizeNamedValue(startToken ?? "", names, name);
      const rangeEnd = normalizeNamedValue(endToken ?? "", names, name);

      expandRange(rangeStart, rangeEnd);
      continue;
    }

    const singleValue = normalizeNamedValue(segmentBase, names, name);

    if (singleValue < min || singleValue > max) {
      throw new Error(`${fieldLabels[name]} 超出范围: ${segment}`);
    }

    values.add(singleValue);
  }

  return {
    raw: normalized,
    values: Array.from(values).sort((left, right) => left - right),
    any: false
  };
};

const matchesCron = (
  fields: Partial<Record<CronFieldName, ParsedCronField>>,
  date: Date,
) => {
  const secondMatches =
    !fields.second || fields.second.values.includes(date.getSeconds());
  const minuteMatches = fields.minute?.values.includes(date.getMinutes()) ?? true;
  const hourMatches = fields.hour?.values.includes(date.getHours()) ?? true;
  const dayOfMonth = date.getDate();
  const month = date.getMonth() + 1;
  const dayOfWeek = date.getDay();
  const monthMatches = fields.month?.values.includes(month) ?? true;
  const dayOfMonthMatches =
    fields.dayOfMonth?.values.includes(dayOfMonth) ?? true;
  const dayOfWeekMatches =
    fields.dayOfWeek?.values.includes(dayOfWeek) ?? true;
  const domAny = fields.dayOfMonth?.any ?? true;
  const dowAny = fields.dayOfWeek?.any ?? true;
  const dayMatches =
    domAny && dowAny
      ? true
      : domAny
        ? dayOfWeekMatches
        : dowAny
          ? dayOfMonthMatches
          : dayOfMonthMatches || dayOfWeekMatches;

  return secondMatches && minuteMatches && hourMatches && monthMatches && dayMatches;
};

export const analyzeCrontab = (
  input: z.infer<typeof cronInputSchema>,
) => {
  const parsedInput = cronInputSchema.safeParse(input);

  if (!parsedInput.success) {
    return createToolError({
      code: "INVALID_INPUT",
      message: "Crontab 输入参数不合法。",
      details: parsedInput.error.issues[0]?.message
    });
  }

  const { expression, count, fromTimestamp } = parsedInput.data;
  const parts = expression.trim().split(/\s+/);
  const precision =
    parts.length === 6 ? "second" : parts.length === 5 ? "minute" : null;

  if (!precision) {
    return createToolError({
      code: "INVALID_CRON",
      message: "当前支持 5 位或 6 位 crontab 表达式。",
      details: "分钟级：分 时 日 月 周；秒级：秒 分 时 日 月 周"
    });
  }

  const fieldConfigs =
    precision === "second"
      ? secondPrecisionFieldConfigs
      : minutePrecisionFieldConfigs;

  try {
    const parsedFields = Object.fromEntries(
      fieldConfigs.map((config, index) => [
        config.name,
        parseCronField(
          parts[index] ?? "*",
          config.name,
          config.min,
          config.max,
          config.names,
        )
      ]),
    ) as Partial<Record<CronFieldName, ParsedCronField>>;
    const fields = fieldConfigs.map((config, index) => ({
      name: config.name,
      label: fieldLabels[config.name],
      raw: parts[index] ?? "*",
      summary: describeField(fieldLabels[config.name], parts[index] ?? "*")
    }));
    const nextRuns: CronRunPreview[] = [];
    let cursor =
      precision === "second"
        ? startOfNextSecond(fromTimestamp)
        : startOfNextMinute(fromTimestamp);
    let inspected = 0;
    const maxIterations =
      precision === "second" ? 2_592_000 : 1_051_200;
    const step = precision === "second" ? 1_000 : 60_000;

    while (nextRuns.length < count && inspected < maxIterations) {
      const date = new Date(cursor);

      if (matchesCron(parsedFields, date)) {
        nextRuns.push({
          epochMilliseconds: cursor,
          localDateTime: formatDateTime(date, "local", precision === "second"),
          utcDateTime: formatDateTime(date, "utc", precision === "second")
        });
      }

      cursor += step;
      inspected += 1;
    }

    if (nextRuns.length < count) {
      throw new Error("在可接受的时间范围内没有找到足够多的执行时间。");
    }

    return createToolSuccess<CronOutput>({
      precision,
      normalizedExpression: parts.join(" "),
      fields,
      nextRuns
    });
  } catch (error) {
    return createToolError({
      code: "INVALID_CRON",
      message: "Crontab 解析失败。",
      details: error instanceof Error ? error.message : "未知错误。"
    });
  }
};
