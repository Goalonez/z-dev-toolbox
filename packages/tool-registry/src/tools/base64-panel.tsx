import { useRef, useState } from "react";

import {
  transformBase64,
  type Base64Input,
  type Base64Output,
} from "@z-dev-toolbox/core";
import type { Locale } from "@z-dev-toolbox/shared";
import { Button, Textarea, cn } from "@z-dev-toolbox/ui";

import {
  ToolActionDock,
  ToolCodeBlock,
  ToolGrid,
  ToolPane,
  ToolSegmentedControl,
  toolInsetPanelClassName,
} from "../components/tool-panel-kit";
import { useToolDraftState } from "../components/use-tool-draft-state";
import { useToolFeedback } from "../components/use-tool-feedback";
import type { ToolPanelProps } from "../types";
import { commonPanelCopy, formatToolError } from "./panel-copy";

const TOOL_DRAFT_KEY = "tool:base64.codec:draft:v4";

interface ImageDraftState {
  bytes: number[];
  mimeType: string;
  previewUrl: string;
  name: string;
}

const panelCopy: Record<
  Locale,
  {
    title: string;
    textType: string;
    imageType: string;
    textEncodePlaceholder: string;
    textDecodePlaceholder: string;
    encodeAction: string;
    decodeAction: string;
    copyImageAction: string;
    downloadImageAction: string;
    imageDownloaded: string;
    imageDownloadFailed: string;
    uploadAction: string;
    imageEmpty: string;
    imageSelected: string;
    dataUrlLabel: string;
    urlSafeLabel: string;
    errorMessage: Record<string, string>;
  }
> = {
  "zh-CN": {
    title: "Base64",
    textType: "文本输入",
    imageType: "上传图片",
    textEncodePlaceholder:
      "输入普通文本后点击“编码”，或输入 Base64 文本后点击“解码”，图片内容会自动识别",
    textDecodePlaceholder: "输入 Base64 文本后点击“解码”，图片内容会自动识别",
    encodeAction: "编码",
    decodeAction: "解码",
    copyImageAction: "复制图片",
    downloadImageAction: "下载图片",
    imageDownloaded: "图片已导出",
    imageDownloadFailed: "图片导出失败",
    uploadAction: "上传图片",
    imageEmpty:
      "点击下方按钮上传图片，或将焦点停留在此处后粘贴剪贴板中的图片。",
    imageSelected: "已选图片",
    dataUrlLabel: "Data URL",
    urlSafeLabel: "URL 安全",
    errorMessage: {
      INVALID_INPUT: "输入参数无效",
      INVALID_BASE64: "Base64 解码失败",
    },
  },
  "en-US": {
    title: "Base64",
    textType: "Text Input",
    imageType: "Upload Image",
    textEncodePlaceholder:
      "Enter plain text to encode, or Base64 text to decode. Image content is detected automatically.",
    textDecodePlaceholder:
      "Enter Base64 text to decode. Image content is detected automatically.",
    encodeAction: "Encode",
    decodeAction: "Decode",
    copyImageAction: "Copy image",
    downloadImageAction: "Download image",
    imageDownloaded: "Image saved",
    imageDownloadFailed: "Image save failed",
    uploadAction: "Upload image",
    imageEmpty:
      "Upload an image with the button below, or focus this area and paste one from the clipboard.",
    imageSelected: "Selected image",
    dataUrlLabel: "Data URL",
    urlSafeLabel: "URL-safe",
    errorMessage: {
      INVALID_INPUT: "Invalid input",
      INVALID_BASE64: "Base64 decode failed",
    },
  },
};

const toUrlSafe = (value: string) =>
  value.replace(/\+/g, "-").replace(/\//g, "_");

const loadImageFile = async (file: File): Promise<ImageDraftState> => {
  const [buffer, previewUrl] = await Promise.all([
    file.arrayBuffer(),
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
    }),
  ]);

  return {
    bytes: Array.from(new Uint8Array(buffer)),
    mimeType: file.type || "image/png",
    previewUrl,
    name: file.name || "clipboard-image",
  };
};

