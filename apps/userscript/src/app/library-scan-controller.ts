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


export interface CollectionPart {
  page?: number;
  part?: string;
}
export interface CollectionArchive extends ScanItem {
  aid?: number;
  title?: string;
  author?: string;
  pages?: CollectionPart[];
  part?: string;
}
export interface CollectionVideoView {
  aid?: number;
  title?: string;
  owner?: { name?: string };
  pages?: CollectionPart[];
}
export interface CollectionExpandPorts {
  cancelled: () => boolean;
  waitIfPaused: () => Promise<unknown>;
  extractBvid: (raw: string) => string;
  progress: (index: number, total: number, bvid: string) => void;
  fetchView: (bvid: string) => Promise<CollectionVideoView>;
  onFailure: (bvid: string, error: unknown) => void;
  sleep: (ms: number) => Promise<unknown>;
}
/** Expand collection archives into distinct (BV, page) entries; browser effects are ports. */
export async function expandCollectionParts(
  archives: readonly CollectionArchive[] | null | undefined,
  config: { delayMs?: number },
  ports: CollectionExpandPorts,
): Promise<CollectionArchive[]> {
  const list = Array.isArray(archives) ? archives : [];
  const out: CollectionArchive[] = [];
  const seen = new Set<string>();
  const normalizeBvid = (raw: string) => ports.extractBvid(raw) || String(raw || "").trim();
  const pushItem = (item: CollectionArchive) => {
    const bvid = normalizeBvid(item.bvid);
    if (!bvid) return;
    const page = Math.max(1, Number(item.page) || 1);
    const key = bvid + "#" + page;
    if (seen.has(key)) return;
    seen.add(key);
    out.push({ ...item, bvid, page });
  };
  const delayMs = config.delayMs === undefined ? 160 : config.delayMs;

  for (let i = 0; i < list.length; i++) {
    assertScanActive(ports.cancelled);
    await ports.waitIfPaused();
    assertScanActive(ports.cancelled);
    const item = list[i]!;
    const bvid = normalizeBvid(item.bvid);
    if (!bvid) continue;
    ports.progress(i + 1, list.length, bvid);

    let pages: CollectionPart[] | null = Array.isArray(item.pages) && item.pages.length ? item.pages : null;
    let title = String(item.title || "").trim();
    let author = String(item.author || "").trim();
    let aid = item.aid;
    if (!pages || pages.length <= 1) {
      try {
        const view = await ports.fetchView(bvid);
        pages = Array.isArray(view.pages) ? view.pages : [];
        title = String(view.title || title || bvid).trim();
        author = String(view.owner?.name || author).trim();
        aid = view.aid || aid;
      } catch (error) {
        if ((error as { name?: string })?.name === "AbortError") throw error;
        ports.onFailure(bvid, error);
        pushItem({ ...item, bvid, title, author, aid, page: Math.max(1, Number(item.page) || 1) });
        continue;
      }
    }
    if (!pages.length || pages.length <= 1) {
      pushItem({ ...item, bvid, aid, title: title || item.title || bvid, author, page: 1, pages: pages || [] });
    } else {
      for (let p = 0; p < pages.length; p++) {
        const part = pages[p] || {};
        const pageNo = Math.max(1, Number(part.page) || p + 1);
        const partName = String(part.part || "").trim();
        pushItem({
          ...item, bvid, aid,
          title: (title || bvid) + " - P" + pageNo + (partName ? "【" + partName + "】" : ""),
          author, page: pageNo, part: partName, pages,
        });
      }
    }
    if (delayMs && i < list.length - 1) {
      await ports.sleep(delayMs);
      assertScanActive(ports.cancelled);
    }
  }
  return out;
}


export interface SeasonEntry {
  meta?: { season_id?: string | number; mid?: string | number; name?: string; title?: string; total?: number };
  archives?: Array<{ bvid?: string }>;
}
export function seasonMemberPlan(entry: SeasonEntry | null | undefined, fallbackMid: string) {
  const meta = entry?.meta || {};
  const sid = meta.season_id;
  if (sid == null || sid === "") return null;
  const bvids = (entry?.archives || []).map(archive => archive?.bvid).filter((bvid): bvid is string => !!bvid);
  const total = Number(meta.total) || bvids.length;
  return {
    mid: String(meta.mid || fallbackMid),
    season_id: String(sid),
    name: String(meta.name || meta.title || "未命名合集").trim() || "未命名合集",
    bvids,
    missingMembers: total > bvids.length,
    total,
  };
}
/** Keep the larger list only, matching the legacy season member completion policy. */
export function chooseSeasonMembers(recent: string[], loaded: string[]): string[] {
  return loaded.length > recent.length ? loaded : recent;
}


