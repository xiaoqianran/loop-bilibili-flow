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

import { planTasks, executeTasks } from "../../apps/userscript/src/app/ai-batch-coordinator";
import { completeAnswer, failAnswer, removeAnchor } from "../../apps/userscript/src/app/knowledge-controller";

describe("batch planning and knowledge transitions", () => {
  it("expands enabled task/model pairs and reports invalid configuration", () => {
    const prompt = { id: "p", stage: "postprocess", systemPrompt: "", userPromptTemplate: "summarize" };
    const result = planTasks([
      { id: "t", promptId: "p", modelIds: ["a", "disabled", "missing"] },
      { id: "off", promptId: "p", modelIds: ["a"], enabled: false },
    ], [prompt], [{ id: "a", enabled: true }, { id: "disabled", enabled: false }]);
    expect(result.runs.map(run => [run.taskId, run.profileId])).toEqual([["t", "a"]]);
    expect(result.invalid.map(model => model.id)).toEqual(["a"]);
  });
  it("waits for all jobs and distinguishes model failure from success", async () => {
    const result = await executeTasks([
      async () => ({ status: "done" }),
      async () => ({ status: "error" }),
      async () => { throw new Error("network"); },
    ]);
    expect(result.results).toHaveLength(3);
    expect(result.status).toBe("error");
    expect((await executeTasks([async () => ({ status: "stopped" })])).status).toBe("stopped");
  });
  it("retains stopped answers and clears stale errors after successful retry", () => {
    const node = { answer: "", preview: "partial", suggestions: [], status: "running", updatedAt: 1, error: "old" };
    completeAnswer(node, { answer: "answer", suggestions: ["next"] }, "", true, 2);
    expect(node).toMatchObject({ answer: "answer", status: "stopped", preview: "", error: "", updatedAt: 2 });
    failAnswer(node, "partial", new Error("offline"), false, 3);
    expect(node).toMatchObject({ answer: "partial", status: "error", error: "offline" });
  });
  it("removes anchor and descendants without affecting another tree", () => {
    expect(removeAnchor([{ id: "a" }, { id: "b" }], [{ anchorId: "a" }, { anchorId: "b" }], "a"))
      .toEqual({ anchors: [{ id: "b" }], nodes: [{ anchorId: "b" }] });
  });
});

import { runAnswer } from "../../apps/userscript/src/app/knowledge-controller";

describe("knowledge execution", () => {
  function setup() {
    const node = { answer: "", preview: "", suggestions: [] as string[], status: "running", updatedAt: 0 };
    return {
      node, generate: vi.fn(async () => "answer"), parse: (text: string) => ({ answer: text, suggestions: [] }),
      visible: (text: string) => text, partial: () => "partial", stopped: () => false,
      exists: () => true, persist: vi.fn(async () => {}), onSuccess: vi.fn(async () => {}),
      onFailure: vi.fn(), cleanup: vi.fn(async () => {}),
    };
  }
  it("persists terminal state before notifying the view and always cleans up", async () => {
    const ports = setup();
    await runAnswer(ports);
    expect(ports.node.status).toBe("done");
    expect(ports.persist.mock.invocationCallOrder[0]).toBeLessThan(ports.onSuccess.mock.invocationCallOrder[0]!);
    expect(ports.cleanup).toHaveBeenCalledOnce();
  });
  it("never recreates an answer after its anchor is deleted", async () => {
    const ports = setup();
    ports.exists = () => false;
    await runAnswer(ports);
    expect(ports.persist).not.toHaveBeenCalled();
    expect(ports.onSuccess).not.toHaveBeenCalled();
    expect(ports.cleanup).toHaveBeenCalledOnce();
  });
  it("persists stopped partial output when generation aborts", async () => {
    const ports = setup();
    ports.generate.mockRejectedValue(new Error("abort"));
    ports.stopped = () => true;
    await runAnswer(ports);
    expect(ports.node).toMatchObject({ status: "stopped", answer: "partial" });
    expect(ports.onFailure).toHaveBeenCalledOnce();
    expect(ports.cleanup).toHaveBeenCalledOnce();
  });
});
