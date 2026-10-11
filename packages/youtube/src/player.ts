import { extractVideoRef } from "./route";

export interface YoutubeCaptionTrack {
  baseUrl: string;
  languageCode: string;
  name: string;
  kind?: string;
  vssId?: string;
  isTranslatable?: boolean;
}

export interface YoutubeVideoDetails {
  videoId: string;
  title?: string;
  author?: string;
}

export interface YoutubePlayerResponse {
  videoDetails?: {
    videoId?: unknown;
    title?: unknown;
    author?: unknown;
  } | null;
  captions?: {
    playerCaptionsTracklistRenderer?: {
      captionTracks?: unknown;
    } | null;
  } | null;
  playerResponse?: YoutubePlayerResponse | null;
}

function record(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object"
    ? (value as Record<string, unknown>)
    : null;
}

function textOf(value: unknown): string {
  const root = record(value);
  if (!root) return String(value || "").trim();
  const simple = String(root.simpleText || "").trim();
  if (simple) return simple;
  const runs = Array.isArray(root.runs) ? root.runs : [];
  return runs.map((run) => String(record(run)?.text || "")).join("").trim();
}

export function videoDetails(
  response: unknown,
): YoutubeVideoDetails | null {
  const root = record(response);
  const nested = record(root?.playerResponse);
  const details = record(root?.videoDetails) ?? record(nested?.videoDetails);
  const videoId = String(details?.videoId || "").trim();
  if (!/^[A-Za-z0-9_-]{11}$/.test(videoId)) return null;
  const title = String(details?.title || "").trim();
  const author = String(details?.author || "").trim();
  return {
    videoId,
    ...(title ? { title } : {}),
    ...(author ? { author } : {}),
  };
}

export function runtimePlayerResponse(
  runtime: unknown,
  expectedVideoId?: string,
): YoutubePlayerResponse | null {
  const root = record(runtime);
  if (!root) return null;

  const direct = root.ytInitialPlayerResponse;
  const ytplayer = record(root.ytplayer);
  const config = record(ytplayer?.config);
  const args = record(config?.args);
  const candidates: unknown[] = [direct];

  const serialized = args?.player_response;
  if (typeof serialized === "string" && serialized.trim()) {
    try {
      candidates.push(JSON.parse(serialized));
    } catch {
      /* ignore malformed page state */
    }
  }

  for (const candidate of candidates) {
    const details = videoDetails(candidate);
    if (!details) continue;
    if (expectedVideoId && details.videoId !== expectedVideoId) continue;
    return candidate as YoutubePlayerResponse;
  }
  return null;
}

export function resolveCurrentVideo(
  href: string,
  runtime: unknown,
): {
  videoId: string;
  kind: string;
  title?: string;
  author?: string;
  playerResponse?: YoutubePlayerResponse;
} | null {
  const route = extractVideoRef(href);
  if (!route) return null;

  const response = runtimePlayerResponse(runtime, route.videoId);
  const details = response ? videoDetails(response) : null;
  return {
    videoId: route.videoId,
    kind: route.kind,
    ...(details?.title ? { title: details.title } : {}),
    ...(details?.author ? { author: details.author } : {}),
    ...(response ? { playerResponse: response } : {}),
  };
}

function balancedJson(source: string, start: number): string {
  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let index = start; index < source.length; index += 1) {
    const char = source[index];
    if (inString) {
      if (escaped) {
        escaped = false;
      } else if (char === "\\") {
        escaped = true;
      } else if (char === '"') {
        inString = false;
      }
      continue;
    }
    if (char === '"') {
      inString = true;
      continue;
    }
    if (char === "{") depth += 1;
    else if (char === "}") {
      depth -= 1;
      if (depth === 0) return source.slice(start, index + 1);
    }
  }
  return "";
}

export function playerResponseFromHtml(
  html: string,
): YoutubePlayerResponse | null {
  const source = String(html || "");
  const markers = [
    "ytInitialPlayerResponse =",
    "ytInitialPlayerResponse=",
    'window["ytInitialPlayerResponse"] =',
    'window["ytInitialPlayerResponse"]=',
  ];
  for (const marker of markers) {
    let offset = source.indexOf(marker);
    while (offset >= 0) {
      const objectStart = source.indexOf("{", offset + marker.length);
      if (objectStart < 0) break;
      const json = balancedJson(source, objectStart);
      if (json) {
        try {
          const parsed = JSON.parse(json) as YoutubePlayerResponse;
          if (videoDetails(parsed)) return parsed;
        } catch {
          /* keep scanning */
        }
      }
      offset = source.indexOf(marker, offset + marker.length);
    }
  }
  return null;
}

