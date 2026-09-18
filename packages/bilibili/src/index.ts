import * as acquisitionApi from "./acquisition";
import * as routeApi from "./route";

export const BILIBILI_SOURCE = "bilibili";

export const route = {
  isCarrierShell: routeApi.isVideoCarrierShell,
  bvidFrom: routeApi.extractBvid,
  hasCarrierIdentity: routeApi.hasVideoCarrierIdentity,
  videoKey: routeApi.routeVideoKey,
  pickIds: routeApi.pickHintIds,
  urlHints: routeApi.extractUrlHints,
  detect: routeApi.detectContext,
  pageFromCid: routeApi.pageFromCid,
  playingHint: routeApi.extractPlayingVideoHint,
  resolveVideo: routeApi.resolvePlayingVideoRef,
  videoChanged: routeApi.playingVideoChanged,
} as const;

export const video = {
  runtimeView: acquisitionApi.runtimeVideoView,
  isChargeBlocked: acquisitionApi.isChargeBlocked,
  pageMeta: acquisitionApi.pageMeta,
} as const;

export const subtitle = {
  normalizeUrl: acquisitionApi.normalizeSubtitleUrl,
  normalizeTracks: acquisitionApi.normalizeTracks,
  runtimeTracks: acquisitionApi.runtimeSubtitleTracks,
  trackEndpoints: acquisitionApi.trackEndpoints,
  pickTrack: acquisitionApi.pickTrack,
  preferredIndex: acquisitionApi.preferredTrackIndex,
} as const;

// Compatibility flat exports.
export * from "./route";
export * from "./acquisition";
