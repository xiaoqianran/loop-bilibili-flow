/** Pure preprocessing policy and reading-model functions. */
export interface PreprocessInput {
  preprocessConcurrency?: unknown;
  preprocessTargetMinutes?: unknown;
  preprocessOverlapSeconds?: unknown;
  preprocessMaxChars?: unknown;
  preprocessRetries?: unknown;
}
export interface ProcessedItem {
  bvid: string; page?: number; title?: string; preprocessedText?: string;
}
export type ReadingBlock =
  | { type: "source" | "heading"; text: string }
  | { type: "paragraph"; text: string; topic: string };

export function settings(value: PreprocessInput) {
  return {
    concurrency: Math.min(8, Math.max(1, Number(value.preprocessConcurrency) || 6)),
    targetMinutes: Math.min(30, Math.max(2, Number(value.preprocessTargetMinutes) || 8)),
    overlapSeconds: Math.min(120, Math.max(0, Number(value.preprocessOverlapSeconds) || 0)),
    maxChars: Math.min(60000, Math.max(8000, Number(value.preprocessMaxChars) || 24000)),
    retries: Math.min(4, Math.max(0, Number(value.preprocessRetries) || 0)),
  };
}

export function parseTimestamp(token: unknown) {
  const match = String(token || "").match(/^\[(BV[\w]+)\s+P(\d+)\s+(\d{1,2}:\d{2}(?::\d{2})?)\]$/i);
  if (!match) return null;
  const clock = match[3]!;
  const parts = clock.split(":").map(Number);
  const seconds = parts.length === 3
    ? parts[0]! * 3600 + parts[1]! * 60 + parts[2]!
    : parts[0]! * 60 + parts[1]!;
  return { token: match[0], bvid: match[1]!, page: Number(match[2]) || 1, clock, seconds };
}

