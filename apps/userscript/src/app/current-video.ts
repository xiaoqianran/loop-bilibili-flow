import {
  bilibiliProvider,
  type BilibiliCurrentVideoRef,
} from "../providers";
import { resolve as resolveContent } from "./current-content";

export type CurrentVideoRef = BilibiliCurrentVideoRef;

/**
 * Compatibility view for callers that still consume the Bilibili-native
 * current-video shape. Provider-neutral code should use app.content.resolve().
 */
export function resolve(
  href: string,
  pageRuntime: unknown,
): CurrentVideoRef | null {
  const resolved = resolveContent(href, pageRuntime);
  if (!resolved || resolved.ref.source !== bilibiliProvider.id) return null;
  return resolved.native as CurrentVideoRef;
}

/** @deprecated Use `video.resolve` from the app namespace. */
export const resolveCurrentVideoRef = resolve;
