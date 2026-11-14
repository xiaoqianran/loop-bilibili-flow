import { describe, it, expect, vi } from "vitest";
import { createCoordinator } from "../../apps/userscript/src/app/ai-batch-coordinator";
import { selectAnchor } from "../../apps/userscript/src/app/knowledge-controller";

describe("application task lifecycle", () => {
  it("blocks a stopped pending stage from reaching the next stage", async () => {
    const coordinator = createCoordinator();
    const run = coordinator.begin("old");
    let release!: () => void;
    const pending = run.stage(() => new Promise<void>(resolve => { release = resolve; }));
    coordinator.stop();
    release();
    await expect(pending).rejects.toThrow("任务已停止或替换");
    const next = vi.fn();
    await expect(run.stage(next)).rejects.toThrow();
    expect(next).not.toHaveBeenCalled();
    expect(run.task.status).toBe("stopped");
    expect(run.signal.aborted).toBe(true);
  });
  it("replacement isolates old completion from the new request", async () => {
    const coordinator = createCoordinator();
    const old = coordinator.begin("old");
    const current = coordinator.begin("new");
    old.finish();
    expect(old.task.status).toBe("stopped");
    expect(current.task.status).toBe("queued");
    await current.stage(async () => 42);
    current.finish();
    expect(current.task.status).toBe("done");
  });
  it("records stage errors and allows explicit retry as a new execution", async () => {
    const coordinator = createCoordinator();
    const failed = coordinator.begin("task");
    await expect(failed.stage(async () => { throw new Error("offline"); })).rejects.toThrow("offline");
    expect(failed.task).toMatchObject({ status: "error", error: "offline" });
    const retry = coordinator.begin("task");
    expect(await retry.stage(async () => "answer")).toBe("answer");
    retry.finish();
    expect(retry.task.status).toBe("done");
    expect(failed.task.status).toBe("error");
  });
  it("selects latest answer only within the selected anchor", () => {
    expect(selectAnchor("a", [
      { id: "old", anchorId: "a", updatedAt: 1 },
      { id: "other", anchorId: "b", updatedAt: 100 },
      { id: "new", anchorId: "a", updatedAt: 2 },
    ])).toEqual({ anchorId: "a", nodeId: "new" });
    expect(selectAnchor("empty", [])).toEqual({ anchorId: "empty", nodeId: "" });
  });
});
