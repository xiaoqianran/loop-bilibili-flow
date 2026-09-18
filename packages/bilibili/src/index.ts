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

// Compatibility flat exports.
export * from "./route";
export * from "./subtitle";
