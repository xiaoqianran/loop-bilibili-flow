import { describe, expect, it } from "vitest";
import { movePanel, resizePanel, snapPanelSide, shouldAutoHideDock } from "../../apps/userscript/src/ui/shell/interaction";

const panel = { x: 100, y: 80, w: 600, h: 700, sizePreset: "medium", heightMode: "high" };

describe("Studio shell pointer interaction", () => {
  it("moves without mutating and snaps only at the edge", () => {
    expect(movePanel(panel, { ox: 20, oy: 10 }, 55, 90)).toMatchObject({ x: 35, y: 80 });
    expect(panel.x).toBe(100);
    expect(snapPanelSide({ x: 10, w: 600 }, 1280)).toBe("left");
    expect(snapPanelSide({ x: 670, w: 600 }, 1280)).toBe("right");
    expect(snapPanelSide(panel, 1280)).toBeNull();
  });

  it("resizes west/north with minimum dimensions and preserves other fields", () => {
    const west = resizePanel(panel, { dir: "w", sx: 0, sy: 0, ox: 100, oy: 80, ow: 600, oh: 700 }, 400, 0);
    expect(west).toMatchObject({ x: 280, w: 420, h: 700, sizePreset: "custom", heightMode: "high" });
    const north = resizePanel(panel, { dir: "n", sx: 0, sy: 0, ox: 100, oy: 80, ow: 600, oh: 700 }, 0, 300);
    expect(north).toMatchObject({ y: 260, h: 520, heightMode: "custom", sizePreset: "medium" });
  });

  it("does not auto-hide while hovered", () => {
    expect(shouldAutoHideDock("left", true, false)).toBe(true);
    expect(shouldAutoHideDock("left", true, true)).toBe(false);
    expect(shouldAutoHideDock(null, true, false)).toBe(false);
  });
});
