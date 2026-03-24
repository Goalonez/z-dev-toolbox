import { describe, expect, it } from "vitest";

import { diffText } from "./tool";

describe("diffText", () => {
  it("builds aligned rows and diff points for line diff", () => {
    const result = diffText({
      before: "alpha\nbeta\ngamma",
      after: "alpha\nbeta-2\ngamma\ndelta",
      highlightMode: "line"
    });

    expect(result.ok).toBe(true);

    if (result.ok) {
      expect(result.data.additions).toBe(2);
      expect(result.data.removals).toBe(1);
      expect(result.data.unchanged).toBe(2);
      expect(result.data.diffCount).toBe(2);
      expect(result.data.rows).toEqual([
        {
          kind: "equal",
          leftLineNumber: 1,
          rightLineNumber: 1,
          leftText: "alpha",
          rightText: "alpha"
        },
        {
          kind: "changed",
          leftLineNumber: 2,
          rightLineNumber: 2,
          leftText: "beta",
          rightText: "beta-2"
        },
        {
          kind: "equal",
          leftLineNumber: 3,
          rightLineNumber: 3,
          leftText: "gamma",
          rightText: "gamma"
        },
        {
          kind: "added",
          leftLineNumber: null,
          rightLineNumber: 4,
          leftText: "",
          rightText: "delta"
        }
      ]);
    }
  });

  it("computes inline spans for character highlighting", () => {
    const result = diffText({
      before: "cat",
      after: "cut",
      highlightMode: "character"
    });

    expect(result.ok).toBe(true);

    if (result.ok) {
      expect(result.data.rows).toHaveLength(1);
      expect(result.data.rows[0]?.kind).toBe("changed");
      expect(result.data.rows[0]?.leftSpans).toEqual([
        { kind: "equal", value: "c" },
        { kind: "removed", value: "a" },
        { kind: "equal", value: "t" }
      ]);
      expect(result.data.rows[0]?.rightSpans).toEqual([
        { kind: "equal", value: "c" },
        { kind: "added", value: "u" },
        { kind: "equal", value: "t" }
      ]);
    }
  });

  it("treats trimmed whitespace as equal when configured", () => {
    const result = diffText({
      before: "  alpha  ",
      after: "alpha",
      highlightMode: "line",
      ignoreMode: "trim"
    });

    expect(result.ok).toBe(true);

    if (result.ok) {
      expect(result.data.diffCount).toBe(0);
      expect(result.data.rows).toEqual([
        {
          kind: "equal",
          leftLineNumber: 1,
          rightLineNumber: 1,
          leftText: "  alpha  ",
          rightText: "alpha"
        }
      ]);
    }
  });

  it("ignores whitespace-only lines when configured", () => {
    const result = diffText({
      before: "first\n   \nsecond",
      after: "first\nsecond",
      highlightMode: "line",
      ignoreMode: "space-and-empty-lines"
    });

    expect(result.ok).toBe(true);

    if (result.ok) {
      expect(result.data.diffCount).toBe(0);
      expect(result.data.rows).toEqual([
        {
          kind: "equal",
          leftLineNumber: 1,
          rightLineNumber: 1,
          leftText: "first",
          rightText: "first"
        },
        {
          kind: "equal",
          leftLineNumber: 2,
          rightLineNumber: null,
          leftText: "   ",
          rightText: ""
        },
        {
          kind: "equal",
          leftLineNumber: 3,
          rightLineNumber: 2,
          leftText: "second",
          rightText: "second"
        }
      ]);
    }
  });

  it("returns a stable error when the line diff exceeds the matrix limit", () => {
    const before = Array.from({ length: 401 }, (_, index) => `before-${index}`).join(
      "\n"
    );
    const after = Array.from({ length: 401 }, (_, index) => `after-${index}`).join(
      "\n"
    );
    const result = diffText({
      before,
      after,
      highlightMode: "line"
    });

    expect(result.ok).toBe(false);

    if (!result.ok) {
      expect(result.error.code).toBe("DIFF_FAILED");
      expect(result.error.details).toContain("文本体积过大");
    }
  });
});
