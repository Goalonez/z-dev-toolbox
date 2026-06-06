import { useEffect, useRef, useState } from "react";

import { generateQrCode } from "@z-dev-toolbox/core";
import type { Locale } from "@z-dev-toolbox/shared";
import { Button, Textarea, cn } from "@z-dev-toolbox/ui";

import {
  ToolActionDock,
  ToolCodeBlock,
  ToolEmptyState,
  ToolGrid,
  ToolPane,
  ToolSegmentedControl,
  ToolSelect,
  toolInsetPanelClassName,
} from "../components/tool-panel-kit";
import { useToolDraftState } from "../components/use-tool-draft-state";
import { useToolFeedback } from "../components/use-tool-feedback";
import type { ToolPanelProps } from "../types";
import { commonPanelCopy, formatToolError } from "./panel-copy";

const TOOL_DRAFT_KEY = "tool:qr.code:draft:v2";
const QR_SIZE = 240;
const AUTO_RUN_DELAY_MS = 300;

type QrPanelMode = "generate" | "parse";
type QrExportFormat = "png" | "svg" | "base64";

interface ParsedImageState {
  file: File;
  previewUrl: string;
}

interface ParsedQrResult {
  text: string;
  format: string;
}

type BarcodeDetectorCtor = new (options?: { formats?: string[] }) => {
  detect: (
    source: unknown,
  ) => Promise<Array<{ rawValue?: string; format?: string }>>;
};

const panelCopy: Record<
  Locale,
  {
    title: string;
    generateMode: string;
    parseMode: string;
    generateAction: string;
    parseAction: string;
    exportLabel: string;
    copyResult: string;
    downloadAction: string;
    uploadAction: string;
    generatePlaceholder: string;
    parsePlaceholder: string;
    generateEmpty: string;
    parseEmpty: string;
    generated: string;
    parsed: string;
    exportSaved: string;
    exportFailed: string;
    errorMessage: Record<string, string>;
  }
> = {
  "zh-CN": {
    title: "二维码",
    generateMode: "生成",
    parseMode: "解析",
    generateAction: "生成二维码",
    parseAction: "解析二维码",
    exportLabel: "导出格式",
    copyResult: "复制结果",
    downloadAction: "下载结果",
    uploadAction: "上传图片",
    generatePlaceholder: "输入要写入二维码的文本、链接或其他内容",
    parsePlaceholder: "上传图片，或将焦点停留在此处后粘贴剪贴板中的截图。",
    generateEmpty: "",
    parseEmpty: "",
    generated: "二维码已生成",
    parsed: "二维码已解析",
    exportSaved: "二维码文件已导出",
    exportFailed: "二维码导出失败",
    errorMessage: {
      INVALID_INPUT: "输入参数无效",
      QR_CODE_FAILED: "二维码生成失败",
      QR_DETECT_UNAVAILABLE: "当前环境不支持二维码解析",
      QR_DETECT_FAILED: "二维码解析失败",
    },
  },
  "en-US": {
    title: "QR Code",
    generateMode: "Generate",
    parseMode: "Parse",
    generateAction: "Generate",
    parseAction: "Parse",
    exportLabel: "Export",
    copyResult: "Copy result",
    downloadAction: "Download",
    uploadAction: "Upload image",
    generatePlaceholder: "Enter the text, URL, or content to encode",
    parsePlaceholder:
      "Upload an image, or focus this area and paste one from the clipboard.",
    generateEmpty: "",
    parseEmpty: "",
    generated: "QR generated",
    parsed: "QR parsed",
    exportSaved: "QR file exported",
    exportFailed: "QR export failed",
    errorMessage: {
      INVALID_INPUT: "Invalid input",
      QR_CODE_FAILED: "QR generation failed",
      QR_DETECT_UNAVAILABLE: "QR parsing is unavailable in this environment",
      QR_DETECT_FAILED: "QR parsing failed",
    },
  },
};

const readPreviewUrl = (file: File) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = () => {
      if (typeof reader.result === "string") {
        resolve(reader.result);
        return;
      }

      reject(new Error("图片读取失败。"));
    };
    reader.onerror = () => {
      reject(reader.error ?? new Error("图片读取失败。"));
    };
    reader.readAsDataURL(file);
  });

const createDownload = (filename: string, blob: Blob) => {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");

  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
};

