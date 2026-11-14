import { describe, expect, it } from "vitest";
import { scan } from "../../apps/userscript/src/app";
import { validateContext } from "../../apps/userscript/src/app/scan-context";

describe("typed Bilibili scan entry validation", () => {
  it("accepts each supported scan mode when required identifiers are present", () => {
    for (const ctx of [
      { type: "video", bvid: "BV1abc" },
      { type: "selection", bvid: "BV1abc", page: 2 },
      { type: "user", mid: "1234" },
      { type: "collection", mid: "1234", season_id: "5678" },
      { type: "favorite", media_id: "76543" },
      { type: "search", keyword: "AI architecture" },
      { type: "auto" },
      { type: "manual-fallback" },
    ]) {
      expect(() => scan.validateContext(ctx), ctx.type).not.toThrow();
    }
  });

  it("rejects missing BVID for single video and multipart selection", () => {
    for (const type of ["video", "selection"]) {
      expect(() => scan.validateContext({ type, bvid: "" })).toThrow(/缺少 BV 号/);
    }
  });

  it("rejects missing collection identifiers independently, without inventing members", () => {
    expect(() => scan.validateContext({ type: "collection", mid: "123" })).toThrow(/season_id/);
    expect(() => scan.validateContext({ type: "collection", season_id: "123" })).toThrow(/mid/);
    expect(() => scan.validateContext({ type: "collection" })).toThrow(/合集需要/);
  });

  it("rejects missing personal-space, favorite and keyword context", () => {
    expect(() => scan.validateContext({ type: "user" })).toThrow(/缺少 mid/);
    expect(() => scan.validateContext({ type: "favorite" })).toThrow(/fid\/media_id/);
    expect(() => scan.validateContext({ type: "search" })).toThrow(/keyword/);
  });

  it("produces meaningful errors for unknown and malformed input", () => {
    expect(() => scan.validateContext({ type: "unknown" })).toThrow(/未能识别页面/);
    for (const ctx of [null, undefined, "", 1, [], false]) {
      expect(() => scan.validateContext(ctx)).toThrow(/缺少扫描上下文/);
    }
  });

  it("does not mutate the caller's context while validating", () => {
    const context = Object.freeze({ type: "collection", mid: "42", season_id: "99", title: "test" });
    validateContext(context);
    expect(context).toEqual({ type: "collection", mid: "42", season_id: "99", title: "test" });
  });

  it("selects Bilibili pagination sizes without coupling to network or DOM", () => {
    expect(scan.pageSizeFor("favorite")).toBe(20);
    expect(scan.pageSizeFor("search")).toBe(42);
    for (const mode of ["user", "collection", "video", "selection", "other"]) {
      expect(scan.pageSizeFor(mode)).toBe(30);
    }
  });
});
