import { z } from "../../lib/zod";

import { createToolError, createToolSuccess } from "../../tool-helpers";

export type DiffKind = "equal" | "added" | "removed";
export type TextDiffRowKind = "equal" | "added" | "removed" | "changed";
export type TextDiffHighlightMode =
  | "line"
  | "word"
  | "split"
  | "character"
  | "none";
export type TextDiffIgnoreMode =
  | "none"
  | "trim"
  | "space"
  | "space-and-empty-lines";

export interface DiffChunk {
  kind: DiffKind;
  value: string;
}

export interface TextDiffInlineSpan {
  kind: DiffKind;
  value: string;
}

export interface TextDiffRow {
  kind: TextDiffRowKind;
  leftLineNumber: number | null;
  rightLineNumber: number | null;
  leftText: string;
  rightText: string;
  leftSpans?: TextDiffInlineSpan[];
  rightSpans?: TextDiffInlineSpan[];
}

export interface TextDiffOutput {
  mode: "line" | "word";
  highlightMode: TextDiffHighlightMode;
  ignoreMode: TextDiffIgnoreMode;
  chunks: DiffChunk[];
  rows: TextDiffRow[];
  additions: number;
  removals: number;
  unchanged: number;
  diffCount: number;
}

interface ComparableValue {
  value: string;
  key: string;
}

interface ComparableLine extends ComparableValue {
  lineNumber: number;
}

type ComparableOperation<T extends ComparableValue> =
  | {
      kind: "equal";
      beforeItem: T;
      afterItem: T;
    }
  | {
      kind: "removed";
      item: T;
    }
  | {
      kind: "added";
      item: T;
    };

const LINE_DIFF_LIMIT = 160_000;
const INLINE_DIFF_LIMIT = 24_000;
const splitTokenPattern = /\s+|[\p{L}\p{N}_]+|./gu;

const textDiffInputSchema = z.object({
  before: z.string().default(""),
  after: z.string().default(""),
  mode: z.enum(["line", "word"]).optional(),
  highlightMode: z
    .enum(["line", "word", "split", "character", "none"])
    .optional(),
  ignoreMode: z
    .enum(["none", "trim", "space", "space-and-empty-lines"])
    .default("none")
});

export type TextDiffInput = z.input<typeof textDiffInputSchema>;

const resolveHighlightMode = (
  mode: "line" | "word" | undefined,
  highlightMode: TextDiffHighlightMode | undefined
): TextDiffHighlightMode => {
  if (highlightMode) {
    return highlightMode;
  }

  return mode === "word" ? "word" : "line";
};

const normalizeLineForComparison = (
  value: string,
  ignoreMode: TextDiffIgnoreMode
) => {
  if (ignoreMode === "trim") {
    return value.trim();
  }

  if (ignoreMode === "space" || ignoreMode === "space-and-empty-lines") {
    return value.replace(/\s+/g, "");
  }

  return value;
};

const tokenizeByLine = (
  value: string,
  ignoreMode: TextDiffIgnoreMode
): ComparableLine[] =>
  (value.length > 0 ? value.split("\n") : []).map((line, index) => ({
    value: line,
    key: normalizeLineForComparison(line, ignoreMode),
    lineNumber: index + 1
  }));

const tokenizeByWord = (value: string): ComparableValue[] =>
  (value.match(/\s+|[^\s]+/g) ?? []).map((token) => ({
    value: token,
    key: token
  }));

const tokenizeBySplit = (value: string): ComparableValue[] =>
  (value.match(splitTokenPattern) ?? []).map((token) => ({
    value: token,
    key: token
  }));

const tokenizeByCharacter = (value: string): ComparableValue[] =>
  Array.from(value).map((token) => ({
    value: token,
    key: token
  }));

const getInlineTokens = (
  value: string,
  highlightMode: TextDiffHighlightMode
): ComparableValue[] => {
  if (highlightMode === "word") {
    return tokenizeByWord(value);
  }

  if (highlightMode === "split") {
    return tokenizeBySplit(value);
  }

  if (highlightMode === "character") {
    return tokenizeByCharacter(value);
  }

  return [];
};

