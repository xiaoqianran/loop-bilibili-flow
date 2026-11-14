import { describe, expect, it } from "vitest";
import { studio } from "../../apps/userscript/src/app";

describe("Studio streaming turn state machine", () => {
  it("appends user and streaming assistant without overwriting previous history", () => {
    const previous = { id: "old", role: "assistant", content: "prior" };
    const state = { studioMessages: [previous], studioMemory: "memory" };
    const { user, assistant } = studio.beginTurn(state, "new question", 123);
    expect(state.studioMessages).toEqual([
      previous,
      { id: "u-123", role: "user", content: "new question", status: "done" },
      { id: "a-123", role: "assistant", content: "", status: "running" },
    ]);
    expect(user).toBe(state.studioMessages[1]);
    expect(assistant).toBe(state.studioMessages[2]);
    expect(state.studioMemory).toBe("memory");
  });

  it("streams full response and finalizes success or stop using existing message identity", () => {
    const state = { studioMessages: [] };
    const { assistant } = studio.beginTurn(state, "question", 1);
    expect(studio.updateTurn(assistant, "one")).toBe("one");
    expect(studio.updateTurn(assistant, "one two")).toBe("one two");
    expect(studio.updateTurn(assistant, null)).toBe("");
    studio.finishTurn(assistant, "  finished  ", false);
    expect(assistant).toMatchObject({ id: "a-1", content: "finished", status: "done" });
    studio.finishTurn(assistant, "  partial ", true);
    expect(assistant).toMatchObject({ content: "partial", status: "stopped" });
    expect(state.studioMessages[1]).toBe(assistant);
  });

  it("preserves partials and fallback status on errors and explicit stops", () => {
    const bot = { id: "a", role: "assistant", content: "", status: "running" };
    studio.failTurn(bot, "  partial response  ", new Error("broken"), false);
    expect(bot).toMatchObject({ content: "partial response", status: "error" });
    studio.failTurn(bot, "", new Error("timeout"), false);
    expect(bot).toMatchObject({ content: "timeout", status: "error" });
    studio.failTurn(bot, "", new Error("abort"), true);
    expect(bot).toMatchObject({ content: "已停止", status: "stopped" });
    studio.failTurn(bot, " in-flight ", new Error("abort"), true);
    expect(bot).toMatchObject({ content: "in-flight", status: "stopped" });
  });

  it("clears only conversation and memory fields without changing unrelated workspace state", () => {
    const state = {
      studioMessages: [{ content: "text" }], studioMemory: "summary",
      studioMemoryUntilId: "last", studioMemoryTurns: 9,
      studioLastContextMeta: { chunks: 2 }, studioBusy: true,
    };
    studio.clearTurnHistory(state);
    expect(state).toEqual({
      studioMessages: [], studioMemory: "", studioMemoryUntilId: "",
      studioMemoryTurns: 0, studioLastContextMeta: null, studioBusy: true,
    });
  });
});
