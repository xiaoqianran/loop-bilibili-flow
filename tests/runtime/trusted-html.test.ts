import { afterEach, describe, expect, it, vi } from "vitest";
import { toTrustedHTML } from "../../apps/userscript/src/runtime/trusted-html";

afterEach(() => vi.unstubAllGlobals());

describe("isolated SubBatch Trusted Types adapter", () => {
  it("keeps existing HTML strings when Trusted Types is unavailable", () => {
    vi.stubGlobal("trustedTypes", undefined);
    expect(toTrustedHTML("<b>字幕</b>")).toBe("<b>字幕</b>");
  });

  it("uses its own policy without changing the page default policy", () => {
    const branded = { html: "<b>course</b>" };
    const createHTML = vi.fn(() => branded);
    const createPolicy = vi.fn(() => ({ createHTML }));
    vi.stubGlobal("trustedTypes", { createPolicy });
    expect(toTrustedHTML("<b>course</b>")).toBe(branded);
    expect(toTrustedHTML("<i>second</i>")).toBe(branded);
    expect(createPolicy).toHaveBeenCalledTimes(1);
    expect(createPolicy).toHaveBeenCalledWith("bili-subbatch-workbench", expect.objectContaining({ createHTML: expect.any(Function) }));
    expect(createHTML).toHaveBeenCalledWith("<b>course</b>");
    expect(createHTML).toHaveBeenCalledWith("<i>second</i>");
  });
});
