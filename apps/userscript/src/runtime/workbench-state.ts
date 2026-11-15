/** Canonical initial workbench state. Typed defaults replace the legacy mutable object literal.
 *  Opaque transport/session fields are marked unknown until each owning subsystem migrates.
 *  New UI/Application modules must refine unknown at the use site rather than bypass checks.
 */
import type { LibraryItem } from "../ui/workspaces/library-controller";
import type { KnowledgeAnchor, KnowledgeNode } from "../ui/workspaces/knowledge-navigation-controller";
import type { StudioMessage } from "../app/studio-controller";
import type { ScanContext } from "../app/scan-context";
import type { AiRequestRuntime } from "../app/ai-controller";
import type { AiSessionInput, BatchModel, BatchTask } from "../app/ai-batch-coordinator";
import type { AiProfile, PromptProfile, SubtitleCue } from "@subbatch/core";
import type { BilibiliVideoView, BilibiliVideoPage, SubtitleTrack } from "@subbatch/bilibili";
import type { PipelineRun } from "../app/preprocess-controller";

export interface WorkbenchLibraryItem extends LibraryItem {
  bvid: string;
  title?: string;
  author?: string;
  page?: number;
  selected?: boolean;
  groupType?: string;
  groupKey?: string;
  part?: string;
  groupFolder?: string;
  parentFolder?: string;
  collectionName?: string;
  collectionShortUrl?: string;
  videoTitle?: string;
  sources?: string[];
  subStatus?: string;
  lan?: string;
  lan_doc?: string;
  activeTrackIndex?: number;
  cachePath?: string;
  source?: string;
  data?: SubtitleCue[] | null;
  tracks?: SubtitleTrack[];
  aid?: string | number | null;
  cid?: string | number | null;
  pages?: BilibiliVideoPage[] | null;
  error?: string;
  cacheLevel?: string;
  cacheStale?: boolean;
  [key: string]: unknown;
}
/** Actual AI run record stored by the workbench, not a bag of unknown values. */
export interface WorkbenchSubtitleResult extends WorkbenchLibraryItem {
  status: "ok" | "empty" | "error";
}
export interface WorkbenchKnowledgeNode extends KnowledgeNode {
  question: string; answer: string; preview: string; suggestions: string[];
  status: string; updatedAt: number; error?: string;
  parentId?: string | null; starred?: boolean; createdAt?: number;
}
export interface WorkbenchAiRuntime extends AiRequestRuntime {
  label: string;
  xhr: { abort?: () => void } | null;
}
export interface WorkbenchAiRun extends WorkbenchAiRuntime {
  id: string;
  profileId: string;
  taskId: string;
  taskSnapshot: WorkbenchPostTask | BatchTask | null;
  promptId: string;
  promptName: string;
  promptProfile: PromptProfile | null;
  config: BatchModel & Partial<AiProfile>;
  raw: string;
  status: string;
  statusText: string;
  busy: boolean;
  error: string;
  sourceBvids: string[];
  startedAt: number;
  finishedAt: number;
  scrollTop: number;
  stickBottom: boolean;
  userReading: boolean;
  mermaidRepairing: boolean;
}

export interface WorkbenchPostTask {
  id: string;
  modelIds: string[];
  promptId: string;
  enabled?: boolean;
  order?: number;
}
export interface ShortcutPreferences {
  schemaVersion: number;
  enabled: boolean;
  summonLayout: string;
  summonTarget: string;
  preferredDock: string;
  bindings: Record<string, string>;
}
export interface WorkbenchUi {
  x: number; y: number; w: number; h: number;
  sizePreset: string; heightMode: string;
  dock: "left" | "right" | null; dockExpanded: boolean;
  view: string; aiStage: string; settingsTab: string; promptStage: string;
  noteFont: number; ctpFlavor: string;
  knowledgeRailW: number; knowledgeNavW: number; knowledgeContextOpen: boolean;
}

