import { useEffect, useMemo, useState } from "react";

import {
  formatJson,
  type JsonFormatInput,
  type JsonFormatOutput,
  jsonEscapeModeSchema,
  jsonFormatModeSchema,
  jsonKeyNamingSchema,
  jsonSortOrderSchema,
} from "@z-dev-toolbox/core";
import type { Locale } from "@z-dev-toolbox/shared";
import { Button, Textarea, cn } from "@z-dev-toolbox/ui";

import { JsonViewer } from "../components/json-viewer";
import { collectJsonCollapsiblePaths } from "../components/json-viewer-utils";
import {
  ToolActionDock,
  ToolGrid,
  ToolPane,
  ToolSegmentedControl,
  ToolSelect,
} from "../components/tool-panel-kit";
import { useToolDraftState } from "../components/use-tool-draft-state";
import { useToolFeedback } from "../components/use-tool-feedback";
import type { ToolPanelProps } from "../types";
import { commonPanelCopy, formatToolError } from "./panel-copy";

const TOOL_DRAFT_KEY = "tool:json.format:draft:v2";

const keyNamingOptions = [
  {
    value: "preserve",
    label: {
      "zh-CN": "保持原样",
      "en-US": "Preserve",
    },
  },
  {
    value: "camel",
    label: {
      "zh-CN": "小驼峰",
      "en-US": "lowerCamel",
    },
  },
  {
    value: "pascal",
    label: {
      "zh-CN": "大驼峰",
      "en-US": "PascalCase",
    },
  },
  {
    value: "snake",
    label: {
      "zh-CN": "下划线",
      "en-US": "snake_case",
    },
  },
  {
    value: "kebab",
    label: {
      "zh-CN": "短横线",
      "en-US": "kebab-case",
    },
  },
  {
    value: "constant",
    label: {
      "zh-CN": "常量",
      "en-US": "CONSTANT",
    },
  },
] as const;

const panelCopy: Record<
  Locale,
  {
    title: string;
    placeholder: string;
    indentLabel: string;
    sortLabel: string;
    keyNamingLabel: string;
    escapeLabel: string;
    viewLabel: string;
    textLabel: string;
    prettyAction: string;
    compactAction: string;
    escapeAction: string;
    unescapeAction: string;
    downloadAction: string;
    downloaded: string;
    downloadFailed: string;
    objectsLabel: string;
    arraysLabel: string;
    expandAll: string;
    collapseAll: string;
    sortStatus: Record<"none" | "asc" | "desc", string>;
    escapeStatus: Record<"none" | "escape" | "unescape", string>;
    successMessage: Record<
      | "pretty"
      | "compact"
      | "prettyEscape"
      | "compactEscape"
      | "prettyUnescape"
      | "compactUnescape",
      string
    >;
    errorMessage: Record<string, string>;
  }
> = {
  "zh-CN": {
    title: "JSON 格式化",
    placeholder: "粘贴待处理的 JSON 文本，可按需格式化、压缩、排序或转义",
    indentLabel: "缩进",
    sortLabel: "键排序",
    keyNamingLabel: "键命名",
    escapeLabel: "转义处理",
    viewLabel: "视图",
    textLabel: "文本",
    prettyAction: "格式化",
    compactAction: "压缩",
    escapeAction: "添加转义",
    unescapeAction: "移除转义",
    downloadAction: "下载 JSON",
    downloaded: "JSON 文件已导出",
    downloadFailed: "导出失败",
    objectsLabel: "对象",
    arraysLabel: "数组",
    expandAll: "展开全部",
    collapseAll: "收起全部",
    sortStatus: {
      none: "原始",
      asc: "升序",
      desc: "降序",
    },
    escapeStatus: {
      none: "不处理",
      escape: "添加转义",
      unescape: "移除转义",
    },
    successMessage: {
      pretty: "JSON 已格式化",
      compact: "JSON 已压缩",
      prettyEscape: "JSON 已格式化并转义",
      compactEscape: "JSON 已压缩并转义",
      prettyUnescape: "转义已移除并格式化",
      compactUnescape: "转义已移除并压缩",
    },
    errorMessage: {
      INVALID_INPUT: "输入参数无效",
      INVALID_JSON: "JSON 解析失败",
      FORMAT_EMPTY_RESULT: "格式化结果为空",
    },
  },
  "en-US": {
    title: "JSON Formatter",
    placeholder: "Paste JSON content to format, minify, sort, or escape",
    indentLabel: "Indent",
    sortLabel: "Key sort",
    keyNamingLabel: "Key naming",
    escapeLabel: "Escapes",
    viewLabel: "View",
    textLabel: "Text",
    prettyAction: "Pretty",
    compactAction: "Minify",
    escapeAction: "Add escapes",
    unescapeAction: "Remove escapes",
    downloadAction: "Download JSON",
    downloaded: "JSON file saved",
    downloadFailed: "Save failed",
    objectsLabel: "Objects",
    arraysLabel: "Arrays",
    expandAll: "Expand all",
    collapseAll: "Collapse all",
    sortStatus: {
      none: "Original",
      asc: "Asc",
      desc: "Desc",
    },
    escapeStatus: {
      none: "None",
      escape: "Add escapes",
      unescape: "Remove escapes",
    },
    successMessage: {
      pretty: "JSON formatted",
      compact: "JSON minified",
      prettyEscape: "JSON formatted and escaped",
      compactEscape: "JSON minified and escaped",
      prettyUnescape: "Escapes removed and formatted",
      compactUnescape: "Escapes removed and minified",
    },
    errorMessage: {
      INVALID_INPUT: "Invalid input",
      INVALID_JSON: "JSON parse failed",
      FORMAT_EMPTY_RESULT: "Output is empty",
    },
  },
};

