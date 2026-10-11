import { describe, expect, it } from "vitest";
import { expandPanelDock, preferredDockSide, setPanelDock, setPanelOpen } from "../../apps/userscript/src/ui/shell/state";

const base = { open: false, dock: null as "left" | "right" | null, dockExpanded: false, aiFocus: true, x: 100, w: 500, view: "ai" };

describe("Studio panel chrome transitions", () => {
  it("opens and closes without mutating input or losing unrelated state", () => {
    const docked = setPanelDock(base, "right", 1200);
    expect(docked).toMatchObject({ open: true, dock: "right", dockExpanded: false, aiFocus: false, x: 688, view: "ai" });
    expect(setPanelOpen(docked, true)).toMatchObject({ dockExpanded: true, dock: "right" });
    expect(setPanelOpen(docked, false)).toMatchObject({ open: false, dock: null, dockExpanded: false });
    expect(base.dock).toBeNull();
  });

  it("expands dock on demand and leaves undocked panels untouched", () => {
    const docked = setPanelDock(base, "left", 1200);
    expect(expandPanelDock(docked).dockExpanded).toBe(true);
    expect(expandPanelDock(expandPanelDock(docked), false).dockExpanded).toBe(false);
    expect(expandPanelDock(base)).toEqual(base);
    expect(setPanelDock(docked, null, 1200)).toMatchObject({ open: true, dock: null, x: 12 });
  });

  it("picks the closest edge by panel midpoint", () => {
    expect(preferredDockSide(base, 1200)).toBe("left");
    expect(preferredDockSide({ x: 800, w: 200 }, 1200)).toBe("right");
  });
});
