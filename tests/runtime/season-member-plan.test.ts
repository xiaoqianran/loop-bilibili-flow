import { describe, expect, it } from "vitest";
import { libraryScan } from "../../apps/userscript/src/app";

describe("space collection member reconciliation", () => {
  it("identifies missing members from total vs recent archives", () => {
    expect(libraryScan.seasonMemberPlan({
      meta: { season_id: 12, name: "Course", total: 3, mid: 99 },
      archives: [{ bvid: "BV1" }, { bvid: "BV2" }],
    }, "15")).toEqual({
      mid: "99", season_id: "12", name: "Course", bvids: ["BV1", "BV2"],
      missingMembers: true, total: 3,
    });
  });
  it("preserves default title, missing ID skip and fallbacks", () => {
    expect(libraryScan.seasonMemberPlan({ meta: {}, archives: [{ bvid: "BV1" }] }, "mid")).toBeNull();
    expect(libraryScan.seasonMemberPlan({ meta: { season_id: "s1", title: "Alternate" } }, "17"))
      .toMatchObject({ mid: "17", name: "Alternate", total: 0, missingMembers: false });
    expect(libraryScan.seasonMemberPlan({ meta: { season_id: "s2", name: "  " } }, "17"))
      .toMatchObject({ name: "未命名合集" });
  });
  it("keeps larger completed member list without dropping available recent archives", () => {
    const recent = ["BV1", "BV2"];
    expect(libraryScan.chooseSeasonMembers(recent, ["BV1"])).toBe(recent);
    const full = ["BV1", "BV2", "BV3"];
    expect(libraryScan.chooseSeasonMembers(recent, full)).toBe(full);
    expect(libraryScan.chooseSeasonMembers(recent, ["BV2", "BV1"])).toBe(recent);
  });
});
