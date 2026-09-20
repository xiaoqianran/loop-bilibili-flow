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

export const acquireCurrentTranscript = acquire;
