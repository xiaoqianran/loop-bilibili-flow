/** Pagination and merging policies for a resumable Bilibili library scan. */
export interface ScanItem {
  bvid: string;
  page?: number;
  [key: string]: unknown;
}
export interface ScanPage<T extends ScanItem> {
  items: T[];
  meta?: Record<string, unknown>;
  hasMore: boolean;
}
export interface ScanPorts<T extends ScanItem> {
  fetchPage: (page: number, pageSize: number) => Promise<ScanPage<T>>;
  waitIfPaused: () => Promise<unknown>;
  cancelled: () => boolean;
  progress?: (message: string) => void;
  sleep: (ms: number) => Promise<unknown>;
}
export function assertScanActive(cancelled: () => boolean): void {
  if (!cancelled()) return;
  const error = new Error("扫描已取消");
  error.name = "AbortError";
  throw error;
}
export async function collectPages<T extends ScanItem>(
  config: { maxPages: number; pageSize: number; delayMs?: number },
  ports: ScanPorts<T>,
) {
  const all: T[] = [];
  const seen = new Set<string>();
  let page = 1;
  let hasMore = true;
  const meta: Record<string, unknown> = {};
  while (hasMore && page <= config.maxPages) {
    assertScanActive(ports.cancelled);
    await ports.waitIfPaused();
    assertScanActive(ports.cancelled);
    ports.progress?.("拉取列表 " + page + "/" + config.maxPages + "…（已 " + all.length + "）");
    const result = await ports.fetchPage(page, config.pageSize);
    assertScanActive(ports.cancelled);
    Object.assign(meta, result.meta || {});
    for (const item of result.items) {
      const key = item.bvid + "#" + (item.page || 1);
      if (!item.bvid || seen.has(key)) continue;
      seen.add(key);
      all.push(item);
    }
    hasMore = result.hasMore;
    if (!hasMore) break;
    page++;
    if (hasMore && page <= config.maxPages) {
      await ports.sleep(config.delayMs || 300);
      assertScanActive(ports.cancelled);
    }
  }
  return { items: all, meta, pagesFetched: Math.min(page, config.maxPages), truncated: hasMore };
}
const REFRESH_KEYS = [
  "title", "author", "videoTitle", "groupType", "groupKey", "groupFolder",
  "parentFolder", "spaceMid", "collectionName", "collectionMid",
  "collectionSid", "collectionShortUrl",
] as const;
export function mergeScanItems(
  existing: ScanItem[],
  incoming: readonly ScanItem[],
  sourceLabel: string,
  keyOf: (item: ScanItem) => string,
) {
  const byKey = new Map(existing.map(item => [keyOf(item), item]));
  let added = 0;
  let existed = 0;
  for (const raw of incoming) {
    const key = keyOf(raw);
    const previous = byKey.get(key);
    if (previous) {
      existed++;
      const target = previous as Record<string, unknown>;
      for (const field of REFRESH_KEYS) {
        target[field] = raw[field] || previous[field];
      }
      target.aid = raw.aid ?? previous.aid;
      target.part = raw.part ?? previous.part;
      const sources = Array.isArray(previous.sources) ? previous.sources : [];
      target.sources = Array.from(new Set([...sources, sourceLabel].filter(Boolean)));
      continue;
    }
    const next = {
      ...raw,
      selected: true, subStatus: "wait", cue_count: 0,
      data: null, error: "", sources: sourceLabel ? [sourceLabel] : [],
    };
    existing.push(next);
    byKey.set(key, next);
    added++;
  }
  return { added, existed };
}
