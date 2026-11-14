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
