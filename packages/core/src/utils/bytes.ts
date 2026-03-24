const BASE64_ALPHABET =
  "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";

const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder("utf-8", { fatal: true });

export const textToBytes = (value: string) => textEncoder.encode(value);

export const bytesToText = (value: Uint8Array) => textDecoder.decode(value);

export const bytesToHex = (value: Uint8Array) =>
  Array.from(value, (item) => item.toString(16).padStart(2, "0")).join("");

export const bytesToBase64 = (value: Uint8Array) => {
  let output = "";

  for (let index = 0; index < value.length; index += 3) {
    const first = value[index] ?? 0;
    const second = value[index + 1] ?? 0;
    const third = value[index + 2] ?? 0;
    const chunk = (first << 16) | (second << 8) | third;
    const hasSecond = index + 1 < value.length;
    const hasThird = index + 2 < value.length;

    output += BASE64_ALPHABET[(chunk >> 18) & 63];
    output += BASE64_ALPHABET[(chunk >> 12) & 63];
    output += hasSecond ? BASE64_ALPHABET[(chunk >> 6) & 63] : "=";
    output += hasThird ? BASE64_ALPHABET[chunk & 63] : "=";
  }

  return output;
};

export const base64ToBytes = (value: string) => {
  const normalized = value.replace(/\s+/g, "");

  if (!normalized) {
    return new Uint8Array();
  }

  if (normalized.length % 4 !== 0) {
    throw new Error("Base64 长度不合法。");
  }

  const output: number[] = [];

  for (let index = 0; index < normalized.length; index += 4) {
    const chars = normalized.slice(index, index + 4).split("");
    const values = chars.map((char) => {
      if (char === "=") {
        return -1;
      }

      const alphabetIndex = BASE64_ALPHABET.indexOf(char);

      if (alphabetIndex === -1) {
        throw new Error(`非法 Base64 字符: ${char}`);
      }

      return alphabetIndex;
    });
    const [first, second, third, fourth] = values;

    const chunk =
      (((first ?? 0) & 63) << 18) |
      (((second ?? 0) & 63) << 12) |
      ((((third ?? -1) < 0 ? 0 : (third ?? 0)) & 63) << 6) |
      (((fourth ?? -1) < 0 ? 0 : (fourth ?? 0)) & 63);

    output.push((chunk >> 16) & 255);

    if ((third ?? -1) >= 0) {
      output.push((chunk >> 8) & 255);
    }

    if ((fourth ?? -1) >= 0) {
      output.push(chunk & 255);
    }
  }

  return new Uint8Array(output);
};
