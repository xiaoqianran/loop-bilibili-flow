import * as libraryScanController from "./library-scan-controller";
import * as libraryJobController from "./library-job-controller";
import * as batchCoordinator from "./ai-batch-coordinator";
import * as preprocessController from "./preprocess-controller";
import * as knowledgeController from "./knowledge-controller";
import * as acquisitionApi from "./acquisition";
import * as aiController from "./ai-controller";
import * as studioController from "./studio-controller";
import * as knowledgeRepository from "./knowledge-repository";
import { resolve as resolveContent } from "./current-content";
import { acquire as acquireTranscript, acquireDetailed as acquireTranscriptDetailed } from "./current-transcript";
import { resolve as resolveVideo } from "./current-video";
import { observe } from "./navigation";
import { start } from "./video-carrier";

export const libraryScan = {
  collectPages: libraryScanController.collectPages,
  mergeItems: libraryScanController.mergeScanItems,
  assertActive: libraryScanController.assertScanActive,
} as const;

export const libraryJob = {
  currentKind: libraryJobController.currentKind,
  isPaused: libraryJobController.isPaused,
  setBusy: libraryJobController.setBusy,
  setProgress: libraryJobController.setProgress,
  clearProgress: libraryJobController.clearProgress,
  togglePause: libraryJobController.togglePause,
  stop: libraryJobController.stop,
  waitWhilePaused: libraryJobController.waitWhilePaused,
  view: libraryJobController.view,
} as const;

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
  createCoordinator: batchCoordinator.createCoordinator,
  planTasks: batchCoordinator.planTasks,
  partitionRuns: batchCoordinator.partitionRuns,
  executeTasks: batchCoordinator.executeTasks,
  cloneSessionInput: batchCoordinator.cloneSessionInput,
  summarizeRuns: batchCoordinator.summarizeRuns,
  ensureSubtitles: batchCoordinator.ensureSubtitles,
  prepareBatchInput: batchCoordinator.prepareBatchInput,
  hydratePlannedRuns: batchCoordinator.hydratePlannedRuns,
  request: aiController.request,
  runPool: aiController.runPool,
} as const;

export const preprocess = {
  settings: preprocessController.settings,
  parseTimestamp: preprocessController.parseTimestamp,
  readingBlocks: preprocessController.readingBlocks,
  buildPayload: preprocessController.buildPayload,
  prepareJobs: preprocessController.prepareJobs,
  runChunkWithRetry: preprocessController.runChunkWithRetry,
  runPipeline: preprocessController.runPipeline,
} as const;

export const studio = {
  parseStore: studioController.parseStore,
  persist: studioController.persist,
  restore: studioController.restore,
  buildChatMessages: studioController.buildChatMessages,
} as const;

export const knowledge = {
  createController: knowledgeController.createController,
  selectAnchor: knowledgeController.selectAnchor,
  runAnswer: knowledgeController.runAnswer,
  completeAnswer: knowledgeController.completeAnswer,
  failAnswer: knowledgeController.failAnswer,
  removeAnchor: knowledgeController.removeAnchor,
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
