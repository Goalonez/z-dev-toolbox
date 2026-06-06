import { useEffect, useMemo, useRef, useState } from "react";

import {
  formatXml,
  type XmlFormatInput,
  type XmlFormatOutput,
  xmlFormatModeSchema,
} from "@z-dev-toolbox/core";
import type { Locale } from "@z-dev-toolbox/shared";
import { Button, Textarea, cn } from "@z-dev-toolbox/ui";

import {
  ToolActionDock,
  ToolCodeBlock,
  ToolGrid,
  ToolPane,
  ToolSelect,
} from "../components/tool-panel-kit";
import { useToolDraftState } from "../components/use-tool-draft-state";
import { useToolFeedback } from "../components/use-tool-feedback";
import type { ToolPanelProps } from "../types";
import { commonPanelCopy, formatToolError } from "./panel-copy";

const TOOL_DRAFT_KEY = "tool:xml.format:draft:v1";
const AUTO_RUN_DELAY_MS = 350;

const panelCopy: Record<
  Locale,
  {
    title: string;
    placeholder: string;
    indentLabel: string;
    prettyAction: string;
    compactAction: string;
    downloadAction: string;
    downloaded: string;
    downloadFailed: string;
    successMessage: Record<XmlFormatInput["mode"], string>;
    errorMessage: Record<string, string>;
  }
> = {
  "zh-CN": {
    title: "XML 格式化",
    placeholder: "粘贴待处理的 XML 文本，可按需格式化、压缩并校验结构",
    indentLabel: "缩进",
    prettyAction: "格式化",
    compactAction: "压缩",
    downloadAction: "下载 XML",
    downloaded: "XML 文件已导出",
    downloadFailed: "导出失败",
    successMessage: {
      pretty: "XML 已格式化",
      compact: "XML 已压缩",
    },
    errorMessage: {
      INVALID_INPUT: "输入参数无效",
      INVALID_XML: "XML 解析失败",
      FORMAT_EMPTY_RESULT: "格式化结果为空",
    },
  },
  "en-US": {
    title: "XML Formatter",
    placeholder: "Paste XML content to format, minify, or validate",
    indentLabel: "Indent",
    prettyAction: "Pretty",
    compactAction: "Minify",
    downloadAction: "Download XML",
    downloaded: "XML file saved",
    downloadFailed: "Save failed",
    successMessage: {
      pretty: "XML formatted",
      compact: "XML minified",
    },
    errorMessage: {
      INVALID_INPUT: "Invalid input",
      INVALID_XML: "XML parse failed",
      FORMAT_EMPTY_RESULT: "Output is empty",
    },
  },
};

const defaultDraft: XmlFormatInput = {
  source: "",
  indent: 2,
  mode: "pretty",
};

const indentOptions = [2, 4] as const;

const isXmlMode = (value: unknown): value is XmlFormatInput["mode"] =>
  xmlFormatModeSchema.options.includes(value as XmlFormatInput["mode"]);

const normalizeXmlDraft = (
  value: Partial<XmlFormatInput> | XmlFormatInput | null | undefined,
): XmlFormatInput => {
  const draft = value ?? {};

  return {
    source: typeof draft.source === "string" ? draft.source : defaultDraft.source,
    indent:
      typeof draft.indent === "number" &&
      Number.isInteger(draft.indent) &&
      draft.indent >= 0 &&
      draft.indent <= 8
        ? draft.indent
        : defaultDraft.indent,
    mode: isXmlMode(draft.mode) ? draft.mode : defaultDraft.mode,
  };
};

export const XmlFormatPanel = ({
  autoCopyOnSuccess,
  bridge,
  locale,
  notify,
  storage,
}: ToolPanelProps) => {
  const common = commonPanelCopy[locale];
  const text = panelCopy[locale];
  const [rawDraft, setDraft] = useToolDraftState<XmlFormatInput>(
    storage,
    TOOL_DRAFT_KEY,
    defaultDraft,
  );
  const draft = useMemo(() => normalizeXmlDraft(rawDraft), [rawDraft]);
  const autoRunTimeoutRef = useRef<ReturnType<typeof window.setTimeout> | null>(
    null,
  );
  const [result, setResult] = useState<XmlFormatOutput | null>(null);
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
      clearAutoRunTimeout();
    },
    [],
  );

  const resetResult = () => {
    setResult(null);
    setFeedback(null);
  };

  const updateDraft = (value: Partial<XmlFormatInput>) => {
    const nextInput = normalizeXmlDraft({
      ...draft,
      ...value,
    });

    resetResult();
    setDraft(nextInput);
    scheduleFormat(nextInput);
  };

  const executeFormat = (input: XmlFormatInput) => {
    clearAutoRunTimeout();

    if (!input.source.trim()) {
      resetResult();
      return;
    }

    const nextResult = formatXml(input);

    if (!nextResult.ok) {
      setResult(null);
      setFeedback({
        tone: "error",
        text: formatToolError(nextResult.error, text.errorMessage),
      });
      return;
    }

    setResult(nextResult.data);
    reportSuccess(text.successMessage[input.mode], nextResult.data.formatted);
  };

  const scheduleFormat = (input: XmlFormatInput) => {
    clearAutoRunTimeout();

    if (!input.source.trim()) {
      resetResult();
      return;
    }

    autoRunTimeoutRef.current = window.setTimeout(() => {
      executeFormat(input);
    }, AUTO_RUN_DELAY_MS);
  };

  const runFormat = (mode: XmlFormatInput["mode"]) => {
    const nextInput = {
      ...draft,
      mode,
    };

    setDraft(nextInput);
    executeFormat(nextInput);
  };

  const handleDownload = async () => {
    if (!result) {
      return;
    }

    try {
      await bridge.saveTextFile("xml-result.xml", result.formatted);
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

  const isEnglish = locale === "en-US";

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

      <ToolPane hideHeader>
        <ToolCodeBlock
          placeholder={common.resultPlaceholder}
          value={result?.formatted ?? ""}
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
              aria-label={text.indentLabel}
              className={cn(
                "h-9 shrink-0 px-2.5 text-xs",
                isEnglish ? "w-[76px] sm:w-[88px]" : "w-[84px] sm:w-[96px]",
              )}
              value={String(draft.indent)}
              onValueChange={(value) => {
                const nextInput = {
                  ...draft,
                  indent: Number(value) as XmlFormatInput["indent"],
                };

                setDraft(nextInput);
                resetResult();
                scheduleFormat(nextInput);
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
