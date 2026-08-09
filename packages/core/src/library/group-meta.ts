/**
 * Library group metadata attachers — single source of truth for
 * 视频选集 / 合集 / 个人主页 folder fields on library items.
 *
 * Product (loop-bilibili) must call these instead of re-implementing.
 */

import {
  SPACE_LOOSE_VIDEOS_FOLDER,
  buildCollectionShortUrl,
  buildUpFolderLabel,
  inferLibraryGroupType,
  resolveLibraryFolderLabel,
  resolveSpaceLooseVideosKey,
  type LibraryGroupItem,
} from "./groups";

const MULTI_PART_TITLE_RE = /^(.*)\s-\sP(\d+)【([\s\S]*)】\s*$/;

function cleanUpName(author: string | null | undefined): string {
  const up = String(author || "").trim();
  if (!up || up === "未知UP") return "";
  return up;
}

/** Pick parentFolder already stamped on items (个人主页 nesting). */
function inheritParentFolder(
  items: LibraryGroupItem[],
  explicit?: string | null,
): string {
  const fromMeta = cleanUpName(explicit);
  if (fromMeta) return fromMeta;
  for (const it of items) {
    const p = cleanUpName(it?.parentFolder);
    if (p) return p;
  }
  return "";
}

export interface SelectionGroupMeta {
  author?: string;
  title?: string;
  /** Keep 个人主页 nesting when expanding multi-P under a space scan. */
  parentFolder?: string;
}

export interface CollectionGroupMeta {
  mid?: string | number;
  season_id?: string | number;
  name?: string;
  title?: string;
  author?: string;
  parentFolder?: string;
}

export interface CollectionGroupContext {
  mid?: string | number;
  season_id?: string | number;
  collectionTitleHint?: string;
  authorHint?: string;
  parentFolder?: string;
}

export interface UserSpaceGroupMeta {
  author?: string;
  mid?: string | number;
}

/** Minimal view shape for ugc_season stamping (Bilibili view/detail). */
export interface UgcSeasonViewLike {
  ugc_season?: {
    id?: string | number;
    mid?: string | number;
    title?: string;
  } | null;
  owner?: {
    mid?: string | number;
    name?: string;
  } | null;
}

function resolveSeriesTitleLocal(item: LibraryGroupItem | null | undefined): string {
  if (item?.videoTitle) return String(item.videoTitle).trim();
  const title = String(item?.title || "").trim();
  const multi = title.match(MULTI_PART_TITLE_RE);
  if (multi?.[1]?.trim()) return multi[1].trim();
  const cut = title.search(/\s-\sP\d+【/);
  if (cut > 0) return title.slice(0, cut).trim();
  if (title) return title;
  return String(item?.bvid || "untitled").trim() || "untitled";
}

/**
 * Stamp 个人主页 nesting: top-level folder = UP name.
 * Singles sit under UP/视频 after attachSpaceLooseVideosMeta;
 * 合集/选集 nest one level deeper under UP.
 */
export function attachUserSpaceGroupMeta<T extends LibraryGroupItem>(
  items: T[] | null | undefined,
  meta: UserSpaceGroupMeta = {},
): T[] {
  const list = items || [];
  const author =
    cleanUpName(meta.author)
    || cleanUpName(list.find((it) => cleanUpName(it?.author))?.author)
    || "";
  const mid = String(meta.mid || "").trim();
  if (!author && !mid) return list.map((it) => ({ ...it }));
  const parentFolder = author || String(list[0]?.parentFolder || "").trim();
  return list.map((it) => {
    const itemAuthor = cleanUpName(it.author) || author;
    return {
      ...it,
      author: itemAuthor || it.author,
      parentFolder: parentFolder || it.parentFolder,
      spaceMid: mid || it.spaceMid,
    };
  });
}

/**
 * 个人主页散视频 → 统一归入「视频」文件夹（UP/视频/…）。
 * 跳过已是合集/选集的条目。应在 applySpaceCollectionMembership 之后调用。
 */
