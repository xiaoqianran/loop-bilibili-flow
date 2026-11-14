/** Typed and side-effect-free panel layout migration, validation and persistence. */
import type { WorkbenchUi } from "../../runtime/workbench-state";

export interface PanelPersistenceOptions {
  viewportWidth: number;
  viewportHeight: number;
  defaultSizePreset: string;
  defaultFlavor: string;
  noteFontDefault: number;
  noteFontMin: number;
  noteFontMax: number;
  minWidth: number;
  minHeight: number;
  /** During initial boot, no state.ui has been installed yet. */
  currentSizePreset: string;
  presetWidth: (name: string, viewportWidth: number) => number;
  highHeight: (viewportHeight: number) => number;
  isPreset: (value: unknown) => boolean;
  normalizeFlavor: (value: unknown) => string;
}

function record(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown> : {};
}
function numberOrDefault(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}
function allowed(value: unknown, options: readonly string[], fallback: string): string {
  return typeof value === "string" && options.includes(value) ? value : fallback;
}

export function normalizeNoteFont(value: unknown, savedDefault: unknown, options: Pick<
  PanelPersistenceOptions, "noteFontDefault" | "noteFontMin" | "noteFontMax"
>): number {
  const n = Number(value);
  if (!Number.isFinite(n)) return options.noteFontDefault;
  const clamped = Math.max(options.noteFontMin, Math.min(options.noteFontMax, n));
  // Historical default was 17px; only migrate users who have not saved a new default.
  if (Number(savedDefault) !== options.noteFontDefault && clamped === 17) return options.noteFontDefault;
  return clamped;
}

export function clampKnowledgeRailWidth(value: unknown, panelWidth = 520): number {
  const max = Math.max(300, Math.floor(Number(panelWidth) || 520) - 40);
  return Math.min(max, Math.max(280, Number(value) || 400));
}
export function clampKnowledgeNavWidth(value: unknown, panelWidth = 520, sizePreset = ""): number {
  const def = sizePreset === "small" || sizePreset === "medium" ? 240 : 280;
  const max = Math.max(200, Math.floor((Number(panelWidth) || 520) * 0.48));
  return Math.min(max, Math.max(200, Number(value) || def));
}

export function defaultUiGeometry(options: PanelPersistenceOptions): WorkbenchUi {
  const sizePreset = options.defaultSizePreset;
  const w = options.presetWidth(sizePreset, options.viewportWidth);
  const h = options.highHeight(options.viewportHeight);
  return {
    x: Math.max(8, options.viewportWidth - w - 16),
    y: Math.max(8, Math.floor((options.viewportHeight - h) / 2)),
    w, h, sizePreset,
    heightMode: "high", dock: null, dockExpanded: false,
    view: "ai", aiStage: "preprocess", settingsTab: "prompt", promptStage: "preprocess",
    noteFont: options.noteFontDefault, ctpFlavor: options.defaultFlavor,
    knowledgeRailW: 400, knowledgeNavW: 280, knowledgeContextOpen: false,
  };
}

export function loadUiGeometry(raw: string | null | undefined, options: PanelPersistenceOptions): WorkbenchUi {
  const defaults = defaultUiGeometry(options);
  if (!raw) return defaults;
  try {
    const saved = record(JSON.parse(raw) as unknown);
    const hasPreset = options.isPreset(saved.sizePreset) || saved.sizePreset === "custom";
    const sizePreset = hasPreset ? String(saved.sizePreset) : options.defaultSizePreset;
    const heightMode = hasPreset && saved.heightMode === "custom" ? "custom" : "high";
    const w = options.isPreset(sizePreset)
      ? options.presetWidth(sizePreset, options.viewportWidth)
      : Math.max(options.minWidth, Number(saved.w) || defaults.w);
    const h = heightMode === "high"
      ? options.highHeight(options.viewportHeight)
      : Math.max(options.minHeight, Number(saved.h) || defaults.h);
    return {
      x: numberOrDefault(saved.x, defaults.x),
      y: numberOrDefault(saved.y, defaults.y),
      w, h, sizePreset, heightMode,
      dock: saved.dock === "left" || saved.dock === "right" ? saved.dock : null,
      dockExpanded: false,
      view: allowed(saved.view, ["ai", "subs", "knowledge", "settings"], "ai"),
      aiStage: allowed(saved.aiStage, ["preprocess", "chat", "postprocess"], "preprocess"),
      settingsTab: allowed(saved.settingsTab, ["prompt", "llm", "shortcuts", "appearance"], "prompt"),
      promptStage: allowed(saved.promptStage, ["preprocess", "postprocess", "knowledge"], "preprocess"),
      noteFont: normalizeNoteFont(saved.noteFont, saved.noteFontDefault, options),
      ctpFlavor: options.normalizeFlavor(saved.ctpFlavor ?? defaults.ctpFlavor),
      knowledgeRailW: clampKnowledgeRailWidth(saved.knowledgeRailW ?? defaults.knowledgeRailW, w),
      // Keep historical width migration. Initial load does not yet have state.ui.
      knowledgeNavW: clampKnowledgeNavWidth(
        saved.knowledgeNavW ?? saved.knowledgeListW ?? defaults.knowledgeNavW, w, options.currentSizePreset,
      ),
      knowledgeContextOpen: saved.knowledgeContextOpen === true,
    };
  } catch {
    return defaults;
  }
}

export function serializeUiGeometry(ui: WorkbenchUi, options: PanelPersistenceOptions): string {
  return JSON.stringify({
    x: ui.x, y: ui.y, w: ui.w, h: ui.h,
    sizePreset: ui.sizePreset || options.defaultSizePreset,
    heightMode: ui.heightMode === "custom" ? "custom" : "high",
    dock: ui.dock,
    view: ui.view || "ai",
    aiStage: ui.aiStage || "preprocess",
    settingsTab: ui.settingsTab || "prompt",
    promptStage: ui.promptStage || "preprocess",
    noteFont: normalizeNoteFont(ui.noteFont, options.noteFontDefault, options),
    noteFontDefault: options.noteFontDefault,
    ctpFlavor: options.normalizeFlavor(ui.ctpFlavor),
    knowledgeRailW: clampKnowledgeRailWidth(ui.knowledgeRailW, ui.w),
    knowledgeNavW: clampKnowledgeNavWidth(ui.knowledgeNavW, ui.w, options.currentSizePreset),
    knowledgeContextOpen: ui.knowledgeContextOpen === true,
  });
}
