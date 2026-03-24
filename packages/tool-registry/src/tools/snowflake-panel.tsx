import { useState } from "react";

import {
  generateSnowflakeIds,
  type SnowflakeOutput,
} from "@z-dev-toolbox/core";
import type { Locale } from "@z-dev-toolbox/shared";
import { Button, Input } from "@z-dev-toolbox/ui";

import {
  ToolActionDock,
  ToolCodeBlock,
  ToolFieldLabel,
  ToolGrid,
  ToolPane,
} from "../components/tool-panel-kit";
import { useToolDraftState } from "../components/use-tool-draft-state";
import { useToolFeedback } from "../components/use-tool-feedback";
import type { ToolPanelProps } from "../types";
import { commonPanelCopy, formatToolError } from "./panel-copy";

const TOOL_DRAFT_KEY = "tool:snowflake.generate:draft:v3";

interface SnowflakeDraft {
  timestamp: string;
  datacenterId: string;
  workerId: string;
  sequenceStart: string;
  epoch: string;
  count: string;
}

const createDefaultDraft = (): SnowflakeDraft => ({
  timestamp: String(Date.now()),
  datacenterId: "1",
  workerId: "1",
  sequenceStart: "0",
  epoch: "1288834974657",
  count: "10",
});

const snowflakeFieldOrder: Array<keyof SnowflakeDraft> = [
  "timestamp",
  "datacenterId",
  "workerId",
  "sequenceStart",
  "epoch",
  "count",
];

const panelCopy: Record<
  Locale,
  {
    title: string;
    runAction: string;
    fields: Record<keyof SnowflakeDraft, string>;
    placeholders: Record<keyof SnowflakeDraft, string>;
    errorMessage: Record<string, string>;
  }
> = {
  "zh-CN": {
    title: "雪花 ID",
    runAction: "生成 ID",
    fields: {
      timestamp: "毫秒时间戳",
      datacenterId: "机房 ID",
      workerId: "工作机器 ID",
      sequenceStart: "序列号起点",
      epoch: "自定义纪元",
      count: "生成数量",
    },
    placeholders: {
      timestamp: "毫秒时间戳",
      datacenterId: "0-31",
      workerId: "0-31",
      sequenceStart: "0-4095",
      epoch: "毫秒时间戳",
      count: "1-20",
    },
    errorMessage: {
      INVALID_INPUT: "输入参数无效",
      INVALID_TIMESTAMP: "时间戳非法",
      SNOWFLAKE_FAILED: "雪花 ID 生成失败",
    },
  },
  "en-US": {
    title: "Snowflake",
    runAction: "Generate",
    fields: {
      timestamp: "Timestamp",
      datacenterId: "Datacenter ID",
      workerId: "Worker ID",
      sequenceStart: "Sequence Start",
      epoch: "Epoch",
      count: "Count",
    },
    placeholders: {
      timestamp: "Milliseconds",
      datacenterId: "0-31",
      workerId: "0-31",
      sequenceStart: "0-4095",
      epoch: "Milliseconds",
      count: "1-20",
    },
    errorMessage: {
      INVALID_INPUT: "Invalid input",
      INVALID_TIMESTAMP: "Invalid timestamp",
      SNOWFLAKE_FAILED: "Snowflake generation failed",
    },
  },
};

const stringifySnowflake = (result: SnowflakeOutput) =>
  result.items.map((item) => item.id).join("\n");

const parseNumberField = (value: string) =>
  value.trim() === "" ? Number.NaN : Number(value);

export const SnowflakePanel = ({
  autoCopyOnSuccess,
  bridge,
  locale,
  notify,
  storage,
}: ToolPanelProps) => {
  const text = panelCopy[locale];
  const common = commonPanelCopy[locale];
  const [draft, setDraft] = useToolDraftState<SnowflakeDraft>(
    storage,
    TOOL_DRAFT_KEY,
    createDefaultDraft(),
  );
  const [result, setResult] = useState<SnowflakeOutput | null>(null);
  const { feedback, setFeedback, copyText, reportSuccess } = useToolFeedback({
    autoCopyOnSuccess,
    bridge,
    copiedText: common.copied,
    copyFailedText: common.copyFailed,
    notify,
  });

  const updateDraft = (value: Partial<SnowflakeDraft>) => {
    setDraft((current) => ({ ...current, ...value }));
    setResult(null);
    setFeedback(null);
  };

  const runGenerate = () => {
    const nextResult = generateSnowflakeIds({
      workerId: parseNumberField(draft.workerId),
      datacenterId: parseNumberField(draft.datacenterId),
      count: parseNumberField(draft.count),
      sequenceStart: parseNumberField(draft.sequenceStart),
      timestamp: parseNumberField(draft.timestamp),
      epoch: parseNumberField(draft.epoch),
    });

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
      locale === "zh-CN" ? "雪花 ID 已生成" : "Generated",
      stringifySnowflake(nextResult.data),
    );
  };

  return (
    <ToolGrid docked>
      <ToolPane title={text.title}>
        <div className="grid gap-3 md:grid-cols-2">
          {snowflakeFieldOrder.map((field) => (
            <div key={field} className="space-y-2">
              <ToolFieldLabel>{text.fields[field]}</ToolFieldLabel>
              <Input
                className="h-11 font-mono text-[13px]"
                inputMode="numeric"
                placeholder={text.placeholders[field]}
                spellCheck={false}
                value={draft[field]}
                onChange={(event) => {
                  updateDraft({ [field]: event.currentTarget.value });
                }}
              />
            </div>
          ))}
        </div>
      </ToolPane>

      <ToolPane hideHeader>
        <ToolCodeBlock
          placeholder={common.resultPlaceholder}
          value={result ? stringifySnowflake(result) : ""}
        />
      </ToolPane>

      <ToolActionDock
        feedback={feedback}
        leftActions={
          <>
            <Button
              data-tool-primary-action="true"
              size="sm"
              onClick={runGenerate}
            >
              {text.runAction}
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                setDraft(createDefaultDraft());
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
                  void copyText(stringifySnowflake(result));
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