export function attachSpaceLooseVideosMeta<T extends LibraryGroupItem>(
  items: T[] | null | undefined,
): T[] {
  const list = items || [];
  return list.map((it) => {
    const parent = cleanUpName(it.parentFolder);
    if (!parent) return { ...it };
    const kind = inferLibraryGroupType(it);
    if (kind === "collection" || kind === "selection") return { ...it };
    if (it.collectionSid || it.collectionName || it.collectionShortUrl) return { ...it };
    return {
      ...it,
      groupType: "single" as const,
      groupKey: resolveSpaceLooseVideosKey(it),
      groupFolder: SPACE_LOOSE_VIDEOS_FOLDER,
    };
  });
}

/** Stamp 视频选集 fields: groupType/groupKey/groupFolder/videoTitle. */
export function attachSelectionGroupMeta<T extends LibraryGroupItem>(
  items: T[] | null | undefined,
  meta: SelectionGroupMeta = {},
): T[] {
  const list = items || [];
  const author = String(meta.author || list[0]?.author || "").trim();
  const videoTitle =
    String(meta.title || "").trim()
    || resolveSeriesTitleLocal(list[0])
    || "";
  const bvid = String(list[0]?.bvid || "").trim();
  const groupKey = bvid ? `selection:${bvid}` : "selection:unknown";
  const parentFolder = inheritParentFolder(list, meta.parentFolder);
  // Nested under UP → leaf is 选集名 only; flat mode keeps "UP 选集名".
  const groupFolder = parentFolder
    ? (videoTitle || "未命名视频")
    : buildUpFolderLabel(author, videoTitle);
  return list.map((it) => ({
    ...it,
    author: String(it.author || "").trim() || author,
    videoTitle,
    groupType: "selection" as const,
    groupKey,
    groupFolder,
    parentFolder: parentFolder || it.parentFolder,
    spaceMid: it.spaceMid,
  }));
}

/** Stamp 合集 fields for a list of archives. */
export function attachCollectionGroupMeta<T extends LibraryGroupItem>(
  items: T[] | null | undefined,
  meta: CollectionGroupMeta = {},
  ctx: CollectionGroupContext = {},
): T[] {
  const list = items || [];
  const mid = String(meta.mid || ctx.mid || "").trim();
  const sid = String(meta.season_id || ctx.season_id || "").trim();
  const shortUrl = buildCollectionShortUrl(mid, sid);
  const collectionName =
    String(meta.name || meta.title || ctx.collectionTitleHint || "未命名合集").trim();
  const author =
    String(meta.author || "").trim()
    || String(ctx.authorHint || "").trim()
    || String(list[0]?.author || "").trim()
    || "";
  const groupKey =
    mid && sid
      ? `collection:${mid}/${sid}`
      : `collection:${shortUrl || collectionName}`;
  const parentFolder = inheritParentFolder(list, meta.parentFolder || ctx.parentFolder);
  const groupFolder = parentFolder
    ? (collectionName || "未命名合集")
    : buildUpFolderLabel(author, collectionName);
  return list.map((it) => ({
    ...it,
    author: String(it.author || "").trim() || author,
    groupType: "collection" as const,
    groupKey,
    groupFolder,
    collectionName,
    collectionMid: mid,
    collectionSid: sid,
    collectionShortUrl: shortUrl,
    parentFolder: parentFolder || it.parentFolder,
    spaceMid: it.spaceMid,
  }));
}

