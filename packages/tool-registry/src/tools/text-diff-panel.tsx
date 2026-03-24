import { useEffect, useMemo, useState } from "react";

import {
  diffText,
  type TextDiffHighlightMode,
  type TextDiffIgnoreMode,
  type TextDiffRow
} from "@z-dev-toolbox/core";
import type { Locale } from "@z-dev-toolbox/shared";
import { Button } from "@z-dev-toolbox/ui";

import {
  ToolActionBar,
  ToolControlField,
  ToolGrid,
  ToolPane,
  ToolSelect
} from "../components/tool-panel-kit";
import { useToolDraftState } from "../components/use-tool-draft-state";
import { useToolFeedback } from "../components/use-tool-feedback";
import type { ToolPanelProps } from "../types";
import { formatToolError } from "./panel-copy";
import { TextDiffViewer } from "./text-diff-viewer";

const TOOL_DRAFT_KEY = "tool:text.diff:draft:v4";

interface DiffRange {
  start: number;
  end: number;
}

const splitLines = (value: string) =>
  value.length > 0 ? value.split("\n") : [];

const buildFallbackRows = (before: string, after: string): TextDiffRow[] => {
  const beforeLines = splitLines(before);
  const afterLines = splitLines(after);
  const rowCount = Math.max(beforeLines.length, afterLines.length);
  const rows: TextDiffRow[] = [];

  for (let index = 0; index < rowCount; index += 1) {
    const hasLeft = index < beforeLines.length;
    const hasRight = index < afterLines.length;
    const leftText = beforeLines[index] ?? "";
    const rightText = afterLines[index] ?? "";

    rows.push({
      kind: hasLeft && hasRight ? (leftText === rightText ? "equal" : "changed") : hasLeft ? "removed" : "added",
      leftLineNumber: hasLeft ? index + 1 : null,
      rightLineNumber: hasRight ? index + 1 : null,
      leftText,
      rightText
    });
  }

  return rows;
};

const buildDiffRanges = (rows: TextDiffRow[]) => {
  const ranges: DiffRange[] = [];
  let currentStart: number | null = null;

  rows.forEach((row, index) => {
    if (row.kind === "equal") {
      if (currentStart !== null) {
        ranges.push({
          start: currentStart,
          end: index - 1
        });
        currentStart = null;
      }
      return;
    }

    if (currentStart === null) {
      currentStart = index;
    }
  });

  if (currentStart !== null) {
    ranges.push({
      start: currentStart,
      end: rows.length - 1
    });
  }

  return ranges;
};

const panelCopy: Record<
  Locale,
  {
    title: string;
    beforeLabel: string;
    afterLabel: string;
    highlightLabel: string;
    ignoreLabel: string;
    highlightOptions: Record<TextDiffHighlightMode, string>;
    ignoreOptions: Record<TextDiffIgnoreMode, string>;
    clear: string;
    previousDiff: string;
    nextDiff: string;
    diffCount: (count: number) => string;
    errorMessage: Record<string, string>;
  }
> = {
  "zh-CN": {
    title: "文本对比",
    beforeLabel: "原始内容",
    afterLabel: "修改后内容",
    highlightLabel: "高亮",
    ignoreLabel: "忽略",
    highlightOptions: {
      line: "高亮显示行",
      word: "高亮显示单词",
      split: "高亮显示拆分的更改",
      character: "高亮显示字符",
      none: "不高亮显示"
    },
    ignoreOptions: {
      none: "不忽略",
      trim: "修整空白",
      space: "忽略空格",
      "space-and-empty-lines": "忽略空格和空行"
    },
    clear: "重置",
    previousDiff: "上一个差异",
    nextDiff: "下一个差异",
    diffCount: (count) => `${count} 个差异点`,
    errorMessage: {
      INVALID_INPUT: "输入参数无效",
      DIFF_FAILED: "文本对比失败"
    }
  },
  "en-US": {
    title: "Text Diff",
    beforeLabel: "Original",
    afterLabel: "Revised",
    highlightLabel: "Highlight",
    ignoreLabel: "Ignore",
    highlightOptions: {
      line: "Highlight lines",
      word: "Highlight words",
      split: "Highlight split changes",
      character: "Highlight characters",
      none: "No highlighting"
    },
    ignoreOptions: {
      none: "Do not ignore",
      trim: "Trim whitespace",
      space: "Ignore spaces",
      "space-and-empty-lines": "Ignore spaces and empty lines"
    },
    clear: "Reset",
    previousDiff: "Previous diff",
    nextDiff: "Next diff",
    diffCount: (count) => `${count} diff points`,
    errorMessage: {
      INVALID_INPUT: "Invalid input",
      DIFF_FAILED: "Diff failed"
    }
  }
};

