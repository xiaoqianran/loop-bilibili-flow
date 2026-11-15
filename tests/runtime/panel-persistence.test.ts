import { describe, expect, it } from "vitest";
import * as panel from "../../apps/userscript/src/ui/shell/persistence";
import { highPanelHeight, isPanelSizePreset, panelPresetWidth } from "../../apps/userscript/src/ui/shell/geometry";
import type { WorkbenchUi } from "../../apps/userscript/src/runtime/workbench-state";

const options: panel.PanelPersistenceOptions = {
  viewportWidth: 1200, viewportHeight: 900,
  defaultSizePreset: "large", defaultFlavor: "mocha",
  noteFontDefault: 14, noteFontMin: 14, noteFontMax: 22,
  minWidth: 420, minHeight: 520, currentSizePreset: "",
  presetWidth: panelPresetWidth, highHeight: highPanelHeight,
  isPreset: isPanelSizePreset,
  normalizeFlavor: (raw: unknown) => ["latte", "frappe", "macchiato", "mocha"].includes(String(raw)) ? String(raw) : "mocha",
};

describe("typed workbench panel persistence", () => {
  it("constructs the default panel independently from browser storage", () => {
    const ui = panel.defaultUiGeometry(options);
    expect(ui.sizePreset).toBe("large");
    expect(ui.w).toBe(panelPresetWidth("large", 1200));
    expect(ui.h).toBe(highPanelHeight(900));
    expect(ui).toMatchObject({
      x: Math.max(8, 1200 - ui.w - 16), view: "ai",
      dock: null, dockExpanded: false,
      noteFont: 14, ctpFlavor: "mocha",
      knowledgeRailW: 400, knowledgeNavW: 280,
    });
    expect(panel.loadUiGeometry(null, options)).toEqual(ui);
    expect(panel.loadUiGeometry("{broken json", options)).toEqual(ui);
  });

  it("migrates old layout without size preset to the current large/high layout", () => {
    const saved = { x: 101, y: 45, w: 560, h: 820, dock: "left", noteFont: 17, knowledgeListW: 260 };
    const loaded = panel.loadUiGeometry(JSON.stringify(saved), options);
    expect(loaded).toMatchObject({
      x: 101, y: 45, sizePreset: "large", heightMode: "high",
      w: panelPresetWidth("large", 1200),
      h: highPanelHeight(900), dock: "left",
      dockExpanded: false, noteFont: 14,
    });
    expect(loaded.knowledgeNavW).toBe(260);
  });

  it("restores explicit custom panel layout but validates out-of-range and unknown view values", () => {
    const input = {
      x: "10", y: 8, sizePreset: "custom", heightMode: "custom",
      w: 450, h: 530, dock: "garbage", view: "unknown",
      aiStage: "chat", promptStage: "knowledge", settingsTab: "shortcuts",
      noteFont: 17, noteFontDefault: 14, ctpFlavor: "latte",
      knowledgeRailW: 99999, knowledgeNavW: 99999, knowledgeContextOpen: true,
    };
    const loaded = panel.loadUiGeometry(JSON.stringify(input), options);
    expect(loaded).toMatchObject({
      sizePreset: "custom", heightMode: "custom", w: 450, h: 530,
      dock: null, x: panel.defaultUiGeometry(options).x, y: 8,
      view: "ai", aiStage: "chat", promptStage: "knowledge", settingsTab: "shortcuts",
      noteFont: 17, ctpFlavor: "latte", knowledgeContextOpen: true,
    });
    expect(loaded.knowledgeRailW).toBe(410);
    expect(loaded.knowledgeNavW).toBe(216);
  });

  it("persists only supported fields with normalized font and clamped Knowledge widths", () => {
    const ui: WorkbenchUi = {
      ...panel.defaultUiGeometry(options),
      sizePreset: "large", w: 900, h: 800, dock: "right",
      view: "subs", promptStage: "postprocess", noteFont: 70,
      knowledgeRailW: 2000, knowledgeNavW: 2000,
      knowledgeContextOpen: true,
    };
    const saved = JSON.parse(panel.serializeUiGeometry(ui, options)) as Record<string, unknown>;
    expect(saved).toMatchObject({
      sizePreset: "large", heightMode: "high", dock: "right",
      view: "subs", noteFont: 22, noteFontDefault: 14,
      knowledgeRailW: 860, knowledgeNavW: 432, knowledgeContextOpen: true,
    });
    expect(saved).not.toHaveProperty("dockExpanded");
    expect(saved).not.toHaveProperty("apiKey");
    expect(panel.loadUiGeometry(JSON.stringify(saved), options).view).toBe("subs");
  });

  it("preserves the same clamping and legacy 17px migration boundary as the old UI", () => {
    expect(panel.normalizeNoteFont(17, 0, options)).toBe(14);
    expect(panel.normalizeNoteFont(17, 14, options)).toBe(17);
    expect(panel.normalizeNoteFont(999, 14, options)).toBe(22);
    expect(panel.normalizeNoteFont("not-a-number", 14, options)).toBe(14);
    expect(panel.clampKnowledgeRailWidth(400, 320)).toBe(300);
    expect(panel.clampKnowledgeNavWidth(undefined, 520, "small")).toBe(240);
    expect(panel.clampKnowledgeNavWidth(1000, 520)).toBe(249);
  });
});
