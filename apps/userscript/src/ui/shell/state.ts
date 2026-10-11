/** Pure Studio chrome transitions. Side effects remain in the browser adapter. */
export interface PanelChromeState {
  open: boolean;
  dock: "left" | "right" | null;
  dockExpanded: boolean;
  aiFocus: boolean;
  x: number;
  w: number;
}

export function setPanelOpen<T extends PanelChromeState>(state: T, open: boolean): T {
  return {
    ...state,
    open,
    dock: open ? state.dock : null,
    dockExpanded: open ? Boolean(state.dock) : false,
    aiFocus: open ? state.aiFocus : false,
  };
}

export function setPanelDock<T extends PanelChromeState>(
  state: T, side: "left" | "right" | null, viewportWidth: number,
): T {
  return {
    ...state,
    open: true,
    aiFocus: side ? false : state.aiFocus,
    dock: side,
    dockExpanded: false,
    x: side === "right" ? Math.max(0, viewportWidth - state.w - 12)
      : side === "left" ? 12 : state.x,
  };
}

export function expandPanelDock<T extends PanelChromeState>(state: T, force?: boolean): T {
  if (!state.dock) return { ...state };
  return {
    ...state,
    open: true,
    dockExpanded: typeof force === "boolean" ? force : !state.dockExpanded,
  };
}

export function preferredDockSide(state: Pick<PanelChromeState, "x" | "w">, viewportWidth: number): "left" | "right" {
  return state.x + state.w / 2 < viewportWidth / 2 ? "left" : "right";
}
