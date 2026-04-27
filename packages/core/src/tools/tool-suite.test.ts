import { describe, expect, it } from "vitest";

import { transformBase64 } from "./base64/tool";
import { analyzeColor } from "./color/tool";
import { analyzeCrontab } from "./crontab/tool";
import { diffText } from "./text-diff/tool";
import { hashText } from "./hash/tool";
import { evaluateRegex } from "./regex/tool";
import { generateSnowflakeIds } from "./snowflake/tool";
import { convertTimestamp } from "./timestamp/tool";
import { transformUrlEncoding } from "./url-encode/tool";
import { formatXml } from "./xml-format/tool";

describe("tool suite", () => {
  it("handles unicode base64 roundtrip", () => {
    const encoded = transformBase64({
      source: "老C toolbox",
      mode: "encode",
      contentType: "text",
      urlSafe: false,
      imageMimeType: "image/png"
    });

    expect(encoded.ok).toBe(true);

    if (encoded.ok) {
      const decoded = transformBase64({
        source: encoded.data.result,
        mode: "decode",
        contentType: "text",
        urlSafe: false,
        imageMimeType: "image/png"
      });

      expect(decoded.ok).toBe(true);

      if (decoded.ok) {
        expect(decoded.data.result).toBe("老C toolbox");
      }
    }
  });

  it("supports url encoding with plus mode", () => {
    const result = transformUrlEncoding({
      source: "hello world+1",
      mode: "encode",
      spaceMode: "plus"
    });

    expect(result.ok).toBe(true);

    if (result.ok) {
      expect(result.data.result).toBe("hello+world%2B1");
    }
  });

  it("converts timestamps from seconds", () => {
    const result = convertTimestamp({
      value: "1700000000",
      source: "timestamp"
    });

    expect(result.ok).toBe(true);

    if (result.ok) {
      expect(result.data.epochMilliseconds).toBe(1_700_000_000_000);
      expect(result.data.isoString).toBe("2023-11-14T22:13:20.000Z");
    }
  });

  it("parses standard crontab and previews runs", () => {
    const result = analyzeCrontab({
      expression: "*/30 9-10 * * 1-5",
      count: 2,
      fromTimestamp: new Date(2024, 0, 1, 8, 0, 0).getTime()
    });

    expect(result.ok).toBe(true);

    if (result.ok) {
      expect(result.data.nextRuns).toHaveLength(2);
      expect(result.data.nextRuns[0]?.localDateTime).toBe("2024-01-01 09:00:00");
      expect(result.data.nextRuns[1]?.localDateTime).toBe("2024-01-01 09:30:00");
    }
  });

  it("parses second-level crontab expressions", () => {
    const result = analyzeCrontab({
      expression: "*/10 * * * * *",
      count: 2,
      fromTimestamp: new Date(2024, 0, 1, 8, 0, 0, 500).getTime()
    });

    expect(result.ok).toBe(true);

    if (result.ok) {
      expect(result.data.precision).toBe("second");
      expect(result.data.nextRuns[0]?.localDateTime).toBe("2024-01-01 08:00:10.000");
    }
  });

  it("calculates text diff summary", () => {
    const result = diffText({
      before: "a\nb\nc",
      after: "a\nb2\nc",
      mode: "line"
    });

    expect(result.ok).toBe(true);

    if (result.ok) {
      expect(result.data.additions).toBe(1);
      expect(result.data.removals).toBe(1);
      expect(result.data.unchanged).toBe(2);
    }
  });

  it("computes regex matches and replacement", () => {
    const result = evaluateRegex({
      pattern: "(tool)(box)",
      flags: "g",
      replacement: "$2-$1",
      source: "toolbox toolbox"
    });

    expect(result.ok).toBe(true);

    if (result.ok) {
      expect(result.data.matchCount).toBe(2);
      expect(result.data.matches[0]?.groups).toEqual(["tool", "box"]);
      expect(result.data.replaced).toBe("box-tool box-tool");
    }
  });

  it("parses colors across formats", () => {
    const result = analyzeColor({
      value: "rgba(198, 110, 71, 0.5)"
    });

    expect(result.ok).toBe(true);

    if (result.ok) {
      expect(result.data.hex).toBe("#C66E47");
      expect(result.data.alpha).toBe(0.5);
      expect(result.data.hsl.startsWith("hsl(")).toBe(true);
    }
  });

  it("generates sequential snowflake ids", () => {
    const result = generateSnowflakeIds({
      workerId: 1,
      datacenterId: 1,
      count: 2,
      sequenceStart: 5,
      timestamp: 1_700_000_000_000,
      epoch: 1_288_834_974_657
    });

    expect(result.ok).toBe(true);

    if (result.ok) {
      expect(result.data.items[0]?.sequence).toBe(5);
      expect(result.data.items[1]?.sequence).toBe(6);
      expect(BigInt(result.data.items[1]?.id ?? "0")).toBeGreaterThan(
        BigInt(result.data.items[0]?.id ?? "0"),
      );
    }
  });

  it("formats xml content", () => {
    const result = formatXml({
      source: "<root><item>ok</item></root>",
      indent: 2,
      mode: "pretty"
    });

    expect(result.ok).toBe(true);

    if (result.ok) {
      expect(result.data.formatted).toContain("<item>");
      expect(result.data.lineCount).toBeGreaterThan(1);
    }
  });

  it("computes common hashes", async () => {
    const result = await hashText({ source: "abc" });

    expect(result.ok).toBe(true);

    if (result.ok) {
      const md5 = result.data.items.find((item) => item.algorithm === "MD5");
      const sha256 = result.data.items.find((item) => item.algorithm === "SHA-256");
      const sm3 = result.data.items.find((item) => item.algorithm === "SM3");

      expect(md5?.hex).toBe("900150983cd24fb0d6963f7d28e17f72");
      expect(sha256?.hex).toBe(
        "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad",
      );
      expect(sm3?.hex).toBe(
        "66c7f0f462eeedd9d1f2d46bdc10e4e24167c4875cf2f7a2297da02b8f4ba8e0",
      );
    }
  });
});
