import * as acquisitionApi from "./acquisition";
import { resolve } from "./current-video";
import { observe } from "./navigation";
import { start } from "./video-carrier";

export const video = {
  resolve,
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
export * from "./current-video";
export * from "./navigation";
export * from "./video-carrier";
