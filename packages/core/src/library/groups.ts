/**
 * Library list grouping for 视频选集 / 合集 folder UI.
 */

export type LibraryGroupType = "selection" | "collection" | "single";

export interface LibraryGroupItem {
  bvid?: string;
  page?: number | string;
  title?: string;
  author?: string;
  part?: string;
  selected?: boolean;
  groupType?: LibraryGroupType | string;
  groupKey?: string;
  groupFolder?: string;
  videoTitle?: string;
  collectionName?: string;
  collectionMid?: string | number;
  collectionSid?: string | number;
  collectionShortUrl?: string;
  sources?: string[];
  subStatus?: string;
}

export interface LibraryEntry {
  item: LibraryGroupItem;
  index: number;
}

export interface LibraryFolderGroup {
  type: "folder";
  groupKey: string;
  groupType: LibraryGroupType;
  folderLabel: string;
  collapsed: boolean;
  selectedCount: number;
  total: number;
  /** all | none | partial */
  checkState: "all" | "none" | "partial";
  children: LibraryEntry[];
}

export interface LibraryFlatItem {
  type: "item";
  entry: LibraryEntry;
}

export type LibraryRenderNode = LibraryFolderGroup | LibraryFlatItem;

const MULTI_PART_TITLE_RE = /^(.*)\s-\sP(\d+)【([\s\S]*)】\s*$/;

/** "UP名称 标题/合集名"；无 UP 时只保留名称（避免下载落到「未知UP …」）。 */
export function buildUpFolderLabel(
  author: string | null | undefined,
  name: string | null | undefined,
): string {
  const up = String(author || "").trim();
  const n = String(name || "").trim() || "未命名";
  if (!up || up === "未知UP") return n;
  return `${up} ${n}`;
}

/** Short collection address used as stable index key. */
export function buildCollectionShortUrl(
  mid: string | number | null | undefined,
  seasonId: string | number | null | undefined,
): string {
  const m = String(mid || "").trim();
  const s = String(seasonId || "").trim();
  if (!m || !s) return "";
  return `space.bilibili.com/${m}/lists/${s}`;
}

export function inferLibraryGroupType(item: LibraryGroupItem | null | undefined): LibraryGroupType {
  const explicit = String(item?.groupType || "").trim();
  if (explicit === "selection" || explicit === "collection" || explicit === "single") {
    return explicit;
  }
  if (item?.collectionSid || item?.collectionName || item?.collectionShortUrl) {
    return "collection";
  }
  const page = Math.max(1, Number(item?.page) || 1);
  const title = String(item?.title || "");
  if (page > 1 || item?.part || MULTI_PART_TITLE_RE.test(title)) return "selection";
  return "single";
}

export function resolveLibraryGroupKey(item: LibraryGroupItem | null | undefined): string {
  if (item?.groupKey) return String(item.groupKey);
  const kind = inferLibraryGroupType(item);
  if (kind === "collection") {
    const mid = item?.collectionMid;
    const sid = item?.collectionSid;
    if (mid && sid) return `collection:${mid}/${sid}`;
    if (item?.collectionShortUrl) return `collection:${item.collectionShortUrl}`;
  }
  if (kind === "selection") {
    const bvid = String(item?.bvid || "").trim();
    if (bvid) return `selection:${bvid}`;
  }
  const bvid = String(item?.bvid || "unknown").trim();
  const page = Math.max(1, Number(item?.page) || 1);
  return `single:${bvid}:P${page}`;
}

export function resolveLibraryFolderLabel(item: LibraryGroupItem | null | undefined): string {
  const existing = String(item?.groupFolder || "").trim();
  // Keep a real UP-named folder; ignore stale "未知UP …" so download can recompute.
  if (existing && !/^未知UP\b/.test(existing)) return existing;
  const kind = inferLibraryGroupType(item);
  const author = item?.author;
  if (kind === "collection") {
    return buildUpFolderLabel(author, item?.collectionName || "未命名合集");
  }
  if (kind === "selection") {
    const title = String(item?.videoTitle || "").trim()
      || String(item?.title || "").replace(/\s-\sP\d+【[\s\S]*】\s*$/, "").trim()
      || item?.bvid
      || "未命名视频";
    return buildUpFolderLabel(author, title);
  }
  return buildUpFolderLabel(author, item?.title || item?.bvid || "未命名视频");
}

/**
 * Same BV appears more than once (different P) → 视频选集 folder even if
 * groupType metadata was lost (e.g. auto-capture then scan merge).
 */
function bvidMultiPageKeys(entries: LibraryEntry[]): Set<string> {
  const counts = new Map<string, number>();
  for (const entry of entries) {
    const bvid = String(entry.item?.bvid || "").trim();
    if (!bvid) continue;
    counts.set(bvid, (counts.get(bvid) || 0) + 1);
  }
  const multi = new Set<string>();
  for (const [bvid, n] of counts) {
    if (n > 1) multi.add(bvid);
  }
  return multi;
}

/**
 * Shared 合集 identity across different BVs → always folder.
 * Keys: collection:mid/sid | collection:shortUrl | collection:name|author
 */
