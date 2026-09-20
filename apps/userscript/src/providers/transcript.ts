import type { ContentRef, TranscriptSegment } from "@subbatch/schemas";
import type { NetworkAdapter } from "@subbatch/runtime";

import type { ResolvedContent } from "./types";

export interface TranscriptAcquireContext {
  network: NetworkAdapter;
  pageRuntime: unknown;
  signal?: AbortSignal;
}

export interface AcquiredTranscript {
  ref: ContentRef;
  segments: TranscriptSegment[];
  language?: string;
  origin?: string;
  metadata: Record<string, unknown>;
}

export interface TranscriptSource {
  id: string;
  acquire(
    resolved: ResolvedContent,
    context: TranscriptAcquireContext,
  ): Promise<AcquiredTranscript | null>;
}

export interface TranscriptSourceRegistry {
  get(source: string): TranscriptSource | null;
  acquire(
    resolved: ResolvedContent,
    context: TranscriptAcquireContext,
  ): Promise<AcquiredTranscript | null>;
}

export function createTranscriptSourceRegistry(
  sources: readonly TranscriptSource[],
): TranscriptSourceRegistry {
  const byId = new Map(sources.map((source) => [source.id, source]));

  return {
    get(source: string): TranscriptSource | null {
      return byId.get(source) ?? null;
    },

    async acquire(
      resolved: ResolvedContent,
      context: TranscriptAcquireContext,
    ): Promise<AcquiredTranscript | null> {
      const source = byId.get(resolved.ref.source);
      return source ? source.acquire(resolved, context) : null;
    },
  };
}
