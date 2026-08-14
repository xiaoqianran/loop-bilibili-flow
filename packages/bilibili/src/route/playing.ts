function extractBvid(text: string | null | undefined): string {
  if (!text) return "";
  const value = String(text).trim();
  if (!value) return "";
  if (/^BV(?!id$)[A-Za-z0-9]+$/i.test(value)) return `BV${value.slice(2)}`;
  const match = value.match(/BV(?!id\b)[A-Za-z0-9]+/i);
  return match ? `BV${match[0].slice(2)}` : "";
}

function routeVideoKey(
  bvid: string | null | undefined,
  page: number | string | null | undefined,
): string {
  return `${String(bvid || "").toUpperCase()}:P${Math.max(1, Number(page) || 1)}`;
}

export interface PlayingVideoHint {
  bvid?: string;
  page?: number;
  cid?: number;
  aid?: number;
  source?: string;
}

export interface PlayingVideoSnapshot {
  bvid: string;
  page: number;
  cid?: number;
  aid?: number;
  key: string;
  source: string;
}

export interface ResolvePlayingVideoInput {
  href?: string;
  urlBvid?: string;
  urlPage?: number | string | null;
  playing?: PlayingVideoHint | null;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object"
    ? (value as Record<string, unknown>)
    : null;
}

function readPositiveNumber(value: unknown): number | undefined {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : undefined;
}

function callMethod(target: Record<string, unknown> | null, name: string): unknown {
  if (!target) return null;
  const fn = target[name];
  if (typeof fn !== "function") return null;
  try {
    return fn.call(target);
  } catch {
    return null;
  }
}

export function pageFromCid(
  pages: Array<{ cid?: number | string } | null | undefined> | null | undefined,
  cid: number | string | null | undefined,
): number | undefined {
  const target = readPositiveNumber(cid);
  if (!target || !Array.isArray(pages) || !pages.length) return undefined;
  const index = pages.findIndex((part) => readPositiveNumber(part?.cid) === target);
  return index >= 0 ? index + 1 : undefined;
}

function firstBvid(...values: unknown[]): string {
  for (const value of values) {
    const id = extractBvid(value == null ? "" : String(value));
    if (id) return id;
  }
  return "";
}

/**
 * Read the live player identity. Prefer player APIs over __INITIAL_STATE__,
 * which often stays on the first episode during 连播 / 合集 auto-next.
 */
export function extractPlayingVideoHint(runtime: unknown): PlayingVideoHint {
  const root = asRecord(runtime);
  if (!root) return {};

  const player = asRecord(root.player);
  const manifest =
    asRecord(callMethod(player, "getManifest")) ||
    asRecord(callMethod(player, "getPlayerInfo")) ||
    asRecord(callMethod(player, "getVideoMessage"));
  const state = asRecord(root.__INITIAL_STATE__);
  const playinfo = asRecord(root.__playinfo__) || asRecord(root.__PLAYINFO__);
  const playData = asRecord(playinfo?.data) || playinfo;
  const videoData = asRecord(state?.videoData) || asRecord(state?.videoInfo);
  const epInfo = asRecord(state?.epInfo);
  const pages = Array.isArray(manifest?.pages)
    ? (manifest.pages as Array<{ cid?: number }>)
    : Array.isArray(videoData?.pages)
      ? (videoData.pages as Array<{ cid?: number }>)
      : Array.isArray(epInfo?.pages)
        ? (epInfo.pages as Array<{ cid?: number }>)
        : null;

  const hint: PlayingVideoHint = {};
  const playerCid =
    readPositiveNumber(manifest?.cid) ||
    readPositiveNumber(callMethod(player, "getCid")) ||
    readPositiveNumber(player?.cid);
  const playerBvid = firstBvid(manifest?.bvid, player?.bvid);
  const playerAid =
    readPositiveNumber(manifest?.aid) || readPositiveNumber(player?.aid);
  const playerPage =
    pageFromCid(pages, playerCid) ||
    readPositiveNumber(manifest?.p) ||
    readPositiveNumber(player?.p);

  if (playerBvid) hint.bvid = playerBvid;
  if (playerCid) hint.cid = playerCid;
  if (playerAid) hint.aid = playerAid;
  if (playerPage) hint.page = playerPage;
  if (playerBvid || playerCid) hint.source = "player";

  if (!hint.bvid) {
    const bvid = firstBvid(playData?.bvid);
    if (bvid) {
      hint.bvid = bvid;
      hint.source = hint.source || "playinfo";
    }
  }
  if (!hint.cid) {
    const cid = readPositiveNumber(playData?.cid);
    if (cid) hint.cid = cid;
  }

  if (!hint.bvid) {
    const bvid = firstBvid(videoData?.bvid, epInfo?.bvid, state?.bvid);
    if (bvid) {
      hint.bvid = bvid;
      hint.source = hint.source || "initial-state";
    }
  }
  if (!hint.cid) {
    const cid =
      readPositiveNumber(videoData?.cid) ||
      readPositiveNumber(epInfo?.cid) ||
      readPositiveNumber(state?.cid);
    if (cid) hint.cid = cid;
  }
  if (!hint.page) {
    const page =
      pageFromCid(pages, hint.cid) ||
      readPositiveNumber(state?.p) ||
      readPositiveNumber(videoData?.p);
    if (page) hint.page = page;
  }
  if (!hint.aid) {
    const aid =
      readPositiveNumber(videoData?.aid) ||
      readPositiveNumber(epInfo?.aid) ||
      readPositiveNumber(playData?.aid);
    if (aid) hint.aid = aid;
  }
  return hint;
}

/**
 * Compose the playing video identity. Live player bvid/page win over a stale URL
 * so 合集/选集连播 still switches subtitles before history updates.
 */
export function resolvePlayingVideoRef(
  input: ResolvePlayingVideoInput,
): PlayingVideoSnapshot | null {
  const urlBvid = firstBvid(input.urlBvid, input.href);
  const playingBvid = firstBvid(input.playing?.bvid);
  const bvid = playingBvid || urlBvid;
  if (!bvid) return null;
  const urlPage = Math.max(1, Number(input.urlPage) || 1);
  const playingPage = Math.max(0, Number(input.playing?.page) || 0);
  const page = playingPage || urlPage;
  const source =
    playingBvid && playingBvid.toUpperCase() !== urlBvid.toUpperCase()
      ? input.playing?.source || "player"
      : playingBvid
        ? input.playing?.source || "player"
        : "url";
  const snapshot: PlayingVideoSnapshot = {
    bvid,
    page,
    key: routeVideoKey(bvid, page),
    source,
  };
  const cid = readPositiveNumber(input.playing?.cid);
  if (cid) snapshot.cid = cid;
  const aid = readPositiveNumber(input.playing?.aid);
  if (aid) snapshot.aid = aid;
  return snapshot;
}

export function playingVideoChanged(
  prev:
    | { bvid?: string; page?: number; cid?: number; key?: string }
    | null
    | undefined,
  next:
    | { bvid?: string; page?: number; cid?: number; key?: string }
    | null
    | undefined,
): boolean {
  const prevKey =
    prev?.key || (prev?.bvid ? routeVideoKey(prev.bvid, prev.page) : "");
  const nextKey =
    next?.key || (next?.bvid ? routeVideoKey(next.bvid, next.page) : "");
  if (prevKey !== nextKey) return true;
  const prevCid = readPositiveNumber(prev?.cid);
  const nextCid = readPositiveNumber(next?.cid);
  return !!(prevCid && nextCid && prevCid !== nextCid);
}
