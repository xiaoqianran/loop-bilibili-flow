import { describe, expect, it } from "vitest";
import { preprocess } from "../../apps/userscript/src/app";

describe("preprocess application policy", () => {
  it("normalizes concurrency and chunk limits with the prior defaults", () => {
    expect(preprocess.settings({})).toEqual({
      concurrency: 6, targetMinutes: 8, overlapSeconds: 0, maxChars: 24000, retries: 0,
    });
    expect(preprocess.settings({
      preprocessConcurrency: 100, preprocessTargetMinutes: 1,
      preprocessOverlapSeconds: 999, preprocessMaxChars: 7, preprocessRetries: 9,
    })).toEqual({
      concurrency: 8, targetMinutes: 2, overlapSeconds: 120, maxChars: 8000, retries: 4,
    });
  });

  it("parses video timestamp tokens and preserves invalid-token rejection", () => {
    expect(preprocess.parseTimestamp("[BV123xyz P2 01:02:03]")).toEqual({
      token: "[BV123xyz P2 01:02:03]", bvid: "BV123xyz", page: 2,
      clock: "01:02:03", seconds: 3723,
    });
    expect(preprocess.parseTimestamp("[BV123xyz P1 02:03]")?.seconds).toBe(123);
    expect(preprocess.parseTimestamp("[missing]")).toBeNull();
  });

  it("splits processed reading blocks by source and section", () => {
    expect(preprocess.readingBlocks("=== BVabc P1 Title ===\r\n# Overview\r\nline one\r\nline two\r\n\r\n## Next\r\ntext")).toEqual([
      { type: "source", text: "BVabc P1 Title" },
      { type: "heading", text: "Overview" },
      { type: "paragraph", topic: "Overview", text: "line one\nline two" },
      { type: "heading", text: "Next" },
      { type: "paragraph", topic: "Next", text: "text" },
    ]);
    expect(preprocess.readingBlocks("")).toEqual([]);
  });

  it("joins processed subtitles without changing the published text format", () => {
    expect(preprocess.buildPayload([
      { bvid: "BV1", page: 1, title: "First", preprocessedText: "  text  " },
      { bvid: "BV2", page: 3, title: "Other", preprocessedText: "second" },
    ])).toBe("=== BV1 First ===\ntext\n\n=== BV2 P3 Other ===\nsecond");
  });
});