/** Apply ugc_season from a view payload onto one library item. */
export function applyUgcSeasonToItem<T extends LibraryGroupItem>(
  item: T | null | undefined,
  view: UgcSeasonViewLike | null | undefined,
): T {
  if (!item) return item as T;
  if (!view?.ugc_season?.id) return item;
  const season = view.ugc_season;
  const mid = season.mid || view.owner?.mid;
  const sid = season.id;
  if (!mid || !sid) return item;
  const author = String(item.author || view.owner?.name || "").trim();
  const collectionName = String(season.title || item.collectionName || "未命名合集").trim();
  const shortUrl = buildCollectionShortUrl(mid, sid);
  const groupKey = `collection:${mid}/${sid}`;
  const parentFolder = cleanUpName(item.parentFolder);
  const groupFolder = parentFolder
    ? collectionName
    : buildUpFolderLabel(author, collectionName);
  return {
    ...item,
    author: author || item.author,
    groupType: "collection",
    groupKey,
    groupFolder,
    collectionName,
    collectionMid: String(mid),
    collectionSid: String(sid),
    collectionShortUrl: shortUrl,
    parentFolder: parentFolder || item.parentFolder,
  };
}

export function applyUgcSeasonToItems<T extends LibraryGroupItem>(
  items: T[] | null | undefined,
  view: UgcSeasonViewLike | null | undefined,
): T[] {
  return (items || []).map((it) => applyUgcSeasonToItem(it, view));
}

/**
 * One UP 合集 discovered on 个人主页 (name + mid/sid → shortUrl + member bvids).
 * Product fetches seasons_series_list / seasons_archives_list; pure only maps.
 */
export interface SpaceCollectionDescriptor {
  mid?: string | number;
  season_id?: string | number;
  name?: string;
  title?: string;
  author?: string;
  /** Member BVids (any casing). */
  bvids?: Array<string | null | undefined> | null;
}

function normalizeBvidKey(bvid: string | null | undefined): string {
  const id = String(bvid || "").trim();
  if (!id) return "";
  // Full uppercase so bv1xxx / BV1XXX match (B站 BV 大小写不敏感)。
  const body = /^bv/i.test(id) ? id.slice(2) : id;
  return `BV${body.toUpperCase()}`;
}

/**
 * Migrate 个人主页 videos into 合集 folders when their BV belongs to a season.
 * Preserves parentFolder (UP) so path is UP/合集名/….
 * First matching collection wins if a BV appears in multiple seasons.
 */
export function applySpaceCollectionMembership<T extends LibraryGroupItem>(
  items: T[] | null | undefined,
  collections: SpaceCollectionDescriptor[] | null | undefined,
): T[] {
  const list = items || [];
  const cols = collections || [];
  if (!list.length || !cols.length) return list.map((it) => ({ ...it }));

  const byBvid = new Map<string, SpaceCollectionDescriptor>();
  for (const col of cols) {
    const sid = String(col?.season_id || "").trim();
    if (!sid) continue;
    for (const raw of col.bvids || []) {
      const key = normalizeBvidKey(raw);
      if (!key || byBvid.has(key)) continue;
      byBvid.set(key, col);
    }
  }
  if (!byBvid.size) return list.map((it) => ({ ...it }));

  return list.map((it) => {
    const key = normalizeBvidKey(it.bvid);
    const col = key ? byBvid.get(key) : undefined;
    if (!col) return { ...it };
    const stamped = attachCollectionGroupMeta([it], {
      mid: col.mid,
      season_id: col.season_id,
      name: col.name || col.title || "未命名合集",
      author: col.author || it.author,
      parentFolder: it.parentFolder,
    });
    return stamped[0] || { ...it };
  });
}

/** Count how many library items were assigned to a collection by membership map. */
export function countSpaceCollectionMatches(
  items: LibraryGroupItem[] | null | undefined,
  collections: SpaceCollectionDescriptor[] | null | undefined,
): { matched: number; collectionCount: number } {
  const list = items || [];
  const cols = (collections || []).filter((c) => String(c?.season_id || "").trim());
  if (!list.length || !cols.length) return { matched: 0, collectionCount: cols.length };
  const memberKeys = new Set<string>();
  for (const col of cols) {
    for (const raw of col.bvids || []) {
      const key = normalizeBvidKey(raw);
      if (key) memberKeys.add(key);
    }
  }
  let matched = 0;
  for (const it of list) {
    const key = normalizeBvidKey(it.bvid);
    if (key && memberKeys.has(key)) matched += 1;
  }
  return { matched, collectionCount: cols.length };
}

