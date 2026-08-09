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

/** "UP名称 标题/合集名" */
export function buildUpFolderLabel(
  author: string | null | undefined,
  name: string | null | undefined,
): string {
  const up = String(author || "").trim() || "未知UP";
  const n = String(name || "").trim() || "未命名";
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
  if (item?.groupFolder) return String(item.groupFolder).trim();
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
 * Group filtered library entries into folders (selection/collection) + flat singles.
 * Folder order follows first appearance of each groupKey.
 */
export function buildLibraryRenderNodes(
  entries: LibraryEntry[],
  collapsedMap: Record<string, boolean> | null | undefined = {},
): LibraryRenderNode[] {
  const collapsed = collapsedMap || {};
  const folderBuckets = new Map<string, LibraryEntry[]>();
  const order: string[] = [];
  const singles: LibraryEntry[] = [];

  for (const entry of entries) {
    const kind = inferLibraryGroupType(entry.item);
    if (kind === "single") {
      singles.push(entry);
      continue;
    }
    const key = resolveLibraryGroupKey(entry.item);
    if (!folderBuckets.has(key)) {
      folderBuckets.set(key, []);
      order.push(key);
    }
    folderBuckets.get(key)!.push(entry);
  }

  const nodes: LibraryRenderNode[] = [];
  const emittedSingles = new Set<number>();

  // Interleave: walk original entries order, emit folder once when first child appears,
  // emit singles in place.
  const emittedFolders = new Set<string>();
  for (const entry of entries) {
    const kind = inferLibraryGroupType(entry.item);
    if (kind === "single") {
      if (!emittedSingles.has(entry.index)) {
        nodes.push({ type: "item", entry });
        emittedSingles.add(entry.index);
      }
      continue;
    }
    const key = resolveLibraryGroupKey(entry.item);
    if (emittedFolders.has(key)) continue;
    emittedFolders.add(key);
    const children = folderBuckets.get(key) || [entry];
    const selectedCount = children.filter((c) => c.item.selected).length;
    const total = children.length;
    let checkState: "all" | "none" | "partial" = "none";
    if (selectedCount === 0) checkState = "none";
    else if (selectedCount === total) checkState = "all";
    else checkState = "partial";
    const first = children[0]?.item;
    nodes.push({
      type: "folder",
      groupKey: key,
      groupType: kind,
      folderLabel: resolveLibraryFolderLabel(first),
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
