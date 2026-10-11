import { MIN_PANEL_HEIGHT, MIN_PANEL_WIDTH, type PanelRect } from "./geometry";

export interface DragOrigin { ox: number; oy: number }
export interface ResizeOrigin { dir: string; sx: number; sy: number; ox: number; oy: number; ow: number; oh: number }

export function movePanel<T extends PanelRect>(ui: T, drag: DragOrigin, clientX: number, clientY: number): T {
  return { ...ui, x: clientX - drag.ox, y: clientY - drag.oy };
}

export function resizePanel<T extends PanelRect>(ui: T, drag: ResizeOrigin, clientX: number, clientY: number): T {
  const dx = clientX - drag.sx;
  const dy = clientY - drag.sy;
  const d = drag.dir;
  let { x, y, w, h } = { x: drag.ox, y: drag.oy, w: drag.ow, h: drag.oh };
  if (d.includes("e")) w = drag.ow + dx;
  if (d.includes("s")) h = drag.oh + dy;
  if (d.includes("w")) { w = drag.ow - dx; x = drag.ox + dx; }
  if (d.includes("n")) { h = drag.oh - dy; y = drag.oy + dy; }
  if (w < MIN_PANEL_WIDTH) {
    if (d.includes("w")) x = drag.ox + drag.ow - MIN_PANEL_WIDTH;
    w = MIN_PANEL_WIDTH;
  }
  if (h < MIN_PANEL_HEIGHT) {
    if (d.includes("n")) y = drag.oy + drag.oh - MIN_PANEL_HEIGHT;
    h = MIN_PANEL_HEIGHT;
  }
  return {
    ...ui, x, y, w, h,
    sizePreset: d.includes("e") || d.includes("w") ? "custom" : ui.sizePreset,
    heightMode: d.includes("n") || d.includes("s") ? "custom" : ui.heightMode,
  };
}

export function snapPanelSide(ui: Pick<PanelRect, "x" | "w">, viewportWidth: number, threshold = 36): "left" | "right" | null {
  if (ui.x <= threshold) return "left";
  if (ui.x + ui.w >= viewportWidth - threshold) return "right";
  return null;
}

export function shouldAutoHideDock(dock: string | null, expanded: boolean, pointerHover: boolean): boolean {
  return Boolean(dock && expanded && !pointerHover);
}
