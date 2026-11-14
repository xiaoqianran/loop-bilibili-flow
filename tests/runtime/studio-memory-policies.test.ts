import { describe, expect, it } from "vitest";
import { studio } from "../../apps/userscript/src/app";

describe("Studio transcript and memory policies", () => {
  it("selects the requested source with processed-text fallback", () => {
    expect(studio.transcriptContext("raw", "clean", "raw")).toEqual({ text: "raw", source: "原始字幕" });
    expect(studio.transcriptContext("raw", "clean", "processed")).toEqual({ text: "clean", source: "规范化稿" });
    expect(studio.transcriptContext("raw", "", "processed")).toEqual({ text: "raw", source: "原始字幕" });
    expect(studio.transcriptContext("raw", "clean", "auto")).toEqual({ text: "clean", source: "规范化稿" });
  });
  it("passes through short inputs while reporting original lengths", () => {
    expect(studio.compressTranscript("", "topic", 10))
      .toEqual({ text: "", compressed: false, original: 0, kept: 0, chunks: 0, total: 0 });
    expect(studio.compressTranscript("one\ntwo", "topic", 20))
      .toEqual({ text: "one\ntwo", compressed: false, original: 7, kept: 7, chunks: 1, total: 1 });
  });
  it("keeps opening chunks and ranks a relevant later subtitle above unrelated blocks", () => {
    const content = [
      "# First\n" + "A".repeat(65),
      "# Second\n" + "B".repeat(65),
      "# Unrelated\n" + "C".repeat(65),
      "# Recursion\n" + "The recursive algorithm matters. ".repeat(2),
      "# Other\n" + "D".repeat(65),
    ].join("\n\n");
    const result = studio.compressTranscript(content, "recursive algorithm", 260);
    expect(result.compressed).toBe(true);
    expect(result.total).toBe(5);
    expect(result.text).toContain("# First");
    expect(result.text).toContain("# Second");
    expect(result.text).toContain("# Recursion");
    expect(result.text).not.toContain("# Unrelated");
    expect(result.kept).toBeLessThanOrEqual(260);
  });
  it("trims and bounds memory to most recent lines without truncating last oversized line", () => {
    expect(studio.compactMemoryText("")).toBe("");
    expect(studio.compactMemoryText(" old  \n middle\n recent", 10)).toBe("recent");
    expect(studio.compactMemoryText("long-oversized-last-line", 3)).toBe("long-oversized-last-line");
  });
  it("folds only eligible completed messages and does not fold the same messages twice", () => {
    const state = {
      studioMessages: [
        { id: "u1", role: "user", content: "How do models learn?" },
        { id: "a1", role: "assistant", content: "From data." },
        { id: "a-run", role: "assistant", content: "pending", status: "running" },
        { id: "u2", role: "user", content: "Tell me more." },
        { id: "a2", role: "assistant", content: "Sure." },
        { id: "sys", role: "system", content: "System instruction" },
      ],
      studioMemory: "", studioMemoryUntilId: "", studioMemoryTurns: 0,
    };
    expect(studio.refreshMemory(state, 2, 2400)).toBe(true);
    expect(state.studioMemory).toContain("- 问：How do models learn?");
    expect(state.studioMemory).toContain("- 答：From data.");
    expect(state.studioMemory).not.toContain("pending");
    expect(state.studioMemoryUntilId).toBe("a1");
    expect(state.studioMemoryTurns).toBe(2);
    const oldMemory = state.studioMemory;
    expect(studio.refreshMemory(state, 2, 2400)).toBe(true);
    expect(state.studioMemory).toBe(oldMemory);
    state.studioMessages.push({ id: "u3", role: "user", content: "Continue" });
    expect(studio.refreshMemory(state, 2, 2400)).toBe(true);
    expect(state.studioMemoryUntilId).toBe("u2");
  });
  it("reads only the last nonempty assistant message", () => {
    expect(studio.lastAssistantText([
      { role: "assistant", content: "first" },
      { role: "user", content: "question" },
      { role: "assistant", content: "" },
      { role: "assistant", content: "last" },
    ])).toBe("last");
    expect(studio.lastAssistantText([{ role: "user", content: "no answer" }])).toBe("");
  });
});