const getBase64MimeType = (
  result: Base64Output,
  contentType: Base64Input["contentType"],
) => {
  if (result.mimeType) {
    return result.mimeType;
  }

  return contentType === "image"
    ? "image/png"
    : "text/plain;charset=utf-8";
};

const getBase64Payload = (result: Base64Output, urlSafe: boolean) =>
  urlSafe ? toUrlSafe(result.result) : result.result;

const stringifyResult = (
  result: Base64Output,
  options: {
    dataUrlOutput: boolean;
    urlSafeOutput: boolean;
  },
  contentType: Base64Input["contentType"],
) => {
  if (result.outputKind !== "base64") {
    return result.result;
  }

  const payload = getBase64Payload(result, options.urlSafeOutput);

  if (options.dataUrlOutput) {
    return `data:${getBase64MimeType(result, contentType)};base64,${payload}`;
  }

  return payload;
};

const dataUrlToBlob = async (dataUrl: string) => {
  const response = await fetch(dataUrl);

  return response.blob();
};

const getImageExtension = (mimeType?: string) => {
  switch (mimeType) {
    case "image/jpeg":
      return "jpg";
    case "image/gif":
      return "gif";
    case "image/webp":
      return "webp";
    case "image/svg+xml":
      return "svg";
    default:
      return "png";
  }
};

