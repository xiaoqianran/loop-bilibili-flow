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
  acquireDetailed(
    resolved: ResolvedContent,
    context: TranscriptAcquireContext,
  ): Promise<TranscriptAcquireResult>;
  acquire(
    resolved: ResolvedContent,
    context: TranscriptAcquireContext,
  ): Promise<AcquiredTranscript | null>;
}

export type TranscriptAcquireResult =
  | { status: "ok"; transcript: AcquiredTranscript }
  | { status: "unavailable"; code: "unsupported" | "no_transcript"; retryable: false }
  | {
      status: "error";
      code: "aborted" | "rate_limited" | "unauthorized" | "network" | "unknown";
      message: string;
      retryable: boolean;
      cause: unknown;
    };

function classifyAcquisitionError(error: unknown): Extract<TranscriptAcquireResult, { status: "error" }> {
  const message = error instanceof Error ? error.message : String(error);
  const status = Number((error as { status?: number } | null)?.status);
  const aborted = (error as { name?: string } | null)?.name === "AbortError";
  const rateLimited = status === 429 || /(?:HTTP\s*(?:429|412)|rate.limit|too many requests)/i.test(message);
  const unauthorized = status === 401 || status === 403 || /HTTP\s*(?:401|403)/i.test(message);
  const network = /(?:network|failed to fetch|load failed|timeout|http\s*5\d\d)/i.test(message);
  const code = aborted ? "aborted"
    : rateLimited ? "rate_limited"
      : unauthorized ? "unauthorized"
        : network ? "network" : "unknown";
  return {
    status: "error",
    code,
    message,
    retryable: rateLimited || network,
    cause: error,
  };
}

export function createTranscriptSourceRegistry(
  sources: readonly TranscriptSource[],
): TranscriptSourceRegistry {
  const byId = new Map(sources.map((source) => [source.id, source]));

  return {
    get(source: string): TranscriptSource | null {
      return byId.get(source) ?? null;
    },

    async acquireDetailed(
      resolved: ResolvedContent,
      context: TranscriptAcquireContext,
    ): Promise<TranscriptAcquireResult> {
      const source = byId.get(resolved.ref.source);
      if (!source) return { status: "unavailable", code: "unsupported", retryable: false };
      try {
        const transcript = await source.acquire(resolved, context);
        return transcript
          ? { status: "ok", transcript }
          : { status: "unavailable", code: "no_transcript", retryable: false };
      } catch (error) {
        return classifyAcquisitionError(error);
      }
    },
    async acquire(
      resolved: ResolvedContent,
      context: TranscriptAcquireContext,
    ): Promise<AcquiredTranscript | null> {
      const result = await this.acquireDetailed(resolved, context);
      if (result.status === "error") throw result.cause;
      return result.status === "ok" ? result.transcript : null;
    },
  };
}
