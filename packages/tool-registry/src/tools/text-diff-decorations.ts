import type { Text } from "@codemirror/state";
import { Decoration, type DecorationSet } from "@codemirror/view";
import type { TextDiffHighlightMode, TextDiffRow } from "@z-dev-toolbox/core";

export type DiffViewerSide = "left" | "right";
export interface DiffRange {
  start: number;
  end: number;
}

export const DIFF_ROW_HEIGHT = 32;

const rowClassName = (
  row: TextDiffRow,
  side: DiffViewerSide,
  highlightMode: TextDiffHighlightMode,
  rowIndex: number,
  activeRange?: DiffRange | null,
) => {
  const classes = [];
  if (highlightMode !== "none") {
    if (row.kind === "changed") {
      classes.push(side === "left" ? "cm-diff-removed" : "cm-diff-added");
    } else if (row.kind === "removed" || row.kind === "added") {
      classes.push(`cm-diff-${row.kind}`);
    }
  }
  if (
    row.kind !== "equal" &&
    activeRange &&
    rowIndex >= activeRange.start &&
    rowIndex <= activeRange.end
  ) {
    classes.push("cm-diff-active");
  }
  return classes.join(" ");
};

export const getDiffLineRange = (
  rows: TextDiffRow[],
  side: DiffViewerSide,
  range: DiffRange,
  lineCount: number,
): DiffRange => {
  const bounds = getDiffLineBounds(rows, side, range);
  // For a missing side, navigate to the source line at the insertion boundary.
  const start = Math.min(bounds.start + 1, lineCount);
  return { start, end: Math.max(start, Math.min(bounds.end, lineCount)) };
};

// Zero-based line boundaries, including a zero-height boundary for a missing side.
export const getDiffLineBounds = (
  rows: TextDiffRow[],
  side: DiffViewerSide,
  range: DiffRange,
): DiffRange => {
  let start: number | null = null;
  let end = 0;
  let previous = 0;
  for (let index = 0; index <= range.end; index += 1) {
    const row = rows[index];
    if (!row) break;
    const number = side === "left" ? row.leftLineNumber : row.rightLineNumber;
    if (number === null) continue;
    if (index < range.start) previous = number;
    else {
      start ??= number - 1;
      end = number;
    }
  }
  return start === null ? { start: previous, end: previous } : { start, end };
};

export const buildDiffDecorations = (
  doc: Text,
  rows: TextDiffRow[],
  side: DiffViewerSide,
  highlightMode: TextDiffHighlightMode,
  activeRange?: DiffRange | null,
): DecorationSet => {
  const decorations = [];

  for (let index = 0; index < rows.length; index += 1) {
    const row = rows[index]!;
    const lineNumber =
      side === "left" ? row.leftLineNumber : row.rightLineNumber;
    if (lineNumber === null) continue;
    const className = rowClassName(
      row,
      side,
      highlightMode,
      index,
      activeRange,
    );

    const line = doc.line(lineNumber);
    decorations.push(
      Decoration.line({
        class: className,
        attributes: { "data-diff-row": String(index) },
      }).range(line.from),
    );

    if (
      row.kind === "changed" &&
      highlightMode !== "line" &&
      highlightMode !== "none"
    ) {
      const spans = (side === "left" ? row.leftSpans : row.rightSpans) ?? [];
      let offset = line.from;
      for (const span of spans) {
        const end = Math.min(offset + span.value.length, line.to);
        if (span.kind !== "equal" && end > offset) {
          decorations.push(
            Decoration.mark({ class: `cm-diff-inline-${span.kind}` }).range(
              offset,
              end,
            ),
          );
        }
        offset = end;
      }
    }
  }
  return Decoration.set(decorations, true);
};
