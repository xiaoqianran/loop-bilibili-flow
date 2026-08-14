/**
 * AI postprocess session cache.
 * Refresh / coming back restores the last markdown (including repaired Mermaid).
 * Only explicit regenerate or a successful Mermaid redraw overwrites the cache.
 */

import { md5 } from "./utils/md5";

export const AI_SESSION_CACHE_PREFIX = "ai-session:";
export const AI_SESSION_CACHE_TTL_MS = 30 * 24 * 60 * 60_000;

export function aiSessionCacheTtlMs(): number {
  return AI_SESSION_CACHE_TTL_MS;
}

export type AiRunCacheSnapshot = {
  id?: string;
  profileId?: string;
  taskId?: string;
  taskSnapshot?: { modelIds?: string[] } | null;
  promptId?: string;
  promptName?: string;
  promptProfile?: unknown;
  config?: Record<string, unknown> | null;
  raw?: string;
  status?: string;
  statusText?: string;
  error?: string;
  sourceBvids?: string[];
  startedAt?: number;
  finishedAt?: number;
  scrollTop?: number;
};

export type PreprocessRunCacheSnapshot = {
  raw?: string;
  preview?: string;
  text?: string;
  status?: string;
  statusText?: string;
  modelName?: string;
  promptName?: string;
  cacheHits?: number;
  total?: number;
  totalChunks?: number;
  completedChunks?: number;
  settings?: Record<string, unknown> | null;
};

export type AiSessionCachePayload = {
  version?: number;
  routeKey?: string;
  sessionInput?: unknown;
  preprocessRun?: PreprocessRunCacheSnapshot | null;
  runs?: Array<AiRunCacheSnapshot | null>;
  activeRunId?: string;
  activeTaskId?: string;
};

export type HydratedAiRunDraft = {
  profileId: string;
  config: Record<string, unknown> | null;
  taskSnapshot: { modelIds?: string[] } | null;
  promptProfile: unknown;
  raw: string;
  status: string;
  statusText: string;
  error: string;
  sourceBvids: string[];
  startedAt: number;
  finishedAt: number;
  scrollTop: number;
  busy: false;
  mermaidRepairing: false;
};

export function aiSessionCacheKey(routeKey: string | null | undefined): string {
  const key = String(routeKey || "").trim();
  return key ? `${AI_SESSION_CACHE_PREFIX}${key}` : "";
}

export function shouldRestoreAutomaticAiSession(options: {
  automatic?: boolean;
  forcePreprocessOnce?: boolean;
} = {}): boolean {
  return !!options.automatic && !options.forcePreprocessOnce;
}

export function isUsableAiSessionCache(
  payload: AiSessionCachePayload | null | undefined,
): boolean {
  const runs = Array.isArray(payload?.runs) ? payload.runs : [];
  return runs.some((run) => String(run?.raw || "").trim());
}

export function serializeAiRunForCache(
  run: AiRunCacheSnapshot | null | undefined,
): AiRunCacheSnapshot | null {
  if (!run) return null;
  const config =
    run.config && typeof run.config === "object" ? { ...run.config } : null;
  if (config && "apiKey" in config) config.apiKey = "";
  const snapshot = run.taskSnapshot;
  return {
    id: String(run.id || ""),
    profileId: String(run.profileId || ""),
    taskId: String(run.taskId || ""),
    taskSnapshot:
      snapshot && typeof snapshot === "object"
        ? { ...snapshot, modelIds: [...(snapshot.modelIds || [])] }
        : null,
    promptId: String(run.promptId || ""),
    promptName: String(run.promptName || ""),
    promptProfile:
      run.promptProfile && typeof run.promptProfile === "object"
        ? { ...run.promptProfile }
        : null,
    config,
    raw: String(run.raw || ""),
    status: String(run.status || ""),
    statusText: String(run.statusText || ""),
    error: String(run.error || ""),
    sourceBvids: Array.isArray(run.sourceBvids) ? [...run.sourceBvids] : [],
    startedAt: Number(run.startedAt) || 0,
    finishedAt: Number(run.finishedAt) || 0,
    scrollTop: Number(run.scrollTop) || 0,
  };
}

