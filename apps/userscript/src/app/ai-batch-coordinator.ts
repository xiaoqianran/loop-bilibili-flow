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
