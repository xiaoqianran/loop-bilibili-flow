export interface BilibiliVideoPage {
  cid?: number | string;
  part?: string;
}

export interface BilibiliVideoView {
  bvid?: string;
  aid?: number | string;
  cid?: number | string;
  title?: string;
  owner?: { name?: string } | null;
  pages?: BilibiliVideoPage[] | null;
  is_upower_exclusive?: boolean;
  is_upower_play?: boolean;
}

export interface VideoPageMeta {
  bvid: string;
  aid: number | null;
  cid: number | null;
  title: string;
  author: string;
  pages: BilibiliVideoPage[];
  page: number;
}

export interface SubtitleTrack {
  lan?: string;
  subtitle_url?: string;
  [key: string]: unknown;
}

export interface SubtitleMeta {
  bvid: string;
  cid: number | string;
  aid?: number | string | null;
}

type UnknownRecord = Record<string, unknown>;

function record(value: unknown): UnknownRecord | null {
  return value && typeof value === "object" ? (value as UnknownRecord) : null;
}

function parseRecord(value: unknown): UnknownRecord | null {
  if (typeof value === "string") {
    try {
      return record(JSON.parse(value));
    } catch {
      return null;
    }
  }
  return record(value);
}

function nested(root: UnknownRecord | null, ...keys: string[]): unknown {
  let current: unknown = root;
  for (const key of keys) {
    const item = record(current);
    if (!item) return undefined;
    current = item[key];
  }
  return current;
}

export function runtimeVideoView(
  runtime: unknown,
  bvid: string,
): BilibiliVideoView | null {
  const root = record(runtime);
  const initial = record(root?.__INITIAL_STATE__);
  const key = String(bvid || "").toUpperCase();
  const candidates = [
    record(initial?.videoData),
    record(initial?.videoInfo),
    record(initial?.epInfo),
  ];

  for (const candidate of candidates) {
    if (!candidate) continue;
    const candidateBvid = String(candidate.bvid || "").toUpperCase();
    const pages = candidate.pages;
    if (
      candidateBvid === key &&
      (candidate.cid || (Array.isArray(pages) && pages.length))
    ) {
      return candidate as BilibiliVideoView;
    }
  }
  return null;
}

export function isChargeBlocked(
  view: BilibiliVideoView | null | undefined,
): boolean {
  return Boolean(view?.is_upower_exclusive && !view?.is_upower_play);
}

export function pageMeta(
  view: BilibiliVideoView,
  requestedBvid: string,
  requestedPage = 1,
): VideoPageMeta {
  const pages = Array.isArray(view.pages) ? view.pages : [];
  const page = Math.max(
    1,
    Math.min(Number(requestedPage) || 1, Math.max(1, pages.length)),
  );
  const part = pages[page - 1] ?? null;
  const cid = Number(part?.cid || view.cid) || null;
  const aid = Number(view.aid) || null;
  const title =
    part?.part && pages.length > 1
      ? `${view.title || requestedBvid} - P${page}【${part.part}】`
      : String(view.title || requestedBvid);

  return {
    bvid: String(view.bvid || requestedBvid),
    aid,
    cid,
    title,
    author: String(view.owner?.name || ""),
    pages,
    page,
  };
}

export function normalizeSubtitleUrl(value: unknown): string {
  let url = String(value || "").trim();
  if (!url) return "";
  if (url.startsWith("//")) return `https:${url}`;
  if (url.startsWith("http://")) return `https://${url.slice(7)}`;
  if (!url.startsWith("http")) {
    url = `https://${url.replace(/^\/+/, "")}`;
  }
  return url;
}

export function normalizeTracks(value: unknown): SubtitleTrack[] {
  if (!Array.isArray(value)) return [];
  return value.map((track) => {
    const item = record(track) ?? {};
    return {
      ...item,
      subtitle_url: normalizeSubtitleUrl(item.subtitle_url),
    } as SubtitleTrack;
  });
}

export function runtimeSubtitleTracks(
  runtime: unknown,
  meta: Pick<SubtitleMeta, "cid">,
): SubtitleTrack[] | null {
  const root = record(runtime);
  const initial = record(root?.__INITIAL_STATE__);
  const initialVideo = record(initial?.videoData);
  const roots = [
    root?.__playinfo__,
    root?.__PLAYINFO__,
    root?.__PLAYER_CONFIG__,
  ];

  for (const candidate of roots) {
    const parsed = parseRecord(candidate);
    if (!parsed) continue;
    const runtimeCid = Number(
      nested(parsed, "data", "cid") ||
        parsed.cid ||
        initialVideo?.cid ||
        0,
    );
    if (runtimeCid && meta.cid && runtimeCid !== Number(meta.cid)) continue;

    const tracks = [
      nested(parsed, "data", "subtitle", "subtitles"),
      nested(parsed, "subtitle", "subtitles"),
      nested(parsed, "data", "data", "subtitle", "subtitles"),
    ];
    for (const value of tracks) {
      if (Array.isArray(value) && value.length) return normalizeTracks(value);
    }
  }
  return null;
}

export function trackEndpoints(meta: SubtitleMeta): string[] {
  const params = new URLSearchParams({
    bvid: meta.bvid,
    cid: String(meta.cid),
  });
  if (meta.aid) params.set("aid", String(meta.aid));
  return [
    `https://api.bilibili.com/x/player/wbi/v2?${params}`,
    `https://api.bilibili.com/x/player/v2?${params}`,
  ];
}

export function pickTrack<T extends SubtitleTrack>(
  tracks: readonly T[] | null | undefined,
): T | null {
  if (!tracks?.length) return null;
  for (const track of tracks) {
    const lan = String(track.lan || "");
    if (
      lan === "zh-CN" ||
      lan === "ai-zh" ||
      lan.startsWith("zh") ||
      lan.startsWith("ai")
    ) {
      return track;
    }
  }
  return tracks[0] ?? null;
}

export function preferredTrackIndex(
  tracks: readonly SubtitleTrack[] | null | undefined,
): number {
  if (!tracks?.length) return 0;
  const chosen = pickTrack(tracks);
  const index = chosen ? tracks.indexOf(chosen) : -1;
  return index >= 0 ? index : 0;
}
