import { useEffect, useState, type PointerEvent as ReactPointerEvent } from "react";

import { analyzeColor, type ColorOutput } from "@z-dev-toolbox/core";
import type { Locale } from "@z-dev-toolbox/shared";
import { Button, Input } from "@z-dev-toolbox/ui";

import {
  ToolActionDock,
  ToolCodeBlock,
  ToolGrid,
  ToolPane,
  toolInsetPanelClassName
} from "../components/tool-panel-kit";
import { useToolDraftState } from "../components/use-tool-draft-state";
import { useToolFeedback } from "../components/use-tool-feedback";
import type { ToolPanelProps } from "../types";
import { commonPanelCopy, formatToolError } from "./panel-copy";

const TOOL_DRAFT_KEY = "tool:color.convert:draft";

interface HslControls {
  hue: number;
  saturation: number;
  lightness: number;
  alpha: number;
}

const DEFAULT_COLOR = "#C66E47";
const DEFAULT_CONTROLS: HslControls = {
  hue: 20,
  saturation: 53,
  lightness: 53,
  alpha: 1
};

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

const sliderThumbClassName =
  "[&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:border [&::-webkit-slider-thumb]:border-white/85 [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:shadow-[0_6px_16px_-10px_rgba(58,45,35,0.45)] " +
  "[&::-moz-range-thumb]:h-4 [&::-moz-range-thumb]:w-4 [&::-moz-range-thumb]:appearance-none [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border [&::-moz-range-thumb]:border-white/85 [&::-moz-range-thumb]:bg-white [&::-moz-range-thumb]:shadow-[0_6px_16px_-10px_rgba(58,45,35,0.45)]";

const panelCopy: Record<
  Locale,
  {
    title: string;
    inputPlaceholder: string;
    sliders: Record<"hue" | "saturation" | "lightness" | "alpha", string>;
    errorMessage: Record<string, string>;
  }
> = {
  "zh-CN": {
    title: "颜色",
    inputPlaceholder: "输入颜色值，或直接在下方色块中拖动选色",
    sliders: {
      hue: "色相",
      saturation: "饱和度",
      lightness: "亮度",
      alpha: "透明度"
    },
    errorMessage: {
      INVALID_INPUT: "输入参数无效",
      COLOR_PARSE_FAILED: "颜色解析失败"
    }
  },
  "en-US": {
    title: "Color",
    inputPlaceholder: "Enter a color value, or drag directly in the picker below",
    sliders: {
      hue: "Hue",
      saturation: "Saturation",
      lightness: "Lightness",
      alpha: "Alpha"
    },
    errorMessage: {
      INVALID_INPUT: "Invalid input",
      COLOR_PARSE_FAILED: "Color parsing failed"
    }
  }
};

const stringifyColor = (result: ColorOutput, locale: Locale) =>
  [
    `HEX: ${result.hex}`,
    `HEX+A: ${result.hexWithAlpha}`,
    `RGB: ${result.rgb}`,
    `RGBA: ${result.rgba}`,
    `HSL: ${result.hsl}`,
    `HSLA: ${result.hsla}`,
    `${locale === "zh-CN" ? "推荐文字色" : "Contrast text"}: ${result.contrastText}`
  ].join("\n");

const parseHslControls = (result: ColorOutput): HslControls => {
  const match = result.hsla.match(
    /^hsla?\(([-\d.]+),\s*([-\d.]+)%?,\s*([-\d.]+)%?,\s*([-\d.]+)\)$/i,
  );

  if (!match) {
    return DEFAULT_CONTROLS;
  }

  return {
    hue: Number(match[1] ?? DEFAULT_CONTROLS.hue),
    saturation: Number(match[2] ?? DEFAULT_CONTROLS.saturation),
    lightness: Number(match[3] ?? DEFAULT_CONTROLS.lightness),
    alpha: Number(match[4] ?? DEFAULT_CONTROLS.alpha)
  };
};

const formatAlpha = (value: number) =>
  Number(value.toFixed(3)).toString().replace(/\.0+$/, "");

const buildColorText = (controls: HslControls) => {
  const hue = Math.round(controls.hue);
  const saturation = Math.round(controls.saturation);
  const lightness = Math.round(controls.lightness);
  const alpha = Number(controls.alpha.toFixed(3));

  if (alpha >= 1) {
    return `hsl(${hue}, ${saturation}%, ${lightness}%)`;
  }

  return `hsla(${hue}, ${saturation}%, ${lightness}%, ${formatAlpha(alpha)})`;
};

