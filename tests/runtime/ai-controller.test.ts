import { describe, expect, it, vi } from "vitest";
import { request, runPool } from "../../apps/userscript/src/app/ai-controller";
import type { NetworkAdapter, NetworkRequest, NetworkResponse } from "@subbatch/runtime";

const endpoint = "https://models.example/v1/chat/completions";

function createRuntime() {
  return { abort: false, abortController: null as AbortController | null, xhr: null };
}

function runWithResponse(
  handler: (req: NetworkRequest, runtime: ReturnType<typeof createRuntime>) => Promise<NetworkResponse>,
  extra: Record<string, unknown> = {},
) {
  const runtime = createRuntime();
  const requestMock = vi.fn(async (_url: string, req?: NetworkRequest) => handler(req || {}, runtime));
  const network = { request: requestMock } as unknown as NetworkAdapter;
  let done!: (result: string) => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<string>((resolve, failure) => { done = resolve; reject = failure; });
  const onDelta = vi.fn();
  request({
    runtime,
    network,
    pageHref: "https://www.bilibili.com/video/BV1TEST",
    baseUrl: "https://models.example/v1",
    apiKey: "test-key",
    model: "model-a",
    messages: [{ role: "user", content: "你好" }],
    onDone: done,
    onError: reject,
    onDelta,
    ...extra,
  });
  return { promise, onDelta, requestMock, runtime };
}

describe("application AI controller", () => {
  it("streams SSE across split lines using one privileged POST", async () => {
    const { promise, onDelta, requestMock } = runWithResponse(async (req) => {
      expect(req.method).toBe("POST");
      expect(req.transport).toBe("privileged");
      expect(req.fallback).toBe("never");
      req.onChunk?.('data: {"choices":[{"delta":{"content":"你');
      req.onChunk?.('好"}}]}\n\ndata: {"choices":[{"delta":{"content":"世界"},"finish_reason":"stop"}]}\n\ndata: [DONE]\n\n');
      return { ok: true, status: 200, headers: {}, text: "" };
    });
    await expect(promise).resolves.toBe("你好世界");
    expect(onDelta).toHaveBeenCalled();
    expect(requestMock).toHaveBeenCalledTimes(1);
    expect(requestMock.mock.calls[0]?.[0]).toBe(endpoint);
  });

  it("accepts regular JSON responses and preserves non-stream calls", async () => {
    const { promise, requestMock } = runWithResponse(
      async () => ({ status: 200, ok: true, headers: {}, text: '{"choices":[{"message":{"content":"完成"},"finish_reason":"stop"}]}' }),
      { stream: false },
    );
    await expect(promise).resolves.toBe("完成");
    expect(requestMock.mock.calls[0]?.[1]?.stream).toBe(false);
  });

  it("does not silently succeed on a truncated SSE stream", async () => {
    const { promise, requestMock } = runWithResponse(async (req) => {
      req.onChunk?.('data: {"choices":[{"delta":{"content":"部分"}}]}\n\n');
      return { ok: true, status: 200, headers: {}, text: "" };
    });
    await expect(promise).rejects.toThrow(/之前中断/);
    expect(requestMock).toHaveBeenCalledTimes(1);
  });

  it("propagates HTTP failures without resending a POST", async () => {
    const { promise, requestMock } = runWithResponse(async () => ({
      status: 429, ok: false, text: "rate limit", headers: {},
    }));
    await expect(promise).rejects.toThrow(/HTTP 429/);
    expect(requestMock).toHaveBeenCalledTimes(1);
  });

  it("cancels a request and preserves partial streamed output", async () => {
    const { promise, runtime } = runWithResponse(async (req, currentRuntime) => {
      req.onChunk?.('data: {"choices":[{"delta":{"content":"保留片段"}}]}\n');
      currentRuntime.abort = true;
      currentRuntime.abortController?.abort();
      throw new DOMException("Aborted", "AbortError");
    });
    await expect(promise).resolves.toBe("保留片段");
    expect(runtime.abortController).toBeNull();
  });

  it("keeps failed workers from claiming more jobs", async () => {
    const seen: number[] = [];
    await expect(runPool([1, 2, 3, 4], 2, async (job) => {
      seen.push(job);
      if (job === 2) throw new Error("broken");
      await Promise.resolve();
    })).rejects.toThrow("broken");
    expect(seen).not.toContain(4);
  });

  it("detects cancellation before new work", async () => {
    await expect(runPool([1, 2], 1, async () => undefined, () => true))
      .rejects.toThrow("用户停止");
  });
});

it("waits for in-flight workers before exposing pool failure", async () => {
  let release!: () => void;
  let finished = false;
  let settled = false;
  const pending = runPool([1, 2, 3], 2, async job => {
    if (job === 1) throw new Error("failed");
    await new Promise<void>(resolve => { release = resolve; });
    finished = true;
  });
  void pending.catch(() => { settled = true; });
  await Promise.resolve();
  expect(settled).toBe(false);
  release();
  await expect(pending).rejects.toThrow("failed");
  expect(finished).toBe(true);
});
