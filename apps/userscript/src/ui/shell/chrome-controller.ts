import { shouldAutoHideDock } from "./interaction";

export interface ChromePanelState {
  open: boolean;
  dock: "left" | "right" | null;
  dockExpanded: boolean;
}

export interface ChromeControllerOptions {
  root: HTMLElement;
  state(): ChromePanelState;
  setOpen(open: boolean): void;
  setDock(side: "left" | "right" | null): void;
  expandDock(force?: boolean): void;
  selectSize(size: string): void;
  preferredDockSide(): "left" | "right";
  autoHideDelay?: number;
}

/** Registers chrome controls once. Product state and effects remain with the caller. */
export function bindPanelChromeControls(options: ChromeControllerOptions): void {
  const { root } = options;
  const sidebar = root.querySelector<HTMLElement>(".bsb-sidebar");
  const fab = root.querySelector<HTMLElement>(".bsb-fab");
  const dockTab = root.querySelector<HTMLElement>(".bsb-dock-tab");
  const close = root.querySelector<HTMLElement>(".bsb-close");
  const dock = root.querySelector<HTMLElement>('[data-act="dock"]');
  const collapse = root.querySelector<HTMLElement>('[data-act="collapse"]');
  if (!sidebar || !fab || !dockTab || !close || !dock || !collapse) {
    throw new Error("Studio shell controls are missing");
  }
  let hideTimer: ReturnType<typeof setTimeout> | null = null;
  const clearHide = (): void => {
    if (hideTimer !== null) clearTimeout(hideTimer);
    hideTimer = null;
  };
  const autoHide = (): void => {
    const state = options.state();
    if (!state.dock || !state.dockExpanded) return;
    clearHide();
    hideTimer = setTimeout(() => {
      hideTimer = null;
      const hover = Boolean(root.querySelector(".bsb-sidebar:hover, .bsb-dock-tab:hover"));
      const now = options.state();
      if (hover) {
        autoHide();
      } else if (shouldAutoHideDock(now.dock, now.dockExpanded, false)) {
        options.expandDock(false);
      }
    }, options.autoHideDelay ?? 700);
  };

  fab.addEventListener("click", () => {
    const state = options.state();
    if (state.dock) options.expandDock(true);
    else options.setOpen(!state.open);
  });
  close.addEventListener("click", (event) => {
    event.stopPropagation();
    options.setOpen(false);
  });
  root.querySelectorAll<HTMLElement>('[data-act="panel-size"]').forEach((button) => {
    button.addEventListener("click", (event) => {
      event.stopPropagation();
      if (button.dataset.size) options.selectSize(button.dataset.size);
    });
  });
  dock.addEventListener("click", (event) => {
    event.stopPropagation();
    options.setDock(options.state().dock ? null : options.preferredDockSide());
  });
  collapse.addEventListener("click", (event) => {
    event.stopPropagation();
    if (!options.state().dock) options.setDock(options.preferredDockSide());
    else options.expandDock(false);
  });
  dockTab.addEventListener("click", () => options.expandDock(true));
  dockTab.addEventListener("mouseenter", () => {
    clearHide();
    if (options.state().dock && !options.state().dockExpanded) options.expandDock(true);
  });
  sidebar.addEventListener("mouseenter", clearHide);
  sidebar.addEventListener("mouseleave", autoHide);
  dockTab.addEventListener("mouseleave", autoHide);
}
