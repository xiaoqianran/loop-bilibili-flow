import { describe, expect, it } from "vitest";
import { transcriptController } from "../../apps/userscript/src/ui";

describe("subtitle reading UI controller", () => {
  it("formats time with hours and clamps invalid or negative values", () => {
    expect(transcriptController.formatTime(0)).toBe("00:00");
    expect(transcriptController.formatTime(65.8)).toBe("01:05");
    expect(transcriptController.formatTime(3661)).toBe("01:01:01");
    expect(transcriptController.formatTime(65, true)).toBe("00:01:05");
    expect(transcriptController.formatTime(-5)).toBe("00:00");
    expect(transcriptController.formatTime("invalid")).toBe("00:00");
  });

  it("searches subtitles case-insensitively and preserves original indices", () => {
    const cues = [
      { content: "Learn Recursive Self Improvement" },
      { content: "中文 RSI 概念" },
      { content: "RECURSIVE algorithms" },
    ];
    expect(transcriptController.filterIndexes(cues, " recursive ")).toEqual([0, 2]);
    expect(transcriptController.filterIndexes(cues, "中文")).toEqual([1]);
    expect(transcriptController.filterIndexes(cues, "")).toEqual([0, 1, 2]);
    expect(transcriptController.filterIndexes(null, "any")).toEqual([]);
  });

  it("uses binary search and 0.2 second tolerance at cue boundaries", () => {
    const cues = [
      { from_sec: 1, to_sec: 3, content: "a" },
      { from_sec: 4, to_sec: 6, content: "b" },
      { from: "8", to: "9", content: "c" },
    ];
    const parseSeconds = (value: unknown) => Number(value);
    expect(transcriptController.cueIndexAt(cues, 0, parseSeconds)).toBe(-1);
    expect(transcriptController.cueIndexAt(cues, 1, parseSeconds)).toBe(0);
    expect(transcriptController.cueIndexAt(cues, 3.2, parseSeconds)).toBe(0);
    expect(transcriptController.cueIndexAt(cues, 3.21, parseSeconds)).toBe(-1);
    expect(transcriptController.cueIndexAt(cues, 5, parseSeconds)).toBe(1);
    expect(transcriptController.cueIndexAt(cues, 8.5, parseSeconds)).toBe(2);
    expect(transcriptController.cueIndexAt([], 8, parseSeconds)).toBe(-1);
  });

  it("copies defined subtitle metadata while preserving unrelated state", () => {
    const original = { subStatus: "wait", title: "user title", data: ["old"] };
    const source = { subStatus: "ok", data: ["new"], cid: 99, title: "server title", error: undefined };
    const result = transcriptController.copySubtitleState(original, source);
    expect(result).toBe(original);
    expect(result).toEqual({ subStatus: "ok", title: "user title", data: ["new"], cid: 99 });
    expect(transcriptController.copySubtitleState(null, source)).toBeNull();
    expect(transcriptController.copySubtitleState(original, null)).toBe(original);
  });
});
