import type { TranscriptSegment } from "@subbatch/schemas";
import * as youtube from "@subbatch/youtube";

import type { YoutubeCurrentVideoRef } from "./youtube";
import type { ResolvedContent } from "./types";
import type {
  AcquiredTranscript,
  TranscriptAcquireContext,
  TranscriptSource,
} from "./transcript";

const SEGMENT_SELECTOR =
  "ytd-transcript-segment-renderer, transcript-segment-view-model";

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object"
    ? (value as Record<string, unknown>)
    : null;
}

function runtimeDocument(runtime: unknown): Document | null {
  const root = asRecord(runtime);
  const value = root?.document;
  return value && typeof value === "object" ? (value as Document) : null;
}

function preferredLanguages(runtime: unknown): string[] {
  const root = asRecord(runtime);
  const navigator = asRecord(root?.navigator);
  const languages = Array.isArray(navigator?.languages)
    ? navigator.languages.map((value) => String(value || "").trim()).filter(Boolean)
    : [];
  const language = String(navigator?.language || "").trim();
  if (language && !languages.includes(language)) languages.push(language);
  return languages;
}

async function requestText(
  context: TranscriptAcquireContext,
  url: string,
): Promise<string> {
  const response = await context.network.request(url, {
    credentials: "include",
    cache: "no-store",
    fallback: "network-or-http",
    ...(context.signal ? { signal: context.signal } : {}),
  });
  if (!response.ok) {
    throw new Error(`YouTube request failed (${response.status})`);
  }
  return response.text;
}

async function acquireFromCaptionTrack(
  resolved: ResolvedContent<YoutubeCurrentVideoRef>,
  context: TranscriptAcquireContext,
): Promise<AcquiredTranscript | null> {
  const native = resolved.native as YoutubeCurrentVideoRef;
  const videoId = String(native.videoId || resolved.ref.sourceId).trim();
  if (!videoId) return null;

  let response =
    native.playerResponse ??
    youtube.runtimePlayerResponse(context.pageRuntime, videoId);
  let tracks = youtube.captionTracks(response);

  if (!tracks.length) {
    const watchUrl = youtube.videoWatchUrl(videoId);
    if (!watchUrl) return null;
    const html = await requestText(context, watchUrl);
    response = youtube.playerResponseFromHtml(html);
    tracks = youtube.captionTracks(response);
  }

  const track = youtube.pickCaptionTrack(
    tracks,
    preferredLanguages(context.pageRuntime),
  );
  const captionUrl = youtube.captionJson3Url(track);
  if (!track || !captionUrl) return null;

  const captionText = await requestText(context, captionUrl);
  let payload: unknown;
  try {
    payload = JSON.parse(captionText);
  } catch {
    return null;
  }
  const segments: TranscriptSegment[] =
    youtube.parseJson3Transcript(payload);
  if (!segments.length) return null;

  return {
    ref: resolved.ref,
    segments,
    language: track.languageCode,
    origin: "caption_track",
    metadata: {
      track: {
        languageCode: track.languageCode,
        name: track.name,
        ...(track.kind ? { kind: track.kind } : {}),
        ...(track.vssId ? { vssId: track.vssId } : {}),
      },
    },
  };
}

function secondsFromLabel(label: string): number | null {
  const parts = String(label || "")
    .trim()
    .split(":")
    .map((part) => Number(part));
  if (
    !parts.length ||
    parts.length > 3 ||
    parts.some((part) => !Number.isFinite(part) || part < 0)
  ) {
    return null;
  }
  if (parts.length === 2) return parts[0]! * 60 + parts[1]!;
  if (parts.length === 3) {
    return parts[0]! * 3600 + parts[1]! * 60 + parts[2]!;
  }
  return parts[0]!;
}

function textOf(element: Element | null): string {
  return String(element?.textContent || "").replace(/\s+/g, " ").trim();
}

function parseDomTranscript(document: Document): TranscriptSegment[] {
  const first = document.querySelector(SEGMENT_SELECTOR);
  const scope =
    first?.closest("ytd-engagement-panel-section-list-renderer") ?? document;
  const nodes = [...scope.querySelectorAll(SEGMENT_SELECTOR)];

  const draft = nodes.flatMap((element, index) => {
    const classic = element.matches("ytd-transcript-segment-renderer");
    const timestamp = textOf(
      element.querySelector(
        classic ? ".segment-timestamp" : '[class*="Timestamp"]',
      ),
    );
    const text = textOf(
      element.querySelector(
        classic
          ? ".segment-text"
          : '.ytAttributedStringHost, [class*="AttributedString"]',
      ),
    );
    const start = secondsFromLabel(timestamp);
    if (start === null || !text) return [];
    return [{ id: String(index + 1), start, text }];
  });

  return draft.map((segment, index) => {
    const next = draft[index + 1];
    return {
      ...segment,
      ...(next && next.start >= segment.start ? { end: next.start } : {}),
    };
  });
}

function findTranscriptButton(document: Document): Element | null {
  return (
    document.querySelector(
      "ytd-video-description-transcript-section-renderer button, " +
        "ytd-video-description-transcript-section-renderer tp-yt-paper-button",
    ) ??
    document.querySelector('button[aria-label*="transcript" i]')
  );
}

function hasDomTranscript(document: Document): boolean {
  return document.querySelector(SEGMENT_SELECTOR) != null;
}

async function waitFor(
  predicate: () => boolean,
  timeoutMs: number,
  stepMs = 150,
): Promise<boolean> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (predicate()) return true;
    await new Promise<void>((resolve) => globalThis.setTimeout(resolve, stepMs));
  }
  return predicate();
}

async function ensureTranscriptPanel(document: Document): Promise<boolean> {
  if (hasDomTranscript(document)) return true;

  const expand = document.querySelector(
    "ytd-text-inline-expander #expand, ytd-watch-metadata #expand",
  ) as HTMLElement | null;
  if (expand && !findTranscriptButton(document)) {
    expand.click();
    await waitFor(() => findTranscriptButton(document) != null, 1500);
  }

  const button = findTranscriptButton(document) as HTMLElement | null;
  if (button) {
    button.click();
    await waitFor(() => hasDomTranscript(document), 5000);
  }
  return hasDomTranscript(document);
}

async function acquireFromDom(
  resolved: ResolvedContent<YoutubeCurrentVideoRef>,
  context: TranscriptAcquireContext,
): Promise<AcquiredTranscript | null> {
  const document = runtimeDocument(context.pageRuntime);
  if (!document) return null;
  const current = youtube.extractVideoRef(document.location?.href || "");
  if (current?.videoId !== resolved.ref.sourceId) return null;
  if (!(await ensureTranscriptPanel(document))) return null;

  const segments = parseDomTranscript(document);
  if (!segments.length) return null;
  return {
    ref: resolved.ref,
    segments,
    origin: "transcript_panel",
    metadata: {},
  };
}

export const youtubeTranscriptSource: TranscriptSource = {
  id: youtube.YOUTUBE_SOURCE,

  async acquire(resolved, context): Promise<AcquiredTranscript | null> {
    const current = resolved as ResolvedContent<YoutubeCurrentVideoRef>;
    try {
      const network = await acquireFromCaptionTrack(current, context);
      if (network) return network;
    } catch (error) {
      if (context.signal?.aborted) throw error;
    }
    return acquireFromDom(current, context);
  },
};
