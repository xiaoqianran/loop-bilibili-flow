/**
 * Subtitle batch download layout helpers.
 *
 * Downloads land under the browser download directory as:
 *   loop-bilibili-subbatch/<series-title>/P{n}{part-name}.{ext}
 * plus a root index.md mapping:
 *   BV1xxx <series-title>
 */

export const SUBTITLE_EXPORT_ROOT = "loop-bilibili-subbatch";
export const SUBTITLE_EXPORT_INDEX_NAME = "index.md";

/** Combined multipage title: "{series} - P{n}【{part}】" */
const MULTI_PART_TITLE_RE = /^(.*)\s-\sP(\d+)【([\s\S]*)】\s*$/;

export interface SubtitleExportItem {
  bvid?: string;
  page?: number | string;
  title?: string;
  part?: string;
  pages?: Array<{ part?: string } | null | undefined> | null;
}

export type SubtitleExportIndexMap = Record<string, string>;

/** Sanitize one path segment for browser Downloads / Windows FS. */
export function safePathSegment(name: string | null | undefined, maxLen = 120): string {
  const cleaned = String(name || "untitled")
    // Keep readable separators; Windows forbids | * ? etc.
    .replace(/\|/g, "｜")
    .replace(/[\\/:*?"<>]+/g, "_")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^\.+/, "")
    .slice(0, Math.max(1, maxLen));
  return cleaned || "untitled";
}

export function resolveSeriesTitle(item: SubtitleExportItem | null | undefined): string {
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
 * File stem inside the series folder.
 * Multipage: P33【动画篇】6.5 头部跟随动画 - 物体约束
 * Single (no part): P1
 */
export function resolveSubtitleFileStem(item: SubtitleExportItem | null | undefined): string {
  const page = Math.max(1, Number(item?.page) || 1);
  const part = resolvePartLabel(item);
  return part ? `P${page}${part}` : `P${page}`;
}

export function buildSubtitleExportRelativePath(
  item: SubtitleExportItem | null | undefined,
  ext: string,
): string {
  const series = safePathSegment(resolveSeriesTitle(item));
  const stem = safePathSegment(resolveSubtitleFileStem(item), 160);
  const cleanExt = String(ext || "txt").replace(/^\./, "").trim() || "txt";
  return `${SUBTITLE_EXPORT_ROOT}/${series}/${stem}.${cleanExt}`;
}

export function buildSubtitleExportIndexPath(): string {
  return `${SUBTITLE_EXPORT_ROOT}/${SUBTITLE_EXPORT_INDEX_NAME}`;
}

/** Parse index.md lines: "BVxxx title with spaces". */
export function parseExportIndexMd(content: string | null | undefined): SubtitleExportIndexMap {
  const map: SubtitleExportIndexMap = {};
  for (const rawLine of String(content || "").split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const m = line.match(/^(BV[\w]+)\s+(.+)$/i);
    if (!m) continue;
    // Normalize BV prefix casing only; keep the rest of the id intact.
    const normalized = /^bv/i.test(m[1]) ? `BV${m[1].slice(2)}` : m[1];
    map[normalized] = m[2].trim();
  }
  return map;
}

/** Upsert BV → series title. Same BV replaces the name (title may change). */
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

export function renderExportIndexMd(map: SubtitleExportIndexMap | null | undefined): string {
  const entries = Object.entries(map || {}).filter(([bvid, name]) => bvid && name);
  entries.sort(([a], [b]) => a.localeCompare(b, "en"));
  if (!entries.length) return "";
  return `${entries.map(([bvid, name]) => `${bvid} ${name}`).join("\n")}\n`;
}

export function describeSubtitleExport(item: SubtitleExportItem | null | undefined, ext = "txt") {
  const seriesTitle = resolveSeriesTitle(item);
  const fileStem = resolveSubtitleFileStem(item);
  return {
    bvid: String(item?.bvid || "").trim(),
    seriesTitle,
    fileStem,
    folderSegment: safePathSegment(seriesTitle),
    fileSegment: safePathSegment(fileStem, 160),
    relativePath: buildSubtitleExportRelativePath(item, ext),
    indexPath: buildSubtitleExportIndexPath(),
  };
}
