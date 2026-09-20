import * as bilibili from "@subbatch/bilibili";

import {
  contentRefKey,
  type ContentProvider,
  type ProviderPageContext,
  type ResolvedContent,
} from "./types";

export interface BilibiliCurrentVideoRef extends bilibili.PlayingVideoSnapshot {
  ctx: bilibili.BilibiliContext;
}

function pageFromHref(href: string): number {
  try {
    return Math.max(1, Number(new URL(href).searchParams.get("p")) || 1);
  } catch {
    return 1;
  }
}

function matchesBilibili(href: string): boolean {
  try {
    const host = new URL(href).hostname.toLowerCase();
    return host === "bilibili.com" || host.endsWith(".bilibili.com");
  } catch {
    return false;
  }
}

function resolveCurrent(
  context: ProviderPageContext,
): ResolvedContent<BilibiliCurrentVideoRef> | null {
  const ctx = bilibili.route.detect(context.href);
  const playing = bilibili.route.playingHint(context.pageRuntime);
  const ref = bilibili.route.resolveVideo({
    href: context.href,
    urlBvid: ctx.bvid || bilibili.route.bvidFrom(context.href),
    urlPage: ctx.page || pageFromHref(context.href),
    playing,
  });
  if (!ref) return null;

  const native: BilibiliCurrentVideoRef = { ...ref, ctx };
  const contentRef = {
    source: bilibili.BILIBILI_SOURCE,
    sourceId: ref.bvid,
    segmentId: "P" + Math.max(1, Number(ref.page) || 1),
    url: context.href,
  };

  return {
    ref: contentRef,
    key: contentRefKey(contentRef),
    native,
  };
}

export const bilibiliProvider: ContentProvider<BilibiliCurrentVideoRef> = {
  id: bilibili.BILIBILI_SOURCE,
  matches: matchesBilibili,
  resolveCurrent,
  activationState(context) {
    if (!bilibili.route.isCarrierShell(context.href)) return "ready";
    return resolveCurrent(context) ? "ready" : "defer";
  },
};
