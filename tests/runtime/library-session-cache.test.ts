import { describe, expect, it } from "vitest";
import { readSessionCache, writeSessionCache } from "../../apps/userscript/src/runtime/session-cache";
import { libraryController } from "../../apps/userscript/src/ui";

describe("session cache runtime", () => {
  function storage() {
    const records = new Map<string, string>();
    return {
      records,
      getItem: (key: string) => records.get(key) ?? null,
      setItem: (key: string, value: string) => { records.set(key, value); },
      removeItem: (key: string) => { records.delete(key); },
    };
  }
  it("keeps legacy bsb:v2 cache keys and round-trips records", () => {
    const area = storage();
    writeSessionCache(() => area, "bsb:v2:", "tracks", "BV123:1", [{ lan: "zh" }], 1000);
    expect(JSON.parse(area.records.get("bsb:v2:tracks:BV123:1")!)).toEqual({
      at: 1000, value: [{ lan: "zh" }],
    });
    expect(readSessionCache(() => area, "bsb:v2:", "tracks", "BV123:1", 600, 1600))
      .toEqual([{ lan: "zh" }]);
  });
  it("expires only after TTL and removes the exact stale key", () => {
    const area = storage();
    writeSessionCache(() => area, "bsb:v2:", "view", "BV1", { cid: 17 }, 100);
    expect(readSessionCache(() => area, "bsb:v2:", "view", "BV1", 600, 701)).toBeNull();
    expect(area.records.size).toBe(0);
  });
  it("does not throw on corrupted records, unavailable storage or quota", () => {
    const area = storage();
    area.records.set("bsb:v2:view:bad", "{invalid json");
    expect(readSessionCache(() => area, "bsb:v2:", "view", "bad", 100)).toBeNull();
    expect(readSessionCache(() => { throw new Error("security"); }, "bsb:v2:", "view", "bad", 100)).toBeNull();
    expect(() => writeSessionCache(() => { throw new Error("security"); }, "bsb:v2:", "view", "bad", 1)).not.toThrow();
    expect(() => writeSessionCache(() => ({ setItem: () => { throw new Error("quota"); } }), "bsb:v2:", "view", "bad", 1)).not.toThrow();
  });
});

describe("library projection", () => {
  it("preserves status normalization and label fallback", () => {
    expect(libraryController.status(null)).toBe("wait");
    expect(libraryController.status({ subStatus: "unknown" })).toBe("wait");
    expect(libraryController.statusLabel({ subStatus: "ok", data: [1, 2] })).toBe("2 条");
    expect(libraryController.statusLabel({ subStatus: "ok", cue_count: 9, data: [1] })).toBe("9 条");
    expect(libraryController.statusLabel({ subStatus: "error" })).toBe("失败");
    expect(libraryController.statusLabel({ subStatus: "empty" })).toBe("无字幕");
    expect(libraryController.statusLabel({ subStatus: "wait" })).toBe("待抓取");
  });
  it("filters by normalized status, metadata and source while retaining indices", () => {
    const items = [
      { title: "RSI 研究", bvid: "BV1", subStatus: "ok", author: "EZ", sources: ["合集 A"] },
      { title: "Machine Learning", bvid: "BV2", subStatus: "error", author: "Up" },
      { title: "Other", bvid: "BV3", subStatus: "other", collectionName: "RSI" },
    ];
    expect(libraryController.filteredEntries(items, " rsi ", "all").map(x => x.index)).toEqual([0, 2]);
    expect(libraryController.filteredEntries(items, "up", "error").map(x => x.index)).toEqual([1]);
    expect(libraryController.filteredEntries(items, "合集 a", "ok").map(x => x.index)).toEqual([0]);
    expect(libraryController.filteredEntries(items, "", "wait").map(x => x.index)).toEqual([2]);
    expect(libraryController.filteredEntries(items, "", "all").map(x => x.index)).toEqual([0, 1, 2]);
  });
});
