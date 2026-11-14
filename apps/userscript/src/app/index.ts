import * as acquisitionApi from "./acquisition";
import * as aiController from "./ai-controller";
import * as studioController from "./studio-controller";
import * as knowledgeRepository from "./knowledge-repository";
import { resolve as resolveContent } from "./current-content";
import { acquire as acquireTranscript, acquireDetailed as acquireTranscriptDetailed } from "./current-transcript";
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
  acquireDetailed: acquireTranscriptDetailed,
} as const;

export const ai = {
  request: aiController.request,
  runPool: aiController.runPool,
} as const;

export const studio = {
  parseStore: studioController.parseStore,
  persist: studioController.persist,
  restore: studioController.restore,
  buildChatMessages: studioController.buildChatMessages,
} as const;

export const knowledge = {
  createRepository: knowledgeRepository.createRepository,
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
