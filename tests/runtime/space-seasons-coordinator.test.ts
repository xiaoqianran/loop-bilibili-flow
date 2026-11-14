import { describe, expect, it, vi } from "vitest";
import { libraryScan } from "../../apps/userscript/src/app";
import type { UserSeasonPorts, UserSeasonPage } from "../../apps/userscript/src/app/library-scan-controller";

function fixture(overrides: Partial<UserSeasonPorts> = {}) {
  const fetchPage = vi.fn(async (): Promise<UserSeasonPage> =>
    ({ code: 0, data: { items_lists: { seasons_list: [], series_list: [] } } }));
  const loadMembers = vi.fn(async () => ["BV1", "BV2", "BV3"]);
  const sleep = vi.fn(async () => {});
  const progress = vi.fn();
  const warn = vi.fn();
  return {
    ports: {
      fetchPage, loadMembers, sleep, progress, warn,
      cancelled: () => false,
      shortUrl: (mid: string, sid: string) => "https://b23.tv/" + mid + "/" + sid,
      ...overrides,
    } satisfies UserSeasonPorts,
    fetchPage, loadMembers, sleep, progress, warn,
  };
}

describe("personal-space seasons listing coordinator", () => {
  it("follows item total across pages and expands incomplete season membership", async () => {
    const f = fixture({
      fetchPage: vi.fn(async (...args: [string, number, number]): Promise<UserSeasonPage> =>
        args[1] === 1
          ? { code: 0, data: { items_lists: {
            seasons_list: [{ meta: { season_id: 12, mid: 9, name: "Course", total: 3 },
              archives: [{ bvid: "BV1" }] }],
            page: { total: 3 },
          } } }
          : { code: 0, data: { items_lists: {
            seasons_list: [{ meta: { season_id: 13, name: "Extra" }, archives: [{ bvid: "BVother" }] }],
            page: { total: 3 },
          } } }),
    });
    const output = await libraryScan.collectUserSeasons(" 17 ", {
      maxPages: 5, pageSize: 2, delayMs: 125, maxSeasonArchivePages: 8,
    }, f.ports);
    expect(output).toEqual([
      { mid: "9", season_id: "12", name: "Course", bvids: ["BV1", "BV2", "BV3"], shortUrl: "https://b23.tv/9/12" },
      { mid: "17", season_id: "13", name: "Extra", bvids: ["BVother"], shortUrl: "https://b23.tv/17/13" },
    ]);
    expect(f.ports.fetchPage).toHaveBeenCalledWith("17", 1, 2);
    expect(f.ports.fetchPage).toHaveBeenCalledWith("17", 2, 2);
    expect(f.loadMembers).toHaveBeenCalledWith("17", "12", 8, 125, expect.any(Function));
    expect(f.sleep).toHaveBeenCalledExactlyOnceWith(125);
    expect(f.warn).not.toHaveBeenCalled();
  });

  it("uses seasons or series page size when total is missing", async () => {
    const f = fixture({
      fetchPage: vi.fn(async (...args: [string, number, number]): Promise<UserSeasonPage> =>
        args[1] === 1 ? { code: 0, data: { items_lists: {
          seasons_list: [], series_list: ["one", "two"], page: {},
        } } } : { code: 0, data: { items_lists: {
          seasons_list: [{ meta: { season_id: 21, name: "Second" } }],
        } } }),
    });
    const result = await libraryScan.collectUserSeasons("1", { pageSize: 2, maxPages: 5, delayMs: 0 }, f.ports);
    expect(result.map(item => item.season_id)).toEqual(["21"]);
    expect(f.sleep).toHaveBeenCalledExactlyOnceWith(280);
  });

  it("keeps recent members if member listing fails without AbortError", async () => {
    const f = fixture({ loadMembers: vi.fn(async () => { throw new Error("permission denied"); }) });
    f.ports.fetchPage = vi.fn(async (): Promise<UserSeasonPage> => ({
      code: 0, data: { items_lists: { seasons_list: [
        { meta: { season_id: 40, total: 4 }, archives: [{ bvid: "BV1" }] },
      ] } },
    }));
    const result = await libraryScan.collectUserSeasons("99", {}, f.ports);
    expect(result).toMatchObject([{ season_id: "40", bvids: ["BV1"] }]);
    expect(f.warn).toHaveBeenCalledWith("40", expect.any(Error));
  });

  it("preserves API error messages and cancellation before/after network or delay", async () => {
    const f = fixture({ fetchPage: vi.fn(async (): Promise<UserSeasonPage> => ({ code: -403, message: "Access denied" })) });
    await expect(libraryScan.collectUserSeasons("1", {}, f.ports)).rejects.toThrow("Access denied");
    const cancelled = fixture({ cancelled: () => true });
    await expect(libraryScan.collectUserSeasons("1", {}, cancelled.ports))
      .rejects.toMatchObject({ name: "AbortError", message: "扫描已取消" });
    expect(cancelled.fetchPage).not.toHaveBeenCalled();

    let isCancelled = false;
    const delayed = fixture({
      cancelled: () => isCancelled,
      fetchPage: vi.fn(async (): Promise<UserSeasonPage> => ({
        code: 0, data: { items_lists: { seasons_list: [{ meta: { season_id: 1 } }], page: { total: 100 } } },
      })),
      sleep: vi.fn(async () => { isCancelled = true; }),
    });
    await expect(libraryScan.collectUserSeasons("1", { maxPages: 3, pageSize: 10 }, delayed.ports))
      .rejects.toMatchObject({ name: "AbortError" });
  });

  it("skips empty mid without side effects and rejects aborted member completion", async () => {
    const f = fixture();
    expect(await libraryScan.collectUserSeasons(" ", {}, f.ports)).toEqual([]);
    expect(f.fetchPage).not.toHaveBeenCalled();
    const aborted = Object.assign(new Error("cancel"), { name: "AbortError" });
    f.ports.fetchPage = vi.fn(async () => ({
      code: 0, data: { items_lists: { seasons_list: [
        { meta: { season_id: "S1", total: 5 }, archives: [{ bvid: "BV1" }] },
      ] } },
    }));
    f.ports.loadMembers = vi.fn(async () => { throw aborted; });
    await expect(libraryScan.collectUserSeasons("17", {}, f.ports)).rejects.toBe(aborted);
    expect(f.warn).not.toHaveBeenCalled();
  });
});
