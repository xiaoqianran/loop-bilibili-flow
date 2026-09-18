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
 * Install browser navigation observation for Bilibili SPA/player changes.
 *
 * This owns the imperative history/event wiring; product code only supplies
 * callbacks describing what a navigation means for the application.
 */
export function installNavigationLifecycle(
  options: NavigationLifecycleOptions,
): () => void {
  const originalPush = options.pageWindow.history.pushState;
  const originalReplace = options.pageWindow.history.replaceState;

  const pushState: History["pushState"] = (...args) => {
    const result = originalPush.apply(options.pageWindow.history, args);
    options.eventWindow.setTimeout(options.onNavigate, 0);
    return result;
  };
  const replaceState: History["replaceState"] = (...args) => {
    const result = originalReplace.apply(options.pageWindow.history, args);
    options.eventWindow.setTimeout(options.onNavigate, 0);
    return result;
  };

  options.pageWindow.history.pushState = pushState;
  options.pageWindow.history.replaceState = replaceState;

  const onPageShow = () => {
    options.onNavigate();
    options.onPageShow?.();
  };
  const onVisibilityChange = () => {
    if (options.document.visibilityState !== "visible") return;
    options.onNavigate();
    options.onVisible?.();
  };
  const onMediaLoad = (event: Event) => {
    const target = event.target as Element | null;
    if (target?.tagName === "VIDEO" || target?.tagName === "AUDIO") {
      options.onNavigate();
    }
  };

  options.pageWindow.addEventListener("popstate", options.onNavigate);
  options.pageWindow.addEventListener("hashchange", options.onNavigate);
  options.eventWindow.addEventListener("pageshow", onPageShow);
  options.document.addEventListener("visibilitychange", onVisibilityChange);
  options.document.addEventListener("loadstart", onMediaLoad, true);

  const timer = options.eventWindow.setInterval(
    options.onNavigate,
    options.pollMs ?? 800,
  );

  return () => {
    options.eventWindow.clearInterval(timer);
    options.pageWindow.removeEventListener("popstate", options.onNavigate);
    options.pageWindow.removeEventListener("hashchange", options.onNavigate);
    options.eventWindow.removeEventListener("pageshow", onPageShow);
    options.document.removeEventListener("visibilitychange", onVisibilityChange);
    options.document.removeEventListener("loadstart", onMediaLoad, true);
    if (options.pageWindow.history.pushState === pushState) {
      options.pageWindow.history.pushState = originalPush;
    }
    if (options.pageWindow.history.replaceState === replaceState) {
      options.pageWindow.history.replaceState = originalReplace;
    }
  };
}
