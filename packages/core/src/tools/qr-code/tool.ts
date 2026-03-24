import { z } from "../../lib/zod";
import { toString } from "qrcode";

import { createToolError, createToolSuccess } from "../../tool-helpers";

const qrCodeInputSchema = z.object({
  text: z.string().trim().min(1, "请输入二维码内容。"),
  size: z.number().int().min(160).max(512).default(224),
  margin: z.number().int().min(0).max(8).default(1),
  darkColor: z.string().default("#1F2937"),
  lightColor: z.string().default("#FFFFFFFF"),
  errorCorrectionLevel: z.enum(["L", "M", "Q", "H"]).default("M")
});

export interface QrCodeOutput {
  svg: string;
}

export const generateQrCode = async (
  input: z.infer<typeof qrCodeInputSchema>,
) => {
  const parsedInput = qrCodeInputSchema.safeParse(input);

  if (!parsedInput.success) {
    return createToolError({
      code: "INVALID_INPUT",
      message: "二维码输入参数不合法。",
      details: parsedInput.error.issues[0]?.message
    });
  }

  try {
    const { text, size, margin, darkColor, lightColor, errorCorrectionLevel } =
      parsedInput.data;
    const svg = await toString(text, {
      type: "svg",
      width: size,
      margin,
      errorCorrectionLevel,
      color: {
        dark: darkColor,
        light: lightColor
      }
    });

    return createToolSuccess<QrCodeOutput>({ svg });
  } catch (error) {
    return createToolError({
      code: "QR_CODE_FAILED",
      message: "二维码生成失败。",
      details: error instanceof Error ? error.message : "未知错误。"
    });
  }
};
