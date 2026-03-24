import { z } from "../../lib/zod";

import { createToolError, createToolSuccess } from "../../tool-helpers";

export interface ColorOutput {
  hex: string;
  hexWithAlpha: string;
  rgb: string;
  rgba: string;
  hsl: string;
  hsla: string;
  alpha: number;
  contrastText: string;
}

const colorInputSchema = z.object({
  value: z.string().trim().min(1, "请输入颜色值。")
});

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

const normalizeHue = (value: number) => ((value % 360) + 360) % 360;

const toHex = (value: number) => Math.round(value).toString(16).padStart(2, "0");

const parseAlpha = (value: string) => {
  const numeric = value.endsWith("%")
    ? Number(value.slice(0, -1)) / 100
    : Number(value);

  if (!Number.isFinite(numeric)) {
    throw new Error(`透明度无法识别: ${value}`);
  }

  return clamp(numeric, 0, 1);
};

const splitFunctionArgs = (value: string) =>
  value
    .replace(/\//g, " ")
    .split(/[\s,]+/)
    .filter(Boolean);

const parseHexColor = (value: string) => {
  const raw = value.replace("#", "").trim();

  if (![3, 4, 6, 8].includes(raw.length)) {
    return null;
  }

  const normalized =
    raw.length <= 4
      ? raw
          .split("")
          .map((item) => `${item}${item}`)
          .join("")
      : raw;

  const rgb = normalized.slice(0, 6);
  const alpha = normalized.slice(6, 8) || "ff";

  return {
    red: Number.parseInt(rgb.slice(0, 2), 16),
    green: Number.parseInt(rgb.slice(2, 4), 16),
    blue: Number.parseInt(rgb.slice(4, 6), 16),
    alpha: Number.parseInt(alpha, 16) / 255
  };
};

const parseRgbColor = (value: string) => {
  const match = value.match(/^rgba?\((.*)\)$/i);

  if (!match) {
    return null;
  }

  const tokens = splitFunctionArgs(match[1] ?? "");

  if (tokens.length < 3 || tokens.length > 4) {
    throw new Error("RGB 颜色格式不合法。");
  }

  const parseChannel = (token: string) => {
    const numeric = token.endsWith("%")
      ? (Number(token.slice(0, -1)) / 100) * 255
      : Number(token);

    if (!Number.isFinite(numeric)) {
      throw new Error(`RGB 通道无法识别: ${token}`);
    }

    return clamp(Math.round(numeric), 0, 255);
  };

  return {
    red: parseChannel(tokens[0] ?? "0"),
    green: parseChannel(tokens[1] ?? "0"),
    blue: parseChannel(tokens[2] ?? "0"),
    alpha: tokens[3] ? parseAlpha(tokens[3]) : 1
  };
};

const hslToRgb = (hue: number, saturation: number, lightness: number) => {
  const chroma = (1 - Math.abs(2 * lightness - 1)) * saturation;
  const segment = hue / 60;
  const secondary = chroma * (1 - Math.abs((segment % 2) - 1));
  let red = 0;
  let green = 0;
  let blue = 0;

  if (segment >= 0 && segment < 1) {
    red = chroma;
    green = secondary;
  } else if (segment < 2) {
    red = secondary;
    green = chroma;
  } else if (segment < 3) {
    green = chroma;
    blue = secondary;
  } else if (segment < 4) {
    green = secondary;
    blue = chroma;
  } else if (segment < 5) {
    red = secondary;
    blue = chroma;
  } else {
    red = chroma;
    blue = secondary;
  }

  const match = lightness - chroma / 2;

  return {
    red: Math.round((red + match) * 255),
    green: Math.round((green + match) * 255),
    blue: Math.round((blue + match) * 255)
  };
};

const parseHslColor = (value: string) => {
  const match = value.match(/^hsla?\((.*)\)$/i);

  if (!match) {
    return null;
  }

  const tokens = splitFunctionArgs(match[1] ?? "");

  if (tokens.length < 3 || tokens.length > 4) {
    throw new Error("HSL 颜色格式不合法。");
  }

  const hue = normalizeHue(Number(tokens[0] ?? "0"));
  const saturation = clamp(Number((tokens[1] ?? "0").replace("%", "")) / 100, 0, 1);
  const lightness = clamp(Number((tokens[2] ?? "0").replace("%", "")) / 100, 0, 1);
  const rgb = hslToRgb(hue, saturation, lightness);

  return {
    ...rgb,
    alpha: tokens[3] ? parseAlpha(tokens[3]) : 1
  };
};

const rgbToHsl = (red: number, green: number, blue: number) => {
  const r = red / 255;
  const g = green / 255;
  const b = blue / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const delta = max - min;
  const lightness = (max + min) / 2;
  let hue = 0;

  if (delta !== 0) {
    if (max === r) {
      hue = 60 * (((g - b) / delta) % 6);
    } else if (max === g) {
      hue = 60 * ((b - r) / delta + 2);
    } else {
      hue = 60 * ((r - g) / delta + 4);
    }
  }

  const saturation =
    delta === 0 ? 0 : delta / (1 - Math.abs(2 * lightness - 1));

  return {
    hue: Math.round(normalizeHue(hue)),
    saturation: Math.round(saturation * 100),
    lightness: Math.round(lightness * 100)
  };
};

const getContrastText = (red: number, green: number, blue: number) => {
  const channels = [red, green, blue].map((channel) => {
    const normalized = channel / 255;

    return normalized <= 0.03928
      ? normalized / 12.92
      : ((normalized + 0.055) / 1.055) ** 2.4;
  });
  const [r = 0, g = 0, b = 0] = channels;
  const luminance = 0.2126 * r + 0.7152 * g + 0.0722 * b;

  return luminance > 0.42 ? "#1f2937" : "#f8fafc";
};

export const analyzeColor = (input: z.infer<typeof colorInputSchema>) => {
  const parsedInput = colorInputSchema.safeParse(input);

  if (!parsedInput.success) {
    return createToolError({
      code: "INVALID_INPUT",
      message: "颜色输入参数不合法。",
      details: parsedInput.error.issues[0]?.message
    });
  }

  try {
    const value = parsedInput.data.value;
    const parsed =
      parseHexColor(value) ?? parseRgbColor(value) ?? parseHslColor(value);

    if (!parsed) {
      throw new Error("仅支持 HEX、RGB(A)、HSL(A) 颜色格式。");
    }

    const { red, green, blue, alpha } = parsed;
    const hsl = rgbToHsl(red, green, blue);
    const normalizedAlpha = Number(alpha.toFixed(3));
    const alphaHex = toHex(normalizedAlpha * 255);

    return createToolSuccess<ColorOutput>({
      hex: `#${toHex(red)}${toHex(green)}${toHex(blue)}`.toUpperCase(),
      hexWithAlpha: `#${toHex(red)}${toHex(green)}${toHex(blue)}${alphaHex}`.toUpperCase(),
      rgb: `rgb(${red}, ${green}, ${blue})`,
      rgba: `rgba(${red}, ${green}, ${blue}, ${normalizedAlpha})`,
      hsl: `hsl(${hsl.hue}, ${hsl.saturation}%, ${hsl.lightness}%)`,
      hsla: `hsla(${hsl.hue}, ${hsl.saturation}%, ${hsl.lightness}%, ${normalizedAlpha})`,
      alpha: normalizedAlpha,
      contrastText: getContrastText(red, green, blue)
    });
  } catch (error) {
    return createToolError({
      code: "COLOR_PARSE_FAILED",
      message: "颜色解析失败。",
      details: error instanceof Error ? error.message : "未知错误。"
    });
  }
};
