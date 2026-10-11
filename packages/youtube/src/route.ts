export const YOUTUBE_SOURCE = "youtube";

const VIDEO_ID_PATTERN = /^[A-Za-z0-9_-]{11}$/;

export type YoutubeRouteKind =
  | "watch"
  | "shorts"
  | "live"
  | "embed"
  | "shortlink";

export interface YoutubeRouteRef {
  videoId: string;
  kind: YoutubeRouteKind;
}

function validVideoId(value: unknown): string {
  const id = String(value || "").trim();
  return VIDEO_ID_PATTERN.test(id) ? id : "";
}

export function isYoutubeHost(hostname: string): boolean {
  const host = String(hostname || "").toLowerCase();
  return (
    host === "youtube.com" ||
    host.endsWith(".youtube.com") ||
    host === "youtu.be" ||
    host.endsWith(".youtu.be")
  );
}

export function matchesYoutubeUrl(href: string): boolean {
  try {
    return isYoutubeHost(new URL(href).hostname);
  } catch {
    return false;
  }
}

export function extractVideoRef(href: string): YoutubeRouteRef | null {
  let url: URL;
  try {
    url = new URL(href);
  } catch {
    return null;
  }
  if (!isYoutubeHost(url.hostname)) return null;

  const host = url.hostname.toLowerCase();
  if (host === "youtu.be" || host.endsWith(".youtu.be")) {
    const id = validVideoId(url.pathname.split("/").filter(Boolean)[0]);
    return id ? { videoId: id, kind: "shortlink" } : null;
  }

  if (url.pathname === "/watch") {
    const id = validVideoId(url.searchParams.get("v"));
    return id ? { videoId: id, kind: "watch" } : null;
  }

  for (const [prefix, kind] of [
    ["/shorts/", "shorts"],
    ["/live/", "live"],
    ["/embed/", "embed"],
  ] as const) {
    if (!url.pathname.startsWith(prefix)) continue;
    const id = validVideoId(url.pathname.slice(prefix.length).split("/")[0]);
    return id ? { videoId: id, kind } : null;
  }

  return null;
}

export function videoWatchUrl(videoId: string): string {
  const id = validVideoId(videoId);
  return id ? `https://www.youtube.com/watch?v=${id}` : "";
}
