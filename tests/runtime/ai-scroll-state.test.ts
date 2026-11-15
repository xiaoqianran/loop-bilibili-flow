import { describe, expect, it } from "vitest";
import { resolveAiScrollState, shouldStickBottom } from "../../apps/userscript/src/ui/workspaces/ai-scroll-state";

describe("streaming scroll state", () => {
  it("detaches on upward input and resumes only when the reader returns to the bottom", () => {
    const initial = { stick: true, userReading: false, progScroll: false };
    const detached = resolveAiScrollState(initial, { type: "wheel-up" });
    expect(detached).toEqual({ stick: false, userReading: true, allowPaintScroll: false });
    expect(resolveAiScrollState({ ...detached, progScroll: false }, { type: "scroll", gap: 20 })).toEqual(detached);
    expect(resolveAiScrollState({ ...detached, progScroll: false }, { type: "scroll", gap: 12 }))
      .toEqual({ stick: true, userReading: false, allowPaintScroll: true });
  });

  it("ignores programmatic scrolling and resumes on explicit start", () => {
    const reading = { stick: false, userReading: true, progScroll: true };
    expect(resolveAiScrollState(reading, { type: "scroll", gap: 0 }))
      .toEqual({ stick: false, userReading: true, allowPaintScroll: false });
    expect(resolveAiScrollState(reading, { type: "start" }))
      .toEqual({ stick: true, userReading: false, allowPaintScroll: true });
  });

  it("uses a strict bottom threshold", () => {
    expect(shouldStickBottom(100, 52, 0)).toBe(false);
    expect(shouldStickBottom(100, 53, 0)).toBe(true);
    expect(shouldStickBottom(100, 90, 0, 10)).toBe(false);
  });
});
