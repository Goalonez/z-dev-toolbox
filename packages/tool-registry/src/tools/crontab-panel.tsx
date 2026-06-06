import { useEffect, useRef, useState } from "react";

import {
  analyzeCrontab,
  type CronOutput
} from "@z-dev-toolbox/core";
import type { Locale } from "@z-dev-toolbox/shared";
import { Button, Input, cn } from "@z-dev-toolbox/ui";

import {
  ToolActionDock,
  ToolCodeBlock,
  ToolFieldLabel,
  ToolGrid,
  ToolPane,
  ToolSegmentedControl,
  toolInsetPanelClassName
} from "../components/tool-panel-kit";
import { useToolDraftState } from "../components/use-tool-draft-state";
import { useToolFeedback } from "../components/use-tool-feedback";
import type { ToolPanelProps } from "../types";
import { commonPanelCopy, formatToolError } from "./panel-copy";

const TOOL_DRAFT_KEY = "tool:crontab.preview:draft:v2";
const DEFAULT_COUNT = 15;
const AUTO_RUN_DELAY_MS = 300;

type CronDraftPrecision = "minute" | "second";

const examples = [
  {
    precision: "minute" as const,
    expression: "*/15 * * * *",
    label: {
      "zh-CN": "每 15 分钟",
      "en-US": "Every 15 minutes"
    }
  },
  {
    precision: "minute" as const,
    expression: "0 9 * * 1-5",
    label: {
      "zh-CN": "工作日 09:00",
      "en-US": "Weekdays 09:00"
    }
  },
  {
    precision: "second" as const,
    expression: "*/10 * * * * *",
    label: {
      "zh-CN": "每 10 秒",
      "en-US": "Every 10 seconds"
    }
  },
  {
    precision: "second" as const,
    expression: "0 */5 * * * *",
    label: {
      "zh-CN": "每 5 分钟整点秒",
      "en-US": "Every 5 min at 0s"
    }
  }
] as const;

const panelCopy: Record<
  Locale,
  {
    title: string;
    expressionPlaceholder: string;
    expressionLabel: string;
    builderLabel: string;
    examplesLabel: string;
    explainLabel: string;
    parseAction: string;
    generateAction: string;
    minutePrecision: string;
    secondPrecision: string;
    fieldLabels: Record<"second" | "minute" | "hour" | "dayOfMonth" | "month" | "dayOfWeek", string>;
    fieldPlaceholders: Record<"second" | "minute" | "hour" | "dayOfMonth" | "month" | "dayOfWeek", string>;
    explainText: Record<CronDraftPrecision, string>;
    errorMessage: Record<string, string>;
  }
> = {
  "zh-CN": {
    title: "Crontab",
    expressionPlaceholder: "直接输入 crontab 表达式，或使用下方字段生成",
    expressionLabel: "表达式",
    builderLabel: "生成公式",
    examplesLabel: "例子",
    explainLabel: "解释",
    parseAction: "解析表达式",
    generateAction: "生成公式",
    minutePrecision: "分钟级 5 位",
    secondPrecision: "秒级 6 位",
    fieldLabels: {
      second: "秒",
      minute: "分",
      hour: "时",
      dayOfMonth: "日",
      month: "月",
      dayOfWeek: "周"
    },
    fieldPlaceholders: {
      second: "秒",
      minute: "分",
      hour: "时",
      dayOfMonth: "日",
      month: "月",
      dayOfWeek: "周"
    },
    explainText: {
      minute:
        "5 位格式：分 时 日 月 周。\n* 表示该字段取任意值。\n, 用来列出多个离散值。\n- 表示一个连续范围。\n/ 表示步进频率，例如 */15 是每 15 个单位执行一次。\n? 仅在日和周字段里表示不指定。\n当“日”和“周”同时受限时，任一字段匹配即可触发。",
      second:
        "6 位格式：秒 分 时 日 月 周。\n* 表示该字段取任意值。\n, 用来列出多个离散值。\n- 表示一个连续范围。\n/ 表示步进频率，例如 */10 是每 10 秒执行一次。\n? 仅在日和周字段里表示不指定。\n当“日”和“周”同时受限时，任一字段匹配即可触发。"
    },
    errorMessage: {
      INVALID_INPUT: "输入参数无效",
      INVALID_CRON: "Crontab 解析失败"
    }
  },
  "en-US": {
    title: "Crontab",
    expressionPlaceholder: "Enter a crontab expression or build one from the fields below",
    expressionLabel: "Expression",
    builderLabel: "Formula builder",
    examplesLabel: "Examples",
    explainLabel: "Explanation",
    parseAction: "Parse",
    generateAction: "Generate",
    minutePrecision: "5-field minute",
    secondPrecision: "6-field second",
    fieldLabels: {
      second: "Sec",
      minute: "Min",
      hour: "Hour",
      dayOfMonth: "Day",
      month: "Month",
      dayOfWeek: "Week"
    },
    fieldPlaceholders: {
      second: "sec",
      minute: "min",
      hour: "hour",
      dayOfMonth: "day",
      month: "month",
      dayOfWeek: "week"
    },
    explainText: {
      minute:
        "5 fields: minute hour day month weekday.\n* matches any value.\n, lists multiple discrete values.\n- defines a continuous range.\n/ defines a step, such as */15 for every 15 units.\n? is only used in day/day-of-week to mean unspecified.\nWhen both day and weekday are limited, either match can trigger the schedule.",
      second:
        "6 fields: second minute hour day month weekday.\n* matches any value.\n, lists multiple discrete values.\n- defines a continuous range.\n/ defines a step, such as */10 for every 10 seconds.\n? is only used in day/day-of-week to mean unspecified.\nWhen both day and weekday are limited, either match can trigger the schedule."
    },
    errorMessage: {
      INVALID_INPUT: "Invalid input",
      INVALID_CRON: "Crontab parsing failed"
    }
  }
};

