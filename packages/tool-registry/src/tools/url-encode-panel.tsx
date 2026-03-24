import { useState } from "react";

import {
  transformUrlEncoding,
  type UrlEncodeInput,
  type UrlEncodeOutput
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

const TOOL_DRAFT_KEY = "tool:url.encode:draft";

const panelCopy: Record<
  Locale,
  {
    title: string;
    inputPlaceholder: string;
    spaceModeLabel: string;
    encodeAction: string;
    decodeAction: string;
    errorMessage: Record<string, string>;
  }
> = {
  "zh-CN": {
    title: "URL 编码",
    inputPlaceholder: "输入 URL、路径或查询参数，并按需选择编码或解码",
    spaceModeLabel: "空格规则",
    encodeAction: "编码",
    decodeAction: "解码",
    errorMessage: {
      INVALID_INPUT: "输入参数无效",
      URL_TRANSFORM_FAILED: "URL 编码处理失败"
    }
  },
  "en-US": {
    title: "URL Encode",
    inputPlaceholder: "Enter a URL, path, or query string to encode or decode",
    spaceModeLabel: "Space mode",
    encodeAction: "Encode",
    decodeAction: "Decode",
    errorMessage: {
      INVALID_INPUT: "Invalid input",
      URL_TRANSFORM_FAILED: "URL transform failed"
    }
  }
};

export const UrlEncodePanel = ({
  autoCopyOnSuccess,
  bridge,
  locale,
  notify,
  storage
}: ToolPanelProps) => {
  const text = panelCopy[locale];
  const common = commonPanelCopy[locale];
  const [draft, setDraft] = useToolDraftState<UrlEncodeInput>(storage, TOOL_DRAFT_KEY, {
    source: "",
    mode: "encode",
    spaceMode: "percent"
  });
  const [result, setResult] = useState<UrlEncodeOutput | null>(null);
  const { feedback, setFeedback, copyText, reportSuccess } = useToolFeedback({
    autoCopyOnSuccess,
    bridge,
    copiedText: common.copied,
    copyFailedText: common.copyFailed,
    notify
  });

  const updateDraft = (value: Partial<UrlEncodeInput>) => {
    setResult(null);
    setFeedback(null);
    setDraft((current) => ({ ...current, ...value }));
  };

  const runTransform = (mode: UrlEncodeInput["mode"]) => {
    const nextInput = {
      ...draft,
      mode
    };

    setDraft(nextInput);

    const nextResult = transformUrlEncoding(nextInput);

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
      locale === "zh-CN" ? "URL 处理完成" : "Done",
      nextResult.data.result,
    );
  };

  return (
    <ToolGrid docked>
      <ToolPane title={text.title}>
        <Textarea
          className="min-h-[18rem] max-h-[60dvh] flex-1 resize-none font-mono text-[13px] leading-6 xl:min-h-0 xl:max-h-none"
          placeholder={text.inputPlaceholder}
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
            <ToolControlField label={text.spaceModeLabel}>
              <ToolSelect
                aria-label={text.spaceModeLabel}
                className="h-7 min-w-0 max-w-full flex-1 pr-6 sm:min-w-24"
                embedded
                value={draft.spaceMode}
                onValueChange={(value) => {
                  updateDraft({
                    spaceMode: value as UrlEncodeInput["spaceMode"]
                  });
                }}
              >
                <option value="percent">%20</option>
                <option value="plus">+</option>
              </ToolSelect>
            </ToolControlField>
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
                  spaceMode: "percent"
                });
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
