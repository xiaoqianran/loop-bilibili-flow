import { describe, expect, it, vi } from "vitest";
import { preprocess } from "../../apps/userscript/src/app";

describe("PRE main pipeline lifecycle", () => {
  const settings = { concurrency: 2, retries: 1, targetMinutes: 8, overlapSeconds: 0, maxChars: 24000 };
  function setup() {
    const onStart = vi.fn();
    const onUpdate = vi.fn();
    const onComplete = vi.fn();
    const abortChild = vi.fn();
    const writeCache = vi.fn(async (...args: [string, { model: string; chunkCount: number }]) => { void args; });
    const runtime = { abort: false };
    let cancelled = false;
    const runChunk = vi.fn(async (...args: [unknown, number, { childRuntimes: Set<{ abort: boolean }> }]) => { void args; return "processed"; });
    const ports = {
      createRuntime: () => runtime, onStart, onUpdate, onComplete,
      isCancelled: () => cancelled, abortChild,
      getRaw: (item: { bvid: string }) => item.bvid,
      cacheKey: (item: { bvid: string }) => item.bvid,
      readCache: async (): Promise<{ value: { text: string } } | null> => null,
      split: () => [{ text: "source", chunkStartSec: 0, coreStartSec: 0, endSec: 2 }],
      forceRefresh: false,
      cacheModel: "model-id",
      runPool: async <J>(jobs: readonly J[], concurrency: number, handler: (job: J, workerId: number) => Promise<void>) => {
        void concurrency;
        for (const job of jobs) await handler(job, 1);
      },
      runChunk, stitch: (chunks: unknown[], output: string[]) => { void chunks; return output.join(""); },
      writeCache,
    };
    return { ports, runtime, onStart, onUpdate, onComplete, runChunk, writeCache, abortChild, cancel: () => { cancelled = true; } };
  }

  it("prepares jobs, runs chunks, persists and finalizes a successful PRE task", async () => {
    const x = setup();
    const items = [{ bvid: "BVdemo", page: 1, title: "Demo" }];
    const result = await preprocess.runPipeline(items, "Normalize", "model", settings, x.ports);
    expect(result).toBe("=== BVdemo Demo ===\nprocessed");
    expect(items[0]).toMatchObject({ preprocessedText: "processed", preprocessCacheKey: "BVdemo" });
    expect(x.onStart).toHaveBeenCalledOnce();
    expect(x.onComplete).toHaveBeenCalledOnce();
    expect(x.onComplete.mock.calls[0]?.[0]).toMatchObject({
      status: "done", busy: false, cacheHits: 0, totalChunks: 1, completedChunks: 1,
    });
    expect(x.writeCache).toHaveBeenCalledOnce();
    expect(x.writeCache.mock.calls[0]?.[1]).toMatchObject({ model: "model-id", chunkCount: 1 });
  });

  it("keeps cached output without launching workers or rewriting persistent cache", async () => {
    const x = setup();
    x.ports.readCache = async () => ({ value: { text: "cached result" } });
    const items = [{ bvid: "BVcache", page: 1, title: "Cached" }];
    const result = await preprocess.runPipeline(items, "Normalize", "model", settings, x.ports);
    expect(result).toBe("=== BVcache Cached ===\\ncached result".replace("\\n", "\n"));
    expect(x.runChunk).not.toHaveBeenCalled();
    expect(x.writeCache).not.toHaveBeenCalled();
    expect(x.onComplete.mock.calls[0]?.[0]).toMatchObject({
      status: "done", cacheHits: 1, totalChunks: 0, completedChunks: 0,
    });
  });

  it("classifies failed PRE task and cancels child requests without publishing a result", async () => {
    const x = setup();
    x.runChunk.mockRejectedValueOnce(new Error("HTTP 503"));
    await expect(preprocess.runPipeline([{ bvid: "BVdemo" }], "Normalize", "model", settings, x.ports))
      .rejects.toThrow("HTTP 503");
    expect(x.runtime.abort).toBe(true);
    expect(x.onComplete).not.toHaveBeenCalled();
    expect(x.onUpdate.mock.calls.at(-1)?.[0]).toMatchObject({
      status: "error", busy: false, statusText: "失败 · HTTP 503",
    });
    expect(x.writeCache).not.toHaveBeenCalled();
  });

  it("marks a cancelled PRE task as stopped and cleans up child runtime", async () => {
    const x = setup();
    x.runChunk.mockImplementationOnce(async (...args) => {
      const run = args[2];
      run.childRuntimes.add({ abort: false });
      x.cancel();
      throw new Error("stopped");
    });
    await expect(preprocess.runPipeline([{ bvid: "BVdemo" }], "Normalize", "model", settings, x.ports))
      .rejects.toThrow("stopped");
    expect(x.onUpdate.mock.calls.at(-1)?.[0]).toMatchObject({ status: "stopped", statusText: "已停止" });
    expect(x.abortChild).toHaveBeenCalledOnce();
  });
});
