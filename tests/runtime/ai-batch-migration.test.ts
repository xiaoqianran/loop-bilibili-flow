import { describe, expect, it, vi } from "vitest";
import { ai } from "../../apps/userscript/src/app";

describe("AI Batch application migration", () => {
  it("clones the persisted v1 session and isolates nested editable arrays", () => {
    const input = {
      sessionId: 7, routeKey: "BVabc", vars: { subtitle: "abc" },
      promptProfile: { id: "legacy" },
      taskSnapshots: [{ task: { id: "task", modelIds: ["m1"] }, prompt: { id: "prompt" } }],
      preprocessPrompt: { id: "pre" }, preprocessConfig: { id: "llm" },
      preprocessEnabled: true,
      commonMeta: { sourceBvids: ["BVabc"], readyCount: 1 },
    };
    const cloned = ai.cloneSessionInput(input, 8)!;
    expect(cloned).toMatchObject({
      sessionId: 8, routeKey: "BVabc", preprocessEnabled: true,
      commonMeta: { sourceBvids: ["BVabc"], readyCount: 1 },
    });
    cloned.taskSnapshots[0]!.task!.modelIds!.push("m2");
    cloned.commonMeta.sourceBvids!.push("BVother");
    expect(input.taskSnapshots[0]!.task!.modelIds).toEqual(["m1"]);
    expect(input.commonMeta.sourceBvids).toEqual(["BVabc"]);
    expect(ai.cloneSessionInput({ vars: {} })).toBeNull();
  });

  it("summarizes all terminal model outcomes", () => {
    expect(ai.summarizeRuns([])).toBeNull();
    expect(ai.summarizeRuns([
      { status: "done" }, { status: "done" }, { status: "error" },
      { status: "stopped" }, { status: "running" },
    ])).toEqual({ done: 2, failed: 1, stopped: 1 });
  });

  it("reuses ready subtitles, fetches missing ones and preserves existing titles", async () => {
    const ready = { bvid: "BVready", subStatus: "ok", data: ["cue"], title: "existing" };
    const missing = { bvid: "BVmissing", page: 2, subStatus: "error", data: null as string[] | null, title: "kept", author: "" };
    const fetchSubtitle = vi.fn(async () => ({
      status: "ok", cue_count: 2, data: ["new"], title: "server title", author: "creator",
    }));
    const sleep = vi.fn(async () => {});
    const onUpdated = vi.fn();
    const result = await ai.ensureSubtitles([ready, missing], 500, {
      cancelled: () => false, onFetching: () => {},
      fetchSubtitle, onUpdated, sleep,
    });
    expect(result).toHaveLength(2);
    expect(fetchSubtitle).toHaveBeenCalledExactlyOnceWith("BVmissing", 2);
    expect(missing).toMatchObject({ subStatus: "ok", cue_count: 2, data: ["new"], title: "kept", author: "creator" });
    expect(sleep).not.toHaveBeenCalled();
    expect(onUpdated).toHaveBeenCalledOnce();
  });

  it("delays between fetched positions without delaying a cached final target", async () => {
    const fetchSubtitle = vi.fn(async () => ({ status: "ok", data: ["text"] }));
    const sleep = vi.fn(async () => {});
    const items = [{ bvid: "BVfirst" }, { bvid: "BVnext", subStatus: "ok", data: ["cached"] }];
    await ai.ensureSubtitles(items, 250, {
      cancelled: () => false, fetchSubtitle, sleep,
      onFetching: () => {}, onUpdated: () => {},
    });
    expect(fetchSubtitle).toHaveBeenCalledTimes(1);
    expect(sleep).toHaveBeenCalledExactlyOnceWith(250);
  });

  it("does not fetch cancelled batches or include failed subtitle targets", async () => {
    const fetchSubtitle = vi.fn(async () => ({ status: "error", error: "unavailable", data: null }));
    const target = { bvid: "BVfail", subStatus: "waiting" };
    await expect(ai.ensureSubtitles([target], 300, {
      cancelled: () => true, fetchSubtitle, onFetching: () => {}, onUpdated: () => {}, sleep: async () => {},
    })).rejects.toThrow("用户停止");
    expect(fetchSubtitle).not.toHaveBeenCalled();
    const result = await ai.ensureSubtitles([target], 300, {
      cancelled: () => false, fetchSubtitle, onFetching: () => {}, onUpdated: () => {}, sleep: async () => {},
    });
    expect(result).toEqual([]);
    expect(target.subStatus).toBe("error");
  });
});
