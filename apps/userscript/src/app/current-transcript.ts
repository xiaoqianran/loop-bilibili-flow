import type { NetworkAdapter } from "@subbatch/runtime";

import {
  providerRegistry,
  transcriptSourceRegistry,
  type AcquiredTranscript,
} from "../providers";

export async function acquire(
  href: string,
  pageRuntime: unknown,
  network: NetworkAdapter,
  signal?: AbortSignal,
): Promise<AcquiredTranscript | null> {
  const resolved = providerRegistry.resolveCurrent({ href, pageRuntime });
  if (!resolved) return null;
  return transcriptSourceRegistry.acquire(resolved, {
    network,
    pageRuntime,
    ...(signal ? { signal } : {}),
  });
}

export async function acquireDetailed(
  href: string,
  pageRuntime: unknown,
  network: NetworkAdapter,
  signal?: AbortSignal,
) {
  const resolved = providerRegistry.resolveCurrent({ href, pageRuntime });
  if (!resolved) return { status: "unavailable" as const, code: "unsupported" as const, retryable: false as const };
  return transcriptSourceRegistry.acquireDetailed(resolved, {
    network,
    pageRuntime,
    ...(signal ? { signal } : {}),
  });
}

export const acquireCurrentTranscript = acquire;
