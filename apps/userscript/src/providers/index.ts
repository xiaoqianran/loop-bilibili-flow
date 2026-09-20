import { bilibiliProvider } from "./bilibili";
import { bilibiliTranscriptSource } from "./bilibili-transcript";
import { createProviderRegistry } from "./registry";
import { createTranscriptSourceRegistry } from "./transcript";

export const providerRegistry = createProviderRegistry([bilibiliProvider]);
export const transcriptSourceRegistry = createTranscriptSourceRegistry([
  bilibiliTranscriptSource,
]);

export { bilibiliProvider } from "./bilibili";
export type { BilibiliCurrentVideoRef } from "./bilibili";
export { bilibiliTranscriptSource } from "./bilibili-transcript";
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
