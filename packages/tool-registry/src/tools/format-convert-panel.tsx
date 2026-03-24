import { useState } from "react";

import {
  convertDataFormat,
  type DataFormat,
  type FormatConvertInput,
  type FormatConvertOutput
} from "@z-dev-toolbox/core";
import type { Locale } from "@z-dev-toolbox/shared";
import { Button, Textarea } from "@z-dev-toolbox/ui";

import {
  ToolActionDock,
  ToolCodeBlock,
  ToolControlField,
  ToolGrid,
  ToolPane,
  ToolSelect
} from "../components/tool-panel-kit";
import { useToolDraftState } from "../components/use-tool-draft-state";
import { useToolFeedback } from "../components/use-tool-feedback";
import type { ToolPanelProps } from "../types";
import { commonPanelCopy, formatToolError } from "./panel-copy";

const TOOL_DRAFT_KEY = "tool:format.convert:draft:v2";

const formatLabels: Record<DataFormat, Record<Locale, string>> = {
  json: {
    "zh-CN": "JSON",
    "en-US": "JSON"
  },
  yaml: {
    "zh-CN": "YAML",
    "en-US": "YAML"
  },
  toml: {
    "zh-CN": "TOML",
    "en-US": "TOML"
  },
  xml: {
    "zh-CN": "XML",
    "en-US": "XML"
  },
  csv: {
    "zh-CN": "CSV",
    "en-US": "CSV"
  },
  properties: {
    "zh-CN": "properties",
    "en-US": "properties"
  },
  html: {
    "zh-CN": "HTML",
    "en-US": "HTML"
  },
  http: {
    "zh-CN": "HTTP",
    "en-US": "HTTP"
  }
};

const panelCopy: Record<
  Locale,
  {
    title: string;
    placeholder: string;
    sourceFormatLabel: string;
    targetFormatLabel: string;
    autoOption: string;
    runAction: string;
    successMessage: string;
    errorMessage: Record<string, string>;
  }
> = {
  "zh-CN": {
    title: "格式转换",
    placeholder: "粘贴待转换内容，并选择源格式和目标格式后开始转换",
    sourceFormatLabel: "源格式",
    targetFormatLabel: "目标格式",
    autoOption: "自动识别",
    runAction: "开始转换",
    successMessage: "格式转换完成",
    errorMessage: {
      INVALID_INPUT: "输入参数无效",
      FORMAT_DETECT_FAILED: "自动识别失败",
      FORMAT_CONVERT_FAILED: "格式转换失败"
    }
  },
  "en-US": {
    title: "Format Converter",
    placeholder: "Paste content to convert, then choose the source and target formats",
    sourceFormatLabel: "Source format",
    targetFormatLabel: "Target format",
    autoOption: "Auto detect",
    runAction: "Convert",
    successMessage: "Converted",
    errorMessage: {
      INVALID_INPUT: "Invalid input",
      FORMAT_DETECT_FAILED: "Auto detect failed",
      FORMAT_CONVERT_FAILED: "Format conversion failed"
    }
  }
};

const formatOptions: DataFormat[] = [
  "json",
  "yaml",
  "toml",
  "xml",
  "csv",
  "properties",
  "html",
  "http"
];

const defaultDraft: FormatConvertInput = {
  source: "",
  sourceFormat: "auto",
  targetFormat: "yaml",
  indent: 2
};

export const FormatConvertPanel = ({
  autoCopyOnSuccess,
  bridge,
  locale,
  notify,
  storage
}: ToolPanelProps) => {
  const common = commonPanelCopy[locale];
  const text = panelCopy[locale];
  const [draft, setDraft] = useToolDraftState<FormatConvertInput>(
    storage,
    TOOL_DRAFT_KEY,
    defaultDraft,
  );
  const [result, setResult] = useState<FormatConvertOutput | null>(null);
  const { feedback, setFeedback, copyText, reportSuccess } = useToolFeedback({
    autoCopyOnSuccess,
    bridge,
    copiedText: common.copied,
    copyFailedText: common.copyFailed,
    notify
  });

  const updateDraft = (value: Partial<FormatConvertInput>) => {
    setResult(null);
    setFeedback(null);
    setDraft((current) => ({ ...current, ...value }));
  };

  const runConvert = () => {
    const nextResult = convertDataFormat(draft);

    if (!nextResult.ok) {
      setResult(null);
      setFeedback({
        tone: "error",
        text: formatToolError(nextResult.error, text.errorMessage)
      });
      return;
    }

    setResult(nextResult.data);
    reportSuccess(
      `${text.successMessage}: ${formatLabels[nextResult.data.sourceFormat][locale]} -> ${formatLabels[nextResult.data.targetFormat][locale]}`,
      nextResult.data.result,
    );
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

      <ToolPane hideHeader>
        <ToolCodeBlock
          placeholder={common.resultPlaceholder}
          value={result?.result ?? ""}
        />
      </ToolPane>

      <ToolActionDock
        feedback={feedback}
        leftActions={
          <>
            <ToolControlField label={text.sourceFormatLabel}>
              <ToolSelect
                aria-label={text.sourceFormatLabel}
                className="h-7 min-w-0 max-w-full flex-1 border-0 bg-transparent px-0 pr-6 text-xs shadow-none hover:bg-transparent focus:border-0 focus:shadow-none sm:min-w-28"
                value={draft.sourceFormat}
                onValueChange={(value) => {
                  updateDraft({
                    sourceFormat: value as FormatConvertInput["sourceFormat"]
                  });
                }}
              >
                <option value="auto">{text.autoOption}</option>
                {formatOptions.map((format) => (
                  <option
                    key={format}
                    value={format}
                  >
                    {formatLabels[format][locale]}
                  </option>
                ))}
              </ToolSelect>
            </ToolControlField>
            <ToolControlField label={text.targetFormatLabel}>
              <ToolSelect
                aria-label={text.targetFormatLabel}
                className="h-7 min-w-0 max-w-full flex-1 border-0 bg-transparent px-0 pr-6 text-xs shadow-none hover:bg-transparent focus:border-0 focus:shadow-none sm:min-w-28"
                value={draft.targetFormat}
                onValueChange={(value) => {
                  updateDraft({
                    targetFormat: value as DataFormat
                  });
                }}
              >
                {formatOptions.map((format) => (
                  <option
                    key={format}
                    value={format}
                  >
                    {formatLabels[format][locale]}
                  </option>
                ))}
              </ToolSelect>
            </ToolControlField>
            <Button
              data-tool-primary-action="true"
              size="sm"
              onClick={runConvert}
            >
              {text.runAction}
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                setDraft(defaultDraft);
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
                if (result) {
                  void copyText(result.result);
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