const renderSvgToPngBlob = async (svg: string) => {
  const svgBlob = new Blob([svg], { type: "image/svg+xml;charset=utf-8" });
  const svgUrl = URL.createObjectURL(svgBlob);

  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const nextImage = new Image();

      nextImage.onload = () => resolve(nextImage);
      nextImage.onerror = () => reject(new Error("PNG 生成失败。"));
      nextImage.src = svgUrl;
    });
    const canvas = document.createElement("canvas");

    canvas.width = QR_SIZE;
    canvas.height = QR_SIZE;

    const context = canvas.getContext("2d");

    if (!context) {
      throw new Error("当前环境不支持 Canvas。");
    }

    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, QR_SIZE, QR_SIZE);
    context.drawImage(image, 0, 0, QR_SIZE, QR_SIZE);

    return await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob((blob) => {
        if (!blob) {
          reject(new Error("PNG 导出失败。"));
          return;
        }

        resolve(blob);
      }, "image/png");
    });
  } finally {
    URL.revokeObjectURL(svgUrl);
  }
};

const readBlobAsDataUrl = (blob: Blob, locale: Locale) =>
  new Promise<string>((resolve, reject) => {
    const errorMessage =
      locale === "zh-CN" ? "Base64 生成失败。" : "Failed to generate Base64.";
    const reader = new FileReader();

    reader.onload = () => {
      if (typeof reader.result === "string") {
        resolve(reader.result);
        return;
      }

      reject(new Error(errorMessage));
    };
    reader.onerror = () => {
      reject(reader.error ?? new Error(errorMessage));
    };
    reader.readAsDataURL(blob);
  });

const detectQrCode = async (file: File) => {
  const detectorClass = (
    window as Window & {
      BarcodeDetector?: BarcodeDetectorCtor;
    }
  ).BarcodeDetector;

  if (!detectorClass) {
    throw new Error("QR_DETECT_UNAVAILABLE");
  }

  const detector = new detectorClass({ formats: ["qr_code"] });
  const bitmap = await createImageBitmap(file);

  try {
    const matches = await detector.detect(bitmap);
    const firstMatch = matches.find((item) => item.rawValue?.trim());
    const rawValue = firstMatch?.rawValue ?? "";

    if (!rawValue) {
      throw new Error("未识别到二维码内容。");
    }

    return {
      text: rawValue,
      format: firstMatch?.format ?? "qr_code",
    };
  } finally {
    bitmap.close();
  }
};

