/**
 * Subtitle batch download layout helpers.
 *
 * Downloads land under the browser download directory as:
 *   loop-bilibili-subbatch/<UP 视频名|合集名>/<file>.{ext}
 * plus a root index.md mapping:
 *   - 视频选集: BV1xxx <folder label>
 *   - 合集: <UP> <shortUrl> <合集名>  (keyed by shortUrl; name updates in place)
 *
 * Folder labels MUST match the 字幕 panel (resolveLibraryFolderLabel).
 */

import {
  buildCollectionShortUrl,
  buildUpFolderLabel,
  inferLibraryGroupType,
  resolveLibraryFolderLabel,
  type LibraryGroupItem,
} from "../library/groups";

export const SUBTITLE_EXPORT_ROOT = "loop-bilibili-subbatch";
export const SUBTITLE_EXPORT_INDEX_NAME = "index.md";

/** Combined multipage title: "{series} - P{n}【{part}】" */
const MULTI_PART_TITLE_RE = /^(.*)\s-\sP(\d+)【([\s\S]*)】\s*$/;

export interface SubtitleExportItem extends LibraryGroupItem {
  pages?: Array<{ part?: string } | null | undefined> | null;
}

/** BV entries are plain strings; collection entries are structured. */
export type ExportIndexBvValue = string;
export type ExportIndexCollectionValue = {
  kind: "collection";
  author: string;
  shortUrl: string;
  name: string;
};
export type ExportIndexValue = ExportIndexBvValue | ExportIndexCollectionValue;
export type SubtitleExportIndexMap = Record<string, ExportIndexValue>;

/**
 * Sanitize one path segment for browser Downloads / Windows FS.
 * - Never keep ASCII `.` inside the segment (avoids Chrome turning `name.txt` stems
 *   into `name-txt` when it rewrites multi-dot names).
 * - Strip trailing dots/spaces (Windows).
 */
