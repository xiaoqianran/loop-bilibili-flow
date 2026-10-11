import * as youtube from "@subbatch/youtube";

import {
  contentRefKey,
  type ContentProvider,
  type ProviderPageContext,
  type ResolvedContent,
} from "./types";

export interface YoutubeCurrentVideoRef {
  videoId: string;
  kind: string;
  title?: string;
  author?: string;
  playerResponse?: youtube.YoutubePlayerResponse;
}

function resolveCurrent(
  context: ProviderPageContext,
): ResolvedContent<YoutubeCurrentVideoRef> | null {
  const current = youtube.resolveCurrentVideo(context.href, context.pageRuntime);
  if (!current) return null;

  const ref = {
    source: youtube.YOUTUBE_SOURCE,
    sourceId: current.videoId,
    segmentId: "main",
    url: context.href,
  };
  return {
    ref,
    key: contentRefKey(ref),
    native: current,
  };
}

export const youtubeProvider: ContentProvider<YoutubeCurrentVideoRef> = {
  id: youtube.YOUTUBE_SOURCE,
  matches: youtube.matchesYoutubeUrl,
  resolveCurrent,
  navigationEvents: ["yt-navigate-finish"],
};