const stringifyCronResult = (result: CronOutput, locale: Locale) =>
  [
    `${locale === "zh-CN" ? "精度" : "Precision"}: ${
      result.precision === "second"
        ? panelCopy[locale].secondPrecision
        : panelCopy[locale].minutePrecision
    }`,
    `${locale === "zh-CN" ? "表达式" : "Expression"}: ${result.normalizedExpression}`,
    "",
    `${locale === "zh-CN" ? "字段说明" : "Fields"}:`,
    ...result.fields.map((item) => `- ${item.label}: ${item.summary}`),
    "",
    `${locale === "zh-CN" ? "未来执行时间" : "Next runs"}:`,
    ...result.nextRuns.map(
      (item) => `- ${item.localDateTime} | UTC ${item.utcDateTime}`,
    )
  ].join("\n");

const buildExpression = (
  precision: CronDraftPrecision,
  fields: Record<"second" | "minute" | "hour" | "dayOfMonth" | "month" | "dayOfWeek", string>,
) =>
  (
    precision === "second"
      ? [
          fields.second,
          fields.minute,
          fields.hour,
          fields.dayOfMonth,
          fields.month,
          fields.dayOfWeek
        ]
      : [
          fields.minute,
          fields.hour,
          fields.dayOfMonth,
          fields.month,
          fields.dayOfWeek
        ]
  ).join(" ");

