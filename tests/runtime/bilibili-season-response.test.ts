import { describe, expect, it } from "vitest";
import { parseUserSeasonPage, seasonMemberPlan } from "../../apps/userscript/src/app/library-scan-controller";

describe("Bilibili user seasons response boundary", () => {
  it("normalizes nested season records without losing the member plan", () => {
    const payload = parseUserSeasonPage({
      code: 0,
      data: { items_lists: {
        seasons_list: [{ meta: { season_id: "123", mid: 42, name: "合集", total: "3" }, archives: [{ bvid: "BV1" }, {}, { bvid: "BV2" }] }],
        page: { total: "12" },
      } },
    });
    expect(payload.data?.items_lists?.page?.total).toBe("12");
    const entry = payload.data?.items_lists?.seasons_list?.[0];
    expect(seasonMemberPlan(entry, "0")).toEqual({
      mid: "42", season_id: "123", name: "合集", bvids: ["BV1", "BV2"], missingMembers: true, total: 3,
    });
  });

  it("rejects malformed response codes and tolerates missing optional lists", () => {
    expect(() => parseUserSeasonPage({ data: {} })).toThrow("有效 code");
    expect(parseUserSeasonPage({ code: 0, data: { items_lists: {} } }).data?.items_lists?.seasons_list).toEqual([]);
    expect(parseUserSeasonPage({ code: -1, message: "blocked" })).toEqual({ code: -1, message: "blocked" });
  });
});
