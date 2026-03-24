import { z } from "../../lib/zod";

import { createToolError, createToolSuccess } from "../../tool-helpers";
import { formatDateTime } from "../../utils/date";

const snowflakeInputSchema = z.object({
  workerId: z.number().int().min(0).max(31).default(1),
  datacenterId: z.number().int().min(0).max(31).default(1),
  count: z.number().int().min(1).max(20).default(5),
  sequenceStart: z.number().int().min(0).max(4095).default(0),
  timestamp: z.number().int().default(() => Date.now()),
  epoch: z.number().int().positive().default(1_288_834_974_657)
});

export interface SnowflakeItem {
  id: string;
  timestamp: number;
  localDateTime: string;
  datacenterId: number;
  workerId: number;
  sequence: number;
}

export interface SnowflakeOutput {
  items: SnowflakeItem[];
}

const workerShift = 12n;
const datacenterShift = 17n;
const timestampShift = 22n;
const sequenceMask = 4095;

export const generateSnowflakeIds = (
  input: z.infer<typeof snowflakeInputSchema>,
) => {
  const parsedInput = snowflakeInputSchema.safeParse(input);

  if (!parsedInput.success) {
    return createToolError({
      code: "INVALID_INPUT",
      message: "雪花 ID 输入参数不合法。",
      details: parsedInput.error.issues[0]?.message
    });
  }

  const { workerId, datacenterId, count, sequenceStart, timestamp, epoch } =
    parsedInput.data;

  if (timestamp < epoch) {
    return createToolError({
      code: "INVALID_TIMESTAMP",
      message: "时间戳不能早于自定义纪元。"
    });
  }

  try {
    const items: SnowflakeItem[] = [];
    let currentTimestamp = timestamp;
    let sequence = sequenceStart;

    for (let index = 0; index < count; index += 1) {
      if (sequence > sequenceMask) {
        currentTimestamp += 1;
        sequence = 0;
      }

      const id =
        ((BigInt(currentTimestamp - epoch) << timestampShift) |
          (BigInt(datacenterId) << datacenterShift) |
          (BigInt(workerId) << workerShift) |
          BigInt(sequence)).toString();

      items.push({
        id,
        timestamp: currentTimestamp,
        localDateTime: formatDateTime(new Date(currentTimestamp), "local"),
        datacenterId,
        workerId,
        sequence
      });

      sequence += 1;
    }

    return createToolSuccess<SnowflakeOutput>({ items });
  } catch (error) {
    return createToolError({
      code: "SNOWFLAKE_FAILED",
      message: "雪花 ID 生成失败。",
      details: error instanceof Error ? error.message : "未知错误。"
    });
  }
};