export const Base64Panel = ({
  autoCopyOnSuccess,
  bridge,
  locale,
  notify,
  storage,
}: ToolPanelProps) => {
  const text = panelCopy[locale];
  const common = commonPanelCopy[locale];
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [draft, setDraft] = useToolDraftState<
    Omit<Base64Input, "imageBytes" | "imageMimeType" | "urlSafe"> & {
      dataUrlOutput: boolean;
      urlSafeOutput: boolean;
    }
  >(storage, TOOL_DRAFT_KEY, {
    source: "",
    mode: "encode",
    contentType: "text",
    dataUrlOutput: false,
    urlSafeOutput: false,
  });
  const [imageDraft, setImageDraft] = useState<ImageDraftState | null>(null);
  const [result, setResult] = useState<Base64Output | null>(null);
  const { feedback, setFeedback, copyText, reportSuccess } = useToolFeedback({
    autoCopyOnSuccess,
    bridge,
    copiedText: common.copied,
    copyFailedText: common.copyFailed,
    notify,
  });
  const inputPlaceholder =
    draft.mode === "encode"
      ? text.textEncodePlaceholder
      : text.textDecodePlaceholder;
  const copyImageToClipboard = async (
    dataUrl: string,
    successText = common.copied,
  ) => {
    try {
      if (
        typeof ClipboardItem === "undefined" ||
        !navigator.clipboard ||
        typeof navigator.clipboard.write !== "function"
      ) {
        throw new Error(
          locale === "zh-CN"
            ? "当前环境不支持复制图片。"
            : "Image clipboard copy is unavailable in this environment.",
        );
      }

      const blob = await dataUrlToBlob(dataUrl);

      await navigator.clipboard.write([
        new ClipboardItem({
          [blob.type]: blob,
        }),
      ]);

      setFeedback({
        tone: "success",
        text: successText,
      });
      return true;
    } catch (error) {
      setFeedback({
        tone: "error",
        text: `${common.copyFailed}: ${error instanceof Error ? error.message : ""}`.trim(),
      });
      return false;
    }
  };
  const reportImageSuccess = (successText: string, dataUrl?: string) => {
    if (!autoCopyOnSuccess || !dataUrl) {
      setFeedback({
        tone: "success",
        text: successText,
      });
      return;
    }

    void copyImageToClipboard(dataUrl, `${successText} · ${common.copied}`);
  };

  const updateDraft = (
    value: Partial<typeof draft>,
    options?: {
      preserveResult?: boolean;
    },
  ) => {
    setDraft((current) => ({ ...current, ...value }));

    if (!options?.preserveResult) {
      setResult(null);
      setFeedback(null);
    }
  };

  const executeTransform = (
    input: typeof draft,
    image: ImageDraftState | null = imageDraft,
  ) => {
    if (
      input.contentType === "text" &&
      input.source.length === 0
    ) {
      setResult(null);
      setFeedback(null);
      return;
    }

    if (input.contentType === "image" && !image) {
      setResult(null);
      setFeedback(null);
      return;
    }

    const nextInput: Base64Input = {
      source: input.source,
      mode: input.mode,
      contentType: input.contentType,
      urlSafe: false,
      imageBytes:
        input.contentType === "image" && input.mode === "encode"
          ? image?.bytes
          : undefined,
      imageMimeType: image?.mimeType ?? "image/png",
    };

    const nextResult = transformBase64(nextInput);

    if (!nextResult.ok) {
      setResult(null);
      setFeedback({
        tone: "error",
        text: formatToolError(nextResult.error, text.errorMessage),
      });
      return;
    }

    setResult(nextResult.data);

    if (nextResult.data.outputKind === "image") {
      reportImageSuccess(
        locale === "zh-CN" ? "图片已解码" : "Decoded",
        nextResult.data.dataUrl,
      );
      return;
    }

    reportSuccess(
      locale === "zh-CN"
        ? `${input.mode === "encode" ? "编码" : "解码"}完成`
        : `${input.mode === "encode" ? "Encoded" : "Decoded"}`,
      stringifyResult(
        nextResult.data,
        {
          dataUrlOutput: input.dataUrlOutput,
          urlSafeOutput: input.urlSafeOutput,
        },
        input.contentType,
      ),
    );
  };

  const runTransform = (mode: Base64Input["mode"]) => {
    const nextDraft = {
      ...draft,
      mode,
    };

    updateDraft({ mode }, { preserveResult: true });
    executeTransform(nextDraft);
  };

  const updateAndTransformText = (source: string) => {
    const nextDraft = {
      ...draft,
      source,
      contentType: "text" as const,
    };

    updateDraft({ source });
    executeTransform(nextDraft);
  };

  const handleImageFile = async (file: File) => {
    try {
      const nextImage = await loadImageFile(file);
      const nextDraft = {
        ...draft,
        contentType: "image" as const,
        mode: "encode" as const,
        source: "",
      };

      setImageDraft(nextImage);
      setResult(null);
      setFeedback(null);
      setDraft(nextDraft);
      executeTransform(nextDraft, nextImage);
    } catch (error) {
      setFeedback({
        tone: "error",
        text: error instanceof Error ? error.message : "图片读取失败",
      });
    }
  };
  const handleDownloadImage = async () => {
    if (result?.outputKind !== "image" || !result.dataUrl) {
      return;
    }

    try {
      const anchor = document.createElement("a");

      anchor.href = result.dataUrl;
      anchor.download = `base64-result.${getImageExtension(result.mimeType)}`;
      anchor.click();
      setFeedback({
        tone: "success",
        text: text.imageDownloaded,
      });
    } catch (error) {
      setFeedback({
        tone: "error",
        text: `${text.imageDownloadFailed}: ${error instanceof Error ? error.message : ""}`.trim(),
      });
    }
  };

  return (
    <ToolGrid docked>
      <ToolPane
        title={text.title}
        headerCenter={
          <ToolSegmentedControl
            value={draft.contentType}
            options={[
              { value: "text", label: text.textType },
              { value: "image", label: text.imageType },
            ]}
            onValueChange={(value) => {
              updateDraft({
                contentType: value as typeof draft.contentType,
                mode: value === "image" ? "encode" : draft.mode,
                source: value === "text" ? draft.source : "",
              });
              setImageDraft(null);
            }}
          />
        }
      >
        {draft.contentType === "text" ? (
          <Textarea
            className="min-h-[18rem] max-h-[60dvh] flex-1 resize-none font-mono text-[13px] leading-6 xl:min-h-0 xl:max-h-none"
            placeholder={inputPlaceholder}
            spellCheck={false}
            value={draft.source}
            onChange={(event) => {
              updateAndTransformText(event.currentTarget.value);
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
                  void handleImageFile(file);
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
                  void handleImageFile(file);
                }
              }}
            >
              {imageDraft?.previewUrl ? (
                <div className="space-y-3">
                  <img
                    alt={imageDraft.name}
                    className="mx-auto max-h-[220px] max-w-full rounded-[18px] border border-border/50 object-contain"
                    src={imageDraft.previewUrl}
                  />
                  <div className="text-sm text-muted">
                    {text.imageSelected}: {imageDraft.name}
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="text-sm text-muted">{text.imageEmpty}</div>
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
        {result?.outputKind === "image" && result.dataUrl ? (
          <div
            className={`flex min-h-0 flex-1 items-center justify-center rounded-[24px] border p-6 ${toolInsetPanelClassName}`}
          >
            <img
              alt="base64 preview"
              className="max-h-full max-w-full rounded-[20px] border border-border/45 object-contain"
              src={result.dataUrl}
            />
          </div>
        ) : (
          <div className="relative flex min-h-0 flex-1 flex-col">
            {result?.outputKind === "base64" ? (
              <div className="absolute right-4 top-3 z-10 inline-flex items-center gap-1 rounded-full border border-border/55 bg-background/82 p-1 backdrop-blur">
                {[
                  {
                    key: "dataUrlOutput",
                    label: text.dataUrlLabel,
                    pressed: draft.dataUrlOutput,
                  },
                  {
                    key: "urlSafeOutput",
                    label: text.urlSafeLabel,
                    pressed: draft.urlSafeOutput,
                  },
                ].map((option) => (
                  <button
                    key={option.key}
                    aria-pressed={option.pressed}
                    className={cn(
                      "rounded-full px-3 py-1.5 text-[11px] font-medium transition-[background-color,color,box-shadow]",
                      option.pressed
                        ? "bg-[linear-gradient(180deg,rgb(var(--color-surface)/0.98),rgb(var(--color-accent-soft)/0.88))] text-foreground shadow-[0_14px_22px_-16px_rgb(var(--color-shadow-ambient)/0.22),0_8px_18px_-14px_rgb(var(--color-shadow-warm)/0.2)]"
                        : "text-muted hover:text-foreground",
                    )}
                    type="button"
                    onClick={() => {
                      updateDraft(
                        {
                          [option.key]: !option.pressed,
                        } as Partial<typeof draft>,
                        { preserveResult: true },
                      );
                    }}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            ) : null}
            <ToolCodeBlock
              className={result?.outputKind === "base64" ? "pt-11" : undefined}
              placeholder={common.resultPlaceholder}
              value={
                result
                  ? stringifyResult(
                      result,
                      {
                        dataUrlOutput: draft.dataUrlOutput,
                        urlSafeOutput: draft.urlSafeOutput,
                      },
                      draft.contentType,
                    )
                  : ""
              }
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
              variant="secondary"
              onClick={() => {
                runTransform("encode");
              }}
            >
              {text.encodeAction}
            </Button>
            <Button
              size="sm"
              variant="secondary"
              disabled={draft.contentType === "image"}
              onClick={() => {
                runTransform("decode");
              }}
            >
              {text.decodeAction}
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                setDraft({
                  source: "",
                  mode: "encode",
                  contentType: "text",
                  dataUrlOutput: false,
                  urlSafeOutput: false,
                });
                setImageDraft(null);
                setResult(null);
                setFeedback(null);
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
                if (result?.outputKind === "image" && result.dataUrl) {
                  void copyImageToClipboard(result.dataUrl);
                  return;
                }

                if (result && result.outputKind !== "image") {
                  void copyText(
                    stringifyResult(
                      result,
                      {
                        dataUrlOutput: draft.dataUrlOutput,
                        urlSafeOutput: draft.urlSafeOutput,
                      },
                      draft.contentType,
                    ),
                  );
                }
              }}
            >
              {result?.outputKind === "image"
                ? text.copyImageAction
                : common.copy}
            </Button>
            {result?.outputKind === "image" && result.dataUrl ? (
              <Button
                size="sm"
                variant="secondary"
                onClick={() => {
                  void handleDownloadImage();
                }}
              >
                {text.downloadImageAction}
              </Button>
            ) : null}
          </>
        }
      />
    </ToolGrid>
  );
};