const sliderTrackClassName =
  "rounded-full p-[2px] shadow-[0_10px_18px_-18px_rgb(var(--color-shadow-ambient)/0.2)]";

const SliderRow = ({
  label,
  value,
  min,
  max,
  step,
  suffix,
  background,
  onChange
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  suffix: string;
  background: string;
  onChange: (value: number) => void;
}) => (
  <div className="space-y-2">
    <div className="flex items-center justify-between gap-3 text-[11px] font-medium tracking-[0.14em] text-muted">
      <span className="uppercase">{label}</span>
      <span className="font-mono text-[12px] tracking-normal text-foreground">
        {Math.round(value * 1000) / 1000}
        {suffix}
      </span>
    </div>
    <div className={sliderTrackClassName} style={{ background }}>
      <input
        className={`h-3 w-full cursor-pointer appearance-none bg-transparent ${sliderThumbClassName}`}
        max={max}
        min={min}
        step={step}
        type="range"
        value={value}
        onChange={(event) => {
          onChange(Number(event.currentTarget.value));
        }}
      />
    </div>
  </div>
);

export const ColorPanel = ({
  bridge,
  locale,
  notify,
  storage
}: ToolPanelProps) => {
  const text = panelCopy[locale];
  const common = commonPanelCopy[locale];
  const [value, setValue] = useToolDraftState(
    storage,
    TOOL_DRAFT_KEY,
    DEFAULT_COLOR,
  );
  const [controls, setControls] = useState<HslControls>(DEFAULT_CONTROLS);
  const [result, setResult] = useState<ColorOutput | null>(null);
  const { feedback, setFeedback, copyText } = useToolFeedback({
    autoCopyOnSuccess: false,
    bridge,
    copiedText: common.copied,
    copyFailedText: common.copyFailed,
    notify
  });

  useEffect(() => {
    const nextResult = analyzeColor({ value });

    if (!nextResult.ok) {
      setResult(null);
      setFeedback({
        tone: "error",
        text: formatToolError(nextResult.error, text.errorMessage)
      });
      return;
    }

    setResult(nextResult.data);
    setControls(parseHslControls(nextResult.data));
    setFeedback(null);
  }, [setFeedback, text.errorMessage, value]);

  const updateControls = (patch: Partial<HslControls>) => {
    setControls((current) => {
      const next = {
        ...current,
        ...patch
      };

      setValue(buildColorText(next));
      return next;
    });
  };

  const updateFromSurface = (surface: HTMLDivElement, clientX: number, clientY: number) => {
    const rect = surface.getBoundingClientRect();
    const saturation = clamp(((clientX - rect.left) / rect.width) * 100, 0, 100);
    const lightness = clamp(100 - ((clientY - rect.top) / rect.height) * 100, 0, 100);

    updateControls({
      saturation,
      lightness
    });
  };

  const handleSurfacePointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    const surface = event.currentTarget;
    const pointerId = event.pointerId;

    event.preventDefault();
    updateFromSurface(surface, event.clientX, event.clientY);
    surface.setPointerCapture(pointerId);

    const handleMove = (nextEvent: PointerEvent) => {
      updateFromSurface(surface, nextEvent.clientX, nextEvent.clientY);
    };
    const handleEnd = (nextEvent: PointerEvent) => {
      if (nextEvent.pointerId !== pointerId) {
        return;
      }

      surface.removeEventListener("pointermove", handleMove);
      surface.removeEventListener("pointerup", handleEnd);
      surface.removeEventListener("pointercancel", handleEnd);

      if (surface.hasPointerCapture(pointerId)) {
        surface.releasePointerCapture(pointerId);
      }
    };

    surface.addEventListener("pointermove", handleMove);
    surface.addEventListener("pointerup", handleEnd);
    surface.addEventListener("pointercancel", handleEnd);
  };

  const previewBackground = result?.rgba ?? "rgba(255,255,255,0.72)";
  const previewText = result?.contrastText ?? "#1f2937";

  return (
    <ToolGrid docked>
      <ToolPane title={text.title}>
        <Input
          className="h-12 font-mono text-[13px]"
          placeholder={text.inputPlaceholder}
          spellCheck={false}
          value={value}
          onChange={(event) => {
            setValue(event.currentTarget.value);
          }}
        />

        <div className="flex min-h-0 flex-1 flex-col gap-4">
          <div
            className={`min-h-[240px] flex-1 rounded-[26px] border p-[1px] ${toolInsetPanelClassName} shadow-[0_16px_30px_-26px_rgba(96,68,45,0.22)]`}
          >
            <div
            className="relative h-full w-full overflow-hidden rounded-[24px] shadow-[inset_0_0_0_1px_rgb(var(--color-border)/0.28)]"
              style={{
                backgroundColor: `hsl(${controls.hue}, 100%, 50%)`,
                backgroundImage:
                  "linear-gradient(to top, rgba(0,0,0,1), rgba(0,0,0,0)), linear-gradient(to right, rgba(255,255,255,1), rgba(255,255,255,0))",
                touchAction: "none"
              }}
              onPointerDown={handleSurfacePointerDown}
            >
              <div
                className="pointer-events-none absolute h-5 w-5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow-[0_0_0_1px_rgba(31,41,55,0.4),0_10px_24px_-12px_rgba(15,23,42,0.65)]"
                style={{
                  left: `${controls.saturation}%`,
                  top: `${100 - controls.lightness}%`,
                }}
              />
            </div>
          </div>

          <div className={`rounded-[26px] border p-4 ${toolInsetPanelClassName}`}>
            <div className="space-y-4">
              <SliderRow
                background="linear-gradient(90deg,#ff4d4d 0%,#ffb84d 17%,#f5ff4d 33%,#59ff7a 50%,#4de4ff 67%,#5d6bff 83%,#ff4df0 100%)"
                label={text.sliders.hue}
                max={360}
                min={0}
                step={1}
                suffix="°"
                value={controls.hue}
                onChange={(nextHue) => {
                  updateControls({ hue: nextHue });
                }}
              />
              <SliderRow
                background={`linear-gradient(90deg,hsl(${controls.hue},0%,${controls.lightness}%),hsl(${controls.hue},100%,${controls.lightness}%))`}
                label={text.sliders.saturation}
                max={100}
                min={0}
                step={1}
                suffix="%"
                value={controls.saturation}
                onChange={(nextSaturation) => {
                  updateControls({ saturation: nextSaturation });
                }}
              />
              <SliderRow
                background={`linear-gradient(90deg,hsl(${controls.hue},${controls.saturation}%,0%),hsl(${controls.hue},${controls.saturation}%,50%),hsl(${controls.hue},${controls.saturation}%,100%))`}
                label={text.sliders.lightness}
                max={100}
                min={0}
                step={1}
                suffix="%"
                value={controls.lightness}
                onChange={(nextLightness) => {
                  updateControls({ lightness: nextLightness });
                }}
              />
              <SliderRow
                background={`linear-gradient(90deg,rgba(255,255,255,0),${result?.rgb.replace("rgb", "rgba").replace(")", ", 1)") ?? "rgba(198,110,71,1)"})`}
                label={text.sliders.alpha}
                max={1}
                min={0}
                step={0.01}
                suffix=""
                value={controls.alpha}
                onChange={(nextAlpha) => {
                  updateControls({ alpha: nextAlpha });
                }}
              />
            </div>
          </div>
        </div>
      </ToolPane>

      <ToolPane hideHeader>
        <div
          className={`flex h-36 items-end rounded-[26px] border p-4 ${toolInsetPanelClassName}`}
          style={{
            background: previewBackground,
            color: previewText
          }}
        >
          <div className="text-sm font-medium">
            {result?.hex ?? ""}
          </div>
        </div>
        <ToolCodeBlock
          placeholder={common.resultPlaceholder}
          value={result ? stringifyColor(result, locale) : ""}
        />
      </ToolPane>

      <ToolActionDock
        feedback={feedback}
        leftActions={
          <>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                setValue(DEFAULT_COLOR);
              }}
            >
              {common.clear}
            </Button>
          </>
        }
        rightActions={
          <>
            <Button
              disabled={!result}
              size="sm"
              variant="secondary"
              onClick={() => {
                if (result) {
                  void copyText(stringifyColor(result, locale));
                }
              }}
            >
              {common.copy}
            </Button>
          </>
        }
      />
    </ToolGrid>
  );
};
