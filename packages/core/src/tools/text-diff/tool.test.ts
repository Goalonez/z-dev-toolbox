import { describe, expect, it } from "vitest";

import { diffText, getTextDiffRanges } from "./tool";

describe("diffText", () => {
  it.each([
    {
      before: "112313\n123",
      after: "123\n123",
      kinds: ["changed", "equal"],
      diffCount: 1,
    },
    {
      before: "1123123\n123\n123123123\n12312312312312\n123123",
      after: "123123\n123\n3123123123\n123\n12312",
      kinds: ["changed", "equal", "changed", "changed", "changed"],
      diffCount: 2,
    },
    {
      before: "1123123\n123\n123123123\n12312312312312\n123123\n1",
      after: "123\n123\n123213\n123123\n123123\n123\n",
      kinds: [
        "changed",
        "equal",
        "changed",
        "changed",
        "equal",
        "changed",
        "added",
      ],
      diffCount: 3,
    },
  ])(
    "aligns edited repeated lines without leading gaps: $before",
    ({ before, after, kinds, diffCount }) => {
      for (const highlightMode of [
        "line",
        "word",
        "split",
        "character",
        "none",
      ] as const) {
        const result = diffText({ before, after, highlightMode });
        expect(result.ok).toBe(true);
        if (!result.ok) continue;
        expect(result.data.rows.map((row) => row.kind)).toEqual(kinds);
        expect(
          result.data.rows.map((row) => [
            row.leftLineNumber,
            row.rightLineNumber,
          ]),
        ).toEqual(
          kinds.map((_, index) => [
            index < before.split("\n").length ? index + 1 : null,
            index + 1,
          ]),
        );
        expect(result.data.diffCount).toBe(diffCount);
      }
    },
  );

  it.each([
    [
      "new\na\nb",
      "a\nb",
      [
        [1, null],
        [2, 1],
        [3, 2],
      ],
    ],
    [
      "a\nb",
      "new\na\nb",
      [
        [null, 1],
        [1, 2],
        [2, 3],
      ],
    ],
    [
      "a\nnew\nb",
      "a\nb",
      [
        [1, 1],
        [2, null],
        [3, 2],
      ],
    ],
    [
      "a\nb",
      "a\nnew\nb",
      [
        [1, 1],
        [null, 2],
        [2, 3],
      ],
    ],
    [
      "a\nb\nnew",
      "a\nb",
      [
        [1, 1],
        [2, 2],
        [3, null],
      ],
    ],
    [
      "a\nb",
      "a\nb\nnew",
      [
        [1, 1],
        [2, 2],
        [null, 3],
      ],
    ],
  ])(
    "preserves actual inserted and deleted lines: %s -> %s",
    (before, after, pairs) => {
      const result = diffText({ before, after });
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(
        result.data.rows.map((row) => [
          row.leftLineNumber,
          row.rightLineNumber,
        ]),
      ).toEqual(pairs);
      expect(result.data.unchanged).toBe(2);
      expect(result.data.diffCount).toBe(1);
    },
  );

  it("prefers replacements when moving lines has the same edit cost", () => {
    const result = diffText({ before: "a\nb", after: "b\na" });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(
      result.data.rows.map((row) => [
        row.kind,
        row.leftLineNumber,
        row.rightLineNumber,
      ]),
    ).toEqual([
      ["changed", 1, 1],
      ["changed", 2, 2],
    ]);
    expect(result.data.chunks).toEqual([
      { kind: "removed", value: "a" },
      { kind: "added", value: "b" },
      { kind: "removed", value: "b" },
      { kind: "added", value: "a" },
    ]);
  });

  it.each([
    ["none", "changed"],
    ["trim", "changed"],
    ["space", "equal"],
    ["space-and-empty-lines", "equal"],
  ] as const)(
    "uses %s comparison keys when aligning repeated lines",
    (ignoreMode, firstKind) => {
      const result = diffText({
        before: " a l p h a \nalpha",
        after: "alpha\nalpha",
        ignoreMode,
      });
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(
        result.data.rows.map((row) => [
          row.kind,
          row.leftLineNumber,
          row.rightLineNumber,
        ]),
      ).toEqual([
        [firstKind, 1, 1],
        ["equal", 2, 2],
      ]);
      expect(result.data.rows[0]?.leftText).toBe(" a l p h a ");
    },
  );

  it.each([
    ["", "", []],
    ["", "a\n", ["added", "added"]],
    ["a\n", "", ["removed", "removed"]],
  ])(
    "preserves empty input and trailing newlines: %s -> %s",
    (before, after, kinds) => {
      const result = diffText({ before, after });
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.data.rows.map((row) => row.kind)).toEqual(kinds);
      expect(
        result.data.rows
          .filter((row) => row.leftLineNumber !== null)
          .map((row) => row.leftText)
          .join("\n"),
      ).toBe(before);
      expect(
        result.data.rows
          .filter((row) => row.rightLineNumber !== null)
          .map((row) => row.rightText)
          .join("\n"),
      ).toBe(after);
    },
  );

  it("builds aligned rows and diff points for line diff", () => {
    const result = diffText({
      before: "alpha\nbeta\ngamma",
      after: "alpha\nbeta-2\ngamma\ndelta",
      highlightMode: "line",
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
          rightText: "alpha",
        },
        {
          kind: "changed",
          leftLineNumber: 2,
          rightLineNumber: 2,
          leftText: "beta",
          rightText: "beta-2",
        },
        {
          kind: "equal",
          leftLineNumber: 3,
          rightLineNumber: 3,
          leftText: "gamma",
          rightText: "gamma",
        },
        {
          kind: "added",
          leftLineNumber: null,
          rightLineNumber: 4,
          leftText: "",
          rightText: "delta",
        },
      ]);
    }
  });

  it("computes inline spans for character highlighting", () => {
    const result = diffText({
      before: "cat",
      after: "cut",
      highlightMode: "character",
    });

    expect(result.ok).toBe(true);

    if (result.ok) {
      expect(result.data.rows).toHaveLength(1);
      expect(result.data.rows[0]?.kind).toBe("changed");
      expect(result.data.rows[0]?.leftSpans).toEqual([
        { kind: "equal", value: "c" },
        { kind: "removed", value: "a" },
        { kind: "equal", value: "t" },
      ]);
      expect(result.data.rows[0]?.rightSpans).toEqual([
        { kind: "equal", value: "c" },
        { kind: "added", value: "u" },
        { kind: "equal", value: "t" },
      ]);
    }
  });

  it("treats trimmed whitespace as equal when configured", () => {
    const result = diffText({
      before: "  alpha  ",
      after: "alpha",
      highlightMode: "line",
      ignoreMode: "trim",
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
          rightText: "alpha",
        },
      ]);
    }
  });

  it("ignores whitespace-only lines when configured", () => {
    const result = diffText({
      before: "first\n   \nsecond",
      after: "first\nsecond",
      highlightMode: "line",
      ignoreMode: "space-and-empty-lines",
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
          rightText: "first",
        },
        {
          kind: "equal",
          leftLineNumber: 2,
          rightLineNumber: null,
          leftText: "   ",
          rightText: "",
        },
        {
          kind: "equal",
          leftLineNumber: 3,
          rightLineNumber: 2,
          leftText: "second",
          rightText: "second",
        },
      ]);
    }
  });

  it("returns a stable error when the line diff exceeds the matrix limit", () => {
    const before = Array.from(
      { length: 401 },
      (_, index) => `before-${index}`,
    ).join("\n");
    const after = Array.from(
      { length: 401 },
      (_, index) => `after-${index}`,
    ).join("\n");
    const result = diffText({
      before,
      after,
      highlightMode: "line",
    });

    expect(result.ok).toBe(false);

    if (!result.ok) {
      expect(result.error.code).toBe("DIFF_FAILED");
      expect(result.error.details).toContain("文本体积过大");
    }
  });

  it.each([
    ["a\n", "\na"],
    ["a\n\nb", "\na\nb\n"],
    ["a\n \nb", " a\nb \n\n"],
    ["\n\n", ""],
  ])(
    "ignores blank lines before matching while retaining the sources: %s -> %s",
    (before, after) => {
      const result = diffText({
        before,
        after,
        ignoreMode: "space-and-empty-lines",
      });
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.data.diffCount).toBe(0);
      expect(result.data.additions).toBe(0);
      expect(result.data.removals).toBe(0);
      for (const [side, source] of [
        ["left", before],
        ["right", after],
      ] as const) {
        const lines = result.data.rows.filter(
          (row) =>
            row[side === "left" ? "leftLineNumber" : "rightLineNumber"] !==
            null,
        );
        expect(
          lines
            .map((row) => row[side === "left" ? "leftText" : "rightText"])
            .join("\n"),
        ).toBe(source);
        expect(
          lines.map(
            (row) =>
              row[side === "left" ? "leftLineNumber" : "rightLineNumber"],
          ),
        ).toEqual(lines.map((_, index) => index + 1));
      }
    },
  );

  it("does not hide a text replacement next to an ignored blank line", () => {
    const result = diffText({
      before: "b",
      after: "\na",
      ignoreMode: "space-and-empty-lines",
      highlightMode: "character",
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(
      result.data.rows.map((row) => [
        row.kind,
        row.leftLineNumber,
        row.rightLineNumber,
      ]),
    ).toEqual([
      ["equal", null, 1],
      ["changed", 1, 2],
    ]);
    expect(result.data.additions).toBe(1);
    expect(result.data.removals).toBe(1);
    expect(result.data.diffCount).toBe(1);
  });

  it("does not split navigation blocks on ignored blank lines", () => {
    const result = diffText({
      before: "",
      after: "a\n\nb",
      ignoreMode: "space-and-empty-lines",
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.diffCount).toBe(1);
    expect(result.data.additions).toBe(2);
  });

  it.each([
    ["b", "a\n\n\n", [{ start: 0, end: 0 }]],
    ["", "\na\n\nb\n", [{ start: 1, end: 3 }]],
    ["old\n\nsame", "new\nsame", [{ start: 0, end: 0 }]],
  ] as const)(
    "excludes ignored blanks at the edges of navigation blocks: %s -> %s",
    (before, after, expectedRanges) => {
      const result = diffText({
        before,
        after,
        ignoreMode: "space-and-empty-lines",
      });
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      const ranges = getTextDiffRanges(
        result.data.rows,
        result.data.ignoreMode,
      );
      expect(ranges).toEqual(expectedRanges);
      expect(result.data.diffCount).toBe(ranges.length);
    },
  );
});