const defaultDraft: JsonFormatInput = {
  source: "",
  indent: 2,
  mode: "pretty",
  escapeMode: "none",
  sortOrder: "none",
  keyNaming: "preserve",
};

const indentOptions = [2, 4] as const;

const isJsonMode = (value: unknown): value is JsonFormatInput["mode"] =>
  jsonFormatModeSchema.options.includes(value as JsonFormatInput["mode"]);

const isJsonEscapeMode = (
  value: unknown,
): value is JsonFormatInput["escapeMode"] =>
  jsonEscapeModeSchema.options.includes(value as JsonFormatInput["escapeMode"]);

const isJsonSortOrder = (
  value: unknown,
): value is JsonFormatInput["sortOrder"] =>
  jsonSortOrderSchema.options.includes(value as JsonFormatInput["sortOrder"]);

const isJsonKeyNaming = (
  value: unknown,
): value is JsonFormatInput["keyNaming"] =>
  jsonKeyNamingSchema.options.includes(value as JsonFormatInput["keyNaming"]);

const normalizeJsonDraft = (
  value: Partial<JsonFormatInput> | JsonFormatInput | null | undefined,
): JsonFormatInput => {
  const draft = value ?? {};

  return {
    source:
      typeof draft.source === "string" ? draft.source : defaultDraft.source,
    indent:
      typeof draft.indent === "number" &&
      Number.isInteger(draft.indent) &&
      draft.indent >= 0 &&
      draft.indent <= 8
        ? draft.indent
        : defaultDraft.indent,
    mode: isJsonMode(draft.mode) ? draft.mode : defaultDraft.mode,
    escapeMode: isJsonEscapeMode(draft.escapeMode)
      ? draft.escapeMode
      : defaultDraft.escapeMode,
    sortOrder: isJsonSortOrder(draft.sortOrder)
      ? draft.sortOrder
      : defaultDraft.sortOrder,
    keyNaming: isJsonKeyNaming(draft.keyNaming)
      ? draft.keyNaming
      : defaultDraft.keyNaming,
  };
};

const getDefaultDisplayMode = (
  draft: Pick<JsonFormatInput, "mode" | "escapeMode">,
): "view" | "text" =>
  draft.mode === "compact" || draft.escapeMode === "escape" ? "text" : "view";

const getSuccessMessage = (
  draft: Pick<JsonFormatInput, "mode" | "escapeMode">,
  text: (typeof panelCopy)[Locale],
) => {
  if (draft.escapeMode === "escape") {
    return draft.mode === "compact"
      ? text.successMessage.compactEscape
      : text.successMessage.prettyEscape;
  }

  if (draft.escapeMode === "unescape") {
    return draft.mode === "compact"
      ? text.successMessage.compactUnescape
      : text.successMessage.prettyUnescape;
  }

  return draft.mode === "compact"
    ? text.successMessage.compact
    : text.successMessage.pretty;
};