export interface UserSeasonPage {
  code: number;
  message?: string;
  data?: {
    items_lists?: {
      seasons_list?: SeasonEntry[];
      series_list?: unknown[];
      page?: { total?: number | string | null };
    };
  };
}
export interface UserSeason {
  mid: string;
  season_id: string;
  name: string;
  bvids: string[];
  shortUrl: string;
}
export interface UserSeasonPorts {
  fetchPage: (mid: string, page: number, pageSize: number) => Promise<UserSeasonPage>;
  loadMembers: (
    mid: string, seasonId: string, maxPages: number, delayMs: number,
    onProgress: (message: string) => void,
  ) => Promise<string[]>;
  shortUrl: (mid: string, seasonId: string) => string;
  progress?: (message: string) => void;
  cancelled: () => boolean;
  sleep: (ms: number) => Promise<unknown>;
  warn: (seasonId: string, error: unknown) => void;
}
/** Personal-space season list pagination. IO remains in the caller-provided ports. */
export async function collectUserSeasons(
  midValue: unknown,
  config: { maxPages?: number; pageSize?: number; delayMs?: number; maxSeasonArchivePages?: number },
  ports: UserSeasonPorts,
): Promise<UserSeason[]> {
  const mid = String(midValue || "").trim();
  if (!mid) return [];
  const maxPages = config.maxPages ?? 30;
  const pageSize = config.pageSize ?? 20;
  const delayMs = config.delayMs ?? 280;
  const maxSeasonArchivePages = config.maxSeasonArchivePages ?? 40;
  const seasons: UserSeason[] = [];
  let page = 1;
  let hasMore = true;

  while (hasMore && page <= maxPages) {
    assertScanActive(ports.cancelled);
    ports.progress?.("拉取合集列表 " + page + "/" + maxPages + "…（已 " + seasons.length + " 个）");
    const result = await ports.fetchPage(mid, page, pageSize);
    assertScanActive(ports.cancelled);
    if (result.code !== 0) {
      throw new Error(result.message || "seasons_series_list code=" + result.code);
    }
    const lists = result.data?.items_lists || {};
    const entries = lists.seasons_list || [];
    const pageInfo = lists.page || {};

    for (const entry of entries) {
      const plan = seasonMemberPlan(entry, mid);
      if (!plan) continue;
      let bvids = plan.bvids;
      if (plan.missingMembers) {
        ports.progress?.("补全合集「" + plan.name + "」成员 " + bvids.length + "/" + plan.total + "…");
        try {
          const loaded = await ports.loadMembers(
            mid, plan.season_id, maxSeasonArchivePages, delayMs,
            message => ports.progress?.("合集 " + (entry?.meta?.name || plan.season_id) + " · " + message),
          );
          bvids = chooseSeasonMembers(bvids, loaded);
        } catch (error) {
          if ((error as { name?: string })?.name === "AbortError") throw error;
          ports.warn(plan.season_id, error);
        }
      }
      seasons.push({
        mid: plan.mid,
        season_id: plan.season_id,
        name: plan.name,
        bvids,
        shortUrl: ports.shortUrl(String(entry?.meta?.mid || mid), plan.season_id),
      });
    }

    const totalHint = pageInfo.total != null ? Number(pageInfo.total) : null;
    if (totalHint != null && Number.isFinite(totalHint) && totalHint > 0) {
      // API total counts seasons and series entries, not page count.
      hasMore = page * pageSize < totalHint;
    } else {
      hasMore = entries.length >= pageSize || (lists.series_list || []).length >= pageSize;
    }
    if (!hasMore) break;
    page++;
    if (page <= maxPages) {
      await ports.sleep(delayMs || 280);
      assertScanActive(ports.cancelled);
    }
  }
  return seasons;
}
