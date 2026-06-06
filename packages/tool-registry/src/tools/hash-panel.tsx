import { useEffect, useRef, useState } from "react";

import { hashText, type HashOutput } from "@z-dev-toolbox/core";
import type { Locale } from "@z-dev-toolbox/shared";
import { Button, Textarea } from "@z-dev-toolbox/ui";

import {
  ToolActionDock,
  ToolCodeBlock,
  ToolGrid,
  ToolPane
} from "../components/tool-panel-kit";
import { useToolDraftState } from "../components/use-tool-draft-state";
import { useToolFeedback } from "../components/use-tool-feedback";
import type { ToolPanelProps } from "../types";
import { commonPanelCopy, formatToolError } from "./panel-copy";

const TOOL_DRAFT_KEY = "tool:hash.digest:draft";
const AUTO_RUN_DELAY_MS = 200;

const panelCopy: Record<
  Locale,
  {
    title: string;
    inputPlaceholder: string;
    errorMessage: Record<string, string>;
  }
> = {
  "zh-CN": {
    title: "哈希",
    inputPlaceholder: "输入任意文本，一次生成常用哈希算法的计算结果",
    errorMessage: {
      INVALID_INPUT: "输入参数无效",
      HASH_UNAVAILABLE: "当前环境不支持哈希能力",
      HASH_FAILED: "哈希计算失败"
    }
  },
  "en-US": {
    title: "Hash",
    inputPlaceholder: "Enter any text to generate common hash digests",
    errorMessage: {
      INVALID_INPUT: "Invalid input",
      HASH_UNAVAILABLE: "Hash is unavailable",
      HASH_FAILED: "Hash failed"
    }
  }
};

const stringifyHashResult = (result: HashOutput) =>
  result.items
    .map((item) => `${item.algorithm}\nhex    ${item.hex}\nbase64 ${item.base64}`)
    .join("\n\n");

export const HashPanel = ({
  autoCopyOnSuccess,
  bridge,
  locale,
  notify,
  storage
}: ToolPanelProps) => {
  const text = panelCopy[locale];
  const common = commonPanelCopy[locale];
  const [source, setSource] = useToolDraftState(storage, TOOL_DRAFT_KEY, "");
  const [result, setResult] = useState<HashOutput | null>(null);
  const { feedback, setFeedback, copyText, reportSuccess } = useToolFeedback({
    autoCopyOnSuccess,
    bridge,
    copiedText: common.copied,
    copyFailedText: common.copyFailed,
    notify
  });
  const latestRunRef = useRef(0);
  const autoRunTimeoutRef = useRef<ReturnType<typeof window.setTimeout> | null>(
    null,
  );

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

  const executeHash = async (value: string) => {
    const runId = latestRunRef.current + 1;

    latestRunRef.current = runId;

    if (value.length === 0) {
      setResult(null);
      setFeedback(null);
      return;
    }

    const nextResult = await hashText({ source: value });

    if (latestRunRef.current !== runId) {
      return;
    }

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
      locale === "zh-CN" ? "哈希计算完成" : "Hashed",
      stringifyHashResult(nextResult.data),
    );
  };

  const scheduleHash = (value: string) => {
    clearAutoRunTimeout();

    if (value.length === 0) {
      latestRunRef.current += 1;
      setResult(null);
      setFeedback(null);
      return;
    }

    autoRunTimeoutRef.current = window.setTimeout(() => {
      void executeHash(value);
    }, AUTO_RUN_DELAY_MS);
  };

  return (
    <ToolGrid docked>
      <ToolPane title={text.title}>
        <Textarea
          className="min-h-[18rem] max-h-[60dvh] flex-1 resize-none font-mono text-[13px] leading-6 xl:min-h-0 xl:max-h-none"
          placeholder={text.inputPlaceholder}
          spellCheck={false}
          value={source}
          onChange={(event) => {
            const nextSource = event.currentTarget.value;

            setSource(nextSource);
            setResult(null);
            setFeedback(null);
            scheduleHash(nextSource);
          }}
        />
      </ToolPane>

      <ToolPane hideHeader>
        <ToolCodeBlock
          placeholder={common.resultPlaceholder}
          value={result ? stringifyHashResult(result) : ""}
        />
      </ToolPane>

      <ToolActionDock
        feedback={feedback}
        leftActions={
          <>
            <Button
              data-tool-primary-action="true"
              size="sm"
              onClick={() => {
                clearAutoRunTimeout();
                void executeHash(source);
              }}
            >
              {common.run}
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                setSource("");
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
                  void copyText(stringifyHashResult(result));
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
