import { spa } from "@subbatch/runtime";

import { providerRegistry } from "../providers";

export interface NavigationLifecycleOptions {
  pageWindow: Window;
  eventWindow: Window;
  document: Document;
  onNavigate: () => void;
  onPageShow?: () => void;
  onVisible?: () => void;
  pollMs?: number;
}

/**
 * Shared History hooks and URL deduplication are owned by runtime.spa.
 * The app additionally watches the live player: Bilibili can switch the
 * active video before (or without) changing the URL.
 */
export function observe(options: NavigationLifecycleOptions): () => void {
  const getHref = () =>
    String(options.pageWindow.location?.href || options.eventWindow.location?.href || "");

  const contentIdentity = (): string => {
    const resolved = providerRegistry.resolveCurrent({
      href: getHref(),
      pageRuntime: options.pageWindow,
    });
    if (!resolved) return "";
    // On media-carrier pages CID may change before the BV/page URL does.
    const native = resolved.native as { cid?: unknown } | null;
    return `${resolved.key}:${Number(native?.cid) || 0}`;
  };

  let lastHref = getHref();
  let lastIdentity = contentIdentity();
  let disposed = false;

  const notify = (force = false) => {
    if (disposed) return;
    const href = getHref();
    const identity = contentIdentity();
    if (!force && href === lastHref && identity === lastIdentity) return;
    lastHref = href;
    lastIdentity = identity;
    options.onNavigate();
  };

  const spaHandle = spa.observe(
    {
      historyWindow: options.pageWindow,
      eventWindow: options.eventWindow,
      documentRef: options.document,
      getHref,
      pollIntervalMs: 0,
      setTimeoutFn: options.eventWindow.setTimeout.bind(options.eventWindow) as typeof setTimeout,
    },
    () => notify(),
  );

  // pageWindow and eventWindow can be distinct wrappers in a userscript.
  const onHistoryEvent = () => {
    spaHandle.check();
    notify();
  };
  const onPageShow = () => options.onPageShow?.();
  const onVisibilityChange = () => {
    if (options.document.visibilityState === "visible") options.onVisible?.();
  };
  const onMediaLoad = (event: Event) => {
    const tag = (event.target as Element | null)?.tagName;
    if (tag === "VIDEO" || tag === "AUDIO") notify(true);
  };
  const onProviderNavigate = () => {
    spaHandle.check();
    notify(true);
  };

  options.pageWindow.addEventListener("popstate", onHistoryEvent);
  options.pageWindow.addEventListener("hashchange", onHistoryEvent);
  const providerNavigationEvents = providerRegistry.navigationEvents();
  for (const eventName of providerNavigationEvents) {
    options.pageWindow.addEventListener(eventName, onProviderNavigate);
  }
  options.eventWindow.addEventListener("pageshow", onPageShow);
  options.document.addEventListener("visibilitychange", onVisibilityChange);
  options.document.addEventListener("loadstart", onMediaLoad, true);

  const timer = options.eventWindow.setInterval(() => {
    // Background playback can advance without a media event or URL update.
    // Continue checking identity while hidden; unchanged polls are deduplicated.
    spaHandle.check();
    notify();
  }, options.pollMs ?? 800);

  return () => {
    if (disposed) return;
    disposed = true;
    options.eventWindow.clearInterval(timer);
    options.pageWindow.removeEventListener("popstate", onHistoryEvent);
    options.pageWindow.removeEventListener("hashchange", onHistoryEvent);
    for (const eventName of providerNavigationEvents) {
      options.pageWindow.removeEventListener(eventName, onProviderNavigate);
    }
    options.eventWindow.removeEventListener("pageshow", onPageShow);
    options.document.removeEventListener("visibilitychange", onVisibilityChange);
    options.document.removeEventListener("loadstart", onMediaLoad, true);
    spaHandle.dispose();
  };
}
