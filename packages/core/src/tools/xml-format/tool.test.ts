import { describe, expect, it } from "vitest";

import { formatXml } from "./tool";

describe("formatXml", () => {
  it("formats nested xml in pretty mode", () => {
    const result = formatXml({
      source: "<root><item id=\"1\"><name>toolbox</name></item></root>",
      indent: 2,
      mode: "pretty",
    });

    expect(result.ok).toBe(true);

    if (result.ok) {
      expect(result.data.formatted).toBe(
        [
          "<root>",
          "  <item id=\"1\">",
          "    <name>",
          "      toolbox",
          "    </name>",
          "  </item>",
          "</root>",
        ].join("\n"),
      );
      expect(result.data.lineCount).toBe(7);
    }
  });

  it("formats xml in compact mode", () => {
    const result = formatXml({
      source: "<root>\n  <item> value </item>\n</root>",
      indent: 2,
      mode: "compact",
    });

    expect(result.ok).toBe(true);

    if (result.ok) {
      expect(result.data.formatted).toBe("<root><item>value</item></root>");
    }
  });

  it("preserves declaration comment and cdata", () => {
    const result = formatXml({
      source:
        "<?xml version=\"1.0\" encoding=\"UTF-8\"?><root><!-- note --><![CDATA[a < b]]><item /></root>",
      indent: 2,
      mode: "pretty",
    });

    expect(result.ok).toBe(true);

    if (result.ok) {
      expect(result.data.formatted).toContain(
        '<?xml version="1.0" encoding="UTF-8"?>',
      );
      expect(result.data.formatted).toContain("<!-- note -->");
      expect(result.data.formatted).toContain("<![CDATA[a < b]]>");
      expect(result.data.formatted).toContain("<item />");
    }
  });

  it("preserves mixed content ordering", () => {
    const result = formatXml({
      source: "<p>Hello <b>world</b> !</p>",
      indent: 2,
      mode: "pretty",
    });

    expect(result.ok).toBe(true);

    if (result.ok) {
      expect(result.data.formatted).toBe(
        ["<p>", "  Hello", "  <b>", "    world", "  </b>", "  !", "</p>"].join(
          "\n",
        ),
      );
    }
  });

  it("returns invalid xml for mismatched tags", () => {
    const result = formatXml({
      source: "<root><item></root>",
      indent: 2,
      mode: "pretty",
    });

    expect(result.ok).toBe(false);

    if (!result.ok) {
      expect(result.error.code).toBe("INVALID_XML");
    }
  });
});