export interface WorkbenchSettings {
  delayMs: number;
  maxPages: number;
  preprocessEnabled: boolean;
  preprocessModelId: string;
  preprocessConcurrency: number;
  preprocessTargetMinutes: number;
  preprocessOverlapSeconds: number;
  preprocessMaxChars: number;
  preprocessRetries: number;
  studioModelId: string;
  autoCaptureEnabled: boolean;
  autoAnalyzeEnabled: boolean;
  transcriptAutoFollow: boolean;
  autoEnablePlayerSubtitle: boolean;
  knowledgeModelId: string;
  shortcutConfig: ShortcutPreferences;
}

export interface WorkbenchState {
  open: boolean;
  busy: boolean;
  scanBusy: boolean;
  batchBusy: boolean;
  scanSeq: number;
  batchSeq: number;
  cancel: boolean;
  cancelScan: boolean;
  cancelBatch: boolean;
  scanPaused: boolean;
  batchPaused: boolean;
  libraryJob: { kind: string; index: number; total: number; label: string };
  pendingRescan: boolean;
  pendingAiSend: boolean;
  mode: string;
  autoCtx: ScanContext | null;
  ctx: ScanContext | null;
  items: WorkbenchLibraryItem[];
  libraryFolderCollapsed: Record<string, boolean>;
  meta: Record<string, unknown>;
  delayMs: number;
  maxPages: number;
  ui: WorkbenchUi | null;
  aiFocus: boolean;
  ai: (BatchModel & Partial<AiProfile>) | null;
  aiProfiles: AiProfile[];
  promptProfiles: PromptProfile[];
  activePromptId: string;
  activePrePromptId: string;
  activeKnowledgePromptId: string;
  preprocessEnabled: boolean;
  preprocessModelId: string;
  preprocessConcurrency: number;
  preprocessTargetMinutes: number;
  preprocessOverlapSeconds: number;
  preprocessMaxChars: number;
  preprocessRetries: number;
  preprocessRun: PipelineRun<WorkbenchAiRuntime> | null;
  studioBusy: boolean;
  studioRuntime: WorkbenchAiRuntime | null;
  studioMessages: StudioMessage[];
  studioMemory: string;
  studioMemoryUntilId: string;
  studioMemoryTurns: number;
  studioLastContextMeta: Record<string, unknown> | null;
  studioContextPref: "auto" | "raw" | "processed";
  studioModelId: string;
  studioSlashIndex: number;
  forcePreprocessOnce: boolean;
  aiViewingPreprocess: boolean;
  postTasks: WorkbenchPostTask[];
  aiActiveTaskId: string;
  aiDrawer: string;
  aiInputView: string;
  promptEditorId: string;
  aiEditorId: string;
  promptSearch: string;
  aiSearch: string;
  aiRuns: Map<string, WorkbenchAiRun>;
  aiRunOrder: string[];
  aiActiveRunId: string;
  aiSessionSeq: number;
  aiSessionInput: AiSessionInput | null;
  aiBusy: boolean;
  aiAbort: boolean;
  aiRaw: string;
  aiXhr: { abort?: () => void } | null;
  aiAbortController: AbortController | null;
  aiStickBottom: boolean;
  aiUserReading: boolean;
  aiProgScroll: boolean;
  aiPaintRaf: number;
  aiPaintTimer: number;
  aiPendingText: string;
  aiRenderedText: string;
  aiStreamTextNode: Text | null;
  renderEpoch: number;
  renderLibs: { core: boolean; highlight: boolean; mermaid: boolean; katex: boolean };
  mermaidObserver: IntersectionObserver | null;
  mermaidRenderSeq: number;
  mermaidQueue: Promise<void>;
  mermaidRepairing: boolean;
  aiSourceBvids: string[];
  autoCaptureEnabled: boolean;
  autoCaptureKey: string;
  autoCaptureEpoch: number;
  autoCaptureTimer: number;
  autoCaptureAbortController: AbortController | null;
  autoAnalyzeEnabled: boolean;
  autoAnalyzeKey: string;
  autoAnalyzePendingKey: string;
  autoAnalyzeTimer: number;
  aiSessionRouteKey: string;
  aiSessionRestorePromise: Promise<boolean> | null;
  aiSessionRestoreKey: string;
  fastViewCache: Map<string, BilibiliVideoView>;
  fastTrackCache: Map<string, SubtitleTrack[]>;
  fastSubtitleCache: Map<string, WorkbenchSubtitleResult>;
  fastTrackBodyCache: Map<string, WorkbenchSubtitleResult>;
  transcriptItemKey: string;
  transcriptItem: WorkbenchLibraryItem | null;
  transcriptQuery: string;
  transcriptFilteredIndexes: number[] | null;
  transcriptActiveCueIndex: number;
  transcriptTrackIndex: number;
  transcriptAutoFollow: boolean;
  autoEnablePlayerSubtitle: boolean;
  playerSubtitleOperation: unknown;
  transcriptUserScrollUntil: number;
  transcriptVideoAbort: AbortController | null;
  transcriptSwitchAbort: AbortController | null;
  transcriptRenderEpoch: number;
  libraryQuery: string;
  libraryFilter: string;
  captureDrawerOpen: boolean;
  knowledgeAnchors: KnowledgeAnchor[];
  knowledgeNodes: WorkbenchKnowledgeNode[];
  knowledgeSearch: string;
  knowledgeActiveAnchorId: string;
  knowledgeActiveNodeId: string;
  knowledgeRailOpen: boolean;
  knowledgeTreeOpen: boolean;
  knowledgeSelection: Pick<KnowledgeAnchor, "sourceKey" | "bvid" | "page" | "title" | "author" | "segmentId" | "timeStart" | "timeEnd" | "contextText" | "sourceHash"> & { selectedText: string } | null;
  knowledgeBusy: boolean;
  knowledgeResetScroll: boolean;
  knowledgeRuntime: WorkbenchAiRuntime | null;
  knowledgePaintRaf: number;
  knowledgeModelId: string;
  shortcutConfig: ShortcutPreferences;
  shortcutRecordingId: string;
}

