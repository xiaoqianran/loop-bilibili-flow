import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { md5 } from "@subbatch/core";

describe("canonical core MD5 for Knowledge and AI fingerprints", () => {
  it("matches Node MD5 for ASCII, Chinese, emoji, combining marks and 64-byte block boundaries", () => {
    const samples = [
      "", "a", "The quick brown fox jumps over the lazy dog",
      "中文学习字幕", "字幕🚀🧠知识", "e\u0301", "\r\n",
      "A".repeat(55), "A".repeat(56), "A".repeat(63),
      "B".repeat(64), "C".repeat(65), "学习字幕".repeat(500),
    ];
    for (const text of samples) {
      const expected = createHash("md5").update(text).digest("hex");
      expect(md5(text), text.slice(0, 32)).toBe(expected);
    }
  });

  it("provides deterministic, content-sensitive identifiers and never includes raw text", () => {
    const first = md5("same selected subtitle");
    expect(first).toBe(md5("same selected subtitle"));
    expect(first).not.toBe(md5("another subtitle"));
    expect(first).toMatch(/^[0-9a-f]{32}$/);
  });
});