export const QrCodePanel = ({
  autoCopyOnSuccess,
  bridge,
  locale,
  notify,
  storage,
}: ToolPanelProps) => {
  const text = panelCopy[locale];
  const common = commonPanelCopy[locale];
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [draft, setDraft] = useToolDraftState(storage, TOOL_DRAFT_KEY, {
    mode: "generate" as QrPanelMode,
    text: "",
    exportFormat: "png" as QrExportFormat,
  });
  const [svg, setSvg] = useState("");
  const [parsedImage, setParsedImage] = useState<ParsedImageState | null>(null);
  const [parsedResult, setParsedResult] = useState<ParsedQrResult | null>(null);
  const autoRunTimeoutRef = useRef<ReturnType<typeof window.setTimeout> | null>(
    null,
  );
  const latestGenerateRunRef = useRef(0);
  const { feedback, setFeedback, copyText, reportSuccess } = useToolFeedback({
    autoCopyOnSuccess,
    bridge,
    copiedText: common.copied,
    copyFailedText: common.copyFailed,
    notify,
  });

  const clearAutoRunTimeout = () => {
    if (autoRunTimeoutRef.current) {
      window.clearTimeout(autoRunTimeoutRef.current);
      autoRunTimeoutRef.current = null;
    }
  };

  useEffect(
    () => () => {
      if (autoRunTimeoutRef.current) {
        window.clearTimeout(autoRunTimeoutRef.current);
      }
    },
    [],
  );

  const resetResults = () => {
    setSvg("");
    setParsedResult(null);
    setFeedback(null);
  };

  const updateDraft = (value: Partial<typeof draft>) => {
    const nextDraft = {
      ...draft,
      ...value,
    };

    setDraft(nextDraft);
    resetResults();
    scheduleGenerate(nextDraft);
  };

  const runGenerate = async (textValue = draft.text) => {
    clearAutoRunTimeout();

    const runId = latestGenerateRunRef.current + 1;

    latestGenerateRunRef.current = runId;

    if (!textValue.trim()) {
      setSvg("");
      setFeedback(null);
      return;
    }

    const nextResult = await generateQrCode({
      text: textValue,
      size: QR_SIZE,
      margin: 1,
      darkColor: "#111827",
      lightColor: "#FFFFFFFF",
      errorCorrectionLevel: "M",
    });

    if (latestGenerateRunRef.current !== runId) {
      return;
    }

    if (!nextResult.ok) {
      setSvg("");
      setFeedback({
        tone: "error",
        text: formatToolError(nextResult.error, text.errorMessage),
      });
      return;
    }

    setSvg(nextResult.data.svg);
    reportSuccess(text.generated);
  };

  const scheduleGenerate = (input: typeof draft) => {
    clearAutoRunTimeout();

    if (input.mode !== "generate" || !input.text.trim()) {
      latestGenerateRunRef.current += 1;
      setSvg("");
      setFeedback(null);
      return;
    }

    autoRunTimeoutRef.current = window.setTimeout(() => {
      void runGenerate(input.text);
    }, AUTO_RUN_DELAY_MS);
  };

  const handleParsedFile = async (file: File) => {
    try {
      const [previewUrl, detected] = await Promise.all([
        readPreviewUrl(file),
        detectQrCode(file),
      ]);

      setParsedImage({
        file,
        previewUrl,
      });
      setParsedResult(detected);
      reportSuccess(text.parsed, detected.text);
    } catch (error) {
      const qrDetectUnavailableMessage =
        text.errorMessage.QR_DETECT_UNAVAILABLE ??
        text.errorMessage.QR_CODE_FAILED ??
        "二维码解析失败";
      const qrDetectFailedMessage =
        text.errorMessage.QR_DETECT_FAILED ??
        text.errorMessage.QR_CODE_FAILED ??
        "二维码解析失败";
      const reason =
        error instanceof Error && error.message === "QR_DETECT_UNAVAILABLE"
          ? qrDetectUnavailableMessage
          : `${qrDetectFailedMessage}: ${error instanceof Error ? error.message : ""}`.trim();

      setParsedResult(null);
      setFeedback({
        tone: "error",
        text: reason,
      });
    }
  };

  const handleDownload = async () => {
    if (!svg) {
      return;
    }

    try {
      if (draft.exportFormat === "svg") {
        await bridge.saveTextFile("qr-code.svg", svg);
      } else if (draft.exportFormat === "base64") {
        const blob = await renderSvgToPngBlob(svg);
        const dataUrl = await readBlobAsDataUrl(blob, locale);

        await bridge.saveTextFile("qr-code-base64.txt", dataUrl);
      } else {
        const blob = await renderSvgToPngBlob(svg);

        createDownload("qr-code.png", blob);
      }

      setFeedback({
        tone: "success",
        text: text.exportSaved,
      });
    } catch (error) {
      setFeedback({
        tone: "error",
        text: `${text.exportFailed}: ${error instanceof Error ? error.message : ""}`.trim(),
      });
    }
  };

  const handleCopyGenerated = async () => {
    if (!svg) {
      return;
    }

    try {
      if (draft.exportFormat === "svg") {
        await copyText(svg);
        return;
      }

      if (draft.exportFormat === "base64") {
        const blob = await renderSvgToPngBlob(svg);
        const dataUrl = await readBlobAsDataUrl(blob, locale);

        await copyText(dataUrl);
        return;
      }

      if (
        typeof ClipboardItem === "undefined" ||
        !navigator.clipboard ||
        typeof navigator.clipboard.write !== "function"
      ) {
        throw new Error(
          locale === "zh-CN"
            ? "当前环境不支持复制 PNG 图片。"
            : "PNG clipboard copy is unavailable in this environment.",
        );
      }

      const blob = await renderSvgToPngBlob(svg);

      await navigator.clipboard.write([
        new ClipboardItem({
          [blob.type]: blob,
        }),
      ]);

      setFeedback({
        tone: "success",
        text: common.copied,
      });
    } catch (error) {
      setFeedback({
        tone: "error",
        text: `${common.copyFailed}: ${error instanceof Error ? error.message : ""}`.trim(),
      });
    }
  };

  return (
    <ToolGrid docked>
      <ToolPane
        title={text.title}
        headerCenter={
          <ToolSegmentedControl
            value={draft.mode}
            options={[
              { value: "generate", label: text.generateMode },
              { value: "parse", label: text.parseMode },
            ]}
            onValueChange={(value) => {
              updateDraft({ mode: value as QrPanelMode });
              setParsedImage(null);
            }}
          />
        }
      >
        {draft.mode === "generate" ? (
          <Textarea
            className="min-h-[18rem] max-h-[60dvh] flex-1 resize-none font-mono text-[13px] leading-6 xl:min-h-0 xl:max-h-none"
            placeholder={text.generatePlaceholder}
            spellCheck={false}
            value={draft.text}
            onChange={(event) => {
              updateDraft({ text: event.currentTarget.value });
            }}
          />
        ) : (
          <div className="flex min-h-0 flex-1 flex-col gap-3">
            <input
              ref={fileInputRef}
              accept="image/*"
              className="hidden"
              type="file"
              onChange={(event) => {
                const file = event.currentTarget.files?.[0];

                if (file) {
                  setParsedImage(null);
                  setParsedResult(null);
                  void handleParsedFile(file);
                }

                event.currentTarget.value = "";
              }}
            />
            <div
              className={cn(
                "flex min-h-[220px] flex-1 flex-col items-center justify-center rounded-[24px] border border-dashed px-6 py-5 text-center",
                toolInsetPanelClassName,
              )}
              role="button"
              tabIndex={0}
              onClick={() => {
                fileInputRef.current?.click();
              }}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  fileInputRef.current?.click();
                }
              }}
              onPaste={(event) => {
                const file = Array.from(event.clipboardData.items)
                  .find((item) => item.type.startsWith("image/"))
                  ?.getAsFile();

                if (file) {
                  event.preventDefault();
                  void handleParsedFile(file);
                }
              }}
            >
              {parsedImage?.previewUrl ? (
                <div className="space-y-3">
                  <img
                    alt={parsedImage.file.name}
                    className="mx-auto max-h-[220px] max-w-full rounded-[18px] border border-border/50 object-contain"
                    src={parsedImage.previewUrl}
                  />
                  <div className="text-sm text-muted">
                    {parsedImage.file.name}
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="text-sm text-muted">
                    {text.parsePlaceholder}
                  </div>
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={(event) => {
                      event.stopPropagation();
                      fileInputRef.current?.click();
                    }}
                  >
                    {text.uploadAction}
                  </Button>
                </div>
              )}
            </div>
          </div>
        )}
      </ToolPane>

      <ToolPane hideHeader>
        {draft.mode === "generate" ? (
          svg ? (
            <div
              className={`flex min-h-0 flex-1 items-center justify-center rounded-[24px] border p-6 ${toolInsetPanelClassName}`}
            >
              <div className="rounded-[18px] bg-white p-4 shadow-[0_18px_30px_-24px_rgba(0,0,0,0.35)]">
                <div
                  className="max-h-full max-w-full [&_svg]:h-auto [&_svg]:max-h-full [&_svg]:w-full [&_svg]:max-w-full"
                  dangerouslySetInnerHTML={{ __html: svg }}
                />
              </div>
            </div>
          ) : (
            <ToolEmptyState>{text.generateEmpty}</ToolEmptyState>
          )
        ) : (
          <div className="flex min-h-0 flex-1 flex-col gap-3">
            {parsedImage?.previewUrl ? (
              <div
                className={`flex h-48 items-center justify-center rounded-[24px] border p-4 ${toolInsetPanelClassName}`}
              >
                <img
                  alt={parsedImage.file.name}
                  className="max-h-full max-w-full rounded-[16px] object-contain"
                  src={parsedImage.previewUrl}
                />
              </div>
            ) : null}
            <ToolCodeBlock
              placeholder={text.parseEmpty}
              value={parsedResult?.text ?? ""}
            />
          </div>
        )}
      </ToolPane>

      <ToolActionDock
        feedback={feedback}
        leftActions={
          <>
            <Button
              data-tool-primary-action="true"
              size="sm"
              onClick={() => {
                if (draft.mode === "generate") {
                  void runGenerate();
                } else if (parsedImage?.file) {
                  void handleParsedFile(parsedImage.file);
                }
              }}
            >
              {draft.mode === "generate"
                ? text.generateAction
                : text.parseAction}
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                setDraft({
                  mode: "generate",
                  text: "",
                  exportFormat: "png",
                });
                setParsedImage(null);
                resetResults();
              }}
            >
              {common.clear}
            </Button>
          </>
        }
        rightActions={
          draft.mode === "generate" ? (
            <>
              <ToolSelect
                aria-label={text.exportLabel}
                className="h-9 rounded-full px-3 text-xs"
                renderValue={(option) => option?.label ?? draft.exportFormat}
                value={draft.exportFormat}
                onValueChange={(value) => {
                  setDraft((current) => ({
                    ...current,
                    exportFormat: value as QrExportFormat,
                  }));
                }}
              >
                <option value="png">PNG</option>
                <option value="svg">SVG</option>
                <option value="base64">Base64</option>
              </ToolSelect>
              <Button
                className="whitespace-nowrap"
                disabled={!svg}
                size="sm"
                variant="secondary"
                onClick={() => {
                  void handleCopyGenerated();
                }}
              >
                {text.copyResult}
              </Button>
              <Button
                className="whitespace-nowrap"
                disabled={!svg}
                size="sm"
                variant="secondary"
                onClick={() => {
                  void handleDownload();
                }}
              >
                {text.downloadAction}
              </Button>
            </>
          ) : (
            <>
              <Button
                disabled={!parsedResult}
                size="sm"
                variant="secondary"
                onClick={() => {
                  if (parsedResult) {
                    void copyText(parsedResult.text);
                  }
                }}
              >
                {common.copy}
              </Button>
            </>
          )
        }
        rightActionsClassName="gap-2 [&_[data-tool-select-trigger='true']]:min-w-[4.5rem] sm:[&_[data-tool-select-trigger='true']]:min-w-[4.75rem]"
      />
    </ToolGrid>
  );
};