/** Each invocation creates isolated maps, arrays and progress/scroll state. */
export function createWorkbenchState(defaults: Readonly<WorkbenchSettings>): WorkbenchState {
  return {
    open: false,
    // busy 仅作旧状态栏兼容；真实互斥由 scanBusy / batchBusy 分别管理。
    busy: false,
    scanBusy: false,
    batchBusy: false,
    scanSeq: 0,
    batchSeq: 0,
    cancel: false, // legacy bridge
    cancelScan: false,
    cancelBatch: false,
    scanPaused: false,
    batchPaused: false,
    libraryJob: { kind: "", index: 0, total: 0, label: "" },
    pendingRescan: false,
    pendingAiSend: false,
    mode: "auto", // auto | video | selection | user | favorite | collection | search
    autoCtx: null,
    ctx: null,
    items: [], // { bvid, title, author, page, selected, groupType?, groupKey?, … }
    /** groupKey -> true when folder is collapsed */
    libraryFolderCollapsed: {},
    meta: {},
    delayMs: defaults.delayMs,
    maxPages: defaults.maxPages,
    ui: null, // geometry + dock
    aiFocus: false, // AI 专注阅读：铺满视口并隐藏非阅读控件
    ai: null, // active/legacy-compatible config
    aiProfiles: [], // persisted model configurations
    promptProfiles: [], // user-editable prompt templates (preprocess + postprocess)
    activePromptId: "", // active postprocess prompt
    activePrePromptId: "", // active preprocess prompt
    activeKnowledgePromptId: "", // Knowledge Drill-down prompt
    preprocessEnabled: defaults.preprocessEnabled,
    preprocessModelId: defaults.preprocessModelId,
    preprocessConcurrency: defaults.preprocessConcurrency,
    preprocessTargetMinutes: defaults.preprocessTargetMinutes,
    preprocessOverlapSeconds: defaults.preprocessOverlapSeconds,
    preprocessMaxChars: defaults.preprocessMaxChars,
    preprocessRetries: defaults.preprocessRetries,
    preprocessRun: null, // shared subtitle normalization stage for current session
    studioBusy: false,
    studioRuntime: null,
    studioMessages: [],
    studioMemory: "",
    studioMemoryUntilId: "",
    studioMemoryTurns: 0,
    studioLastContextMeta: null,
    studioContextPref: "auto", // auto | raw | processed
    studioModelId: defaults.studioModelId,
    studioSlashIndex: 0,
    forcePreprocessOnce: false,
    aiViewingPreprocess: false, // legacy bridge; v5.8 input preview lives in drawer
    postTasks: [], // output artifacts: each POST Prompt + selected LLMs
    aiActiveTaskId: "", // first-level result navigation: output artifact
    aiDrawer: "", // "flow" | "input" | ""
    aiInputView: "raw", // raw | processed
    promptEditorId: "", // settings master-detail current prompt editor
    aiEditorId: "", // settings master-detail current LLM editor
    promptSearch: "",
    aiSearch: "",
    aiRuns: new Map(), // current analysis session: runId -> independent runtime/result
    aiRunOrder: [],
    aiActiveRunId: "",
    aiSessionSeq: 0,
    // 当前批次已经组装好的共享输入。单模型/全部重新生成直接复用，不重新抓字幕。
    aiSessionInput: null,
    aiBusy: false, // true while any model run is active
    aiAbort: false, // stop-all / subtitle preparation flag
    aiRaw: "", // active result markdown buffer (legacy rendering bridge)
    aiXhr: null, // legacy field; model requests use per-run handles
    aiAbortController: null, // legacy field; model requests use per-run handles
    aiStickBottom: true, // 仅「跟随模式」时 paint 才改 scrollTop
    aiUserReading: false, // 用户主动离开底部后锁住，禁止自动回粘
    aiProgScroll: false, // 程序化滚动中，忽略 scroll 事件回写
    aiPaintRaf: 0,
    aiPaintTimer: 0,
    aiPendingText: "",
    aiRenderedText: "",
    aiStreamTextNode: null,
    renderEpoch: 0,
    renderLibs: { core: false, highlight: false, mermaid: false, katex: false },
    mermaidObserver: null,
    mermaidRenderSeq: 0,
    mermaidQueue: Promise.resolve(),
    mermaidRepairing: false,
    aiSourceBvids: [],
    autoCaptureEnabled: defaults.autoCaptureEnabled,
    autoCaptureKey: "",
    autoCaptureEpoch: 0,
    autoCaptureTimer: 0,
    autoCaptureAbortController: null,
    autoAnalyzeEnabled: defaults.autoAnalyzeEnabled,
    autoAnalyzeKey: "",
    autoAnalyzePendingKey: "",
    autoAnalyzeTimer: 0,
    aiSessionRouteKey: "",
    aiSessionRestorePromise: null,
    aiSessionRestoreKey: "",
    fastViewCache: new Map(),
    fastTrackCache: new Map(),
    fastSubtitleCache: new Map(),
    fastTrackBodyCache: new Map(),
    transcriptItemKey: "",
    transcriptItem: null, // 当前阅读字幕独立于扫描列表，扫描合集时不会被覆盖
    transcriptQuery: "",
    transcriptFilteredIndexes: null,
    transcriptActiveCueIndex: -1,
    transcriptTrackIndex: -1,
    transcriptAutoFollow: defaults.transcriptAutoFollow,
    autoEnablePlayerSubtitle: defaults.autoEnablePlayerSubtitle,
    playerSubtitleOperation: null,
    transcriptUserScrollUntil: 0,
    transcriptVideoAbort: null,
    transcriptSwitchAbort: null,
    transcriptRenderEpoch: 0,
    libraryQuery: "",
    libraryFilter: "all", // all | ok | wait | error | empty
    captureDrawerOpen: false,
    knowledgeAnchors: [],
    knowledgeNodes: [],
    knowledgeSearch: "",
    knowledgeActiveAnchorId: "",
    knowledgeActiveNodeId: "",
    knowledgeRailOpen: false,
    knowledgeTreeOpen: false,
    knowledgeSelection: null,
    knowledgeBusy: false,
    knowledgeResetScroll: false,
    knowledgeRuntime: null,
    knowledgePaintRaf: 0,
    knowledgeModelId: defaults.knowledgeModelId,
    shortcutConfig: defaults.shortcutConfig,
    shortcutRecordingId: "",
  };
}
