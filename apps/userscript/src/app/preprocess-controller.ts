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


export interface PipelineSettings {
  concurrency: number; retries: number; targetMinutes: number; overlapSeconds: number; maxChars: number;
}
export interface PipelineRun<R> {
  runtime: R; childRuntimes: Set<R>; raw: string; text?: string; preview: string;
  status: "running" | "done" | "error" | "stopped";
  statusText: string; busy: boolean; modelName: string; promptName: string;
  cacheHits: number; total: number; totalChunks: number; completedChunks: number;
  settings: PipelineSettings;
}
export interface PipelinePorts<T extends PreprocessJobItem, R extends { abort?: boolean }> {
  createRuntime: () => R;
  onStart: (run: PipelineRun<R>) => void;
  onUpdate: (run: PipelineRun<R>) => void;
  onComplete: (run: PipelineRun<R>) => void;
  isCancelled: (run: PipelineRun<R>) => boolean;
  abortChild: (runtime: R) => void;
  getRaw: (item: T) => string;
  cacheKey: (item: T, raw: string) => string;
  readCache: (key: string) => Promise<{ value?: { text?: string } } | null>;
  split: (item: T) => Chunk[];
  forceRefresh: boolean;
  cacheModel: string;
  runPool: (
    jobs: readonly ChunkJob<T>[], concurrency: number,
    handler: (job: ChunkJob<T>, workerId: number) => Promise<void>,
    cancelled: () => boolean,
  ) => Promise<void>;
  runChunk: (job: ChunkJob<T>, workerId: number, run: PipelineRun<R>) => Promise<string>;
  stitch: (chunks: Chunk[], outputs: string[]) => string;
  writeCache: (key: string, value: {
    text: string; bvid: string; page: number; model: string;
    chunkSettings: PipelineSettings; chunkCount: number;
  }) => Promise<unknown>;
}
/** Owns PRE execution lifecycle. UI, storage and network remain injected runtime ports. */
export async function runPipeline<T extends PreprocessJobItem, R extends { abort?: boolean }>(
  items: T[], promptName: string, modelName: string,
  settings: PipelineSettings, ports: PipelinePorts<T, R>,
): Promise<string> {
  const runtime = ports.createRuntime();
  const run: PipelineRun<R> = {
    runtime, childRuntimes: new Set<R>(), raw: "", preview: "",
    status: "running", statusText: "准备智能切块", busy: true,
    modelName, promptName, cacheHits: 0, total: items.length,
    totalChunks: 0, completedChunks: 0, settings: { ...settings },
  };
  ports.onStart(run);
  try {
    const { prepared, jobs, hits } = await prepareJobs(items, {
      getRaw: ports.getRaw, cacheKey: ports.cacheKey,
      readCache: ports.readCache, split: ports.split,
      forceRefresh: ports.forceRefresh,
    });
    run.cacheHits = hits;
    run.totalChunks = jobs.length;
    run.statusText = jobs.length
      ? "智能切块完成 · " + jobs.length + " 块 · 并发 " + settings.concurrency
      : "全部命中缓存 · " + hits + "/" + items.length;
    ports.onUpdate(run);
    if (jobs.length) {
      await ports.runPool(jobs, settings.concurrency, async (job, workerId) => {
        const text = await ports.runChunk(job, workerId, run);
        job.record.outputs[job.chunkIndex] = text;
        run.completedChunks += 1;
        run.preview = "";
        run.statusText = "分块 " + run.completedChunks + "/" + run.totalChunks
          + " · 并发 " + settings.concurrency;
        ports.onUpdate(run);
      }, () => ports.isCancelled(run));
    }
    for (const record of prepared) {
      if (record.cached) continue;
      const text = ports.stitch(record.chunks, record.outputs);
      record.item.preprocessedText = text;
      record.item.preprocessCacheKey = record.cacheKey;
      void ports.writeCache(record.cacheKey, {
        text, bvid: record.item.bvid, page: record.item.page || 1,
        model: ports.cacheModel, chunkSettings: settings, chunkCount: record.chunks.length,
      }).catch(() => {});
    }
    run.raw = buildPayload(items);
    run.text = run.raw;
    run.cacheHits = hits;
    run.status = "done";
    run.statusText = "完成 · " + items.length + " 个视频 · " + jobs.length
      + " 个新分块 · 缓存 " + hits + " · 并发 " + settings.concurrency;
    run.busy = false;
    ports.onUpdate(run);
    ports.onComplete(run);
    return run.raw;
  } catch (error) {
    const stopped = ports.isCancelled(run);
    runtime.abort = true;
    for (const child of run.childRuntimes) ports.abortChild(child);
    run.status = stopped ? "stopped" : "error";
    run.statusText = stopped ? "已停止" : "失败 · " + String(
      error instanceof Error ? error.message : error,
    ).slice(0, 80);
    run.busy = false;
    ports.onUpdate(run);
    throw error;
  }
}