/**
 * Author/folder patches to apply to library rows after export normalize.
 * Pure — product applies patches to state.
 */
export interface GroupMetaPatch {
  groupKey: string;
  author?: string;
  groupFolder?: string;
}

export function buildGroupMetaPatches(
  normalized: LibraryGroupItem | null | undefined,
): GroupMetaPatch | null {
  const key = String(normalized?.groupKey || "").trim();
  if (!key) return null;
  const author = String(normalized?.author || "").trim();
  const groupFolder = String(normalized?.groupFolder || "").trim();
  if (!author && !groupFolder) return null;
  return {
    groupKey: key,
    author: author && author !== "未知UP" ? author : undefined,
    groupFolder: groupFolder && !/^未知UP\b/.test(groupFolder) ? groupFolder : undefined,
  };
}

/** Apply one patch onto a library list (returns new array; does not mutate). */
export function applyGroupMetaPatchToItems<T extends LibraryGroupItem>(
  items: T[] | null | undefined,
  patch: GroupMetaPatch | null | undefined,
): T[] {
  const list = items || [];
  if (!patch?.groupKey) return list.slice();
  return list.map((row) => {
    if (String(row.groupKey || "") !== patch.groupKey) return row;
    const next = { ...row };
    if (patch.author && (!row.author || row.author === "未知UP")) next.author = patch.author;
    if (
      patch.groupFolder
      && (!row.groupFolder || /^未知UP\b/.test(String(row.groupFolder)))
    ) {
      next.groupFolder = patch.groupFolder;
    }
    return next;
  });
}

/** Merge group fields from source onto target (for autoCapture merge). */
export function mergeGroupFields<T extends LibraryGroupItem>(
  target: T,
  source: LibraryGroupItem | null | undefined,
): T {
  if (!source) return target;
  const next = { ...target };
  if (source.groupType) next.groupType = source.groupType;
  if (source.groupKey) next.groupKey = source.groupKey;
  if (source.groupFolder) next.groupFolder = source.groupFolder;
  if (source.parentFolder) next.parentFolder = source.parentFolder;
  if (source.spaceMid != null && source.spaceMid !== "") next.spaceMid = source.spaceMid;
  if (source.collectionName) next.collectionName = source.collectionName;
  if (source.collectionMid != null) next.collectionMid = source.collectionMid;
  if (source.collectionSid != null) next.collectionSid = source.collectionSid;
  if (source.collectionShortUrl) next.collectionShortUrl = source.collectionShortUrl;
  if (source.videoTitle) next.videoTitle = source.videoTitle;
  if (source.author && (!target.author || target.author === "未知UP")) {
    next.author = source.author;
  }
  return next;
}

/** Ensure groupFolder is a clean label (no stale 未知UP). */
export function refreshGroupFolder<T extends LibraryGroupItem>(item: T): T {
  const folder = String(item.groupFolder || "").trim();
  if (folder && !/^未知UP\b/.test(folder)) return item;
  return { ...item, groupFolder: resolveLibraryFolderLabel(item) };
}

/**
 * Suggest capture-panel mode from a library / view item.
 * - 合集 (ugc_season fields) → "collection"
 * - 多分P 视频选集 → "selection"
 * - otherwise → "auto" (caller may only apply when leaving selection/collection)
 */
export function suggestCaptureMode(
  item: LibraryGroupItem | null | undefined,
): "collection" | "selection" | "auto" {
  if (!item) return "auto";
  if (
    item.groupType === "collection"
    || item.collectionSid
    || item.collectionShortUrl
    || item.collectionName
  ) {
    return "collection";
  }
  const pageCount = Array.isArray(item.pages) ? item.pages.length : 0;
  if (item.groupType === "selection" || pageCount > 1) {
    return "selection";
  }
  return "auto";
}
