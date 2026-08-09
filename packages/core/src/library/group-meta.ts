/**
 * Library group metadata attachers — single source of truth for
 * 视频选集 / 合集 folder fields on library items.
 *
 * Product (loop-bilibili) must call these instead of re-implementing.
 */

import {
  buildCollectionShortUrl,
  buildUpFolderLabel,
  resolveLibraryFolderLabel,
  type LibraryGroupItem,
} from "./groups";

const MULTI_PART_TITLE_RE = /^(.*)\s-\sP(\d+)【([\s\S]*)】\s*$/;

export interface SelectionGroupMeta {
  author?: string;
  title?: string;
}

export interface CollectionGroupMeta {
  mid?: string | number;
  season_id?: string | number;
  name?: string;
  title?: string;
  author?: string;
}

export interface CollectionGroupContext {
  mid?: string | number;
  season_id?: string | number;
  collectionTitleHint?: string;
  authorHint?: string;
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
  const groupFolder = buildUpFolderLabel(author, videoTitle);
  return list.map((it) => ({
    ...it,
    author: String(it.author || "").trim() || author,
    videoTitle,
    groupType: "selection" as const,
    groupKey,
    groupFolder,
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
  const groupFolder = buildUpFolderLabel(author, collectionName);
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
  const groupFolder = buildUpFolderLabel(author, collectionName);
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
  };
}

export function applyUgcSeasonToItems<T extends LibraryGroupItem>(
  items: T[] | null | undefined,
  view: UgcSeasonViewLike | null | undefined,
): T[] {
  return (items || []).map((it) => applyUgcSeasonToItem(it, view));
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
