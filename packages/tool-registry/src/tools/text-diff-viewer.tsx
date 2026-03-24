import {
  useEffect,
  useLayoutEffect,
  useRef,
  type ClipboardEvent,
  type RefObject
} from "react";

import type {
  DiffKind,
  TextDiffHighlightMode,
  TextDiffInlineSpan,
  TextDiffRow
} from "@z-dev-toolbox/core";
import { cn } from "@z-dev-toolbox/ui";

import { toolInsetPanelClassName } from "../components/tool-panel-kit";

type DiffViewerSide = "left" | "right";

interface DiffRange {
  start: number;
  end: number;
}

interface TextDiffViewerProps {
  highlightMode: TextDiffHighlightMode;
  rows: TextDiffRow[];
  before: string;
  after: string;
  beforeLabel: string;
  afterLabel: string;
  errorText?: string | null;
  activeDiffRange?: DiffRange | null;
  onBeforeChange: (value: string) => void;
  onAfterChange: (value: string) => void;
}

interface FocusTarget {
  side: DiffViewerSide;
  rowIndex: number;
  selectionStart: number;
  selectionEnd: number;
}

interface LineMutationResult {
  value: string;
  focus?: FocusTarget;
}

const splitEditorLines = (value: string) =>
  value.length > 0 ? value.split("\n") : [];

const joinEditorLines = (lines: string[]) => lines.join("\n");

const getLineNumber = (row: TextDiffRow, side: DiffViewerSide) =>
  side === "left" ? row.leftLineNumber : row.rightLineNumber;

const getLineText = (row: TextDiffRow, side: DiffViewerSide) =>
  side === "left" ? row.leftText : row.rightText;

const getInlineSpans = (
  row: TextDiffRow,
  side: DiffViewerSide,
  highlightMode: TextDiffHighlightMode
) => {
  if (
    row.kind === "changed" &&
    (highlightMode === "word" ||
      highlightMode === "split" ||
      highlightMode === "character")
  ) {
    return side === "left" ? row.leftSpans ?? [] : row.rightSpans ?? [];
  }

  const value = getLineText(row, side);

  return value.length > 0 ? [{ kind: "equal" as const, value }] : [];
};

const resolveInsertIndex = (
  rows: TextDiffRow[],
  side: DiffViewerSide,
  rowIndex: number
) => {
  const currentLineNumber = getLineNumber(rows[rowIndex] ?? createEmptyRow(), side);

  if (typeof currentLineNumber === "number") {
    return currentLineNumber - 1;
  }

  for (let index = rowIndex - 1; index >= 0; index -= 1) {
    const previousLineNumber = getLineNumber(rows[index] ?? createEmptyRow(), side);

    if (typeof previousLineNumber === "number") {
      return previousLineNumber;
    }
  }

  return 0;
};

const replaceVisualRow = (
  source: string,
  rows: TextDiffRow[],
  side: DiffViewerSide,
  rowIndex: number,
  nextLine: string
) => {
  const lines = splitEditorLines(source);
  const lineNumber = getLineNumber(rows[rowIndex] ?? createEmptyRow(), side);

  if (typeof lineNumber === "number") {
    const nextLines = [...lines];
    nextLines[lineNumber - 1] = nextLine;
    return joinEditorLines(nextLines);
  }

  if (!nextLine.length) {
    return source;
  }

  const nextLines = [...lines];
  nextLines.splice(resolveInsertIndex(rows, side, rowIndex), 0, nextLine);
  return joinEditorLines(nextLines);
};

