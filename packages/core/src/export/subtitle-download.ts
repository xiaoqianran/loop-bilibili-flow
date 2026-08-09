/**
 * Subtitle batch download layout helpers.
 *
 * Downloads land under the browser download directory as:
 *   loop-bilibili-subbatch/<UP 视频名|合集名>/<file>.{ext}
 * plus a root index.md mapping (same shape for 选集 / 合集):
 *   - 视频选集/单视频: <UP> www.bilibili.com/video/BVxxx <视频标题>
 *   - 合集: <UP> space.bilibili.com/{mid}/lists/{sid} <合集名>
 * Same BV / 合集短地址 upsert 覆盖名称与作者。
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

/** @deprecated legacy string values keyed by BV (pre-6.4). */
export type ExportIndexBvValue = string;
/** 视频选集 / 单视频：作者 + 短链 + 标题 */
export type ExportIndexVideoValue = {
  kind: "video";
  author: string;
  shortUrl: string;
  bvid: string;
  name: string;
};
export type ExportIndexCollectionValue = {
  kind: "collection";
  author: string;
  shortUrl: string;
  name: string;
};
export type ExportIndexValue =
  | ExportIndexBvValue
  | ExportIndexVideoValue
  | ExportIndexCollectionValue;
export type SubtitleExportIndexMap = Record<string, ExportIndexValue>;

/** Short watch URL for index.md (parallel to collection short address). */
export function buildVideoShortUrl(bvid: string | null | undefined): string {
  const id = String(bvid || "").trim();
  if (!id) return "";
  const normalized = /^bv/i.test(id) ? `BV${id.slice(2)}` : id;
  return `www.bilibili.com/video/${normalized}`;
}

export function videoIndexKey(bvid: string | null | undefined): string {
  const id = String(bvid || "").trim();
  if (!id) return "";
  return /^bv/i.test(id) ? `BV${id.slice(2)}` : id;
}

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

/** Parse index.md: video lines and collection lines (plus legacy `BV title`). */
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

    // New: author www.bilibili.com/video/BVxxx 标题
    // Also accept missing author: www.bilibili.com/video/BVxxx 标题
    const vid = line.match(
      /^(?:(.+?)\s+)?((?:www\.)?bilibili\.com\/video\/(BV[\w]+))\s+(.+)$/i,
    );
    if (vid) {
      const author = String(vid[1] || "").trim();
      const bare = String(vid[2] || "").replace(/^https?:\/\//i, "");
      const short = bare.startsWith("www.")
        ? bare
        : bare.toLowerCase().startsWith("bilibili.com")
          ? `www.${bare}`
          : bare;
      const bvid = videoIndexKey(vid[3]);
      const name = vid[4].trim();
      map[bvid] = {
        kind: "video",
        author,
        shortUrl: short || buildVideoShortUrl(bvid),
        bvid,
        name,
      };
      continue;
    }

    // Legacy: BV14u41147YH 标题…
    const m = line.match(/^(BV[\w]+)\s+(.+)$/i);
    if (!m) continue;
    const normalized = videoIndexKey(m[1]);
    const legacyName = m[2].trim();
    map[normalized] = {
      kind: "video",
      author: "",
      shortUrl: buildVideoShortUrl(normalized),
      bvid: normalized,
      name: legacyName,
    };
  }
  return map;
}

/**
 * Upsert 视频选集/单视频 index: author + shortUrl + title (keyed by BV).
 * Same BV replaces author/title when metadata changes.
 */
export function upsertVideoExportIndex(
  map: SubtitleExportIndexMap | null | undefined,
  author: string | null | undefined,
  bvid: string | null | undefined,
  videoTitle: string | null | undefined,
): SubtitleExportIndexMap {
  const next: SubtitleExportIndexMap = { ...(map || {}) };
  const id = videoIndexKey(bvid);
  if (!id) return next;
  const up = String(author || "").trim();
  const name = String(videoTitle || "").trim() || id;
  const shortUrl = buildVideoShortUrl(id);
  next[id] = {
    kind: "video",
    author: up,
    shortUrl,
    bvid: id,
    name,
  };
  return next;
}

/**
 * @deprecated Prefer upsertVideoExportIndex. Kept for callers that only have BV + title.
 * Writes structured video entries when possible.
 */
export function upsertExportIndexMap(
  map: SubtitleExportIndexMap | null | undefined,
  bvid: string | null | undefined,
  seriesTitle: string | null | undefined,
  author?: string | null,
): SubtitleExportIndexMap {
  return upsertVideoExportIndex(map, author, bvid, seriesTitle);
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
  const up = String(author || "").trim();
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
  const videoLines: string[] = [];
  const colLines: string[] = [];
  for (const [key, value] of Object.entries(map || {})) {
    if (!value) continue;
    if (typeof value === "string") {
      // Legacy storage: BV → title only → upgrade on render with empty author omitted carefully.
      // Keep BV shortUrl so line is still discoverable: "www.bilibili.com/video/BV … title"
      const bvid = videoIndexKey(key);
      const shortUrl = buildVideoShortUrl(bvid);
      if (bvid && value) videoLines.push(`${shortUrl} ${value}`);
      continue;
    }
    if (value.kind === "video" && value.bvid && value.name) {
      const shortUrl = value.shortUrl || buildVideoShortUrl(value.bvid);
      const up = String(value.author || "").trim();
      videoLines.push(up ? `${up} ${shortUrl} ${value.name}` : `${shortUrl} ${value.name}`);
      continue;
    }
    if (value.kind === "collection" && value.shortUrl && value.name) {
      const up = String(value.author || "").trim();
      colLines.push(up ? `${up} ${value.shortUrl} ${value.name}` : `${value.shortUrl} ${value.name}`);
    }
  }
  videoLines.sort((a, b) => a.localeCompare(b, "en"));
  colLines.sort((a, b) => a.localeCompare(b, "zh"));
  const lines = [...videoLines, ...colLines];
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

/** Pure video title for index (no UP prefix; UP is a separate field). */
export function resolveIndexVideoTitle(item: SubtitleExportItem | null | undefined): string {
  const videoTitle = String(item?.videoTitle || "").trim();
  if (videoTitle) return videoTitle;
  return resolveSeriesTitle(item);
}

/** Apply index upsert for one export item (video 选集 / collection 合集). */
export function upsertIndexForExportItem(
  map: SubtitleExportIndexMap | null | undefined,
  item: SubtitleExportItem | null | undefined,
): SubtitleExportIndexMap {
  const normalized = normalizeExportItem(item, item ? [item] : []);
  const kind = inferLibraryGroupType(normalized);
  if (kind === "collection") {
    const shortUrl =
      normalized.collectionShortUrl
      || buildCollectionShortUrl(normalized.collectionMid, normalized.collectionSid);
    return upsertCollectionExportIndex(
      map,
      normalized.author,
      shortUrl,
      normalized.collectionName || resolveSeriesTitle(normalized),
    );
  }
  // 视频选集 / 单视频：作者 + www.bilibili.com/video/BV + 标题
  return upsertVideoExportIndex(
    map,
    normalized.author,
    normalized.bvid,
    resolveIndexVideoTitle(normalized),
  );
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
