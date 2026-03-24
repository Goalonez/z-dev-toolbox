import { z } from "../../lib/zod";

import { createToolError, createToolSuccess } from "../../tool-helpers";
import { formatDateTime } from "../../utils/date";

export const timestampInputSchema = z.object({
  value: z.string().trim().min(1, "请输入时间戳或日期时间。"),
  source: z.enum(["auto", "timestamp", "datetime"]).default("auto")
});

export type TimestampInput = z.infer<typeof timestampInputSchema>;

export interface TimestampOutput {
  inputKind: "seconds" | "milliseconds" | "datetime";
  epochMilliseconds: number;
  epochSeconds: number;
  isoString: string;
  localDateTime: string;
  utcDateTime: string;
  localDateTimeWithMilliseconds: string;
  utcDateTimeWithMilliseconds: string;
}

const parseTimestampValue = (value: string) => {
  if (!/^-?\d+$/.test(value)) {
    return null;
  }

  const numeric = Number(value);

  if (!Number.isFinite(numeric)) {
    throw new Error("时间戳超出可解析范围。");
  }

  if (value.length <= 10) {
    return {
      epochMilliseconds: numeric * 1000,
      inputKind: "seconds" as const,
    };
  }

  if (value.length <= 13) {
    return {
      epochMilliseconds: numeric,
      inputKind: "milliseconds" as const,
    };
  }

  throw new Error("仅支持 10 位秒级或 13 位毫秒级时间戳。");
};

const parseDateValue = (value: string) => {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    throw new Error("日期时间格式无法识别。");
  }

  return date.getTime();
};

export const convertTimestamp = (input: TimestampInput) => {
  const parsedInput = timestampInputSchema.safeParse(input);

  if (!parsedInput.success) {
    return createToolError({
      code: "INVALID_INPUT",
      message: "时间戳输入参数不合法。",
      details: parsedInput.error.issues[0]?.message
    });
  }

  const { value, source } = parsedInput.data;

  try {
    const parsedTimestamp =
      source === "datetime"
        ? null
        : source === "timestamp"
          ? parseTimestampValue(value)
          : parseTimestampValue(value);
    const epochMilliseconds =
      source === "datetime"
        ? parseDateValue(value)
        : source === "timestamp"
          ? parsedTimestamp?.epochMilliseconds ?? null
          : parsedTimestamp?.epochMilliseconds ?? parseDateValue(value);

    if (epochMilliseconds === null) {
      throw new Error("时间戳格式无法识别。");
    }

    const date = new Date(epochMilliseconds);

    return createToolSuccess<TimestampOutput>({
      inputKind: parsedTimestamp?.inputKind ?? "datetime",
      epochMilliseconds,
      epochSeconds: Math.floor(epochMilliseconds / 1000),
      isoString: date.toISOString(),
      localDateTime: formatDateTime(date, "local"),
      utcDateTime: formatDateTime(date, "utc"),
      localDateTimeWithMilliseconds: formatDateTime(date, "local", true),
      utcDateTimeWithMilliseconds: formatDateTime(date, "utc", true),
    });
  } catch (error) {
    return createToolError({
      code: "TIMESTAMP_CONVERT_FAILED",
      message: "时间戳转换失败。",
      details: error instanceof Error ? error.message : "未知错误。"
    });
  }
};