const splitVisualRow = (
  source: string,
  rows: TextDiffRow[],
  side: DiffViewerSide,
  rowIndex: number,
  currentValue: string,
  selectionStart: number,
  selectionEnd: number
): LineMutationResult => {
  const lines = splitEditorLines(source);
  const lineNumber = getLineNumber(rows[rowIndex] ?? createEmptyRow(), side);
  const insertIndex = resolveInsertIndex(rows, side, rowIndex);
  const nextLines = [...lines];
  const beforePart = currentValue.slice(0, selectionStart);
  const afterPart = currentValue.slice(selectionEnd);
  const replacement = [beforePart, afterPart];

  if (typeof lineNumber === "number") {
    nextLines.splice(lineNumber - 1, 1, ...replacement);
  } else if (beforePart.length || afterPart.length) {
    nextLines.splice(insertIndex, 0, ...replacement);
  } else {
    nextLines.splice(insertIndex, 0, "");
  }

  return {
    value: joinEditorLines(nextLines),
    focus: {
      side,
      rowIndex: rowIndex + 1,
      selectionStart: 0,
      selectionEnd: 0
    }
  };
};

const pasteIntoVisualRow = (
  source: string,
  rows: TextDiffRow[],
  side: DiffViewerSide,
  rowIndex: number,
  currentValue: string,
  selectionStart: number,
  selectionEnd: number,
  pastedText: string
): LineMutationResult => {
  const normalizedText = pastedText.replace(/\r\n?/g, "\n");
  const segments = normalizedText.split("\n");

  if (segments.length === 1) {
    return {
      value: replaceVisualRow(
        source,
        rows,
        side,
        rowIndex,
        `${currentValue.slice(0, selectionStart)}${normalizedText}${currentValue.slice(selectionEnd)}`
      )
    };
  }

  const lines = splitEditorLines(source);
  const lineNumber = getLineNumber(rows[rowIndex] ?? createEmptyRow(), side);
  const insertIndex = resolveInsertIndex(rows, side, rowIndex);
  const nextLines = [...lines];
  const mergedSegments = [
    `${currentValue.slice(0, selectionStart)}${segments[0] ?? ""}`,
    ...segments.slice(1, -1),
    `${segments.at(-1) ?? ""}${currentValue.slice(selectionEnd)}`
  ];

  if (typeof lineNumber === "number") {
    nextLines.splice(lineNumber - 1, 1, ...mergedSegments);
  } else {
    nextLines.splice(insertIndex, 0, ...mergedSegments);
  }

  const lastSegment = mergedSegments.at(-1) ?? "";

  return {
    value: joinEditorLines(nextLines),
    focus: {
      side,
      rowIndex: rowIndex + mergedSegments.length - 1,
      selectionStart: lastSegment.length,
      selectionEnd: lastSegment.length
    }
  };
};

const removeVisualRow = (
  source: string,
  rows: TextDiffRow[],
  side: DiffViewerSide,
  rowIndex: number,
  key: "Backspace" | "Delete"
): LineMutationResult | null => {
  const lines = splitEditorLines(source);
  const lineNumber = getLineNumber(rows[rowIndex] ?? createEmptyRow(), side);

  if (typeof lineNumber !== "number") {
    return null;
  }

  const nextLines = [...lines];
  nextLines.splice(lineNumber - 1, 1);

  return {
    value: joinEditorLines(nextLines),
    focus: {
      side,
      rowIndex: key === "Backspace" ? Math.max(rowIndex - 1, 0) : rowIndex,
      selectionStart: 0,
      selectionEnd: 0
    }
  };
};

const lineToneClassName = (
  row: TextDiffRow,
  side: DiffViewerSide,
  highlightMode: TextDiffHighlightMode
) => {
  if (highlightMode === "none") {
    return "bg-transparent";
  }

  if (row.kind === "changed") {
    return side === "left" ? "bg-danger/10" : "bg-success/10";
  }

  if (row.kind === "removed") {
    return side === "left"
      ? "bg-danger/10"
      : "bg-[rgb(var(--color-surface-muted)/0.18)]";
  }

  if (row.kind === "added") {
    return side === "right"
      ? "bg-success/10"
      : "bg-[rgb(var(--color-surface-muted)/0.18)]";
  }

  return "bg-transparent";
};

