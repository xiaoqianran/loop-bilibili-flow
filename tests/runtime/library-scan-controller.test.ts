import { describe, expect, it, vi } from "vitest";
import { libraryScan } from "../../apps/userscript/src/app";

describe("library scan pagination and merging", () => {
  it("collects pages with stable dedupe, metadata overlay and configurable pacing", async () => {
    const fetchPage = vi.fn(async (page: number) => page === 1
      ? { items: [{ bvid: "BV1" }, { bvid: "BV2", page: 2 }, { bvid: "" }], hasMore: true, meta: { author: "UP" } }
      : { items: [{ bvid: "BV1" }, { bvid: "BV2", page: 1 }], hasMore: false, meta: { keyword: "AI" } });
    const progress = vi.fn();
    const sleep = vi.fn(async () => {});
    const waitIfPaused = vi.fn(async () => {});
    const result = await libraryScan.collectPages({ maxPages: 5, pageSize: 30, delayMs: 250 }, {
      fetchPage, progress, sleep, waitIfPaused, cancelled: () => false,
    });
    expect(result.items.map(item => item.bvid + ":" + (item.page || 1))).toEqual(["BV1:1", "BV2:2", "BV2:1"]);
    expect(result).toMatchObject({ pagesFetched: 2, truncated: false, meta: { author: "UP", keyword: "AI" } });
    expect(fetchPage).toHaveBeenCalledWith(1, 30);
    expect(fetchPage).toHaveBeenCalledWith(2, 30);
    expect(progress).toHaveBeenCalledTimes(2);
    expect(waitIfPaused).toHaveBeenCalledTimes(2);
    expect(sleep).toHaveBeenCalledExactlyOnceWith(250);
  });
  it("honors page limits and default delay, preserves legacy truncated status", async () => {
    const sleep = vi.fn(async () => {});
    const result = await libraryScan.collectPages({ maxPages: 2, pageSize: 20, delayMs: 0 }, {
      fetchPage: async page => ({ items: [{ bvid: "BV" + page }], hasMore: true }),
      waitIfPaused: async () => {}, cancelled: () => false, sleep,
    });
    expect(result).toMatchObject({ pagesFetched: 2, truncated: true });
    expect(sleep).toHaveBeenCalledExactlyOnceWith(300);
  });
  it("cancels before and after network fetch without publishing further results", async () => {
    let cancelled = true;
    const fetchPage = vi.fn(async () => ({ items: [{ bvid: "BV1" }], hasMore: false }));
    const ports = { fetchPage, waitIfPaused: async () => {}, cancelled: () => cancelled, sleep: async () => {} };
    await expect(libraryScan.collectPages({ maxPages: 3, pageSize: 30 }, ports))
      .rejects.toMatchObject({ name: "AbortError", message: "扫描已取消" });
    expect(fetchPage).not.toHaveBeenCalled();
    cancelled = false;
    ports.fetchPage = vi.fn(async () => { cancelled = true; return { items: [{ bvid: "BV1" }], hasMore: false }; });
    await expect(libraryScan.collectPages({ maxPages: 3, pageSize: 30 }, ports))
      .rejects.toMatchObject({ name: "AbortError" });
  });
  it("merges metadata while preserving selected status, cached transcript and source history", () => {
    const existing = [{
      bvid: "BV1", page: 1, selected: false, subStatus: "ok", data: ["cached"], cue_count: 1,
      title: "Old", author: "UP", groupFolder: "Old Folder", sources: ["old"], aid: 10, part: "A",
    }];
    const original = existing[0];
    const result = libraryScan.mergeItems(existing, [
      { bvid: "BV1", page: 1, title: "New", author: "", groupFolder: "New Folder", aid: 0, part: "" },
      { bvid: "BV2", page: 2, title: "Second" },
    ], "new", item => item.bvid + "#" + (item.page || 1));
    expect(result).toEqual({ added: 1, existed: 1 });
    expect(existing[0]).toBe(original);
    expect(existing[0]).toMatchObject({
      title: "New", author: "UP", groupFolder: "New Folder", aid: 0, part: "",
      selected: false, subStatus: "ok", data: ["cached"], cue_count: 1, sources: ["old", "new"],
    });
    expect(existing[1]).toMatchObject({
      bvid: "BV2", page: 2, selected: true, subStatus: "wait", cue_count: 0,
      data: null, error: "", sources: ["new"],
    });
  });
});
