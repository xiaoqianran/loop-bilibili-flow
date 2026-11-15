import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import { sourceFunction } from "../golden/legacy-harness";

const source = readFileSync(new URL("../../apps/userscript/src/workbench/runtime.ts", import.meta.url), "utf8");

describe("workbench asynchronous lifecycle", () => {
  it("does not send a request for a run removed before dispatch", async () => {
    const requestChatCompletion = vi.fn();
    const updateAiRun = vi.fn();
    const runAiProfile = sourceFunction<(run: { id: string }, vars: object, prompt: null, meta: object) => Promise<object>>(
      source, "runAiProfile", { isCurrentAiRun: () => false, requestChatCompletion, updateAiRun },
    );
    const oldRun = { id: "removed-run" };
    expect(await runAiProfile(oldRun, {}, null, {})).toBe(oldRun);
    expect(requestChatCompletion).not.toHaveBeenCalled();
    expect(updateAiRun).not.toHaveBeenCalled();
  });

  it("serializes Mermaid rendering, returns SVG results and recovers after rejection", async () => {
    const state = { mermaidQueue: Promise.resolve() };
    const enqueue = sourceFunction<(job: () => Promise<string>) => Promise<string>>(source, "enqueueMermaidRender", { state });
    const order: string[] = [];
    let release: () => void = () => {};
    const gate = new Promise<void>(resolve => { release = resolve; });
    const first = enqueue(async () => { order.push("first"); await gate; throw new Error("invalid diagram"); });
    const second = enqueue(async () => { order.push("second"); return "<svg/>"; });
    const rejected = expect(first).rejects.toThrow("invalid diagram");
    await Promise.resolve();
    await Promise.resolve();
    expect(order).toEqual(["first"]);
    release();
    await rejected;
    expect(await second).toBe("<svg/>");
    expect(order).toEqual(["first", "second"]);
    await expect(state.mermaidQueue).resolves.toBeUndefined();
  });
});
