import { describe, expect, it } from "vitest";

import { convertDataFormat } from "./tool";

describe("convertDataFormat", () => {
  it("auto-detects json and converts it to yaml", () => {
    const result = convertDataFormat({
      source: "{\"name\":\"toolbox\",\"enabled\":true}",
      sourceFormat: "auto",
      targetFormat: "yaml",
      indent: 2
    });

    expect(result.ok).toBe(true);

    if (result.ok) {
      expect(result.data.sourceFormat).toBe("json");
      expect(result.data.result).toContain("name: toolbox");
    }
  });

  it("converts csv rows into json objects", () => {
    const result = convertDataFormat({
      source: "name,enabled\njson,true\nyaml,false",
      sourceFormat: "auto",
      targetFormat: "json",
      indent: 2
    });

    expect(result.ok).toBe(true);

    if (result.ok) {
      expect(result.data.sourceFormat).toBe("csv");
      expect(result.data.result).toContain("\"name\": \"json\"");
      expect(result.data.result).toContain("\"enabled\": \"true\"");
    }
  });

  it("parses properties into json", () => {
    const result = convertDataFormat({
      source: "app.name=z-dev-toolbox\napp.mode=local",
      sourceFormat: "auto",
      targetFormat: "json",
      indent: 2
    });

    expect(result.ok).toBe(true);

    if (result.ok) {
      expect(result.data.sourceFormat).toBe("properties");
      expect(result.data.result).toContain("\"app.name\": \"z-dev-toolbox\"");
    }
  });

  it("parses toml tables into json", () => {
    const result = convertDataFormat({
      source: "title = \"toolbox\"\n[owner]\nname = \"老C\"",
      sourceFormat: "auto",
      targetFormat: "json",
      indent: 2
    });

    expect(result.ok).toBe(true);

    if (result.ok) {
      expect(result.data.sourceFormat).toBe("toml");
      expect(result.data.result).toContain("\"title\": \"toolbox\"");
      expect(result.data.result).toContain("\"name\": \"老C\"");
    }
  });

  it("parses xml into json", () => {
    const result = convertDataFormat({
      source: "<root id=\"1\"><item>alpha</item><item>beta</item></root>",
      sourceFormat: "auto",
      targetFormat: "json",
      indent: 2
    });

    expect(result.ok).toBe(true);

    if (result.ok) {
      expect(result.data.sourceFormat).toBe("xml");
      expect(result.data.result).toContain("\"@id\": \"1\"");
      expect(result.data.result).toContain("\"item\": [");
    }
  });

  it("parses raw http into json", () => {
    const result = convertDataFormat({
      source: "POST /tools HTTP/1.1\nHost: example.com\nContent-Type: application/json\n\n{\"name\":\"toolbox\"}",
      sourceFormat: "auto",
      targetFormat: "json",
      indent: 2
    });

    expect(result.ok).toBe(true);

    if (result.ok) {
      expect(result.data.sourceFormat).toBe("http");
      expect(result.data.result).toContain("\"method\": \"POST\"");
      expect(result.data.result).toContain("\"name\": \"toolbox\"");
    }
  });
});
