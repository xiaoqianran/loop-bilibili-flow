import * as bilibili from "@subbatch/bilibili";

export interface CurrentVideoRef extends bilibili.PlayingVideoSnapshot {
  ctx: bilibili.BilibiliContext;
}

function pageFromHref(href: string): number {
  try {
    return Math.max(1, Number(new URL(href).searchParams.get("p")) || 1);
  } catch {
    return 1;
  }
}

/**
 * Resolve the video that is actually playing on the current page.
 *
 * Application code owns the browser/runtime read; Bilibili package owns the
 * identity rules. Live player state wins over stale URL state.
 */
export function resolve(
  href: string,
  pageRuntime: unknown,
): CurrentVideoRef | null {
  const ctx = bilibili.route.detect(href);
  const playing = bilibili.route.playingHint(pageRuntime);
  const ref = bilibili.route.resolveVideo({
    href,
    urlBvid: ctx.bvid || bilibili.route.bvidFrom(href),
    urlPage: ctx.page || pageFromHref(href),
    playing,
  });
  return ref ? { ...ref, ctx } : null;
}

/** @deprecated Use `video.resolve` from the app namespace. */
export const resolveCurrentVideoRef = resolve;