const diffComparableValues = <T extends ComparableValue>(
  before: T[],
  after: T[],
  limit: number
) => {
  const rows = before.length;
  const cols = after.length;

  if (rows * cols > limit) {
    throw new Error("文本体积过大，当前差异算法无法稳定处理。");
  }

  const dp = Array.from({ length: rows + 1 }, () => Array(cols + 1).fill(0));

  for (let row = rows - 1; row >= 0; row -= 1) {
    for (let col = cols - 1; col >= 0; col -= 1) {
      const nextRow = dp[row];
      const belowRow = dp[row + 1];

      if (!nextRow || !belowRow) {
        throw new Error("差异计算初始化失败。");
      }

      nextRow[col] =
        before[row]?.key === after[col]?.key
          ? (belowRow[col + 1] ?? 0) + 1
          : Math.max(belowRow[col] ?? 0, nextRow[col + 1] ?? 0);
    }
  }

  const operations: ComparableOperation<T>[] = [];
  let row = 0;
  let col = 0;

  while (row < rows && col < cols) {
    const beforeItem = before[row];
    const afterItem = after[col];

    if (beforeItem?.key === afterItem?.key && beforeItem && afterItem) {
      operations.push({
        kind: "equal",
        beforeItem,
        afterItem
      });
      row += 1;
      col += 1;
      continue;
    }

    if ((dp[row + 1]?.[col] ?? 0) >= (dp[row]?.[col + 1] ?? 0)) {
      if (beforeItem) {
        operations.push({
          kind: "removed",
          item: beforeItem
        });
      }
      row += 1;
      continue;
    }

    if (afterItem) {
      operations.push({
        kind: "added",
        item: afterItem
      });
    }
    col += 1;
  }

  while (row < rows) {
    const beforeItem = before[row];

    if (beforeItem) {
      operations.push({
        kind: "removed",
        item: beforeItem
      });
    }
    row += 1;
  }

  while (col < cols) {
    const afterItem = after[col];

    if (afterItem) {
      operations.push({
        kind: "added",
        item: afterItem
      });
    }
    col += 1;
  }

  return operations;
};

const appendSpan = (
  spans: TextDiffInlineSpan[],
  kind: DiffKind,
  value: string
) => {
  if (!value.length) {
    return;
  }

  const lastSpan = spans.at(-1);

  if (lastSpan?.kind === kind) {
    lastSpan.value += value;
    return;
  }

  spans.push({ kind, value });
};

const buildInlineSpans = (
  before: string,
  after: string,
  highlightMode: TextDiffHighlightMode
) => {
  try {
    const operations = diffComparableValues(
      getInlineTokens(before, highlightMode),
      getInlineTokens(after, highlightMode),
      INLINE_DIFF_LIMIT
    );
    const leftSpans: TextDiffInlineSpan[] = [];
    const rightSpans: TextDiffInlineSpan[] = [];

    for (const operation of operations) {
      if (operation.kind === "equal") {
        appendSpan(leftSpans, "equal", operation.beforeItem.value);
        appendSpan(rightSpans, "equal", operation.afterItem.value);
        continue;
      }

      if (operation.kind === "removed") {
        appendSpan(leftSpans, "removed", operation.item.value);
        continue;
      }

      appendSpan(rightSpans, "added", operation.item.value);
    }

    return { leftSpans, rightSpans };
  } catch {
    return {
      leftSpans: before.length
        ? [{ kind: "removed" as const, value: before }]
        : [],
      rightSpans: after.length ? [{ kind: "added" as const, value: after }] : []
    };
  }
};

const shouldIgnoreBlankDiff = (
  row: TextDiffRow,
  ignoreMode: TextDiffIgnoreMode
) => {
  if (ignoreMode !== "space-and-empty-lines") {
    return false;
  }

  const leftBlank = normalizeLineForComparison(row.leftText, "space") === "";
  const rightBlank = normalizeLineForComparison(row.rightText, "space") === "";

  if (row.kind === "added") {
    return rightBlank;
  }

  if (row.kind === "removed") {
    return leftBlank;
  }

  if (row.kind === "changed") {
    return leftBlank && rightBlank;
  }

  return false;
};

const buildRows = (
  operations: ComparableOperation<ComparableLine>[],
  highlightMode: TextDiffHighlightMode,
  ignoreMode: TextDiffIgnoreMode
): TextDiffRow[] => {
  const rows: TextDiffRow[] = [];
  let index = 0;

  while (index < operations.length) {
    const current = operations[index];

    if (!current) {
      break;
    }

    if (current.kind === "equal") {
      rows.push({
        kind: "equal",
        leftLineNumber: current.beforeItem.lineNumber,
        rightLineNumber: current.afterItem.lineNumber,
        leftText: current.beforeItem.value,
        rightText: current.afterItem.value
      });
      index += 1;
      continue;
    }

    const removed: ComparableLine[] = [];
    const added: ComparableLine[] = [];

    while (operations[index]?.kind === "removed") {
      const operation = operations[index];

      if (operation?.kind === "removed") {
        removed.push(operation.item);
      }
      index += 1;
    }

    while (operations[index]?.kind === "added") {
      const operation = operations[index];

      if (operation?.kind === "added") {
        added.push(operation.item);
      }
      index += 1;
    }

    const rowCount = Math.max(removed.length, added.length);

    for (let rowIndex = 0; rowIndex < rowCount; rowIndex += 1) {
      const leftItem = removed[rowIndex];
      const rightItem = added[rowIndex];
      const row: TextDiffRow = {
        kind:
          leftItem && rightItem
            ? "changed"
            : leftItem
              ? "removed"
              : "added",
        leftLineNumber: leftItem?.lineNumber ?? null,
        rightLineNumber: rightItem?.lineNumber ?? null,
        leftText: leftItem?.value ?? "",
        rightText: rightItem?.value ?? ""
      };

      if (
        row.kind === "changed" &&
        (highlightMode === "word" ||
          highlightMode === "split" ||
          highlightMode === "character")
      ) {
        const { leftSpans, rightSpans } = buildInlineSpans(
          row.leftText,
          row.rightText,
          highlightMode
        );
        row.leftSpans = leftSpans;
        row.rightSpans = rightSpans;
      }

      if (shouldIgnoreBlankDiff(row, ignoreMode)) {
        row.kind = "equal";
      }

      rows.push(row);
    }
  }

  return rows;
};