export function readingBlocks(text: unknown): ReadingBlock[] {
  const source = String(text || "").replace(/\r\n?/g, "\n").trim();
  if (!source) return [];
  const blocks: ReadingBlock[] = [];
  let paragraph: string[] = [];
  let topic = "";
  const flush = () => {
    const value = paragraph.join("\n").trim();
    paragraph = [];
    if (value) blocks.push({ type: "paragraph", text: value, topic });
  };
  for (const rawLine of source.split("\n")) {
    const line = rawLine.trimEnd();
    const trimmed = line.trim();
    if (!trimmed) { flush(); continue; }
    const sourceMatch = trimmed.match(/^===\s*(.*?)\s*===$/);
    if (sourceMatch) {
      flush();
      blocks.push({ type: "source", text: sourceMatch[1]!.trim() });
      topic = "";
      continue;
    }
    const heading = trimmed.match(/^#{1,4}\s+(.+)$/);
    if (heading) {
      flush();
      topic = heading[1]!.replace(/[*_`]+/g, "").trim();
      blocks.push({ type: "heading", text: topic });
      continue;
    }
    paragraph.push(line);
  }
  flush();
  return blocks;
}

export function buildPayload(items: readonly ProcessedItem[]): string {
  return items.map(it => {
    const head = "=== " + it.bvid + ((it.page || 1) > 1 ? " P" + it.page : "") + " " + (it.title || "") + " ===";
    return head + "\n" + String(it.preprocessedText || "").trim();
  }).join("\n\n");
}


export interface Chunk {
  text: string; chunkStartSec: number; coreStartSec: number; endSec: number;
}
export interface PreprocessJobItem extends ProcessedItem {
  author?: string; data?: unknown; preprocessCacheKey?: string;
}
export interface PreparedRecord<T extends PreprocessJobItem> {
  item: T; raw: string; cacheKey: string; cached: boolean; chunks: Chunk[]; outputs: string[];
}
export interface ChunkJob<T extends PreprocessJobItem> {
  record: PreparedRecord<T>; item: T; raw: string; chunk: Chunk;
  chunkIndex: number; chunkCount: number; itemIndex: number; itemCount: number;
}

export async function prepareJobs<T extends PreprocessJobItem>(
  items: T[],
  ports: {
    getRaw: (item: T) => string;
    cacheKey: (item: T, raw: string) => string;
    readCache: (key: string) => Promise<{ value?: { text?: string } } | null>;
    split: (item: T) => Chunk[];
    forceRefresh: boolean;
  },
): Promise<{ prepared: PreparedRecord<T>[]; jobs: ChunkJob<T>[]; hits: number }> {
  const prepared: PreparedRecord<T>[] = [];
  const jobs: ChunkJob<T>[] = [];
  let hits = 0;
  for (let itemIndex = 0; itemIndex < items.length; itemIndex++) {
    const item = items[itemIndex]!;
    const raw = ports.getRaw(item);
    const cacheKey = ports.cacheKey(item, raw);
    const cached = ports.forceRefresh ? null : await ports.readCache(cacheKey);
    if (cached?.value?.text) {
      item.preprocessedText = String(cached.value.text);
      item.preprocessCacheKey = cacheKey;
      hits++;
      prepared.push({ item, raw, cacheKey, cached: true, chunks: [], outputs: [] });
      continue;
    }
    const chunks = ports.split(item);
    const record: PreparedRecord<T> = {
      item, raw, cacheKey, cached: false, chunks, outputs: new Array<string>(chunks.length),
    };
    prepared.push(record);
    chunks.forEach((chunk, chunkIndex) => jobs.push({
      record, item, raw, chunk, chunkIndex, chunkCount: chunks.length,
      itemIndex, itemCount: items.length,
    }));
  }
  return { prepared, jobs, hits };
}

export async function runChunkWithRetry<T extends PreprocessJobItem, R extends { abort?: boolean }>(
  job: ChunkJob<T>, retries: number, workerId: number,
  ports: {
    isCancelled: () => boolean;
    createRuntime: (label: string) => R;
    register: (runtime: R) => void;
    unregister: (runtime: R) => void;
    abort: (runtime: R) => void;
    formatClock: (seconds: number) => string;
    execute: (runtime: R, variables: Record<string, unknown>, label: string) => Promise<string>;
    onRetry: (label: string) => void;
    sleep: (milliseconds: number) => Promise<unknown>;
  },
): Promise<string> {
  let lastError: unknown = null;
  for (let attempt = 0; attempt <= retries; attempt++) {
    if (ports.isCancelled()) throw new Error("用户停止");
    const runtime = ports.createRuntime("PRE W" + workerId + " " + job.item.bvid + " " + (job.chunkIndex + 1) + "/" + job.chunkCount);
    ports.register(runtime);
    const vars = {
      title: job.item.title || "",
      bvid: (job.item.bvid || "") + ((job.item.page || 1) > 1 ? " P" + job.item.page : ""),
      author: job.item.author || "",
      subtitle: job.chunk.text,
      rawSubtitle: job.raw,
      chunkIndex: job.chunkIndex + 1,
      chunkCount: job.chunkCount,
      chunkStart: ports.formatClock(job.chunk.chunkStartSec),
      coreStart: ports.formatClock(job.chunk.coreStartSec),
      chunkEnd: ports.formatClock(job.chunk.endSec),
    };
    const suffix = attempt ? " · 重试 " + attempt + "/" + retries : "";
    const label = (job.itemIndex + 1) + "/" + job.itemCount + " " + job.item.bvid
      + ((job.item.page || 1) > 1 ? " P" + job.item.page : "")
      + " · 块 " + (job.chunkIndex + 1) + "/" + job.chunkCount + " · W" + workerId + suffix;
    try {
      return await ports.execute(runtime, vars, label);
    } catch (error) {
      lastError = error;
      if (ports.isCancelled() || runtime.abort) throw error;
      if (attempt >= retries) break;
      ports.onRetry(label);
      await ports.sleep(Math.min(2500, 600 * (attempt + 1)));
    } finally {
      ports.unregister(runtime);
      ports.abort(runtime);
    }
  }
  throw lastError || new Error("预处理分块失败");
}
