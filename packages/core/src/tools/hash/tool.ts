import { z } from "../../lib/zod";

import { createToolError, createToolSuccess } from "../../tool-helpers";
import { bytesToBase64, bytesToHex, textToBytes } from "../../utils/bytes";
import { hashMd5, hashSm3 } from "../../utils/hash";

const algorithms = ["MD5", "SHA-1", "SHA-256", "SHA-384", "SHA-512", "SM3"] as const;

type HashAlgorithm = (typeof algorithms)[number];

export interface HashItem {
  algorithm: HashAlgorithm;
  hex: string;
  base64: string;
}

export interface HashOutput {
  items: HashItem[];
}

const hashInputSchema = z.object({
  source: z.string().default("")
});

export const hashText = async (input: z.infer<typeof hashInputSchema>) => {
  const parsedInput = hashInputSchema.safeParse(input);

  if (!parsedInput.success) {
    return createToolError({
      code: "INVALID_INPUT",
      message: "哈希输入参数不合法。",
      details: parsedInput.error.issues[0]?.message
    });
  }

  try {
    const bytes = textToBytes(parsedInput.data.source);
    const items = await Promise.all(
      algorithms.map(async (algorithm) => {
        let result: Uint8Array;

        if (algorithm === "MD5") {
          result = hashMd5(bytes);
        } else if (algorithm === "SM3") {
          result = hashSm3(bytes);
        } else {
          if (!globalThis.crypto?.subtle) {
            throw new Error("当前环境不支持 Web Crypto。");
          }

          const buffer = await globalThis.crypto.subtle.digest(algorithm, bytes);

          result = new Uint8Array(buffer);
        }

        return {
          algorithm,
          hex: bytesToHex(result),
          base64: bytesToBase64(result)
        };
      }),
    );

    return createToolSuccess<HashOutput>({ items });
  } catch (error) {
    return createToolError({
      code: "HASH_FAILED",
      message: "哈希计算失败。",
      details: error instanceof Error ? error.message : "未知错误。"
    });
  }
};
