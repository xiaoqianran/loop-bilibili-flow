import { partitionPlannedAiRuns } from "@subbatch/core";

export type TaskStatus = "queued" | "running" | "done" | "error" | "stopped";
export interface TaskSnapshot { id: string; status: TaskStatus; error: string }

/** Owns execution identity: cancelled/replaced work cannot commit later stages. */
export function createCoordinator() {
  let sequence = 0;
  let active: { token: number; controller: AbortController; task: TaskSnapshot } | null = null;
  return {
    begin(id: string) {
      this.stop();
      const token = ++sequence;
      const controller = new AbortController();
      const task: TaskSnapshot = { id, status: "queued", error: "" };
      active = { token, controller, task };
      const current = () => active?.token === token && !controller.signal.aborted;
      return {
        task,
        signal: controller.signal,
        current,
        assertCurrent() { if (!current()) throw new Error("任务已停止或替换"); },
        async stage<T>(operation: () => Promise<T>): Promise<T> {
          if (!current()) throw new Error("任务已停止或替换");
          task.status = "running";
          try {
            const result = await operation();
            if (!current()) throw new Error("任务已停止或替换");
            return result;
          } catch (error) {
            task.status = current() ? "error" : "stopped";
            task.error = task.status === "error" ? String(error instanceof Error ? error.message : error) : "";
            throw error;
          }
        },
        finish(status: "done" | "error" | "stopped" = "done") {
          if (current()) task.status = status;
        },
      };
    },
    stop() {
      if (active && ["queued", "running"].includes(active.task.status)) {
        active.task.status = "stopped";
        active.controller.abort();
      }
    },
  };
}

export interface BatchModel { id: string; enabled?: boolean; apiKey?: string; baseUrl?: string; model?: string; temperature?: number; maxTokens?: number }
export interface BatchPrompt { id: string; stage: string; systemPrompt: string; userPromptTemplate: string }
export interface BatchTask { id: string; promptId: string; modelIds: string[]; enabled?: boolean }
/** The application owns task expansion; UI supplies only saved configuration. */
export function planTasks(tasks: readonly BatchTask[], prompts: readonly BatchPrompt[], profiles: readonly BatchModel[]) {
  const profileMap = new Map(profiles.map(profile => [profile.id, profile]));
  const plans = tasks.filter(task => task.enabled !== false).flatMap(task => {
    const prompt = prompts.find(prompt => prompt.id === task.promptId && prompt.stage === "postprocess");
    if (!prompt || !(prompt.systemPrompt.trim() || prompt.userPromptTemplate.trim())) return [];
    const models = (task.modelIds || []).flatMap(id => {
      const model = profileMap.get(id);
      return model?.enabled ? [model] : [];
    });
    return models.length ? [{ task, prompt, models }] : [];
  });
  const runs = plans.flatMap(plan => plan.models.map(profile => ({
    task: plan.task, prompt: plan.prompt, profile,
    taskId: plan.task.id, profileId: profile.id, promptId: plan.prompt.id,
    promptProfile: plan.prompt, config: profile,
  })));
  const invalid = [...new Map(plans.flatMap(plan => plan.models).map(model => [model.id, model])).values()]
    .filter(model => !model.apiKey || !model.baseUrl || !model.model);
  return { plans, runs, invalid };
}
export const partitionRuns = partitionPlannedAiRuns;

/** Wait for every dispatched model, and retain failures instead of reporting done. */
export async function executeTasks<T extends { status?: string }>(jobs: readonly (() => Promise<T>)[]) {
  const results = await Promise.allSettled(jobs.map(job => Promise.resolve().then(job)));
  const failed = results.some(result => result.status === "rejected" || result.value.status === "error");
  const stopped = results.some(result => result.status === "fulfilled" && result.value.status === "stopped");
  return { results, status: failed ? "error" as const : stopped ? "stopped" as const : "done" as const };
}


export interface AiSessionInput {
  sessionId?: number;
  routeKey?: string;
  vars?: { subtitle?: string; [key: string]: unknown };
  promptProfile?: Record<string, unknown> | null;
  taskSnapshots?: Array<{
    task?: (Record<string, unknown> & { modelIds?: string[] }) | null;
    prompt?: Record<string, unknown> | null;
  }>;
  preprocessPrompt?: Record<string, unknown> | null;
  preprocessConfig?: Record<string, unknown> | null;
  preprocessEnabled?: boolean;
  commonMeta?: Record<string, unknown> & { sourceBvids?: string[] };
  [key: string]: unknown;
}

