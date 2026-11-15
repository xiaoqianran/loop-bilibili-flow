import type { HydratedAiRunDraft, PreprocessRunCacheSnapshot } from "@subbatch/core";
import type { AiSessionInput } from "./ai-batch-coordinator";
import { settings } from "./preprocess-controller";
import type { PipelineRun } from "./preprocess-controller";

function record(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown> : null;
}

function strings(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((entry): entry is string => typeof entry === "string") : [];
}

/** Read historical cache input without trusting nested editable arrays. */
export function normalizeCachedSessionInput(value: unknown): AiSessionInput | null {
  const input = record(value);
  const vars = record(input?.vars);
  if (!input || !vars || typeof vars.subtitle !== "string") return null;
  const meta = record(input.commonMeta);
  return {
    ...input,
    sessionId: Number(input.sessionId) || 0,
    routeKey: String(input.routeKey || ""),
    vars: { ...vars, subtitle: vars.subtitle },
    promptProfile: record(input.promptProfile),
    preprocessPrompt: record(input.preprocessPrompt),
    preprocessConfig: record(input.preprocessConfig),
    preprocessEnabled: !!input.preprocessEnabled,
    taskSnapshots: Array.isArray(input.taskSnapshots) ? input.taskSnapshots.flatMap(entry => {
      const snapshot = record(entry);
      if (!snapshot) return [];
      const task = record(snapshot.task);
      return [{
        task: task ? { ...task, modelIds: strings(task.modelIds) } : null,
        prompt: record(snapshot.prompt),
      }];
    }) : [],
    commonMeta: { ...meta, sourceBvids: strings(meta?.sourceBvids) },
  };
}

/** Restore output while retaining the current credentials, prompt, task and identity. */
export function applyRestoredRunOutput<T extends { raw: string }>(target: T, draft: HydratedAiRunDraft): T {
  return Object.assign(target, {
    raw: draft.raw, status: draft.status, statusText: draft.statusText,
    error: draft.error, sourceIds: [...draft.sourceIds], sourceBvids: [...draft.sourceBvids],
    startedAt: draft.startedAt, finishedAt: draft.finishedAt, scrollTop: draft.scrollTop,
    busy: false, mermaidRepairing: false,
  });
}

/** A restored PRE result is idle and owns no active child request. */
export function restorePreprocessRun<R>(snapshot: PreprocessRunCacheSnapshot, runtime: R): PipelineRun<R> {
  return {
    runtime, childRuntimes: new Set<R>(), busy: false,
    raw: snapshot.raw || "", text: snapshot.text || snapshot.raw || "", preview: snapshot.preview || "",
    status: snapshot.status === "error" ? "error" : snapshot.status === "stopped" ? "stopped" : "done",
    statusText: snapshot.statusText || "缓存", modelName: snapshot.modelName || "", promptName: snapshot.promptName || "",
    cacheHits: snapshot.cacheHits || 0, total: snapshot.total || 0,
    totalChunks: snapshot.totalChunks || 0, completedChunks: snapshot.completedChunks || 0,
    settings: settings({
      preprocessConcurrency: snapshot.settings?.concurrency,
      preprocessTargetMinutes: snapshot.settings?.targetMinutes,
      preprocessOverlapSeconds: snapshot.settings?.overlapSeconds,
      preprocessMaxChars: snapshot.settings?.maxChars,
      preprocessRetries: snapshot.settings?.retries,
    }),
  };
}