export function safePathSegment(name: string | null | undefined, maxLen = 120): string {
  const cleaned = String(name || "untitled")
    .replace(/\|/g, "｜")
    // ASCII dots → middle dot so the only `.` left is our real extension.
    .replace(/\./g, "·")
    .replace(/[\\/:*?"<>]+/g, "_")
    // Fullwidth / odd marks browsers often rewrite aggressively
    .replace(/[？?！!]+/g, "＿")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^\.+/, "")
    .replace(/[.\s]+$/g, "")
    .slice(0, Math.max(1, maxLen))
    .replace(/[.\s]+$/g, "");
  return cleaned || "untitled";
}

/** Join stem + ext so extension is always a real `.{ext}`. */
export function joinFileName(stem: string, ext: string): string {
  const cleanExt = String(ext || "txt").replace(/^\./, "").trim().toLowerCase() || "txt";
  let base = safePathSegment(stem, 160);
  // Defensive: strip accidental extension tails from stem after sanitize.
  base = base.replace(new RegExp(`[·._-]+${cleanExt}$`, "i"), "");
  if (!base) base = "untitled";
  return `${base}.${cleanExt}`;
}

export function resolveSeriesTitle(item: SubtitleExportItem | null | undefined): string {
  if (item?.videoTitle) return String(item.videoTitle).trim();
  const title = String(item?.title || "").trim();
  const multi = title.match(MULTI_PART_TITLE_RE);
  if (multi?.[1]?.trim()) return multi[1].trim();

  const cut = title.search(/\s-\sP\d+【/);
  if (cut > 0) return title.slice(0, cut).trim();

  if (title) return title;
  return String(item?.bvid || "untitled").trim() || "untitled";
}

export function resolvePartLabel(item: SubtitleExportItem | null | undefined): string {
  const explicit = String(item?.part || "").trim();
  if (explicit) return explicit;

  const page = Math.max(1, Number(item?.page) || 1);
  const fromPages = item?.pages?.[page - 1];
  const pagePart = String(fromPages?.part || "").trim();
  if (pagePart) return pagePart;

  const title = String(item?.title || "").trim();
  const multi = title.match(MULTI_PART_TITLE_RE);
  if (multi?.[3] != null) return String(multi[3]).trim();

  return "";
}

/**
 * File stem inside the export folder.
 * - 视频选集: P33【动画篇】6.5 …
 * - 合集: 单集视频标题（各 BV 不同）
 * - 单视频: P1 或带 part 的 P{n}{part}
 */
export function resolveSubtitleFileStem(item: SubtitleExportItem | null | undefined): string {
  const kind = inferLibraryGroupType(item);
  if (kind === "collection") {
    const title = String(item?.title || "").trim();
    if (title) return title;
    return String(item?.bvid || "video").trim() || "video";
  }
  const page = Math.max(1, Number(item?.page) || 1);
  const part = resolvePartLabel(item);
  return part ? `P${page}${part}` : `P${page}`;
}

/**
 * Folder under loop-bilibili-subbatch — same rule as 字幕 panel folder label.
 * Prefer non-未知UP groupFolder; otherwise recompute from author + name.
 */
export function resolveExportFolderName(item: SubtitleExportItem | null | undefined): string {
  const folder = String(item?.groupFolder || "").trim();
  if (folder && !/^未知UP\b/.test(folder)) return folder;
  // Keep UI and disk names aligned.
  return resolveLibraryFolderLabel(item);
}

export function buildSubtitleExportRelativePath(
  item: SubtitleExportItem | null | undefined,
  ext: string,
): string {
  const series = safePathSegment(resolveExportFolderName(item));
  const fileName = joinFileName(resolveSubtitleFileStem(item), ext);
  return `${SUBTITLE_EXPORT_ROOT}/${series}/${fileName}`;
}

export function buildSubtitleExportIndexPath(): string {
  return `${SUBTITLE_EXPORT_ROOT}/${SUBTITLE_EXPORT_INDEX_NAME}`;
}

export function collectionIndexKey(shortUrl: string): string {
  return `collection:${String(shortUrl || "").trim()}`;
}

/** Parse index.md: BV lines and "UP shortUrl 合集名" collection lines. */
export function parseExportIndexMd(content: string | null | undefined): SubtitleExportIndexMap {
  const map: SubtitleExportIndexMap = {};
  for (const rawLine of String(content || "").split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;

    const col = line.match(
      /^(.+?)\s+(space\.bilibili\.com\/\d+\/lists\/\d+)\s+(.+)$/i,
    );
    if (col) {
      const author = col[1].trim();
      const shortUrl = col[2].trim();
      const name = col[3].trim();
      map[collectionIndexKey(shortUrl)] = {
        kind: "collection",
        author,
        shortUrl,
        name,
      };
      continue;
    }

    const m = line.match(/^(BV[\w]+)\s+(.+)$/i);
    if (!m) continue;
    const normalized = /^bv/i.test(m[1]) ? `BV${m[1].slice(2)}` : m[1];
    map[normalized] = m[2].trim();
  }
  return map;
}

/** Upsert BV → folder/title. Same BV replaces the name. */
export function upsertExportIndexMap(
  map: SubtitleExportIndexMap | null | undefined,
  bvid: string | null | undefined,
  seriesTitle: string | null | undefined,
): SubtitleExportIndexMap {
  const next: SubtitleExportIndexMap = { ...(map || {}) };
  const id = String(bvid || "").trim();
  if (!id) return next;
  const normalized = /^bv/i.test(id) ? `BV${id.slice(2)}` : id;
  const name = String(seriesTitle || "").trim() || normalized;
  next[normalized] = name;
  return next;
}

/**
 * Upsert 合集 index by short URL (not BV).
 * Same shortUrl replaces author/name when the collection is renamed.
 */
export function upsertCollectionExportIndex(
  map: SubtitleExportIndexMap | null | undefined,
  author: string | null | undefined,
  shortUrl: string | null | undefined,
  collectionName: string | null | undefined,
): SubtitleExportIndexMap {
  const next: SubtitleExportIndexMap = { ...(map || {}) };
  const url = String(shortUrl || "").trim();
  if (!url) return next;
  const up = String(author || "").trim() || "未知UP";
  const name = String(collectionName || "").trim() || "未命名合集";
  next[collectionIndexKey(url)] = {
    kind: "collection",
    author: up,
    shortUrl: url,
    name,
  };
  return next;
}

export function renderExportIndexMd(map: SubtitleExportIndexMap | null | undefined): string {
  const bvLines: string[] = [];
  const colLines: string[] = [];
  for (const [key, value] of Object.entries(map || {})) {
    if (!value) continue;
    if (typeof value === "string") {
      if (key && value) bvLines.push(`${key} ${value}`);
      continue;
    }
    if (value.kind === "collection" && value.shortUrl && value.name) {
      colLines.push(`${value.author || "未知UP"} ${value.shortUrl} ${value.name}`);
    }
  }
  bvLines.sort((a, b) => a.localeCompare(b, "en"));
  colLines.sort((a, b) => a.localeCompare(b, "zh"));
  const lines = [...bvLines, ...colLines];
  if (!lines.length) return "";
  return `${lines.join("\n")}\n`;
}

/**
 * Fill author / groupFolder from sibling items so download matches 字幕 panel.
 * Fixes 未知UP when list API omitted upper name but peers (or UI folder) already know it.
 */
export function normalizeExportItem(
  item: SubtitleExportItem | null | undefined,
  peers: SubtitleExportItem[] | null | undefined = [],
): SubtitleExportItem {
  const base = { ...(item || {}) } as SubtitleExportItem;
  const list = peers || [];
  const key = String(base.groupKey || "");
  const sameGroup = key
    ? list.filter((p) => String(p?.groupKey || "") === key)
    : list.filter((p) => String(p?.bvid || "") === String(base.bvid || "") && base.bvid);

  const peerAuthor = sameGroup.map((p) => String(p?.author || "").trim()).find((a) => a && a !== "未知UP");
  const author = String(base.author || "").trim() && base.author !== "未知UP"
    ? String(base.author).trim()
    : peerAuthor || String(base.author || "").trim();

  if (author) base.author = author;

  const peerFolder = sameGroup
    .map((p) => String(p?.groupFolder || "").trim())
    .find((f) => f && !/^未知UP\b/.test(f));

  if (peerFolder) base.groupFolder = peerFolder;
  else if (!base.groupFolder || /^未知UP\b/.test(String(base.groupFolder))) {
    base.groupFolder = resolveLibraryFolderLabel(base);
  }

  return base;
}

/** Apply index upsert for one export item (BV for 选集, shortUrl for 合集). */
export function upsertIndexForExportItem(
  map: SubtitleExportIndexMap | null | undefined,
  item: SubtitleExportItem | null | undefined,
): SubtitleExportIndexMap {
  const normalized = normalizeExportItem(item, item ? [item] : []);
  let next: SubtitleExportIndexMap = { ...(map || {}) };
  const kind = inferLibraryGroupType(normalized);
  if (kind === "collection") {
    const shortUrl =
      normalized.collectionShortUrl
      || buildCollectionShortUrl(normalized.collectionMid, normalized.collectionSid);
    return upsertCollectionExportIndex(
      next,
      normalized.author,
      shortUrl,
      normalized.collectionName || resolveExportFolderName(normalized),
    );
  }
  const folder = resolveExportFolderName(normalized);
  if (normalized.bvid) next = upsertExportIndexMap(next, normalized.bvid, folder);
  return next;
}

export function describeSubtitleExport(item: SubtitleExportItem | null | undefined, ext = "txt") {
  const normalized = normalizeExportItem(item, item ? [item] : []);
  const seriesTitle = resolveExportFolderName(normalized);
  const fileStem = resolveSubtitleFileStem(normalized);
  return {
    bvid: String(normalized.bvid || "").trim(),
    seriesTitle,
    fileStem,
    folderSegment: safePathSegment(seriesTitle),
    fileSegment: safePathSegment(fileStem, 160),
    relativePath: buildSubtitleExportRelativePath(normalized, ext),
    indexPath: buildSubtitleExportIndexPath(),
    groupType: inferLibraryGroupType(normalized),
  };
}

export { buildCollectionShortUrl, buildUpFolderLabel };
