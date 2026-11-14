import { describe, expect, it } from "vitest";
import { createTranscriptSourceRegistry } from "../../apps/userscript/src/providers/transcript";
import type { ResolvedContent } from "../../apps/userscript/src/providers/types";
import type { NetworkAdapter } from "@subbatch/runtime";

const resolved: ResolvedContent = {
  ref: { source: "example", sourceId: "id" },
  key: "example:id",
  native: {},
};
const context = { network: {} as NetworkAdapter, pageRuntime: {} };

describe("structured transcript acquisition results", () => {
  it("returns a distinguishable unsupported-platform result", async () => {
    const registry = createTranscriptSourceRegistry([]);
    await expect(registry.acquireDetailed(resolved, context)).resolves.toEqual({
      status: "unavailable", code: "unsupported", retryable: false,
    });
    await expect(registry.acquire(resolved, context)).resolves.toBeNull();
  });

  it("retains the legacy null result when no subtitle exists", async () => {
    const registry = createTranscriptSourceRegistry([{
      id: "example", acquire: async () => null,
    }]);
    await expect(registry.acquireDetailed(resolved, context)).resolves.toEqual({
      status: "unavailable", code: "no_transcript", retryable: false,
    });
    await expect(registry.acquire(resolved, context)).resolves.toBeNull();
  });

  it("classifies 429 as retryable while preserving the original error for old callers", async () => {
    const error = new Error("HTTP 429: Too Many Requests");
    const registry = createTranscriptSourceRegistry([{
      id: "example", acquire: async () => { throw error; },
    }]);
    await expect(registry.acquireDetailed(resolved, context)).resolves.toMatchObject({
      status: "error", code: "rate_limited", retryable: true, cause: error,
    });
    await expect(registry.acquire(resolved, context)).rejects.toBe(error);
  });

  it("does not retry unauthorized requests or cancelled jobs", async () => {
    let current: unknown = new Error("HTTP 403");
    const registry = createTranscriptSourceRegistry([{
      id: "example", acquire: async () => { throw current; },
    }]);
    await expect(registry.acquireDetailed(resolved, context)).resolves.toMatchObject({
      status: "error", code: "unauthorized", retryable: false,
    });
    current = new DOMException("Aborted", "AbortError");
    await expect(registry.acquireDetailed(resolved, context)).resolves.toMatchObject({
      status: "error", code: "aborted", retryable: false,
    });
  });
});