function collectionIdentityKey(item: LibraryGroupItem | null | undefined): string {
  if (!item) return "";
  if (item.groupKey && String(item.groupKey).startsWith("collection:")) {
    return String(item.groupKey);
  }
  const mid = item.collectionMid;
  const sid = item.collectionSid;
  if (mid && sid) return `collection:${mid}/${sid}`;
  if (item.collectionShortUrl) return `collection:${item.collectionShortUrl}`;
  const name = String(item.collectionName || "").trim();
  if (name) {
    const author = String(item.author || "").trim();
    return `collection:name:${author}|${name}`;
  }
  return "";
}

/** Identities that appear on ≥1 collection-tagged item (even a single video in a 合集). */
function collectionFolderKeys(entries: LibraryEntry[]): Set<string> {
  const keys = new Set<string>();
  for (const entry of entries) {
    const item = entry.item;
    const kind = inferLibraryGroupType(item);
    const id = collectionIdentityKey(item);
    // Explicit collection meta → folder even if only one video is in the library.
    if (id && (kind === "collection" || item?.collectionSid || item?.collectionName || item?.collectionShortUrl)) {
      keys.add(id);
    }
  }
  // Also: 2+ items sharing the same collection identity without explicit groupType.
  const counts = new Map<string, number>();
  for (const entry of entries) {
    const id = collectionIdentityKey(entry.item);
    if (!id) continue;
    counts.set(id, (counts.get(id) || 0) + 1);
  }
  for (const [id, n] of counts) {
    if (n > 1) keys.add(id);
  }
  return keys;
}

function effectiveGroupType(
  item: LibraryGroupItem | null | undefined,
  multiBvids: Set<string>,
  collectionKeys: Set<string>,
): LibraryGroupType {
  const kind = inferLibraryGroupType(item);
  if (kind === "collection") return "collection";
  if (kind === "selection") return "selection";
  const colId = collectionIdentityKey(item);
  if (colId && collectionKeys.has(colId)) return "collection";
  const bvid = String(item?.bvid || "").trim();
  if (bvid && multiBvids.has(bvid)) return "selection";
  return "single";
}

function effectiveGroupKey(
  item: LibraryGroupItem | null | undefined,
  multiBvids: Set<string>,
  collectionKeys: Set<string>,
): string {
  if (item?.groupKey) return String(item.groupKey);
  const kind = effectiveGroupType(item, multiBvids, collectionKeys);
  if (kind === "collection") {
    const id = collectionIdentityKey(item);
    if (id) return id;
  }
  if (kind === "selection") {
    const bvid = String(item?.bvid || "").trim();
    if (bvid) return `selection:${bvid}`;
  }
  return resolveLibraryGroupKey(item);
}

/**
 * Group filtered library entries into folders (selection/collection) + flat singles.
 * Folder order follows first appearance of each groupKey.
 *
 * - 视频选集: multi-P same BV (or groupType=selection)
 * - 合集: groupType/collectionSid/… (even a single captured episode) auto-folders
 */
export function buildLibraryRenderNodes(
  entries: LibraryEntry[],
  collapsedMap: Record<string, boolean> | null | undefined = {},
): LibraryRenderNode[] {
  const collapsed = collapsedMap || {};
  const multiBvids = bvidMultiPageKeys(entries);
  const collectionKeys = collectionFolderKeys(entries);
  const folderBuckets = new Map<string, LibraryEntry[]>();

  for (const entry of entries) {
    const kind = effectiveGroupType(entry.item, multiBvids, collectionKeys);
    if (kind === "single") continue;
    const key = effectiveGroupKey(entry.item, multiBvids, collectionKeys);
    if (!folderBuckets.has(key)) folderBuckets.set(key, []);
    folderBuckets.get(key)!.push(entry);
  }

  const nodes: LibraryRenderNode[] = [];
  const emittedFolders = new Set<string>();

  // Interleave: walk original entries order, emit folder once when first child appears,
  // emit singles in place.
  for (const entry of entries) {
    const kind = effectiveGroupType(entry.item, multiBvids, collectionKeys);
    if (kind === "single") {
      nodes.push({ type: "item", entry });
      continue;
    }
    const key = effectiveGroupKey(entry.item, multiBvids, collectionKeys);
    if (emittedFolders.has(key)) continue;
    emittedFolders.add(key);
    const children = folderBuckets.get(key) || [entry];
    const selectedCount = children.filter((c) => c.item.selected).length;
    const total = children.length;
    let checkState: "all" | "none" | "partial" = "none";
    if (selectedCount === 0) checkState = "none";
    else if (selectedCount === total) checkState = "all";
    else checkState = "partial";
    // Prefer a child that already has a good folder label / author (avoid 未知UP).
    const labeled =
      children.map((c) => c.item).find((it) => it.groupFolder && !/^未知UP\b/.test(String(it.groupFolder)))
      || children.map((c) => c.item).find((it) => String(it.author || "").trim() && it.author !== "未知UP")
      || children[0]?.item;
    nodes.push({
      type: "folder",
      groupKey: key,
      groupType: kind,
      folderLabel: resolveLibraryFolderLabel(labeled),
      collapsed: !!collapsed[key],
      selectedCount,
      total,
      checkState,
      children,
    });
  }

  return nodes;
}

export function setGroupSelection(
  items: LibraryGroupItem[],
  groupKey: string,
  selected: boolean,
): void {
  for (const item of items) {
    if (resolveLibraryGroupKey(item) === groupKey) item.selected = selected;
  }
}
