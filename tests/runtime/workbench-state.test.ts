import { describe, expect, it } from "vitest";
import { createWorkbenchState, type WorkbenchSettings } from "../../apps/userscript/src/runtime/workbench-state";

const settings: WorkbenchSettings = {
  delayMs: 400,
  maxPages: 20,
  preprocessEnabled: true,
  preprocessModelId: "pre",
  preprocessConcurrency: 6,
  preprocessTargetMinutes: 10,
  preprocessOverlapSeconds: 8,
  preprocessMaxChars: 20000,
  preprocessRetries: 2,
  studioModelId: "studio",
  autoCaptureEnabled: true,
  autoAnalyzeEnabled: false,
  transcriptAutoFollow: true,
  autoEnablePlayerSubtitle: false,
  knowledgeModelId: "knowledge",
  shortcutConfig: {
    schemaVersion: 2, enabled: true, summonLayout: "remember",
    summonTarget: "remember", preferredDock: "right",
    bindings: { "toggle-panel": "Ctrl+KeyB" },
  },
};

describe("typed workbench state factory", () => {
  it("contains all 130 state fields with stable initial runtime values", () => {
    const state = createWorkbenchState(settings);
    expect(Object.keys(state)).toHaveLength(130);
    expect(state).toMatchObject({
      open: false, busy: false, scanBusy: false, batchBusy: false,
      libraryJob: { kind: "", index: 0, total: 0, label: "" },
      mode: "auto", items: [], ui: null, aiFocus: false,
      delayMs: 400, maxPages: 20,
      preprocessConcurrency: 6,
      preprocessModelId: "pre",
      studioModelId: "studio", knowledgeModelId: "knowledge",
      autoCaptureEnabled: true, autoAnalyzeEnabled: false,
      autoEnablePlayerSubtitle: false, transcriptAutoFollow: true,
      knowledgeAnchors: [], knowledgeNodes: [],
      transcriptItem: null, transcriptActiveCueIndex: -1,
      renderLibs: { core: false, highlight: false, mermaid: false, katex: false },
    });
  });

  it("allocates fresh cache maps, sessions, node collections and progress for every mount", () => {
    const first = createWorkbenchState(settings);
    const second = createWorkbenchState(settings);
    first.fastTrackCache.set("t", []);
    expect(first.aiRuns).not.toBe(second.aiRuns);
    first.libraryFolderCollapsed.a = true;
    first.libraryJob.index = 4;
    first.knowledgeAnchors.push({ id: "a" });
    first.studioMessages.push({ role: "user", content: "hello" });
    expect(second.aiRuns.size).toBe(0);
    expect(second.fastTrackCache.size).toBe(0);
    expect(second.libraryFolderCollapsed).toEqual({});
    expect(second.libraryJob.index).toBe(0);
    expect(second.knowledgeAnchors).toEqual([]);
    expect(second.studioMessages).toEqual([]);
    expect(first.fastSubtitleCache).not.toBe(second.fastSubtitleCache);
  });

  it("accepts caller settings without modifying saved preferences or forcing defaults", () => {
    const state = createWorkbenchState({
      ...settings,
      delayMs: 0, maxPages: 1, autoAnalyzeEnabled: true, shortcutConfig: settings.shortcutConfig,
    });
    expect(state.delayMs).toBe(0);
    expect(state.maxPages).toBe(1);
    expect(state.autoAnalyzeEnabled).toBe(true);
    expect(state.shortcutConfig).toBe(settings.shortcutConfig);
    expect(settings.shortcutConfig.bindings["toggle-panel"]).toBe("Ctrl+KeyB");
  });
});
