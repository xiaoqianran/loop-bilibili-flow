import {
  subtitle,
  video,
  wbi,
  type BilibiliVideoView,
  type SubtitleMeta,
  type SubtitleTrack,
  type WbiKeys,
  type WbiParams,
} from "@subbatch/bilibili";
import { md5 } from "@subbatch/core";
import type { NetworkAdapter, NetworkRequest } from "@subbatch/runtime";

interface BilibiliPayload<T> {
  code?: number;
  message?: string;
  data?: T;
}

interface WbiNavData {
  wbi_img?: {
    img_url?: string;
    sub_url?: string;
  };
}

interface VideoDetailData {
  View?: BilibiliVideoView;
}

interface SubtitleData {
  subtitle?: {
    subtitles?: unknown;
  };
}

export interface SubtitleTrackCollection {
  subs: SubtitleTrack[];
  source: "player_wbi" | "player_v2" | "dm_view" | "";
  error?: unknown;
}

export interface SubtitleUrlResolution {
  url: string;
  source: string;
}

const WBI_TTL_MS = 600_000;
const wbiCache = new WeakMap<
  NetworkAdapter,
  { keys: WbiKeys; at: number }
>();

const JSON_REQUEST = {
  credentials: "include" as const,
  cache: "no-store" as const,
  fallback: "network-or-http" as const,
  headers: { Accept: "application/json, text/plain, */*" },
};

function request(signal?: AbortSignal): NetworkRequest {
  return { ...JSON_REQUEST, ...(signal ? { signal } : {}) };
}

function isAbortError(error: unknown): boolean {
  return (error as { name?: string })?.name === "AbortError";
}

async function fetchWbiKeys(
  network: NetworkAdapter,
  signal?: AbortSignal,
): Promise<WbiKeys> {
  const now = Date.now();
  const cached = wbiCache.get(network);
  if (cached && now - cached.at < WBI_TTL_MS) return cached.keys;

  const payload = await network.json<BilibiliPayload<WbiNavData>>(
    wbi.navUrl(),
    request(signal),
  );
  const imgUrl = payload?.data?.wbi_img?.img_url || "";
  const subUrl = payload?.data?.wbi_img?.sub_url || "";
  if (payload?.code !== 0 || !imgUrl || !subUrl) {
    throw new Error(payload?.message || "无法取得 WBI keys");
  }

  const keys = {
    img: wbi.keyFromUrl(imgUrl),
    sub: wbi.keyFromUrl(subUrl),
  };
  wbiCache.set(network, { keys, at: now });
  return keys;
}

export async function signWbi(
  network: NetworkAdapter,
  params: WbiParams,
  signal?: AbortSignal,
  wts?: number,
): Promise<string> {
  const keys = await fetchWbiKeys(network, signal);
  return wbi.sign(params, keys, md5, wts);
}

export async function fetchVideoView(
  network: NetworkAdapter,
  bvid: string,
  signal?: AbortSignal,
): Promise<BilibiliVideoView> {
  const payload = await network.json<BilibiliPayload<BilibiliVideoView>>(
    video.url(bvid),
    request(signal),
  );
  if (payload?.code !== 0 || !payload.data) {
    throw new Error(payload?.message || "视频信息接口返回失败");
  }
  return payload.data;
}

export async function fetchVideoDetail(
  network: NetworkAdapter,
  bvid: string,
  signal?: AbortSignal,
): Promise<BilibiliPayload<VideoDetailData>> {
  const query = await signWbi(network, { bvid, need_elec: 0 }, signal);
  return network.json<BilibiliPayload<VideoDetailData>>(
    wbi.videoDetailUrl(query),
    request(signal),
  );
}

export async function fetchSubtitleBody(
  network: NetworkAdapter,
  url: string,
  signal?: AbortSignal,
): Promise<unknown[]> {
  const payload = await network.json<{ body?: unknown }>(url, request(signal));
  return Array.isArray(payload?.body) ? payload.body : [];
}