/** Preserve the v1 AI session persistence contract while detaching editable input. */
export function cloneSessionInput(input: AiSessionInput | null | undefined, sessionId?: number) {
  if (!input?.vars?.subtitle) return null;
  return {
    sessionId: Number(sessionId ?? input.sessionId),
    routeKey: String(input.routeKey || ""),
    vars: { ...input.vars },
    promptProfile: input.promptProfile ? { ...input.promptProfile } : null,
    taskSnapshots: Array.isArray(input.taskSnapshots)
      ? input.taskSnapshots.map(entry => ({
        task: entry.task ? { ...entry.task, modelIds: [...(entry.task.modelIds || [])] } : null,
        prompt: entry.prompt ? { ...entry.prompt } : null,
      }))
      : [],
    preprocessPrompt: input.preprocessPrompt ? { ...input.preprocessPrompt } : null,
    preprocessConfig: input.preprocessConfig ? { ...input.preprocessConfig } : null,
    preprocessEnabled: !!input.preprocessEnabled,
    commonMeta: {
      ...(input.commonMeta || {}),
      sourceBvids: [...(input.commonMeta?.sourceBvids || [])],
    },
  };
}

export function summarizeRuns(runs: readonly { status?: string }[]) {
  if (!runs.length) return null;
  return {
    done: runs.filter(run => run.status === "done").length,
    failed: runs.filter(run => run.status === "error").length,
    stopped: runs.filter(run => run.status === "stopped").length,
  };
}

export interface SubtitleCandidate {
  bvid: string;
  page?: number;
  subStatus?: string;
  data?: unknown[] | null;
  cue_count?: number;
  error?: string;
  title?: string;
  author?: string;
}
export interface SubtitleFetchResult {
  status: string;
  cue_count?: number;
  data?: unknown[] | null;
  error?: string;
  title?: string;
  author?: string;
}

/** Batch subtitle acquisition policy. Browser transport/UI remain caller-supplied ports. */
export async function ensureSubtitles<T extends SubtitleCandidate>(
  targets: T[],
  delayMs: number,
  ports: {
    cancelled: () => boolean;
    onFetching: (item: T, index: number, total: number) => void;
    fetchSubtitle: (bvid: string, page: number) => Promise<SubtitleFetchResult>;
    onUpdated: (item: T) => void;
    sleep: (ms: number) => Promise<unknown>;
  },
): Promise<T[]> {
  for (let i = 0; i < targets.length; i++) {
    if (ports.cancelled()) throw new Error("用户停止");
    const item = targets[i]!;
    if (item.subStatus === "ok" && item.data?.length) continue;
    ports.onFetching(item, i, targets.length);
    const result = await ports.fetchSubtitle(item.bvid, item.page || 1);
    item.subStatus = result.status;
    item.cue_count = result.cue_count || 0;
    item.data = result.data || null;
    item.error = result.error || "";
    if (!item.title && result.title) item.title = result.title;
    if (!item.author && result.author) item.author = result.author;
    ports.onUpdated(item);
    if (i < targets.length - 1) await ports.sleep(delayMs);
  }
  return targets.filter(item => item.subStatus === "ok" && !!item.data?.length);
}


export interface BatchSubtitle {
  bvid: string;
  title?: string;
  author?: string;
}
export function prepareBatchInput<T extends BatchSubtitle>(
  ready: readonly T[],
  rawBuilt: string,
  stageInput: string,
  preprocessEnabled: boolean,
  truncate: (text: string) => { text: string; truncated: boolean },
  preprocessPromptName: string,
  preprocessModelName: string,
) {
  const first = ready[0];
  const sourceBvids = ready.map(item => item.bvid).filter(Boolean);
  const cut = truncate(stageInput);
  const vars = {
    title: ready.map(item => item.title).filter(Boolean).join(" / ") || first?.title || "",
    bvid: ready.map(item => item.bvid).join(", "),
    author: first?.author || "",
    subtitle: cut.text,
    rawSubtitle: rawBuilt,
    processedSubtitle: preprocessEnabled ? stageInput : "",
  };
  const commonMeta = {
    sourceBvids,
    truncated: cut.truncated,
    readyCount: ready.length,
    preprocessEnabled,
    preprocessPromptName,
    preprocessModelName,
  };
  return { vars, commonMeta, sourceBvids, cut };
}

export interface BatchRunIdentity {
  taskId: string;
  profileId: string;
}
export interface BatchRunState extends BatchRunIdentity {
  id: string;
  sourceBvids?: string[];
  [key: string]: unknown;
}

/** Assign cached model output to its existing run identity; return only missing run IDs. */
export function hydratePlannedRuns<
  T extends BatchRunState,
  C,
  P extends BatchRunIdentity,
>(
  runs: readonly T[],
  split: {
    reuse: readonly { plan: P; cached: C }[];
    generate: readonly P[];
  },
  sourceBvids: readonly string[],
  draft: (cached: C) => Record<string, unknown> | null,
) {
  const findRun = (item: BatchRunIdentity) =>
    runs.find(run => run.taskId === item.taskId && run.profileId === item.profileId);
  let reused = 0;
  for (const item of split.reuse) {
    const run = findRun(item.plan);
    if (!run) continue;
    const restored = draft(item.cached);
    if (!restored) continue;
    Object.assign(run, restored, { sourceBvids: [...sourceBvids] });
    reused++;
  }
  const generateIds = split.generate.map(plan => findRun(plan)?.id).filter(
    (id): id is string => Boolean(id),
  );
  return { reused, generateIds };
}
