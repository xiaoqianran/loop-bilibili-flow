import * as bilibili from "@subbatch/bilibili";
import type { TranscriptSegment } from "@subbatch/schemas";

import {
  collectSubtitleTracks,
  fetchSubtitleBody,
  fetchVideoView,
  resolveSubtitleUrl,
} from "./bilibili-acquisition";
import type { BilibiliCurrentVideoRef } from "./bilibili";
import type {
  AcquiredTranscript,
  TranscriptSource,
} from "./transcript";

type RawCue = {
  sid?: number | string;
  from?: number | string;
  to?: number | string;
  content?: unknown;
};

function normalizeSegments(body: unknown[]): TranscriptSegment[] {
  const segments: TranscriptSegment[] = [];
  for (let index = 0; index < body.length; index += 1) {
    const cue = body[index] as RawCue | null;
    if (!cue || typeof cue !== "object") continue;
    const text = String(cue.content || "").trim();
    if (!text) continue;
    const start = Number(cue.from) || 0;
    const end = Number(cue.to);
    segments.push({
      id: String(cue.sid ?? index + 1),
      start,
      ...(Number.isFinite(end) ? { end } : {}),
      text,
    });
  }
  return segments;
}

export const bilibiliTranscriptSource: TranscriptSource = {
  id: bilibili.BILIBILI_SOURCE,

  async acquire(resolved, context): Promise<AcquiredTranscript | null> {
    const native = resolved.native as BilibiliCurrentVideoRef;
    const bvid = String(native.bvid || resolved.ref.sourceId).trim();
    if (!bvid) return null;

    let cid = Number(native.cid) || 0;
    let aid = Number(native.aid) || 0;

    if (!cid) {
      const view = await fetchVideoView(context.network, bvid, context.signal);
      if (bilibili.video.isChargeBlocked(view)) return null;
      const meta = bilibili.video.pageMeta(view, bvid, native.page || 1);
      cid = Number(meta.cid) || 0;
      aid = Number(meta.aid) || aid;
    }
    if (!cid) return null;

    const meta = {
      bvid,
      cid,
      ...(aid ? { aid } : {}),
    };
    const collected = await collectSubtitleTracks(
      context.network,
      meta,
      context.signal,
    );
    const track = bilibili.subtitle.pickTrack(collected.subs);
    if (!track) return null;

    const resolution = await resolveSubtitleUrl(
      context.network,
      track,
      { aid, cid },
      collected.source,
      context.signal,
    );
    if (!resolution.url) return null;

    const body = await fetchSubtitleBody(
      context.network,
      resolution.url,
      context.signal,
    );
    const segments = normalizeSegments(body);
    if (!segments.length) return null;

    const language = String(track.lan || "").trim();
    return {
      ref: resolved.ref,
      segments,
      ...(language ? { language } : {}),
      ...(resolution.source ? { origin: resolution.source } : {}),
      metadata: {
        track: { ...track },
      },
    };
  },
};
