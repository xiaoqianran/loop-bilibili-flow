import * as acquisitionApi from "./acquisition";
import * as routeApi from "./route";
import * as wbiApi from "./wbi";

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
  url: acquisitionApi.videoViewUrl,
  runtimeView: acquisitionApi.runtimeVideoView,
  isChargeBlocked: acquisitionApi.isChargeBlocked,
  pageMeta: acquisitionApi.pageMeta,
} as const;

export const subtitle = {
  normalizeUrl: acquisitionApi.normalizeSubtitleUrl,
  normalizeTracks: acquisitionApi.normalizeTracks,
  runtimeTracks: acquisitionApi.runtimeSubtitleTracks,
  playerUrl: acquisitionApi.subtitlePlayerUrl,
  dmUrl: acquisitionApi.subtitleDmUrl,
  aiStatUrl: acquisitionApi.subtitleAiStatUrl,
  pickTrack: acquisitionApi.pickTrack,
  preferredIndex: acquisitionApi.preferredTrackIndex,
} as const;

export const wbi = {
  navUrl: wbiApi.navUrl,
  videoDetailUrl: wbiApi.videoDetailUrl,
  playerUrl: wbiApi.playerUrl,
  keyFromUrl: wbiApi.keyFromUrl,
  sign: wbiApi.sign,
} as const;

// Compatibility flat exports.
export * from "./route";
export * from "./acquisition";
export * from "./wbi";
