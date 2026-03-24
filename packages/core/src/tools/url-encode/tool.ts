import { z } from "../../lib/zod";

import { createToolError, createToolSuccess } from "../../tool-helpers";

export const urlEncodeInputSchema = z.object({
  source: z.string().default(""),
  mode: z.enum(["encode", "decode"]).default("encode"),
  spaceMode: z.enum(["percent", "plus"]).default("percent")
});

export type UrlEncodeInput = z.infer<typeof urlEncodeInputSchema>;

export interface UrlEncodeOutput {
  result: string;
  length: number;
}

export const transformUrlEncoding = (input: UrlEncodeInput) => {
  const parsedInput = urlEncodeInputSchema.safeParse(input);

  if (!parsedInput.success) {
    return createToolError({
      code: "INVALID_INPUT",
      message: "URL 编码输入参数不合法。",
      details: parsedInput.error.issues[0]?.message
    });
  }

  const { source, mode, spaceMode } = parsedInput.data;

  try {
    const result =
      mode === "encode"
        ? encodeURIComponent(source).replace(
            /%20/g,
            spaceMode === "plus" ? "+" : "%20",
          )
        : decodeURIComponent(
            spaceMode === "plus" ? source.replace(/\+/g, " ") : source,
          );

    return createToolSuccess<UrlEncodeOutput>({
      result,
      length: result.length
    });
  } catch (error) {
    return createToolError({
      code: "URL_TRANSFORM_FAILED",
      message: "URL 编码处理失败。",
      details: error instanceof Error ? error.message : "未知错误。"
    });
  }
};
