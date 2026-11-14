import { describe, expect, it } from "vitest";
import { buildChatMessages, parseStore, persist, restore } from "../../apps/userscript/src/app/studio-controller";
import { stageOf } from "../../apps/userscript/src/ui/workspaces/studio-controller";

describe("Studio state and request preparation", () => {
  it("uses historical storage format with 40 messages and at most 24 routes", () => {
    const messages = Array.from({ length: 45 }, (_, i) =>
      ({ id: "msg-" + i, role: "user", content: String(i) }));
    let store = parseStore(null);
    for (let index = 0; index < 26; index++) {
      store = persist(store, "BV" + index, {
        studioMessages: messages, studioContextPref: "processed",
        studioMemory: "知识摘要", studioMemoryTurns: 2,
      }, 100 + index);
    }
    expect(Object.keys(store)).toHaveLength(24);
    expect(store.BV0).toBeUndefined();
    expect(store.BV25?.messages).toHaveLength(40);
    expect(restore(store, "BV25")).toMatchObject({
      studioMemory: "知识摘要",
      studioContextPref: "processed",
      studioMemoryTurns: 2,
    });
  });

  it("is backward-compatible with string JSON and malformed entries", () => {
    expect(parseStore("not-json")).toEqual({});
    expect(restore(parseStore('{"BV1":{"contextPref":"wrong","messages":[]}}'), "BV1"))
      .toMatchObject({ studioContextPref: "auto", studioMessages: [] });
  });

  it("does not duplicate the latest user question in model requests", () => {
    const result = buildChatMessages("系统", [
      { id: "old", role: "user", content: "旧问题", status: "done" },
      { id: "answer", role: "assistant", content: "旧答案", status: "done" },
      { id: "new", role: "user", content: "新问题", status: "done" },
      { id: "pending", role: "assistant", content: "", status: "running" },
    ], "new", "新问题", 8);
    expect(result.map((message) => message.content))
      .toEqual(["系统", "旧问题", "旧答案", "新问题"]);
  });

  it("normalizes invalid workbench stage values", () => {
    expect(stageOf("chat")).toBe("chat");
    expect(stageOf("postprocess")).toBe("postprocess");
    expect(stageOf("broken")).toBe("preprocess");
  });
});