async function fetchPlayerWbiTracks(
  network: NetworkAdapter,
  meta: SubtitleMeta,
  signal?: AbortSignal,
): Promise<SubtitleTrack[]> {
  const params: WbiParams = meta.aid
    ? { aid: meta.aid, cid: meta.cid }
    : { bvid: meta.bvid, cid: meta.cid };
  const query = await signWbi(network, params, signal);
  const payload = await network.json<BilibiliPayload<SubtitleData>>(
    wbi.playerUrl(query),
    request(signal),
  );
  if (payload?.code !== 0) {
    throw new Error(payload?.message || "WBI 字幕轨道接口返回失败");
  }
  return subtitle.normalizeTracks(payload.data?.subtitle?.subtitles);
}

async function fetchPlayerV2Tracks(
  network: NetworkAdapter,
  meta: SubtitleMeta,
  signal?: AbortSignal,
): Promise<SubtitleTrack[]> {
  const payload = await network.json<BilibiliPayload<SubtitleData>>(
    subtitle.playerUrl(meta),
    request(signal),
  );
  if (payload?.code !== 0) {
    throw new Error(payload?.message || "字幕轨道接口返回失败");
  }
  return subtitle.normalizeTracks(payload.data?.subtitle?.subtitles);
}

async function fetchDmSubtitleTracks(
  network: NetworkAdapter,
  meta: Pick<SubtitleMeta, "bvid" | "cid">,
  signal?: AbortSignal,
): Promise<SubtitleTrack[]> {
  const payload = await network.json<BilibiliPayload<SubtitleData>>(
    subtitle.dmUrl(meta),
    request(signal),
  );
  if (payload?.code !== 0) {
    throw new Error(payload?.message || "弹幕字幕接口返回失败");
  }
  return subtitle.normalizeTracks(payload.data?.subtitle?.subtitles);
}

async function fetchAiSubtitleUrl(
  network: NetworkAdapter,
  meta: Pick<SubtitleMeta, "aid" | "cid">,
  signal?: AbortSignal,
): Promise<string> {
  if (!meta.aid) return "";
  const payload = await network.json<
    BilibiliPayload<{ subtitle_url?: unknown }>
  >(
    subtitle.aiStatUrl(meta),
    request(signal),
  );
  if (payload?.code !== 0) return "";
  return subtitle.normalizeUrl(payload.data?.subtitle_url);
}

export async function collectSubtitleTracks(
  network: NetworkAdapter,
  meta: SubtitleMeta,
  signal?: AbortSignal,
): Promise<SubtitleTrackCollection> {
  let lastError: unknown = null;
  let hadSuccessfulResponse = false;

  try {
    const subs = await fetchPlayerWbiTracks(network, meta, signal);
    hadSuccessfulResponse = true;
    if (subs.length) return { subs, source: "player_wbi" };
  } catch (error) {
    if (isAbortError(error)) throw error;
    lastError = error;
  }

  try {
    const subs = await fetchPlayerV2Tracks(network, meta, signal);
    hadSuccessfulResponse = true;
    if (subs.length) return { subs, source: "player_v2" };
  } catch (error) {
    if (isAbortError(error)) throw error;
    lastError = error;
  }

  try {
    const subs = await fetchDmSubtitleTracks(network, meta, signal);
    hadSuccessfulResponse = true;
    if (subs.length) return { subs, source: "dm_view" };
  } catch (error) {
    if (isAbortError(error)) throw error;
    lastError = error;
  }

  return {
    subs: [],
    source: "",
    ...(!hadSuccessfulResponse && lastError ? { error: lastError } : {}),
  };
}

export async function resolveSubtitleUrl(
  network: NetworkAdapter,
  track: SubtitleTrack,
  meta: Pick<SubtitleMeta, "aid" | "cid">,
  source = "",
  signal?: AbortSignal,
): Promise<SubtitleUrlResolution> {
  const lan = String(track.lan || "");
  const direct = subtitle.normalizeUrl(track.subtitle_url);
  if (direct) return { url: direct, source };
  if (!lan.startsWith("ai-") || !meta.aid) return { url: "", source };

  try {
    const url = await fetchAiSubtitleUrl(network, meta, signal);
    return url ? { url, source: "ai_stat" } : { url: "", source };
  } catch (error) {
    if (isAbortError(error)) throw error;
    return { url: "", source };
  }
}

export async function fetchSubtitleTracks(
  network: NetworkAdapter,
  meta: SubtitleMeta,
  signal?: AbortSignal,
): Promise<SubtitleTrack[]> {
  const result = await collectSubtitleTracks(network, meta, signal);
  if (!result.subs.length && result.error) throw result.error;
  return result.subs;
}
