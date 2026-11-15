import { describe, expect, it } from "vitest";
import { parseListResponse } from "../../apps/userscript/src/app/bilibili-list-response";
import { parseUserSeasonPage } from "../../apps/userscript/src/app/library-scan-controller";

describe("Bilibili list response boundaries", () => {
  it.each([undefined, null, "", " ", false, true, [], {}, Infinity, 0.5])(
    "rejects invalid status code %j in both decoders", (code) => {
      expect(() => parseListResponse({ code })).toThrow("有效 code");
      expect(() => parseUserSeasonPage({ code })).toThrow("有效 code");
    },
  );

  it("preserves success and API failure codes", () => {
    expect(parseListResponse({ code: "0" }).code).toBe(0);
    expect(parseListResponse({ code: -403, message: "blocked" })).toMatchObject({ code: -403, message: "blocked" });
  });

  it("preserves each list source's identity, author and paging fields", () => {
    const result = parseListResponse({ code: 0, data: {
      list: { vlist: [{ bvid: "BV-user", author: "User" }] },
      medias: [{ bv_id: "BV-fav", id: "42", upper: { name: "Favorite" } }],
      archives: [{ bvid: "BV-collection", owner: { name: "Owner" } }],
      result: [{ bvid: "BV-search", up_name: "Search" }],
      page: { pn: "2", ps: "20", count: "100", total: "80" },
      has_more: true, numPages: "3", numResults: "120",
    } });
    expect(result.data.list.vlist[0]).toMatchObject({ bvid: "BV-user", author: "User" });
    expect(result.data.medias[0]).toMatchObject({ bv_id: "BV-fav", id: 42, upper: { name: "Favorite" } });
    expect(result.data.archives[0]?.owner.name).toBe("Owner");
    expect(result.data.result[0]?.up_name).toBe("Search");
    expect(result.data.page).toEqual({ pn: 2, ps: 20, count: 100, total: 80 });
    expect(result.data).toMatchObject({ has_more: true, numPages: 3, numResults: 120 });
  });

  it("keeps unknown page totals absent so the scanner can use its length fallback", () => {
    expect(parseListResponse({ code: 0, data: { page: { total: "invalid", count: false, pn: "", ps: -1 } } }).data.page).toEqual({});
    expect(parseListResponse({ code: 0, data: { page: { total: 0 } } }).data.page).toEqual({ total: 0 });
  });
});