export function serializePreprocessRunForCache(
  run: PreprocessRunCacheSnapshot | null | undefined,
): PreprocessRunCacheSnapshot | null {
  if (!run) return null;
  return {
    raw: String(run.raw || ""),
    preview: String(run.preview || ""),
    text: String(run.text || run.raw || ""),
    status: String(run.status || ""),
    statusText: String(run.statusText || ""),
    modelName: String(run.modelName || ""),
    promptName: String(run.promptName || ""),
    cacheHits: Number(run.cacheHits) || 0,
    total: Number(run.total) || 0,
    totalChunks: Number(run.totalChunks) || 0,
    completedChunks: Number(run.completedChunks) || 0,
    settings:
      run.settings && typeof run.settings === "object" ? { ...run.settings } : null,
  };
}

export function sanitizeSessionInputForCache(input: unknown): unknown {
  if (!input || typeof input !== "object") return null;
  const next = { ...(input as Record<string, unknown>) };
  const preprocessConfig = next.preprocessConfig;
  if (preprocessConfig && typeof preprocessConfig === "object") {
    next.preprocessConfig = {
      ...(preprocessConfig as Record<string, unknown>),
      apiKey: "",
    };
  }
  return next;
}

export function buildAiSessionCachePayload(input: {
  routeKey?: string | null;
  sessionInput?: unknown;
  preprocessRun?: PreprocessRunCacheSnapshot | null;
  runs?: Array<AiRunCacheSnapshot | null | undefined>;
  activeRunId?: string | null;
  activeTaskId?: string | null;
}): AiSessionCachePayload {
  return {
    version: 1,
    routeKey: String(input.routeKey || ""),
    sessionInput: sanitizeSessionInputForCache(input.sessionInput),
    preprocessRun: serializePreprocessRunForCache(input.preprocessRun),
    runs: (input.runs || [])
      .map((run) => serializeAiRunForCache(run))
      .filter((run): run is AiRunCacheSnapshot => !!run),
    activeRunId: String(input.activeRunId || ""),
    activeTaskId: String(input.activeTaskId || ""),
  };
}

export function resolveRestoredActiveRunId(
  runs: Array<{ id?: string; profileId?: string; taskId?: string } | null | undefined>,
  savedActive: { profileId?: string; taskId?: string } | null | undefined,
  activeTaskId = "",
): string {
  const list = (runs || []).filter(Boolean) as Array<{
    id?: string;
    profileId?: string;
    taskId?: string;
  }>;
  if (savedActive) {
    const match = list.find(
      (run) =>
        run.profileId === savedActive.profileId && run.taskId === savedActive.taskId,
    );
    if (match?.id) return String(match.id);
  }
  if (activeTaskId) {
    const match = list.find((run) => run.taskId === activeTaskId);
    if (match?.id) return String(match.id);
  }
  return String(list[0]?.id || "");
}

export function draftHydratedAiRun(
  saved: AiRunCacheSnapshot | null | undefined,
): HydratedAiRunDraft | null {
  if (!saved) return null;
  const raw = String(saved.raw || "");
  const unfinished = saved.status === "running" || saved.status === "queued";
  return {
    profileId: String(saved.profileId || ""),
    config:
      saved.config && typeof saved.config === "object" ? { ...saved.config } : null,
    taskSnapshot: saved.taskSnapshot || null,
    promptProfile: saved.promptProfile ?? null,
    raw,
    status: unfinished ? (raw.trim() ? "done" : "stopped") : String(saved.status || "done"),
    statusText: unfinished
      ? raw.trim()
        ? "缓存"
        : "缓存中无完整结果"
      : String(saved.statusText || "缓存"),
    error: String(saved.error || ""),
    sourceBvids: Array.isArray(saved.sourceBvids) ? [...saved.sourceBvids] : [],
    startedAt: Number(saved.startedAt) || 0,
    finishedAt: Number(saved.finishedAt) || 0,
    scrollTop: Number(saved.scrollTop) || 0,
    busy: false,
    mermaidRepairing: false,
  };
}

export type PlannedAiRun = {
  taskId?: string;
  profileId?: string;
  promptId?: string;
  promptProfile?: {
    id?: string;
    systemPrompt?: string;
    userPromptTemplate?: string;
  } | null;
  config?: {
    baseUrl?: string;
    model?: string;
    temperature?: number;
    maxTokens?: number;
  } | null;
};

