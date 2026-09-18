import {
  hasVideoCarrierIdentity,
  isVideoCarrierShell,
} from "@subbatch/bilibili";

import { resolveCurrentVideoRef } from "./current-video";

export interface UserscriptLifecycleOptions {
  pageWindow: Window;
  eventWindow: Window;
  document: Document;
  href: () => string;
  boot: () => void;
  pollMs?: number;
}

/**
 * Own the userscript activation boundary.
 *
 * Normal supported pages boot immediately. Activity shells such as
 * /festival/* and /blackboard/* defer boot until a real BV can be observed
 * from the URL or live player state.
 */
export function startUserscriptLifecycle(
  options: UserscriptLifecycleOptions,
): () => void {
  if (!isVideoCarrierShell(options.href())) {
    options.boot();
    return () => {};
  }

  let booted = false;
  let timer = 0;

  const cleanup = () => {
    if (timer) options.eventWindow.clearInterval(timer);
    timer = 0;
    options.pageWindow.removeEventListener("popstate", onCandidate);
    options.pageWindow.removeEventListener("hashchange", onCandidate);
    options.eventWindow.removeEventListener("pageshow", onCandidate);
    options.document.removeEventListener("loadstart", onMediaCandidate, true);
  };

  const bootOnce = () => {
    if (booted) return;
    booted = true;
    cleanup();
    options.boot();
  };

  const tryActivate = () => {
    if (booted) {
      cleanup();
      return;
    }
    const href = options.href();
    if (!isVideoCarrierShell(href)) {
      bootOnce();
      return;
    }

    const ref = resolveCurrentVideoRef(href, options.pageWindow);
    if (hasVideoCarrierIdentity(href, ref?.bvid || "")) bootOnce();
  };

  const onCandidate = () => {
    options.eventWindow.setTimeout(tryActivate, 0);
  };

  const onMediaCandidate = (event: Event) => {
    const target = event.target as Element | null;
    if (target?.tagName === "VIDEO" || target?.tagName === "AUDIO") {
      onCandidate();
    }
  };

  options.pageWindow.addEventListener("popstate", onCandidate);
  options.pageWindow.addEventListener("hashchange", onCandidate);
  options.eventWindow.addEventListener("pageshow", onCandidate);
  options.document.addEventListener("loadstart", onMediaCandidate, true);

  timer = options.eventWindow.setInterval(() => {
    if (options.document.visibilityState === "visible") tryActivate();
  }, options.pollMs ?? 1500);

  tryActivate();
  return cleanup;
}
