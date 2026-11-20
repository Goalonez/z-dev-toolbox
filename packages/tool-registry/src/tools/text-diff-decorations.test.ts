import { EditorState } from "@codemirror/state";
import type { DecorationSet } from "@codemirror/view";
import {
  diffText,
  getTextDiffRanges,
  type TextDiffInput,
} from "@z-dev-toolbox/core";
import { describe, expect, it } from "vitest";

import {
  buildDiffDecorations,
  getDiffLineBounds,
  getDiffLineRange,
} from "./text-diff-decorations";

const compare = (input: TextDiffInput) => {
  const result = diffText(input);
  if (!result.ok) throw new Error(result.error.message);
  return result.data.rows;
};

const entries = (decorations: DecorationSet) => {
  const result = [];
  for (const cursor = decorations.iter(); cursor.value; cursor.next()) {
    result.push({ from: cursor.from, to: cursor.to, spec: cursor.value.spec });
  }
  return result;
};

describe("text diff decorations", () => {
  it("keeps source lines in place despite leading, middle and trailing additions", () => {
    const before = "a\nb";
    const rows = compare({ before, after: "start\na\nmiddle\nb\nend" });
    const state = EditorState.create({ doc: before });
    const decorations = entries(
      buildDiffDecorations(state.doc, rows, "left", "line"),
    );
    expect(decorations.filter((entry) => entry.spec.widget)).toHaveLength(0);
    expect(decorations.map((entry) => entry.from)).toEqual([0, 2]);
    expect(
      decorations
        .filter((entry) => entry.spec.attributes)
        .map((entry) => entry.spec.attributes["data-diff-row"]),
    ).toEqual(["1", "3"]);
    expect(state.doc.toString()).toBe(before);
  });

  it("leaves the empty editor with its normal editable line", () => {
    const rows = compare({ before: "", after: "a\nb\nc" });
    const doc = EditorState.create().doc;
    const decorations = entries(
      buildDiffDecorations(doc, rows, "left", "line", { start: 1, end: 2 }),
    );
    expect(decorations).toHaveLength(0);
    expect(doc.toString()).toBe("");
  });

  it("decorates actual empty source lines without padding the opposite editor", () => {
    const rows = compare({ before: "a\n\nb", after: "a\nb" });
    const left = entries(
      buildDiffDecorations(
        EditorState.create({ doc: "a\n\nb" }).doc,
        rows,
        "left",
        "line",
      ),
    );
    const right = entries(
      buildDiffDecorations(
        EditorState.create({ doc: "a\nb" }).doc,
        rows,
        "right",
        "line",
      ),
    );
    expect(left.filter((entry) => entry.spec.widget)).toHaveLength(0);
    expect(
      left.filter((entry) => entry.spec.attributes).map((entry) => entry.from),
    ).toEqual([0, 2, 3]);
    expect(right.filter((entry) => entry.spec.widget)).toHaveLength(0);
    expect(right.map((entry) => entry.from)).toEqual([0, 2]);
  });

  it("maps character highlights after a surrogate pair to document offsets", () => {
    const rows = compare({
      before: "🙂 cat",
      after: "🙂 cut",
      highlightMode: "character",
    });
    for (const side of ["left", "right"] as const) {
      const doc = EditorState.create({
        doc: side === "left" ? "🙂 cat" : "🙂 cut",
      }).doc;
      const marks = entries(
        buildDiffDecorations(doc, rows, side, "character"),
      ).filter((entry) => !entry.spec.attributes);
      expect(marks).toEqual([
        {
          from: 4,
          to: 5,
          spec: {
            class:
              side === "left"
                ? "cm-diff-inline-removed"
                : "cm-diff-inline-added",
          },
        },
      ]);
    }
  });

  it("ignores blank differences without adding lines to the opposite editor", () => {
    const rows = compare({
      before: "first\n   \nsecond",
      after: "first\nsecond",
      ignoreMode: "space-and-empty-lines",
    });
    const doc = EditorState.create({ doc: "first\nsecond" }).doc;
    const decorations = entries(
      buildDiffDecorations(doc, rows, "right", "line"),
    );
    expect(decorations).toHaveLength(2);
    expect(decorations.map((entry) => entry.from)).toEqual([0, 6]);
    expect(decorations.every((entry) => entry.spec.class === "")).toBe(true);
  });

  it("maps navigation to the real line range on each side", () => {
    const rows = compare({
      before: "a\nb\nold\nz",
      after: "start\na\nb\nnew\nz",
    });
    expect(getDiffLineRange(rows, "left", { start: 3, end: 3 }, 4)).toEqual({
      start: 3,
      end: 3,
    });
    expect(getDiffLineRange(rows, "right", { start: 3, end: 3 }, 5)).toEqual({
      start: 4,
      end: 4,
    });
  });

  it("navigates missing lines to a source insertion boundary", () => {
    const rows = compare({ before: "a\nb", after: "start\na\nmiddle\nb\nend" });
    expect(getDiffLineRange(rows, "left", { start: 0, end: 0 }, 2)).toEqual({
      start: 1,
      end: 1,
    });
    expect(getDiffLineRange(rows, "left", { start: 2, end: 2 }, 2)).toEqual({
      start: 2,
      end: 2,
    });
    expect(getDiffLineRange(rows, "left", { start: 4, end: 4 }, 2)).toEqual({
      start: 2,
      end: 2,
    });
    expect(
      getDiffLineRange(
        compare({ before: "", after: "a\nb" }),
        "left",
        { start: 0, end: 1 },
        1,
      ),
    ).toEqual({ start: 1, end: 1 });
  });

  it("retains navigation decoration when highlighting is disabled", () => {
    const rows = compare({
      before: "cat",
      after: "cut",
      highlightMode: "character",
    });
    const doc = EditorState.create({ doc: "cat" }).doc;
    const decorations = entries(
      buildDiffDecorations(doc, rows, "left", "none", { start: 0, end: 0 }),
    );
    expect(decorations).toHaveLength(1);
    expect(decorations[0]?.spec.class).toBe("cm-diff-active");
  });

  it("connects changed blocks by their independent source line boundaries", () => {
    const rows = compare({
      before: "a\nb\nold\nz",
      after: "start\na\nb\nnew\nz",
    });
    const range = { start: 3, end: 3 };
    expect(getDiffLineBounds(rows, "left", range)).toEqual({
      start: 2,
      end: 3,
    });
    expect(getDiffLineBounds(rows, "right", range)).toEqual({
      start: 3,
      end: 4,
    });
  });

  it("connects additions to exact leading, middle and trailing insertion boundaries", () => {
    const rows = compare({ before: "a\nb", after: "start\na\nmiddle\nb\nend" });
    for (const [index, boundary] of [
      [0, 0],
      [2, 1],
      [4, 2],
    ]) {
      expect(
        getDiffLineBounds(rows, "left", { start: index!, end: index! }),
      ).toEqual({
        start: boundary,
        end: boundary,
      });
    }
    expect(
      getDiffLineBounds(compare({ before: "", after: "a\nb" }), "left", {
        start: 0,
        end: 1,
      }),
    ).toEqual({ start: 0, end: 0 });
  });

  it("connects deletions to the unchanged right-side boundary", () => {
    const rows = compare({ before: "a\nremoved\nb", after: "a\nb" });
    expect(getDiffLineBounds(rows, "left", { start: 1, end: 1 })).toEqual({
      start: 1,
      end: 2,
    });
    expect(getDiffLineBounds(rows, "right", { start: 1, end: 1 })).toEqual({
      start: 1,
      end: 1,
    });
  });

  it("keeps ignored empty lines unmarked inside an active navigation block", () => {
    const rows = compare({
      before: "",
      after: "a\n\nb\n",
      ignoreMode: "space-and-empty-lines",
    });
    const range = getTextDiffRanges(rows, "space-and-empty-lines")[0]!;
    expect(getDiffLineBounds(rows, "right", range)).toEqual({
      start: 0,
      end: 3,
    });
    const decorations = entries(
      buildDiffDecorations(
        EditorState.create({ doc: "a\n\nb\n" }).doc,
        rows,
        "right",
        "line",
        range,
      ),
    );
    expect(
      decorations
        .filter((entry) => entry.spec.class.includes("cm-diff-active"))
        .map((entry) => entry.from),
    ).toEqual([0, 3]);
    expect(
      decorations
        .filter((entry) => entry.from === 2 || entry.from === 5)
        .every((entry) => entry.spec.class === ""),
    ).toBe(true);
  });
});