export function captionTracks(
  response: unknown,
): YoutubeCaptionTrack[] {
  const root = record(response);
  const nested = record(root?.playerResponse);
  const captions =
    record(root?.captions) ??
    record(nested?.captions);
  const renderer = record(captions?.playerCaptionsTracklistRenderer);
  const tracks = Array.isArray(renderer?.captionTracks)
    ? renderer.captionTracks
    : [];

  return tracks.flatMap((value) => {
    const track = record(value);
    const baseUrl = String(track?.baseUrl || "").trim();
    const languageCode = String(track?.languageCode || "").trim();
    if (!baseUrl || !languageCode) return [];
    const name = textOf(track?.name) || languageCode;
    const kind = String(track?.kind || "").trim();
    const vssId = String(track?.vssId || "").trim();
    return [{
      baseUrl,
      languageCode,
      name,
      ...(kind ? { kind } : {}),
      ...(vssId ? { vssId } : {}),
      ...(typeof track?.isTranslatable === "boolean"
        ? { isTranslatable: track.isTranslatable }
        : {}),
    }];
  });
}

function languageScore(
  languageCode: string,
  preferred: readonly string[],
): number {
  const code = languageCode.toLowerCase();
  for (let index = 0; index < preferred.length; index += 1) {
    const wanted = String(preferred[index] || "").toLowerCase();
    if (!wanted) continue;
    if (code === wanted) return 1000 - index * 10;
    const codeBase = code.split("-")[0];
    const wantedBase = wanted.split("-")[0];
    if (codeBase && wantedBase && codeBase === wantedBase) {
      return 500 - index * 10;
    }
  }
  return 0;
}

export function pickCaptionTrack(
  tracks: readonly YoutubeCaptionTrack[] | null | undefined,
  preferredLanguages: readonly string[] = [],
): YoutubeCaptionTrack | null {
  if (!tracks?.length) return null;
  return [...tracks].sort((a, b) => {
    const language =
      languageScore(b.languageCode, preferredLanguages) -
      languageScore(a.languageCode, preferredLanguages);
    if (language) return language;
    const manualA = a.kind === "asr" ? 0 : 1;
    const manualB = b.kind === "asr" ? 0 : 1;
    return manualB - manualA;
  })[0] ?? null;
}

export function captionJson3Url(
  track: YoutubeCaptionTrack | null | undefined,
): string {
  const raw = String(track?.baseUrl || "").trim();
  if (!raw) return "";
  try {
    const url = new URL(raw);
    url.searchParams.set("fmt", "json3");
    return url.toString();
  } catch {
    return raw + (raw.includes("?") ? "&" : "?") + "fmt=json3";
  }
}

export interface YoutubeJson3Segment {
  id: string;
  start: number;
  end?: number;
  text: string;
}

export function parseJson3Transcript(payload: unknown): YoutubeJson3Segment[] {
  const root = record(payload);
  const events = Array.isArray(root?.events) ? root.events : [];
  const segments: YoutubeJson3Segment[] = [];

  for (let index = 0; index < events.length; index += 1) {
    const event = record(events[index]);
    if (!event) continue;
    const pieces = Array.isArray(event.segs) ? event.segs : [];
    const text = pieces
      .map((piece) => String(record(piece)?.utf8 || ""))
      .join("")
      .replace(/\s+/g, " ")
      .trim();
    if (!text) continue;

    const startMs = Number(event.tStartMs);
    if (!Number.isFinite(startMs)) continue;
    const durationMs = Number(event.dDurationMs);
    const start = startMs / 1000;
    const end = Number.isFinite(durationMs) && durationMs >= 0
      ? (startMs + durationMs) / 1000
      : undefined;
    segments.push({
      id: String(index + 1),
      start,
      ...(end !== undefined ? { end } : {}),
      text,
    });
  }
  return segments;
}
