import * as acquisitionApi from "./acquisition";
import { resolve as resolveContent } from "./current-content";
import { acquire as acquireTranscript } from "./current-transcript";
import { resolve as resolveVideo } from "./current-video";
import { observe } from "./navigation";
import { start } from "./video-carrier";

export const content = {
  resolve: resolveContent,
} as const;

export const video = {
  resolve: resolveVideo,
} as const;

export const transcript = {
  acquire: acquireTranscript,
} as const;

export const acquisition = {
  signWbi: acquisitionApi.signWbi,
  fetchVideoView: acquisitionApi.fetchVideoView,
  fetchVideoDetail: acquisitionApi.fetchVideoDetail,
  fetchSubtitleTracks: acquisitionApi.fetchSubtitleTracks,
  collectSubtitleTracks: acquisitionApi.collectSubtitleTracks,
  resolveSubtitleUrl: acquisitionApi.resolveSubtitleUrl,
  fetchSubtitleBody: acquisitionApi.fetchSubtitleBody,
} as const;

export const navigation = {
  observe,
} as const;

export const activation = {
  start,
} as const;

// Compatibility flat exports.
export * from "./acquisition";
export { resolveCurrentContent } from "./current-content";
export { acquireCurrentTranscript } from "./current-transcript";
export * from "./current-video";
export * from "./navigation";
export * from "./video-carrier";
