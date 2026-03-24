import { z } from "../../lib/zod";

import { createToolError, createToolSuccess } from "../../tool-helpers";
import {
  base64ToBytes,
  bytesToBase64,
  bytesToText,
  textToBytes
} from "../../utils/bytes";

export const base64InputSchema = z.object({
  source: z.string().default(""),
  mode: z.enum(["encode", "decode"]).default("encode"),
  contentType: z.enum(["text", "image"]).default("text"),
  urlSafe: z.boolean().default(false),
  imageBytes: z.array(z.number().int().min(0).max(255)).optional(),
  imageMimeType: z.string().default("image/png")
});

export type Base64Input = z.infer<typeof base64InputSchema>;

export interface Base64Output {
  result: string;
  characterCount: number;
  byteLength: number;
  outputKind: "text" | "base64" | "image";
  mimeType?: string;
  dataUrl?: string;
}

const DEFAULT_TEXT_MIME_TYPE = "text/plain;charset=utf-8";

const htmlMimeType = "text/html;charset=utf-8";
const jsonMimeType = "application/json;charset=utf-8";
const xmlMimeType = "application/xml;charset=utf-8";
const csvMimeType = "text/csv;charset=utf-8";

const toUrlSafe = (value: string) =>
  value.replace(/\+/g, "-").replace(/\//g, "_");

const fromUrlSafe = (value: string) => {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const missing = normalized.length % 4;

  if (!missing) {
    return normalized;
  }

  return normalized.padEnd(normalized.length + (4 - missing), "=");
};

const parseBase64Source = (value: string) => {
  const trimmed = value.trim();
  const dataUrlMatch = trimmed.match(/^data:([^,]+);base64,(.+)$/i);

  if (!dataUrlMatch) {
    return {
      base64: trimmed,
      mimeType: null as string | null
    };
  }

  return {
    base64: dataUrlMatch[2] ?? "",
    mimeType: dataUrlMatch[1] ?? null
  };
};

const isImageMimeType = (value: string | null | undefined) => {
  if (!value) {
    return false;
  }

  return value.split(";", 1)[0]?.trim().startsWith("image/") ?? false;
};

const detectTextMimeType = (source: string) => {
  const trimmed = source.trim();

  if (!trimmed) {
    return DEFAULT_TEXT_MIME_TYPE;
  }

  if (
    /^<svg[\s>]/i.test(trimmed) ||
    (/^<\?xml/i.test(trimmed) && /<svg[\s>]/i.test(trimmed))
  ) {
    return "image/svg+xml";
  }

  if (/^<!doctype html/i.test(trimmed) || /^<html[\s>]/i.test(trimmed)) {
    return htmlMimeType;
  }

  if (/^<\?xml/i.test(trimmed)) {
    return xmlMimeType;
  }

  if (/^<[^!?][^>]*>/.test(trimmed)) {
    return /<(html|head|body|meta|link|script|style|main|section|article|header|footer|nav|div|span|p|a|button|form|input|table|ul|ol|li)\b/i.test(trimmed)
      ? htmlMimeType
      : xmlMimeType;
  }

  if (/^[[{"]/.test(trimmed)) {
    try {
      JSON.parse(trimmed);
      return jsonMimeType;
    } catch {
      void 0;
    }
  }

  const lines = source.split(/\r?\n/).filter((line) => line.trim().length > 0);

  if (
    lines.length >= 2 &&
    lines.slice(0, Math.min(lines.length, 3)).every((line) => line.includes(","))
  ) {
    return csvMimeType;
  }

  return DEFAULT_TEXT_MIME_TYPE;
};

const guessImageMimeType = (bytes: Uint8Array) => {
  if (
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47
  ) {
    return "image/png";
  }

  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return "image/jpeg";
  }

  if (
    bytes[0] === 0x47 &&
    bytes[1] === 0x49 &&
    bytes[2] === 0x46 &&
    bytes[3] === 0x38
  ) {
    return "image/gif";
  }

  if (
    bytes[0] === 0x52 &&
    bytes[1] === 0x49 &&
    bytes[2] === 0x46 &&
    bytes[3] === 0x46 &&
    bytes[8] === 0x57 &&
    bytes[9] === 0x45 &&
    bytes[10] === 0x42 &&
    bytes[11] === 0x50
  ) {
    return "image/webp";
  }

  try {
    const asText = bytesToText(bytes).trimStart();

    if (asText.startsWith("<svg") || asText.startsWith("<?xml")) {
      return "image/svg+xml";
    }
  } catch {
    return null;
  }

  return null;
};

export const transformBase64 = (input: Base64Input) => {
  const parsedInput = base64InputSchema.safeParse(input);

  if (!parsedInput.success) {
    return createToolError({
      code: "INVALID_INPUT",
      message: "Base64 输入参数不合法。",
      details: parsedInput.error.issues[0]?.message
    });
  }

  const { source, mode, contentType, urlSafe, imageBytes, imageMimeType } = parsedInput.data;

  try {
    if (mode === "encode") {
      const rawBytes =
        contentType === "image"
          ? new Uint8Array(imageBytes ?? [])
          : textToBytes(source);

      if (contentType === "image" && rawBytes.length === 0) {
        throw new Error("请先提供图片内容。");
      }

      const encoded = bytesToBase64(rawBytes);
      const result = urlSafe ? toUrlSafe(encoded) : encoded;

      return createToolSuccess<Base64Output>({
        result,
        characterCount: result.length,
        byteLength: rawBytes.length,
        outputKind: "base64",
        mimeType:
          contentType === "image"
            ? imageMimeType
            : detectTextMimeType(source)
      });
    }

    const parsedSource = parseBase64Source(source);
    const normalized = fromUrlSafe(parsedSource.base64.replace(/\s+/g, ""));
    const decodedBytes = base64ToBytes(normalized);

    const detectedImageMimeType =
      (isImageMimeType(parsedSource.mimeType) ? parsedSource.mimeType : null) ??
      guessImageMimeType(decodedBytes);

    if (detectedImageMimeType) {
      const mimeType = detectedImageMimeType ?? imageMimeType;

      return createToolSuccess<Base64Output>({
        result: parsedSource.base64.replace(/\s+/g, ""),
        characterCount: parsedSource.base64.replace(/\s+/g, "").length,
        byteLength: decodedBytes.length,
        outputKind: "image",
        mimeType,
        dataUrl: `data:${mimeType};base64,${bytesToBase64(decodedBytes)}`
      });
    }

    const decoded = bytesToText(decodedBytes);

    return createToolSuccess<Base64Output>({
      result: decoded,
      characterCount: decoded.length,
      byteLength: textToBytes(decoded).length,
      outputKind: "text"
    });
  } catch (error) {
    return createToolError({
      code: "INVALID_BASE64",
      message: "Base64 处理失败。",
      details: error instanceof Error ? error.message : "未知错误。"
    });
  }
};
