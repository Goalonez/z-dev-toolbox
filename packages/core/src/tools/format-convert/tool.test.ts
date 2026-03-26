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

  it("wraps xml output with root when the object has multiple top-level keys", () => {
    const result = convertDataFormat({
      source:
        "{\"code\":500,\"message\":\"没有可用token（traceid: f335e34bce529918f08bcb1bbe2c7ffc）\",\"param\":null,\"type\":\"invalid_request_error\"}",
      sourceFormat: "auto",
      targetFormat: "xml",
      indent: 2
    });

    expect(result.ok).toBe(true);

    if (result.ok) {
      expect(result.data.sourceFormat).toBe("json");
      expect(result.data.result).toContain("<root>");
      expect(result.data.result).toContain("<code>500</code>");
      expect(result.data.result).toContain("<param />");
    }
  });

  it("converts a json object into a single-row csv table", () => {
    const result = convertDataFormat({
      source:
        "{\"code\":500,\"message\":\"没有可用token（traceid: f335e34bce529918f08bcb1bbe2c7ffc）\",\"param\":null,\"type\":\"invalid_request_error\"}",
      sourceFormat: "auto",
      targetFormat: "csv",
      indent: 2
    });

    expect(result.ok).toBe(true);

    if (result.ok) {
      expect(result.data.result).toBe(
        "code,message,param,type\n500,没有可用token（traceid: f335e34bce529918f08bcb1bbe2c7ffc）,,invalid_request_error",
      );
    }
  });

  it("converts a json object into an html table", () => {
    const result = convertDataFormat({
      source:
        "{\"code\":500,\"message\":\"没有可用token（traceid: f335e34bce529918f08bcb1bbe2c7ffc）\",\"param\":null,\"type\":\"invalid_request_error\"}",
      sourceFormat: "auto",
      targetFormat: "html",
      indent: 2
    });

    expect(result.ok).toBe(true);

    if (result.ok) {
      expect(result.data.result).toBe(
        "<table><thead><tr><th>code</th><th>message</th><th>param</th><th>type</th></tr></thead><tbody><tr><td>500</td><td>没有可用token（traceid: f335e34bce529918f08bcb1bbe2c7ffc）</td><td>null</td><td>invalid_request_error</td></tr></tbody></table>",
      );
    }
  });

  it("converts a json object into http query parameters", () => {
    const result = convertDataFormat({
      source:
        "{\"code\":500,\"message\":\"没有可用token（traceid: f335e34bce529918f08bcb1bbe2c7ffc）\",\"param\":null,\"type\":\"invalid_request_error\"}",
      sourceFormat: "auto",
      targetFormat: "http",
      indent: 2
    });

    expect(result.ok).toBe(true);

    if (result.ok) {
      expect(result.data.result).toBe(
        "code=500&message=%E6%B2%A1%E6%9C%89%E5%8F%AF%E7%94%A8token%EF%BC%88traceid%3A%20f335e34bce529918f08bcb1bbe2c7ffc%EF%BC%89&param=&type=invalid_request_error",
      );
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
