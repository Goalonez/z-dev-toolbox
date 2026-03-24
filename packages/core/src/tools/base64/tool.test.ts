import { describe, expect, it } from "vitest";

import { transformBase64 } from "./tool";

describe("transformBase64", () => {
  it("detects json mime type when encoding text content", () => {
    const result = transformBase64({
      source: '{"name":"toolbox"}',
      mode: "encode",
      contentType: "text",
      urlSafe: false,
      imageMimeType: "image/png",
    });

    expect(result.ok).toBe(true);

    if (result.ok) {
      expect(result.data.outputKind).toBe("base64");
      expect(result.data.mimeType).toBe("application/json;charset=utf-8");
    }
  });

  it("detects svg mime type when encoding svg markup", () => {
    const result = transformBase64({
      source: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1 1"></svg>',
      mode: "encode",
      contentType: "text",
      urlSafe: false,
      imageMimeType: "image/png",
    });

    expect(result.ok).toBe(true);

    if (result.ok) {
      expect(result.data.outputKind).toBe("base64");
      expect(result.data.mimeType).toBe("image/svg+xml");
    }
  });

  it("decodes text data urls with charset parameters as text", () => {
    const result = transformBase64({
      source: "data:application/json;charset=utf-8;base64,eyJuYW1lIjoidG9vbGJveCJ9",
      mode: "decode",
      contentType: "text",
      urlSafe: false,
      imageMimeType: "image/png",
    });

    expect(result.ok).toBe(true);

    if (result.ok) {
      expect(result.data.outputKind).toBe("text");
      expect(result.data.result).toBe('{"name":"toolbox"}');
    }
  });
});
