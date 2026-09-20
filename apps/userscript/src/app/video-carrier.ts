import { providerRegistry } from "../providers";

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
 * Provider-specific activation rules live in the provider adapter. The app
 * only asks whether the current page is ready or should defer activation.
 */
export function start(
  options: UserscriptLifecycleOptions,
): () => void {
  const activationState = () =>
    providerRegistry.activationState({
      href: options.href(),
      pageRuntime: options.pageWindow,
    });

  if (activationState() === "ready") {
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
    if (activationState() === "ready") bootOnce();
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

/** @deprecated Use `activation.start` from the app namespace. */
export const startUserscriptLifecycle = start;
