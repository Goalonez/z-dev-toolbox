import { describe, expect, it } from "vitest";

import { formatJson } from "./tool";

describe("formatJson", () => {
  it("formats pretty json and reports container counts", () => {
    const result = formatJson({
      source: '{"name":"toolbox","items":[{"enabled":true}]}',
      indent: 2,
      mode: "pretty",
      escapeMode: "none",
      sortOrder: "none",
      keyNaming: "preserve",
    });

    expect(result.ok).toBe(true);

    if (result.ok) {
      expect(result.data.formatted).toContain("\n");
      expect(result.data.lineCount).toBeGreaterThan(1);
      expect(result.data.objectCount).toBe(2);
      expect(result.data.arrayCount).toBe(1);
    }
  });

  it("renames keys and sorts them recursively", () => {
    const result = formatJson({
      source: '{"z_key":1,"a-key":{"beta_value":2,"alpha_value":1}}',
      indent: 2,
      mode: "pretty",
      escapeMode: "none",
      sortOrder: "asc",
      keyNaming: "camel",
    });

    expect(result.ok).toBe(true);

    if (result.ok) {
      expect(result.data.formatted).toContain('"aKey"');
      expect(result.data.formatted.indexOf('"aKey"')).toBeLessThan(
        result.data.formatted.indexOf('"zKey"'),
      );
      expect(result.data.formatted).toContain('"alphaValue"');
      expect(result.data.formatted).toContain('"betaValue"');
    }
  });

  it("sorts numeric-like keys lexicographically in nested output", () => {
    const result = formatJson({
      source: '{"2":{"2":2,"10":10},"10":1}',
      indent: 2,
      mode: "pretty",
      escapeMode: "none",
      sortOrder: "asc",
      keyNaming: "preserve",
    });

    expect(result.ok).toBe(true);

    if (result.ok) {
      const lines = result.data.formatted
        .split("\n")
        .map((line) => line.trim())
        .filter((line) => line.length > 0);

      expect(lines[1]).toBe('"10": 1,');
      expect(lines[2]).toBe('"2": {');
      expect(lines[3]).toBe('"10": 10,');
      expect(lines[4]).toBe('"2": 2');
    }
  });

  it("supports compact escape and unescape actions independently", () => {
    const escaped = formatJson({
      source: '{"name":"toolbox"}',
      indent: 2,
      mode: "compact",
      escapeMode: "escape",
      sortOrder: "none",
      keyNaming: "preserve",
    });

    expect(escaped.ok).toBe(true);

    if (escaped.ok) {
      expect(escaped.data.formatted).not.toContain("\n");
      expect(escaped.data.formatted).toContain('\\"name\\"');
      expect(escaped.data.formatted.trim().startsWith('"')).toBe(false);

      const unescaped = formatJson({
        source: escaped.data.formatted,
        indent: 2,
        mode: "pretty",
        escapeMode: "unescape",
        sortOrder: "none",
        keyNaming: "preserve",
      });

      expect(unescaped.ok).toBe(true);

      if (unescaped.ok) {
        expect(unescaped.data.formatted).toContain('"name": "toolbox"');
      }
    }
  });

  it("returns invalid json error for broken content", () => {
    const result = formatJson({
      source: '{"name":',
      indent: 2,
      mode: "pretty",
      escapeMode: "none",
      sortOrder: "none",
      keyNaming: "preserve",
    });

    expect(result.ok).toBe(false);

    if (!result.ok) {
      expect(result.error.code).toBe("INVALID_JSON");
    }
  });
});
