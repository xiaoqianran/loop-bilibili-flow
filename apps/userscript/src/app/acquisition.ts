import {
  subtitle,
  type BilibiliVideoView,
  type SubtitleMeta,
  type SubtitleTrack,
} from "@subbatch/bilibili";
import type { NetworkAdapter } from "@subbatch/runtime";

interface BilibiliPayload<T> {
  code?: number;
  message?: string;
  data?: T;
}

const JSON_REQUEST = {
  credentials: "include" as const,
  cache: "no-store" as const,
  fallback: "network-or-http" as const,
  headers: { Accept: "application/json, text/plain, */*" },
};

export async function fetchVideoView(
  network: NetworkAdapter,
  bvid: string,
  signal?: AbortSignal,
): Promise<BilibiliVideoView> {
  const payload = await network.json<BilibiliPayload<BilibiliVideoView>>(
    `https://api.bilibili.com/x/web-interface/view?bvid=${encodeURIComponent(bvid)}`,
    { ...JSON_REQUEST, ...(signal ? { signal } : {}) },
  );
  if (payload?.code !== 0 || !payload.data) {
    throw new Error(payload?.message || "视频信息接口返回失败");
  }
  return payload.data;
}

export async function fetchSubtitleBody(
  network: NetworkAdapter,
  url: string,
  signal?: AbortSignal,
): Promise<unknown[]> {
  const payload = await network.json<{ body?: unknown }>(url, {
    ...JSON_REQUEST,
    ...(signal ? { signal } : {}),
  });
  return Array.isArray(payload?.body) ? payload.body : [];
}

export async function fetchSubtitleTracks(
  network: NetworkAdapter,
  meta: SubtitleMeta,
  signal?: AbortSignal,
): Promise<SubtitleTrack[]> {
  let lastError: unknown = null;

  for (const endpoint of subtitle.trackEndpoints(meta)) {
    try {
      const payload = await network.json<
        BilibiliPayload<{ subtitle?: { subtitles?: unknown } }>
      >(endpoint, { ...JSON_REQUEST, ...(signal ? { signal } : {}) });

      if (payload?.code === 0) {
        const tracks = payload.data?.subtitle?.subtitles;
        if (Array.isArray(tracks)) return subtitle.normalizeTracks(tracks);
      }
      lastError = new Error(payload?.message || "字幕轨道接口返回失败");
    } catch (error) {
      if ((error as { name?: string })?.name === "AbortError") throw error;
      lastError = error;
    }
  }

  throw lastError || new Error("无法取得字幕轨道");
}