export function aiSessionInputHash(
  vars: { subtitle?: string; processedSubtitle?: string } | null | undefined,
): string {
  return md5(String(vars?.processedSubtitle || vars?.subtitle || ""));
}

export function aiRunIdentityKey(run: PlannedAiRun | null | undefined, inputHash = ""): string {
  const prompt = run?.promptProfile || {};
  const promptSig = md5(`${prompt.systemPrompt || ""}\n---\n${prompt.userPromptTemplate || ""}`);
  const config = run?.config || {};
  const modelSig = md5(
    `${config.baseUrl || ""}|${config.model || ""}|${config.temperature}|${config.maxTokens}`,
  );
  return [
    String(run?.taskId || ""),
    String(run?.profileId || ""),
    String(run?.promptId || prompt.id || ""),
    promptSig,
    modelSig,
    String(inputHash || ""),
  ].join(":");
}

function plannedAiRunFromCache(cached: AiRunCacheSnapshot): PlannedAiRun {
  const prompt =
    cached.promptProfile && typeof cached.promptProfile === "object"
      ? (cached.promptProfile as NonNullable<PlannedAiRun["promptProfile"]>)
      : null;
  const config =
    cached.config && typeof cached.config === "object"
      ? {
          baseUrl: String(cached.config.baseUrl || ""),
          model: String(cached.config.model || ""),
          temperature: Number(cached.config.temperature),
          maxTokens: Number(cached.config.maxTokens),
        }
      : null;
  const next: PlannedAiRun = {
    promptProfile: prompt,
    config,
  };
  if (cached.taskId !== undefined) next.taskId = cached.taskId;
  if (cached.profileId !== undefined) next.profileId = cached.profileId;
  if (cached.promptId !== undefined) next.promptId = cached.promptId;
  return next;
}

export function partitionPlannedAiRuns(
  planned: PlannedAiRun[] | null | undefined,
  cachedRuns: Array<AiRunCacheSnapshot | null | undefined> | null | undefined,
  inputHash = "",
): {
  reuse: Array<{ plan: PlannedAiRun; cached: AiRunCacheSnapshot }>;
  generate: PlannedAiRun[];
} {
  const byKey = new Map<string, AiRunCacheSnapshot>();
  for (const cached of cachedRuns || []) {
    if (!cached || !String(cached.raw || "").trim()) continue;
    byKey.set(aiRunIdentityKey(plannedAiRunFromCache(cached), inputHash), cached);
  }
  const reuse: Array<{ plan: PlannedAiRun; cached: AiRunCacheSnapshot }> = [];
  const generate: PlannedAiRun[] = [];
  const used = new Set<string>();
  for (const plan of planned || []) {
    const key = aiRunIdentityKey(plan, inputHash);
    const cached = byKey.get(key);
    if (cached && !used.has(key)) {
      used.add(key);
      reuse.push({ plan, cached });
    } else {
      generate.push(plan);
    }
  }
  return { reuse, generate };
}

export function shouldSkipPrepareForCachedSession(
  plannedCount: number,
  generateCount: number,
  reuseCount: number,
  options: { automatic?: boolean; force?: boolean } = {},
): boolean {
  return (
    !!options.automatic &&
    !options.force &&
    plannedCount > 0 &&
    generateCount === 0 &&
    reuseCount === plannedCount
  );
}

export function draftHydratedPreprocessRun(
  saved: PreprocessRunCacheSnapshot | null | undefined,
): PreprocessRunCacheSnapshot & { busy: false } | null {
  if (!saved) return null;
  return {
    raw: String(saved.raw || ""),
    preview: String(saved.preview || ""),
    text: String(saved.text || saved.raw || ""),
    status: String(saved.status || "done"),
    statusText: String(saved.statusText || "缓存"),
    modelName: String(saved.modelName || ""),
    promptName: String(saved.promptName || ""),
    cacheHits: Number(saved.cacheHits) || 0,
    total: Number(saved.total) || 0,
    totalChunks: Number(saved.totalChunks) || 0,
    completedChunks: Number(saved.completedChunks) || 0,
    settings:
      saved.settings && typeof saved.settings === "object" ? { ...saved.settings } : null,
    busy: false,
  };
}