export const JsonFormatPanel = ({
  autoCopyOnSuccess,
  bridge,
  locale,
  notify,
  storage,
}: ToolPanelProps) => {
  const common = commonPanelCopy[locale];
  const text = panelCopy[locale];
  const [rawDraft, setDraft] = useToolDraftState<JsonFormatInput>(
    storage,
    TOOL_DRAFT_KEY,
    defaultDraft,
  );
  const draft = useMemo(() => normalizeJsonDraft(rawDraft), [rawDraft]);
  const [result, setResult] = useState<JsonFormatOutput | null>(null);
  const [displayMode, setDisplayMode] = useState<"view" | "text">(
    getDefaultDisplayMode(defaultDraft),
  );
  const [collapsedPaths, setCollapsedPaths] = useState<Record<string, boolean>>(
    {},
  );
  const { feedback, setFeedback, copyText, reportSuccess } = useToolFeedback({
    autoCopyOnSuccess,
    bridge,
    copiedText: common.copied,
    copyFailedText: common.copyFailed,
    notify,
  });

  const resetResult = () => {
    setResult(null);
    setFeedback(null);
    setCollapsedPaths({});
  };

  const updateDraft = (value: Partial<JsonFormatInput>) => {
    resetResult();
    setDraft((current) =>
      normalizeJsonDraft({
        ...normalizeJsonDraft(current),
        ...value,
      }),
    );
  };

  const executeFormat = (input: JsonFormatInput) => {
    const nextResult = formatJson(input);

    if (!nextResult.ok) {
      setResult(null);
      setFeedback({
        tone: "error",
        text: formatToolError(nextResult.error, text.errorMessage),
      });
      return;
    }

    setResult(nextResult.data);
    setCollapsedPaths({});
    reportSuccess(getSuccessMessage(input, text), nextResult.data.formatted);
  };

  const runFormat = (mode: JsonFormatInput["mode"]) => {
    const nextInput = {
      ...draft,
      mode,
    };

    setDraft(nextInput);
    setDisplayMode(getDefaultDisplayMode(nextInput));
    executeFormat(nextInput);
  };

  const applyControlChange = (
    value: Partial<JsonFormatInput>,
    shouldRun: boolean,
  ) => {
    const nextInput = {
      ...draft,
      ...value,
    };

    setDraft(nextInput);
    setDisplayMode((current) =>
      nextInput.escapeMode === "escape" ? "text" : current,
    );

    if (shouldRun && nextInput.source.trim()) {
      executeFormat(nextInput);
      return;
    }

    resetResult();
  };

  useEffect(() => {
    if (!result) {
      setCollapsedPaths({});
    }
  }, [result]);

  useEffect(() => {
    if (!result) {
      setDisplayMode(getDefaultDisplayMode(draft));
    }
  }, [draft, result]);

  const collapsiblePaths = useMemo(
    () => (result ? collectJsonCollapsiblePaths(result.value) : []),
    [result],
  );
  const hasCollapsedItems = collapsiblePaths.some(
    (path) => collapsedPaths[path],
  );
  const isEnglish = locale === "en-US";

  const handleDownload = async () => {
    if (!result) {
      return;
    }

    try {
      await bridge.saveTextFile("json-result.json", result.formatted);
      setFeedback({
        tone: "success",
        text: text.downloaded,
      });
    } catch (error) {
      setFeedback({
        tone: "error",
        text: `${text.downloadFailed}: ${error instanceof Error ? error.message : ""}`.trim(),
      });
    }
  };

  return (
    <ToolGrid docked>
      <ToolPane title={text.title}>
        <Textarea
          className="min-h-[18rem] max-h-[60dvh] flex-1 resize-none font-mono text-[13px] leading-6 xl:min-h-0 xl:max-h-none"
          placeholder={text.placeholder}
          spellCheck={false}
          value={draft.source}
          onChange={(event) => {
            updateDraft({ source: event.currentTarget.value });
          }}
        />
      </ToolPane>

      <ToolPane
        title={undefined}
        headerCenter={
          <ToolSegmentedControl
            value={displayMode}
            options={[
              { value: "view", label: text.viewLabel },
              { value: "text", label: text.textLabel },
            ]}
            onValueChange={(value) => {
              setDisplayMode(value as "view" | "text");
            }}
          />
        }
        toolbar={
          displayMode === "view" && result ? (
            <div className="flex flex-wrap items-center justify-end gap-3 text-[11px] font-medium tracking-[0.12em] text-muted">
              <span>
                {text.objectsLabel} {result.objectCount}
              </span>
              <span>
                {text.arraysLabel} {result.arrayCount}
              </span>
              {collapsiblePaths.length > 0 ? (
                <Button
                  className="h-7 rounded-full px-3 text-[11px]"
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    setCollapsedPaths(
                      hasCollapsedItems
                        ? {}
                        : Object.fromEntries(
                            collapsiblePaths.map(
                              (path) => [path, true] as const,
                            ),
                          ),
                    );
                  }}
                >
                  {hasCollapsedItems ? text.expandAll : text.collapseAll}
                </Button>
              ) : null}
            </div>
          ) : null
        }
      >
        <JsonViewer
          collapsedPaths={collapsedPaths}
          displayMode={displayMode}
          formatted={result?.formatted ?? ""}
          placeholder={common.resultPlaceholder}
          sortOrder={result?.sortOrder ?? draft.sortOrder}
          value={result?.value ?? null}
          onTogglePath={(path) => {
            setCollapsedPaths((current) => ({
              ...current,
              [path]: !current[path],
            }));
          }}
        />
      </ToolPane>

      <ToolActionDock
        feedback={feedback}
        leftActions={
          <>
            <Button
              className={cn(isEnglish && "px-2.5 text-xs")}
              data-tool-primary-action="true"
              size="sm"
              variant="secondary"
              onClick={() => {
                runFormat("pretty");
              }}
            >
              {text.prettyAction}
            </Button>
            <Button
              className={cn(isEnglish && "px-2.5 text-xs")}
              size="sm"
              variant="secondary"
              onClick={() => {
                runFormat("compact");
              }}
            >
              {text.compactAction}
            </Button>
            <ToolSelect
              aria-label={text.escapeLabel}
              className={cn(
                "h-9 shrink-0 px-2.5 text-xs",
                isEnglish ? "w-[96px] sm:w-[108px]" : "w-[104px] sm:w-[118px]",
              )}
              value={draft.escapeMode}
              onValueChange={(value) => {
                applyControlChange(
                  {
                    escapeMode: value as JsonFormatInput["escapeMode"],
                  },
                  true,
                );
              }}
            >
              <option value="none">{text.escapeStatus.none}</option>
              <option value="escape">{text.escapeAction}</option>
              <option value="unescape">{text.unescapeAction}</option>
            </ToolSelect>
            <ToolSelect
              aria-label={text.sortLabel}
              className={cn(
                "h-9 shrink-0 px-2.5 text-xs",
                isEnglish ? "w-[84px] sm:w-[92px]" : "w-[92px] sm:w-[104px]",
              )}
              value={draft.sortOrder}
              onValueChange={(value) => {
                applyControlChange(
                  {
                    sortOrder: value as JsonFormatInput["sortOrder"],
                  },
                  true,
                );
              }}
            >
              <option value="none">{text.sortStatus.none}</option>
              <option value="asc">{text.sortStatus.asc}</option>
              <option value="desc">{text.sortStatus.desc}</option>
            </ToolSelect>
            <ToolSelect
              aria-label={text.keyNamingLabel}
              className={cn(
                "h-9 shrink-0 px-2.5 text-xs",
                isEnglish ? "w-[96px] sm:w-[104px]" : "w-[100px] sm:w-[112px]",
              )}
              value={draft.keyNaming}
              onValueChange={(value) => {
                applyControlChange(
                  {
                    keyNaming: value as JsonFormatInput["keyNaming"],
                  },
                  true,
                );
              }}
            >
              {keyNamingOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label[locale]}
                </option>
              ))}
            </ToolSelect>
            <ToolSelect
              aria-label={text.indentLabel}
              className={cn(
                "h-9 shrink-0 px-2.5 text-xs",
                isEnglish ? "w-[76px] sm:w-[88px]" : "w-[84px] sm:w-[96px]",
              )}
              value={String(draft.indent)}
              onValueChange={(value) => {
                applyControlChange(
                  {
                    indent: Number(value) as JsonFormatInput["indent"],
                  },
                  Boolean(result),
                );
              }}
            >
              {indentOptions.map((option) => (
                <option key={option} value={String(option)}>
                  {locale === "zh-CN" ? `${option} 格` : `${option} spaces`}
                </option>
              ))}
            </ToolSelect>
            <Button
              className={cn(isEnglish && "px-2.5 text-xs")}
              size="sm"
              variant="ghost"
              onClick={() => {
                setDraft(defaultDraft);
                setDisplayMode(getDefaultDisplayMode(defaultDraft));
                resetResult();
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
                  void copyText(result.formatted);
                }
              }}
            >
              {common.copy}
            </Button>
            <Button
              disabled={!result}
              size="sm"
              variant="secondary"
              onClick={() => {
                void handleDownload();
              }}
            >
              {text.downloadAction}
            </Button>
          </>
        }
      />
    </ToolGrid>
  );
};