export const CrontabPanel = ({
  autoCopyOnSuccess,
  bridge,
  locale,
  notify,
  storage
}: ToolPanelProps) => {
  const text = panelCopy[locale];
  const common = commonPanelCopy[locale];
  const [draft, setDraft] = useToolDraftState(storage, TOOL_DRAFT_KEY, {
    expression: "",
    precision: "minute" as CronDraftPrecision,
    second: "",
    minute: "",
    hour: "",
    dayOfMonth: "",
    month: "",
    dayOfWeek: ""
  });
  const [result, setResult] = useState<CronOutput | null>(null);
  const { feedback, setFeedback, copyText, reportSuccess } = useToolFeedback({
    autoCopyOnSuccess,
    bridge,
    copiedText: common.copied,
    copyFailedText: common.copyFailed,
    notify
  });
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

  const runAnalyze = (expression = draft.expression) => {
    clearAutoRunTimeout();

    if (!expression.trim()) {
      setResult(null);
      setFeedback(null);
      return;
    }

    const nextResult = analyzeCrontab({
      expression,
      count: DEFAULT_COUNT,
      fromTimestamp: Date.now()
    });

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
      locale === "zh-CN" ? "Crontab 已解析" : "Parsed",
      stringifyCronResult(nextResult.data, locale),
    );
  };

  const scheduleAnalyze = (expression: string) => {
    clearAutoRunTimeout();

    if (!expression.trim()) {
      setResult(null);
      setFeedback(null);
      return;
    }

    autoRunTimeoutRef.current = window.setTimeout(() => {
      runAnalyze(expression);
    }, AUTO_RUN_DELAY_MS);
  };

  const updateDraft = (value: Partial<typeof draft>) => {
    setDraft((current) => ({ ...current, ...value }));
    setResult(null);
    setFeedback(null);
  };

  const updateExpression = (expression: string) => {
    setDraft((current) => ({ ...current, expression }));
    setResult(null);
    setFeedback(null);
    scheduleAnalyze(expression);
  };

  const fieldOrder =
    draft.precision === "second"
      ? (["second", "minute", "hour", "dayOfMonth", "month", "dayOfWeek"] as const)
      : (["minute", "hour", "dayOfMonth", "month", "dayOfWeek"] as const);

  return (
    <ToolGrid docked>
      <ToolPane title={text.title}>
        <div className="space-y-2">
          <ToolFieldLabel>{text.expressionLabel}</ToolFieldLabel>
          <Input
            className="h-12 font-mono text-[13px]"
            placeholder={text.expressionPlaceholder}
            spellCheck={false}
            value={draft.expression}
            onChange={(event) => {
              updateExpression(event.currentTarget.value);
            }}
          />
        </div>

        <div className="space-y-3">
          <ToolFieldLabel>{text.builderLabel}</ToolFieldLabel>
          <ToolSegmentedControl
            className="w-fit"
            value={draft.precision}
            options={[
              { value: "minute", label: text.minutePrecision },
              { value: "second", label: text.secondPrecision }
            ]}
            onValueChange={(value) => {
              updateDraft({ precision: value as CronDraftPrecision });
            }}
          />
          <div className="grid gap-2 md:grid-cols-3 xl:grid-cols-6">
            {fieldOrder.map((field) => (
              <div key={field} className="space-y-2">
                <ToolFieldLabel>{text.fieldLabels[field]}</ToolFieldLabel>
                <Input
                  className="h-10 font-mono text-[13px]"
                  placeholder={text.fieldPlaceholders[field]}
                  spellCheck={false}
                  value={draft[field]}
                  onChange={(event) => {
                    updateDraft({ [field]: event.currentTarget.value });
                  }}
                />
              </div>
            ))}
          </div>
        </div>

        <div className="space-y-2">
          <ToolFieldLabel>{text.examplesLabel}</ToolFieldLabel>
          <div className="flex flex-wrap gap-2">
            {examples.map((example) => (
              <Button
                key={example.expression}
                size="sm"
                variant="secondary"
                onClick={() => {
                  setDraft((current) => ({
                    ...current,
                    precision: example.precision,
                    expression: example.expression
                  }));
                  runAnalyze(example.expression);
                }}
              >
                {example.label[locale]}
              </Button>
            ))}
          </div>
        </div>

        <div className="space-y-2">
          <ToolFieldLabel>{text.explainLabel}</ToolFieldLabel>
          <div
            className={cn(
              "rounded-[24px] border px-4 py-3 text-sm leading-6 text-muted whitespace-pre-line",
              toolInsetPanelClassName,
            )}
          >
            {text.explainText[draft.precision]}
          </div>
        </div>
      </ToolPane>

      <ToolPane hideHeader>
        <ToolCodeBlock
          placeholder={common.resultPlaceholder}
          value={result ? stringifyCronResult(result, locale) : ""}
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
                runAnalyze();
              }}
            >
              {text.parseAction}
            </Button>
            <Button
              size="sm"
              variant="secondary"
              onClick={() => {
                const expression = buildExpression(draft.precision, {
                  second: draft.second,
                  minute: draft.minute,
                  hour: draft.hour,
                  dayOfMonth: draft.dayOfMonth,
                  month: draft.month,
                  dayOfWeek: draft.dayOfWeek
                });

                setDraft((current) => ({
                  ...current,
                  expression
                }));
                runAnalyze(expression);
              }}
            >
              {text.generateAction}
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                setDraft({
                  expression: "",
                  precision: "minute",
                  second: "",
                  minute: "",
                  hour: "",
                  dayOfMonth: "",
                  month: "",
                  dayOfWeek: ""
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
                  void copyText(stringifyCronResult(result, locale));
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
