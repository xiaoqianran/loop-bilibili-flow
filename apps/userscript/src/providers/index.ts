import { bilibiliProvider } from "./bilibili";
import { bilibiliTranscriptSource } from "./bilibili-transcript";
import { createProviderRegistry } from "./registry";
import { createTranscriptSourceRegistry } from "./transcript";
import { youtubeProvider } from "./youtube";
import { youtubeTranscriptSource } from "./youtube-transcript";

export const providerRegistry = createProviderRegistry([
  bilibiliProvider,
  youtubeProvider,
]);
export const transcriptSourceRegistry = createTranscriptSourceRegistry([
  bilibiliTranscriptSource,
  youtubeTranscriptSource,
]);

export { bilibiliProvider } from "./bilibili";
export type { BilibiliCurrentVideoRef } from "./bilibili";
export { bilibiliTranscriptSource } from "./bilibili-transcript";
export { youtubeProvider } from "./youtube";
export type { YoutubeCurrentVideoRef } from "./youtube";
export { youtubeTranscriptSource } from "./youtube-transcript";
export { createProviderRegistry } from "./registry";
export {
  createTranscriptSourceRegistry,
  type AcquiredTranscript,
  type TranscriptAcquireContext,
  type TranscriptSource,
  type TranscriptSourceRegistry,
} from "./transcript";
export {
  contentRefKey,
  type ContentProvider,
  type ProviderActivationState,
  type ProviderPageContext,
  type ProviderRegistry,
  type ResolvedContent,
} from "./types";