const inlineSpanClassName = (kind: DiffKind) => {
  if (kind === "equal") {
    return "text-foreground";
  }

  return kind === "removed"
    ? "rounded-sm bg-danger/18 px-0.5 text-danger"
    : "rounded-sm bg-success/18 px-0.5 text-success";
};

const createEmptyRow = (): TextDiffRow => ({
  kind: "equal",
  leftLineNumber: null,
  rightLineNumber: null,
  leftText: "",
  rightText: ""
});

const isDesktopViewport = () =>
  typeof window !== "undefined" && window.innerWidth >= 1024;

const PreviewLine = ({ spans }: { spans: TextDiffInlineSpan[] }) => {
  if (!spans.length) {
    return <span className="opacity-0"> </span>;
  }

  return (
    <>
      {spans.map((span, index) => (
        <span
          key={`${span.kind}-${index}`}
          className={inlineSpanClassName(span.kind)}
        >
          {span.value}
        </span>
      ))}
    </>
  );
};

const PaneHeader = ({ title }: { title: string }) => (
  <div className="border-b border-[rgb(var(--color-border)/0.14)] px-3 py-2">
    <div className="text-[0.68rem] font-semibold uppercase tracking-[0.18em] text-muted">
      {title}
    </div>
  </div>
);

export const TextDiffViewer = ({
  highlightMode,
  rows,
  before,
  after,
  beforeLabel,
  afterLabel,
  errorText,
  activeDiffRange,
  onBeforeChange,
  onAfterChange
}: TextDiffViewerProps) => {
  const displayRows = rows.length > 0 ? rows : [createEmptyRow()];
  const leftScrollRef = useRef<HTMLDivElement | null>(null);
  const rightScrollRef = useRef<HTMLDivElement | null>(null);
  const syncingScrollRef = useRef(false);
  const pendingFocusRef = useRef<FocusTarget | null>(null);
  const inputRefs = useRef(new Map<string, HTMLTextAreaElement>());
  const previewRefs = useRef(new Map<string, HTMLDivElement>());
  const rowRefs = useRef(new Map<number, HTMLDivElement>());
  const selectionTextareaRefs = useRef(
    new Map<DiffViewerSide, HTMLTextAreaElement>()
  );

  useEffect(() => {
    const pendingFocus = pendingFocusRef.current;

    if (!pendingFocus) {
      return;
    }

    const nextInput = inputRefs.current.get(
      `${pendingFocus.side}:${pendingFocus.rowIndex}`
    );

    if (!nextInput) {
      pendingFocusRef.current = null;
      return;
    }

    nextInput.focus();
    nextInput.setSelectionRange(
      pendingFocus.selectionStart,
      pendingFocus.selectionEnd
    );
    pendingFocusRef.current = null;
  }, [before, after, displayRows.length]);

  useLayoutEffect(() => {
    if (!activeDiffRange) {
      return;
    }

    const scrollContainer = leftScrollRef.current;
    const startRow = rowRefs.current.get(activeDiffRange.start);
    const endRow = rowRefs.current.get(activeDiffRange.end);

    if (!scrollContainer || !startRow || !endRow) {
      return;
    }

    const containerHeight = scrollContainer.clientHeight;
    const startTop = startRow.offsetTop;
    const endBottom = endRow.offsetTop + endRow.offsetHeight;
    const blockHeight = endBottom - startTop;
    const blockPadding = 24;
    const centeredTop =
      startTop - Math.max((containerHeight - blockHeight) / 2, blockPadding);
    const alignedTop = startTop - blockPadding;
    const nextTop =
      blockHeight + blockPadding * 2 <= containerHeight
        ? centeredTop
        : alignedTop;
    const resolvedTop = Math.max(nextTop, 0);

    syncingScrollRef.current = true;
    leftScrollRef.current?.scrollTo({ top: resolvedTop });
    rightScrollRef.current?.scrollTo({ top: resolvedTop });

    window.requestAnimationFrame(() => {
      syncingScrollRef.current = false;
    });
  }, [activeDiffRange]);

  const syncScroll = (
    target: HTMLDivElement | null,
    nextTop: number
  ) => {
    if (!target || !isDesktopViewport()) {
      return;
    }

    if (syncingScrollRef.current) {
      return;
    }

    syncingScrollRef.current = true;
    target.scrollTop = nextTop;

    window.requestAnimationFrame(() => {
      syncingScrollRef.current = false;
    });
  };

  const selectAllSideText = (side: DiffViewerSide, value: string) => {
    const selectionTextarea = selectionTextareaRefs.current.get(side);

    if (!selectionTextarea) {
      return;
    }

    selectionTextarea.focus();
    selectionTextarea.setSelectionRange(0, value.length);
  };

  const renderPane = (
    side: DiffViewerSide,
    title: string,
    value: string,
    onChange: (nextValue: string) => void,
    scrollRef: RefObject<HTMLDivElement>,
    oppositeScrollRef: RefObject<HTMLDivElement>
  ) => (
    <div
      className={cn(
        "flex min-h-[280px] min-w-0 flex-col overflow-hidden rounded-[24px] border",
        toolInsetPanelClassName
      )}
    >
      <PaneHeader title={title} />
      <div
        ref={scrollRef}
        className="min-h-0 flex-1 overflow-auto [scrollbar-width:thin]"
        onScroll={(event) => {
          syncScroll(oppositeScrollRef.current, event.currentTarget.scrollTop);
        }}
      >
        {displayRows.map((row, rowIndex) => {
          const lineValue = getLineText(row, side);
          const lineNumber = getLineNumber(row, side);
          const spans = getInlineSpans(row, side, highlightMode);
          const isActive =
            activeDiffRange !== null &&
            activeDiffRange !== undefined &&
            rowIndex >= activeDiffRange.start &&
            rowIndex <= activeDiffRange.end;

          return (
            <div
              key={`${side}-${rowIndex}`}
              ref={(node) => {
                if (side !== "left") {
                  return;
                }

                if (node) {
                  rowRefs.current.set(rowIndex, node);
                  return;
                }

                rowRefs.current.delete(rowIndex);
              }}
              className={cn(
                "relative overflow-hidden grid grid-cols-[56px_minmax(0,1fr)] border-b border-[rgb(var(--color-border)/0.12)] last:border-b-0",
                lineToneClassName(row, side, highlightMode),
                isActive &&
                  "before:absolute before:inset-y-0 before:left-0 before:z-10 before:w-1 before:bg-[rgb(var(--color-accent))] before:content-[''] shadow-[inset_0_0_0_2px_rgb(var(--color-accent)/0.36)]"
              )}
            >
              <div
                className={cn(
                  "select-none border-r border-[rgb(var(--color-border)/0.12)] bg-[rgb(var(--color-surface-muted)/0.22)] px-2 py-1 text-right font-mono text-[11px] leading-6 text-muted",
                  isActive &&
                    "bg-[rgb(var(--color-accent)/0.14)] font-semibold text-foreground"
                )}
              >
                {lineNumber ?? ""}
              </div>
              <div className="relative min-w-0">
                <div className="pointer-events-none absolute inset-0 overflow-hidden px-3 py-1 font-mono text-[12px] leading-6">
                  <div
                    ref={(node) => {
                      const key = `${side}:${rowIndex}`;

                      if (node) {
                        previewRefs.current.set(key, node);
                        return;
                      }

                      previewRefs.current.delete(key);
                    }}
                    className="min-w-max whitespace-pre"
                  >
                    <PreviewLine spans={spans} />
                  </div>
                </div>
                <textarea
                  ref={(node) => {
                    const key = `${side}:${rowIndex}`;

                    if (node) {
                      inputRefs.current.set(key, node);
                      return;
                    }

                    inputRefs.current.delete(key);
                  }}
                  rows={1}
                  spellCheck={false}
                  value={lineValue}
                  wrap="off"
                  className="relative z-10 h-8 w-full resize-none overflow-x-auto overflow-y-hidden whitespace-pre bg-transparent px-3 py-1 font-mono text-[12px] leading-6 text-transparent caret-[rgb(var(--color-foreground))] outline-none selection:bg-[rgb(var(--color-accent)/0.18)] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
                  onScroll={(event) => {
                    const previewNode = previewRefs.current.get(
                      `${side}:${rowIndex}`
                    );

                    if (!previewNode) {
                      return;
                    }

                    previewNode.style.transform = `translateX(-${event.currentTarget.scrollLeft}px)`;
                  }}
                  onChange={(event) => {
                    onChange(
                      replaceVisualRow(
                        value,
                        displayRows,
                        side,
                        rowIndex,
                        event.currentTarget.value.replace(/\r/g, "")
                      )
                    );
                  }}
                  onKeyDown={(event) => {
                    const isSelectAllShortcut =
                      (event.metaKey || event.ctrlKey) &&
                      !event.altKey &&
                      !event.shiftKey &&
                      event.key.toLowerCase() === "a";

                    if (isSelectAllShortcut) {
                      event.preventDefault();
                      selectAllSideText(side, value);
                      return;
                    }

                    const selectionStart = event.currentTarget.selectionStart ?? 0;
                    const selectionEnd = event.currentTarget.selectionEnd ?? 0;

                    if (event.key === "Enter") {
                      event.preventDefault();

                      const nextMutation = splitVisualRow(
                        value,
                        displayRows,
                        side,
                        rowIndex,
                        lineValue,
                        selectionStart,
                        selectionEnd
                      );

                      pendingFocusRef.current = nextMutation.focus ?? null;
                      onChange(nextMutation.value);
                      return;
                    }

                    if (
                      (event.key === "Backspace" || event.key === "Delete") &&
                      !lineValue.length &&
                      selectionStart === 0 &&
                      selectionEnd === 0
                    ) {
                      const nextMutation = removeVisualRow(
                        value,
                        displayRows,
                        side,
                        rowIndex,
                        event.key
                      );

                      if (!nextMutation) {
                        return;
                      }

                      event.preventDefault();
                      pendingFocusRef.current = nextMutation.focus ?? null;
                      onChange(nextMutation.value);
                    }
                  }}
                  onPaste={(event: ClipboardEvent<HTMLTextAreaElement>) => {
                    const pastedText = event.clipboardData.getData("text");

                    if (!pastedText.includes("\n") && !pastedText.includes("\r")) {
                      return;
                    }

                    event.preventDefault();

                    const nextMutation = pasteIntoVisualRow(
                      value,
                      displayRows,
                      side,
                      rowIndex,
                      lineValue,
                      event.currentTarget.selectionStart ?? 0,
                      event.currentTarget.selectionEnd ?? 0,
                      pastedText
                    );

                    pendingFocusRef.current = nextMutation.focus ?? null;
                    onChange(nextMutation.value);
                  }}
                />
              </div>
            </div>
          );
        })}
      </div>
      <textarea
        ref={(node) => {
          if (node) {
            selectionTextareaRefs.current.set(side, node);
            return;
          }

          selectionTextareaRefs.current.delete(side);
        }}
        readOnly
        tabIndex={-1}
        value={value}
        className="absolute left-0 top-0 h-px w-px opacity-0 pointer-events-none"
      />
    </div>
  );

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3">
      {errorText ? (
        <div className="rounded-[18px] border border-danger/18 bg-danger/8 px-3.5 py-2.5 text-sm leading-6 text-danger">
          {errorText}
        </div>
      ) : null}
      <div className="grid min-h-0 flex-1 gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        {renderPane(
          "left",
          beforeLabel,
          before,
          onBeforeChange,
          leftScrollRef,
          rightScrollRef
        )}
        {renderPane(
          "right",
          afterLabel,
          after,
          onAfterChange,
          rightScrollRef,
          leftScrollRef
        )}
      </div>
    </div>
  );
};
