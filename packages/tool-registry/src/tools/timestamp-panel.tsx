import { useCallback, useEffect, useRef, useState } from "react";

import {
  convertTimestamp,
  type TimestampInput,
  type TimestampOutput,
} from "@z-dev-toolbox/core";
import type { Locale } from "@z-dev-toolbox/shared";
import { Button, Input } from "@z-dev-toolbox/ui";

import {
  ToolActionDock,
  ToolCodeBlock,
  ToolGrid,
  ToolPane,
} from "../components/tool-panel-kit";
import { useToolFeedback } from "../components/use-tool-feedback";
import type { ToolPanelProps } from "../types";
import { commonPanelCopy, formatToolError } from "./panel-copy";

const panelCopy: Record<
  Locale,
  {
    title: string;
    inputPlaceholder: string;
    runAction: string;
    errorMessage: Record<string, string>;
  }
> = {
  "zh-CN": {
    title: "时间转换",
    inputPlaceholder: "输入时间戳或日期时间，系统会自动识别格式并完成转换",
    runAction: "转换",
    errorMessage: {
      INVALID_INPUT: "输入参数无效",
      TIMESTAMP_CONVERT_FAILED: "时间转换失败",
    },
  },
  "en-US": {
    title: "Time Converter",
    inputPlaceholder:
      "Enter a timestamp or datetime string and it will be converted automatically",
    runAction: "Convert",
    errorMessage: {
      INVALID_INPUT: "Invalid input",
      TIMESTAMP_CONVERT_FAILED: "Time conversion failed",
    },
  },
};

const inputKindLabel: Record<
  TimestampOutput["inputKind"],
  Record<Locale, string>
> = {
  seconds: {
    "zh-CN": "秒级时间戳",
    "en-US": "Seconds timestamp",
  },
  milliseconds: {
    "zh-CN": "毫秒时间戳",
    "en-US": "Milliseconds timestamp",
  },
  datetime: {
    "zh-CN": "日期时间",
    "en-US": "Datetime",
  },
};

const getDisplayDateTime = (
  value: Pick<
    TimestampOutput,
    | "epochMilliseconds"
    | "localDateTime"
    | "utcDateTime"
    | "localDateTimeWithMilliseconds"
    | "utcDateTimeWithMilliseconds"
  >,
  zone: "local" | "utc",
) => {
  const hasMilliseconds = value.epochMilliseconds % 1000 !== 0;

  if (zone === "local") {
    return hasMilliseconds
      ? value.localDateTimeWithMilliseconds
      : value.localDateTime;
  }

  return hasMilliseconds
    ? value.utcDateTimeWithMilliseconds
    : value.utcDateTime;
};

const stringifyTimestampResult = (result: TimestampOutput, locale: Locale) =>
  [
    `${locale === "zh-CN" ? "识别类型" : "Detected type"}: ${inputKindLabel[result.inputKind][locale]}`,
    `${locale === "zh-CN" ? "本地时间" : "Local time"}: ${getDisplayDateTime(result, "local")}`,
    `${locale === "zh-CN" ? "UTC 时间" : "UTC time"}: ${getDisplayDateTime(result, "utc")}`,
    `ISO: ${result.isoString}`,
    `${locale === "zh-CN" ? "秒级时间戳" : "Epoch seconds"}: ${result.epochSeconds}`,
    `${locale === "zh-CN" ? "毫秒时间戳" : "Epoch milliseconds"}: ${result.epochMilliseconds}`,
  ].join("\n");

const createCurrentTimestampInput = (): TimestampInput => ({
  value: String(Date.now()),
  source: "auto",
});

export const TimestampPanel = ({
  autoCopyOnSuccess,
  bridge,
  locale,
  notify,
}: ToolPanelProps) => {
  const text = panelCopy[locale];
  const common = commonPanelCopy[locale];
  const [draft, setDraft] = useState<TimestampInput>(
    createCurrentTimestampInput,
  );
  const [result, setResult] = useState<TimestampOutput | null>(null);
  const initializedRef = useRef(false);
  const { feedback, setFeedback, copyText, reportSuccess } = useToolFeedback({
    autoCopyOnSuccess,
    bridge,
    copiedText: common.copied,
    copyFailedText: common.copyFailed,
    notify,
  });

  const executeConvert = useCallback((input: TimestampInput) => {
    if (!input.value.trim()) {
      setResult(null);
      setFeedback(null);
      return;
    }

    const nextResult = convertTimestamp(input);

    if (!nextResult.ok) {
      setResult(null);
      setFeedback({
        tone: "error",
        text: formatToolError(nextResult.error, text.errorMessage),
      });
      return;
    }

    setResult(nextResult.data);
    reportSuccess(
      locale === "zh-CN" ? "时间解析完成" : "Parsed",
      stringifyTimestampResult(nextResult.data, locale),
    );
  }, [locale, reportSuccess, setFeedback, text.errorMessage]);

  useEffect(() => {
    if (initializedRef.current) {
      return;
    }

    initializedRef.current = true;

    const nextInput = createCurrentTimestampInput();

    setDraft(nextInput);
    executeConvert(nextInput);
  }, [executeConvert]);

  const updateAndConvert = (value: string) => {
    const nextInput: TimestampInput = {
      value,
      source: "auto",
    };

    setDraft(nextInput);
    executeConvert(nextInput);
  };

  return (
    <ToolGrid docked>
      <ToolPane title={text.title}>
        <Input
          className="h-12 font-mono text-[13px]"
          placeholder={text.inputPlaceholder}
          spellCheck={false}
          value={draft.value}
          onChange={(event) => {
            updateAndConvert(event.currentTarget.value);
          }}
        />
      </ToolPane>

      <ToolPane hideHeader>
        <ToolCodeBlock
          placeholder={common.resultPlaceholder}
          value={result ? stringifyTimestampResult(result, locale) : ""}
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
                executeConvert({
                  value: draft.value,
                  source: "auto",
                });
              }}
            >
              {text.runAction}
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                updateAndConvert(String(Date.now()));
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
                  void copyText(stringifyTimestampResult(result, locale));
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
