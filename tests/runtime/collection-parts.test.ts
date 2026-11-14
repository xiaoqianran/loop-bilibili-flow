import { describe, expect, it, vi } from "vitest";
import { libraryScan } from "../../apps/userscript/src/app";
import type { CollectionExpandPorts } from "../../apps/userscript/src/app/library-scan-controller";

function ports(overrides: Partial<CollectionExpandPorts> = {}): CollectionExpandPorts {
  return {
    cancelled: () => false,
    waitIfPaused: vi.fn(async () => {}),
    extractBvid: raw => raw.trim(),
    progress: vi.fn(),
    fetchView: vi.fn(async () => ({
      title: "Video", aid: 100, owner: { name: "Author" },
      pages: [{ page: 1, part: "Intro" }, { page: 2, part: "Chapter 2" }],
    })),
    onFailure: vi.fn(),
    sleep: vi.fn(async () => {}),
    ...overrides,
  };
}

describe("collection archive part expansion", () => {
  it("uses cached multipage metadata and does not request video details", async () => {
    const p = ports();
    const out = await libraryScan.expandCollectionParts([
      { bvid: "BV1", title: "Lessons", author: "Up", pages: [{ part: "One" }, { page: 3, part: "Three" }] },
    ], {}, p);
    expect(out).toMatchObject([
      { bvid: "BV1", page: 1, part: "One", title: "Lessons - P1【One】" },
      { bvid: "BV1", page: 3, part: "Three", title: "Lessons - P3【Three】" },
    ]);
    expect(p.fetchView).not.toHaveBeenCalled();
    expect(p.progress).toHaveBeenCalledWith(1, 1, "BV1");
  });

  it("fetches missing metadata, dedupes BV/page and paces between archives", async () => {
    const p = ports();
    const out = await libraryScan.expandCollectionParts([
      { bvid: "BV1", title: "Before", page: 1 },
      { bvid: "BV1", title: "Duplicate", page: 1 },
      { bvid: "BV2", pages: [{ page: 1, part: "Single" }], title: "Old" },
    ], { delayMs: 50 }, p);
    expect(out.map(item => item.bvid + "#" + item.page)).toEqual(["BV1#1", "BV1#2", "BV2#1", "BV2#2"]);
    expect(out[0]).toMatchObject({ title: "Video - P1【Intro】", author: "Author", aid: 100 });
    expect(p.fetchView).toHaveBeenCalledTimes(3);
    expect(p.sleep).toHaveBeenCalledTimes(2);
    expect(p.sleep).toHaveBeenCalledWith(50);
  });

  it("retains a fallback archive on non-abort metadata errors and continues", async () => {
    const p = ports({
      fetchView: vi.fn(async () => { throw new Error("502"); }),
    });
    const out = await libraryScan.expandCollectionParts([
      { bvid: "BVbad", page: 2, title: "Fallback", author: "Old" },
      { bvid: "BVbad", page: 2, title: "Duplicate" },
    ], {}, p);
    expect(out).toEqual([{ bvid: "BVbad", page: 2, title: "Fallback", author: "Old", aid: undefined }]);
    expect(p.onFailure).toHaveBeenCalledTimes(2);
    expect(p.sleep).not.toHaveBeenCalled();
  });

  it("aborts before requests, after pause and after spacing, preserving cancellation", async () => {
    const abort = Object.assign(new Error("stopped"), { name: "AbortError" });
    const p = ports({ cancelled: () => true });
    await expect(libraryScan.expandCollectionParts([{ bvid: "BV1" }], {}, p)).rejects.toMatchObject({ name: "AbortError" });
    expect(p.fetchView).not.toHaveBeenCalled();
    const q = ports({ fetchView: vi.fn(async () => { throw abort; }) });
    await expect(libraryScan.expandCollectionParts([{ bvid: "BV1" }], {}, q)).rejects.toBe(abort);
    expect(q.onFailure).not.toHaveBeenCalled();
    let cancelled = false;
    const h = ports({ cancelled: () => cancelled, sleep: vi.fn(async () => { cancelled = true; }) });
    await expect(libraryScan.expandCollectionParts([
      { bvid: "BV1" }, { bvid: "BV2" },
    ], { delayMs: 10 }, h)).rejects.toMatchObject({ name: "AbortError" });
  });

  it("normalizes empty archive lists without side effects", async () => {
    const p = ports();
    expect(await libraryScan.expandCollectionParts([], {}, p)).toEqual([]);
    expect(p.fetchView).not.toHaveBeenCalled();
    expect(p.progress).not.toHaveBeenCalled();
  });
});