export const TextDiffPanel = ({
  bridge,
  locale,
  notify,
  storage
}: ToolPanelProps) => {
  const text = panelCopy[locale];
  const [draft, setDraft] = useToolDraftState(storage, TOOL_DRAFT_KEY, {
    before: "",
    after: "",
    highlightMode: "line" as TextDiffHighlightMode,
    ignoreMode: "none" as TextDiffIgnoreMode
  });
  const [activeDiffIndex, setActiveDiffIndex] = useState(-1);
  const { feedback, setFeedback } = useToolFeedback({
    autoCopyOnSuccess: false,
    bridge,
    copiedText: "",
    copyFailedText: "",
    notify
  });
  const diffResult = useMemo(
    () =>
      diffText({
        before: draft.before,
        after: draft.after,
        highlightMode: draft.highlightMode,
        ignoreMode: draft.ignoreMode
      }),
    [draft.after, draft.before, draft.highlightMode, draft.ignoreMode]
  );

  useEffect(() => {
    if (diffResult.ok) {
      setFeedback(null);
      return;
    }

    setFeedback({
      tone: "error",
      text: formatToolError(diffResult.error, text.errorMessage)
    });
  }, [diffResult, setFeedback, text.errorMessage]);

  const rows = useMemo(() => {
    if (diffResult.ok && diffResult.data.rows.length > 0) {
      return diffResult.data.rows;
    }

    return buildFallbackRows(draft.before, draft.after);
  }, [diffResult, draft.after, draft.before]);

  const diffRanges = useMemo(() => buildDiffRanges(rows), [rows]);
  const diffCount = diffResult.ok ? diffResult.data.diffCount : diffRanges.length;
  const activeDiffRange =
    activeDiffIndex >= 0 ? diffRanges[activeDiffIndex] ?? null : null;
  const errorText = feedback?.tone === "error" ? feedback.text : null;

  useEffect(() => {
    if (!diffRanges.length) {
      setActiveDiffIndex(-1);
      return;
    }

    setActiveDiffIndex((current) => {
      if (current < 0) {
        return 0;
      }

      return Math.min(current, diffRanges.length - 1);
    });
  }, [diffRanges.length]);

  const jumpDiff = (direction: "previous" | "next") => {
    if (!diffRanges.length) {
      return;
    }

    setActiveDiffIndex((current) => {
      if (direction === "previous") {
        return current <= 0 ? diffRanges.length - 1 : current - 1;
      }

      if (current < 0 || current >= diffRanges.length - 1) {
        return 0;
      }

      return current + 1;
    });
  };

  return (
    <ToolGrid className="xl:grid-cols-1">
      <ToolPane
        title={text.title}
        footer={
          <ToolActionBar feedback={feedback}>
            <Button
              disabled={!diffCount}
              size="sm"
              variant="secondary"
              onClick={() => {
                jumpDiff("previous");
              }}
            >
              {text.previousDiff}
            </Button>
            <Button
              disabled={!diffCount}
              size="sm"
              variant="secondary"
              onClick={() => {
                jumpDiff("next");
              }}
            >
              {text.nextDiff}
            </Button>
            <div className="rounded-full border border-[rgb(var(--color-border)/0.16)] px-3 py-1 text-[11px] font-medium tabular-nums text-muted">
              {text.diffCount(diffCount)}
            </div>
            <ToolControlField label={text.highlightLabel}>
              <ToolSelect
                aria-label={text.highlightLabel}
                className="h-7 min-w-0 max-w-full flex-1 border-0 bg-transparent px-0 pr-6 text-xs shadow-none hover:bg-transparent focus:border-0 focus:shadow-none sm:min-w-36"
                value={draft.highlightMode}
                onValueChange={(value) => {
                  setDraft((current) => ({
                    ...current,
                    highlightMode: value as TextDiffHighlightMode
                  }));
                }}
              >
                {Object.entries(text.highlightOptions).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </ToolSelect>
            </ToolControlField>
            <ToolControlField label={text.ignoreLabel}>
              <ToolSelect
                aria-label={text.ignoreLabel}
                className="h-7 min-w-0 max-w-full flex-1 border-0 bg-transparent px-0 pr-6 text-xs shadow-none hover:bg-transparent focus:border-0 focus:shadow-none sm:min-w-36"
                value={draft.ignoreMode}
                onValueChange={(value) => {
                  setDraft((current) => ({
                    ...current,
                    ignoreMode: value as TextDiffIgnoreMode
                  }));
                }}
              >
                {Object.entries(text.ignoreOptions).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </ToolSelect>
            </ToolControlField>
            <Button
              className="shrink-0 whitespace-nowrap"
              size="sm"
              variant="ghost"
              onClick={() => {
                setDraft({
                  before: "",
                  after: "",
                  highlightMode: "line",
                  ignoreMode: "none"
                });
                setActiveDiffIndex(-1);
                setFeedback(null);
              }}
            >
              {text.clear}
            </Button>
          </ToolActionBar>
        }
      >
        <TextDiffViewer
          activeDiffRange={activeDiffRange}
          after={draft.after}
          afterLabel={text.afterLabel}
          before={draft.before}
          beforeLabel={text.beforeLabel}
          errorText={errorText}
          highlightMode={draft.highlightMode}
          rows={rows}
          onAfterChange={(value) => {
            setDraft((current) => ({
              ...current,
              after: value
            }));
          }}
          onBeforeChange={(value) => {
            setDraft((current) => ({
              ...current,
              before: value
            }));
          }}
        />
      </ToolPane>
    </ToolGrid>
  );
};