const summarizeRows = (rows: TextDiffRow[]) =>
  rows.reduce(
    (summary, row) => {
      if (row.kind === "equal") {
        summary.unchanged += 1;
      }

      if (row.kind === "added" || row.kind === "changed") {
        summary.additions += 1;
      }

      if (row.kind === "removed" || row.kind === "changed") {
        summary.removals += 1;
      }

      return summary;
    },
    { additions: 0, removals: 0, unchanged: 0 }
  );

const countDiffPoints = (rows: TextDiffRow[]) => {
  let diffCount = 0;
  let inDiffBlock = false;

  for (const row of rows) {
    if (row.kind === "equal") {
      inDiffBlock = false;
      continue;
    }

    if (!inDiffBlock) {
      diffCount += 1;
      inDiffBlock = true;
    }
  }

  return diffCount;
};

const mapLineOperationsToChunks = (
  operations: ComparableOperation<ComparableLine>[]
): DiffChunk[] =>
  operations.map((operation) => {
    if (operation.kind === "equal") {
      return {
        kind: "equal" as const,
        value: operation.beforeItem.value
      };
    }

    return {
      kind: operation.kind,
      value: operation.item.value
    };
  });

const buildLegacyChunks = (
  before: string,
  after: string,
  highlightMode: TextDiffHighlightMode,
  lineOperations: ComparableOperation<ComparableLine>[]
) => {
  if (
    highlightMode !== "word" &&
    highlightMode !== "split" &&
    highlightMode !== "character"
  ) {
    return mapLineOperationsToChunks(lineOperations);
  }

  try {
    const operations = diffComparableValues(
      getInlineTokens(before, highlightMode),
      getInlineTokens(after, highlightMode),
      INLINE_DIFF_LIMIT
    );

    return operations.map((operation) => {
      if (operation.kind === "equal") {
        return {
          kind: "equal" as const,
          value: operation.beforeItem.value
        };
      }

      return {
        kind: operation.kind,
        value: operation.item.value
      };
    });
  } catch {
    return mapLineOperationsToChunks(lineOperations);
  }
};

export const diffText = (input: TextDiffInput) => {
  const parsedInput = textDiffInputSchema.safeParse(input);

  if (!parsedInput.success) {
    return createToolError({
      code: "INVALID_INPUT",
      message: "文本对比输入参数不合法。",
      details: parsedInput.error.issues[0]?.message
    });
  }

  try {
    const { before, after, mode, highlightMode, ignoreMode } = parsedInput.data;
    const effectiveHighlightMode = resolveHighlightMode(mode, highlightMode);
    const lineOperations = diffComparableValues(
      tokenizeByLine(before, ignoreMode),
      tokenizeByLine(after, ignoreMode),
      LINE_DIFF_LIMIT
    );
    const rows = buildRows(
      lineOperations,
      effectiveHighlightMode,
      ignoreMode
    );
    const summary = summarizeRows(rows);
    const chunks = buildLegacyChunks(
      before,
      after,
      effectiveHighlightMode,
      lineOperations
    );

    return createToolSuccess<TextDiffOutput>({
      mode: effectiveHighlightMode === "word" ? "word" : "line",
      highlightMode: effectiveHighlightMode,
      ignoreMode,
      chunks,
      rows,
      additions: summary.additions,
      removals: summary.removals,
      unchanged: summary.unchanged,
      diffCount: countDiffPoints(rows)
    });
  } catch (error) {
    return createToolError({
      code: "DIFF_FAILED",
      message: "文本对比失败。",
      details: error instanceof Error ? error.message : "未知错误。"
    });
  }
};
