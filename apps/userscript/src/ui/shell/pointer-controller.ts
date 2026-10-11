import { clampPanelRect, type PanelRect } from "./geometry";
import { movePanel, resizePanel, snapPanelSide, type ResizeOrigin } from "./interaction";

export interface PointerPanelState extends PanelRect {
  dock: "left" | "right" | null;
  dockExpanded: boolean;
}

export interface PointerControllerOptions<T extends PointerPanelState> {
  root: HTMLElement;
  getState(): T;
  update(patch: Partial<T>): void;
  setOpen(open: boolean): void;
  setDock(side: "left" | "right" | null): void;
  render(): void;
  persist(): void;
  viewport(): { width: number; height: number };
  snapThreshold: number;
}

/** Owns pointer listener registration; product state and persistence stay in the caller. */
export function bindPanelPointerController<T extends PointerPanelState>(
  options: PointerControllerOptions<T>,
): void {
  const { root } = options;
  const sidebar = root.querySelector<HTMLElement>(".bsb-sidebar");
  const head = root.querySelector<HTMLElement>(".bsb-head");
  if (!sidebar || !head) throw new Error("Studio shell pointer elements are missing");

  let drag: { pid: number; ox: number; oy: number } | null = null;
  head.addEventListener("pointerdown", (event) => {
    if (event.button !== 0 || (event.target as Element).closest("button, select, input, a, label")) return;
    const ui = options.getState();
    if (ui.dock) {
      options.update({ dock: null, dockExpanded: false } as Partial<T>);
      options.setOpen(true);
    }
    drag = { pid: event.pointerId, ox: event.clientX - ui.x, oy: event.clientY - ui.y };
    head.setPointerCapture(event.pointerId);
    sidebar.classList.add("dragging");
    event.preventDefault();
  });
  head.addEventListener("pointermove", (event) => {
    if (!drag || event.pointerId !== drag.pid) return;
    const viewport = options.viewport();
    const next = clampPanelRect(movePanel(options.getState(), drag, event.clientX, event.clientY), viewport.width, viewport.height);
    options.update(next);
    options.render();
  });
  const endDrag = (event: PointerEvent): void => {
    if (!drag || event.pointerId !== drag.pid) return;
    drag = null;
    sidebar.classList.remove("dragging");
    const side = snapPanelSide(options.getState(), options.viewport().width, options.snapThreshold);
    if (side) options.setDock(side);
    else options.persist();
  };
  head.addEventListener("pointerup", endDrag);
  head.addEventListener("pointercancel", endDrag);

  root.querySelectorAll<HTMLElement>(".bsb-resize").forEach((handle) => {
    let resize: (ResizeOrigin & { pid: number }) | null = null;
    handle.addEventListener("pointerdown", (event) => {
      const ui = options.getState();
      if (event.button !== 0 || ui.dock) return;
      resize = {
        pid: event.pointerId, dir: handle.getAttribute("data-dir") || "",
        sx: event.clientX, sy: event.clientY,
        ox: ui.x, oy: ui.y, ow: ui.w, oh: ui.h,
      };
      handle.setPointerCapture(event.pointerId);
      sidebar.classList.add("resizing");
      event.preventDefault();
      event.stopPropagation();
    });
    handle.addEventListener("pointermove", (event) => {
      if (!resize || event.pointerId !== resize.pid) return;
      const viewport = options.viewport();
      const next = clampPanelRect(resizePanel(options.getState(), resize, event.clientX, event.clientY), viewport.width, viewport.height);
      options.update(next);
      options.render();
    });
    const endResize = (event: PointerEvent): void => {
      if (!resize || event.pointerId !== resize.pid) return;
      resize = null;
      sidebar.classList.remove("resizing");
      options.persist();
    };
    handle.addEventListener("pointerup", endResize);
    handle.addEventListener("pointercancel", endResize);
  });
}
