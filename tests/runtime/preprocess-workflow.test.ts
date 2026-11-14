
import { describe, expect, it, vi } from "vitest";
import { preprocess } from "../../apps/userscript/src/app";

const chunk = { text: "piece", chunkStartSec: 1, coreStartSec: 2, endSec: 3 };

describe("PRE workflow migration", () => {
  it("splits only uncached items, retains ordered job metadata and cached content", async () => {
    const items: Array<{ bvid: string; page: number; preprocessedText?: string }> = [{ bvid: "BVcached", page: 1 }, { bvid: "BVnew", page: 2 }];
    const readCache = vi.fn(async (key: string) => key === "BVcached"
      ? { value: { text: "prior result" } } : null);
    const split = vi.fn(() => [chunk, { ...chunk, text: "second" }]);
    const result = await preprocess.prepareJobs(items, {
      getRaw: item => item.bvid,
      cacheKey: item => item.bvid,
      readCache,
      split,
      forceRefresh: false,
    });
    expect(result.hits).toBe(1);
    expect(result.prepared[0]?.cached).toBe(true);
    expect(result.prepared[0]?.item.preprocessedText).toBe("prior result");
    expect(result.jobs.map(job => [job.itemIndex, job.chunkIndex, job.chunkCount])).toEqual([
      [1, 0, 2], [1, 1, 2],
    ]);
    expect(split).toHaveBeenCalledTimes(1);
  });

  it("forces a fresh split without accessing existing cache", async () => {
    const readCache = vi.fn(async () => ({ value: { text: "old" } }));
    const result = await preprocess.prepareJobs([{ bvid: "BVnew" }], {
      getRaw: () => "raw", cacheKey: () => "key",
      readCache, split: () => [chunk], forceRefresh: true,
    });
    expect(result.hits).toBe(0);
    expect(result.jobs).toHaveLength(1);
    expect(readCache).not.toHaveBeenCalled();
  });

  function createPorts() {
    const registered = new Set<{ abort: boolean }>();
    const abort = vi.fn((runtime: { abort: boolean }) => { runtime.abort = true; });
    const execute = vi.fn(async (...args: [{ abort: boolean }, Record<string, unknown>, string]) => { void args; return "ok"; });
    const sleep = vi.fn(async (...args: [number]) => { void args; });
    const onRetry = vi.fn();
    return {
      registered, abort, execute, sleep, onRetry,
      ports: {
        isCancelled: () => false,
        createRuntime: () => ({ abort: false }),
        register: (runtime: { abort: boolean }) => { registered.add(runtime); },
        unregister: (runtime: { abort: boolean }) => { registered.delete(runtime); },
        abort,
        formatClock: (seconds: number) => "s" + seconds,
        execute, onRetry, sleep,
      },
    };
  }
  const job = {
    record: { item: { bvid: "BVone", page: 2, author: "up", title: "title" }, raw: "raw", cacheKey: "key", cached: false, chunks: [chunk], outputs: [] },
    item: { bvid: "BVone", page: 2, author: "up", title: "title" },
    raw: "raw", chunk, chunkIndex: 0, chunkCount: 1, itemIndex: 0, itemCount: 1,
  };

  it("retries failed PRE chunks with the same exact variable contract and cleans up", async () => {
    const { ports, execute, sleep, abort, registered, onRetry } = createPorts();
    execute.mockRejectedValueOnce(new Error("network"));
    await expect(preprocess.runChunkWithRetry(job, 2, 3, ports)).resolves.toBe("ok");
    expect(execute).toHaveBeenCalledTimes(2);
    expect(execute.mock.calls[0]?.[1]).toMatchObject({
      bvid: "BVone P2", chunkIndex: 1, chunkCount: 1, chunkStart: "s1", coreStart: "s2", chunkEnd: "s3",
    });
    expect(execute.mock.calls[1]?.[2]).toContain("重试 1/2");
    expect(sleep).toHaveBeenCalledWith(600);
    expect(onRetry).toHaveBeenCalledOnce();
    expect(abort).toHaveBeenCalledTimes(2);
    expect(registered.size).toBe(0);
  });

  it("does not retry cancellations, and always releases child requests", async () => {
    const { ports, execute, sleep, registered, abort } = createPorts();
    execute.mockRejectedValueOnce(new Error("cancelled"));
    const cancelledPorts = { ...ports, isCancelled: () => true };
    await expect(preprocess.runChunkWithRetry(job, 3, 1, cancelledPorts)).rejects.toThrow("用户停止");
    expect(execute).not.toHaveBeenCalled();

    execute.mockReset();
    let cancel = false;
    const afterRequestPorts = { ...ports, isCancelled: () => cancel };
    execute.mockImplementationOnce(async () => { cancel = true; throw new Error("stopped"); });
    await expect(preprocess.runChunkWithRetry(job, 3, 1, afterRequestPorts)).rejects.toThrow("stopped");
    expect(sleep).not.toHaveBeenCalled();
    expect(abort).toHaveBeenCalledOnce();
    expect(registered.size).toBe(0);
  });
});
