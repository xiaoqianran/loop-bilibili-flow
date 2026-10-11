/** Pure panel sizing rules; no DOM, storage, or browser state. */
export const PANEL_SIZE_PRESETS = {
  small: { viewportRatio: 0.32, min: 440, max: 560 },
  medium: { viewportRatio: 0.48, min: 620, max: 820 },
  large: { viewportRatio: 0.68, min: 860, max: 1180 },
} as const;

export type PanelSizePreset = keyof typeof PANEL_SIZE_PRESETS;
export const DEFAULT_PANEL_SIZE: PanelSizePreset = "medium";
export const MIN_PANEL_WIDTH = 420;
export const MIN_PANEL_HEIGHT = 520;

export function isPanelSizePreset(value: unknown): value is PanelSizePreset {
  return typeof value === "string" && Object.hasOwn(PANEL_SIZE_PRESETS, value);
}

export function panelPresetWidth(name: string, viewportWidth: number): number {
  const preset = isPanelSizePreset(name)
    ? PANEL_SIZE_PRESETS[name]
    : PANEL_SIZE_PRESETS[DEFAULT_PANEL_SIZE];
  const desired = Math.round((Number(viewportWidth) || 0) * preset.viewportRatio);
  const available = Math.max(MIN_PANEL_WIDTH, (Number(viewportWidth) || 0) - 16);
  return Math.min(available, Math.max(preset.min, Math.min(preset.max, desired)));
}

export function highPanelHeight(viewportHeight: number): number {
  const available = Math.max(MIN_PANEL_HEIGHT, (Number(viewportHeight) || 0) - 16);
  return Math.min(available, Math.max(MIN_PANEL_HEIGHT, Math.round((Number(viewportHeight) || 0) * 0.9)));
}

export function panelSizeClassFromWidth(width: number, viewportWidth: number): PanelSizePreset {
  const value = Number(width) || panelPresetWidth(DEFAULT_PANEL_SIZE, viewportWidth);
  const names = Object.keys(PANEL_SIZE_PRESETS) as PanelSizePreset[];
  return names.reduce((best, name) =>
    Math.abs(value - panelPresetWidth(name, viewportWidth)) <
    Math.abs(value - panelPresetWidth(best, viewportWidth)) ? name : best, DEFAULT_PANEL_SIZE);
}

export interface PanelRect {
  x: number;
  y: number;
  w: number;
  h: number;
  sizePreset: string;
  heightMode: string;
}

export function clampPanelRect<T extends PanelRect>(ui: T, vw: number, vh: number): T {
  const next = { ...ui };
  if (isPanelSizePreset(next.sizePreset)) {
    next.w = panelPresetWidth(next.sizePreset, vw);
  } else {
    next.sizePreset = "custom";
    next.w = Math.min(Math.max(MIN_PANEL_WIDTH, next.w), Math.max(MIN_PANEL_WIDTH, vw - 8));
  }
  if (next.heightMode !== "custom") {
    next.heightMode = "high";
    next.h = highPanelHeight(vh);
  } else {
    next.h = Math.min(Math.max(MIN_PANEL_HEIGHT, next.h), Math.max(MIN_PANEL_HEIGHT, vh - 8));
  }
  next.x = Math.min(Math.max(0, next.x), Math.max(0, vw - next.w));
  next.y = Math.min(Math.max(0, next.y), Math.max(0, vh - next.h));
  return next;
}
