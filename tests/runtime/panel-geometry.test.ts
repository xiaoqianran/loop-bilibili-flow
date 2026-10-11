import { describe, expect, it } from "vitest";
import {
  clampPanelRect,
  highPanelHeight,
  isPanelSizePreset,
  panelPresetWidth,
  panelSizeClassFromWidth,
} from "../../apps/userscript/src/ui/shell/geometry";

describe("panel shell geometry", () => {
  it("preserves the existing size presets", () => {
    expect(panelPresetWidth("small", 1920)).toBe(560);
    expect(panelPresetWidth("medium", 1920)).toBe(820);
    expect(panelPresetWidth("large", 1920)).toBe(1180);
    expect(panelPresetWidth("unknown", 1920)).toBe(820);
    expect(isPanelSizePreset("custom")).toBe(false);
    expect(panelSizeClassFromWidth(800, 1920)).toBe("medium");
  });

  it("keeps geometry within the viewport and does not mutate the input", () => {
    const original = { x: 2000, y: -30, w: 1000, h: 200, sizePreset: "custom", heightMode: "custom" };
    const next = clampPanelRect(original, 1280, 800);
    expect(next).toMatchObject({ x: 280, y: 0, w: 1000, h: 520 });
    expect(original.x).toBe(2000);
    expect(highPanelHeight(1000)).toBe(900);
  });
});
