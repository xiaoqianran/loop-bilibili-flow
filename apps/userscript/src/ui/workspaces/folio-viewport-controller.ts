/** Owns exactly one scroll/resize subscription per reader viewport. */
export interface FolioViewportCallbacks {
  onScroll(): void;
  onResize(): void;
}

const activeFolioViewportSubscriptions = new WeakMap<Element, () => void>();

/** Release listeners on a replaced reading page or before switching to Markdown. */
export function releaseFolioViewport(box: Element | null | undefined): void {
  if (!box) return;
  activeFolioViewportSubscriptions.get(box)?.();
}

/** Binds the viewport without retaining old TOC DOM across repeated renders. */
export function bindFolioViewport(box: Element, callbacks: FolioViewportCallbacks): () => void {
  releaseFolioViewport(box);
  box.addEventListener("scroll", callbacks.onScroll, { passive: true });
  window.addEventListener("resize", callbacks.onResize);
  const observer = typeof ResizeObserver === "function"
    ? new ResizeObserver(callbacks.onResize)
    : null;
  observer?.observe(box);
  let disposed = false;
  const dispose = () => {
    if (disposed) return;
    disposed = true;
    box.removeEventListener("scroll", callbacks.onScroll);
    window.removeEventListener("resize", callbacks.onResize);
    observer?.disconnect();
    activeFolioViewportSubscriptions.delete(box);
  };
  activeFolioViewportSubscriptions.set(box, dispose);
  callbacks.onResize();
  callbacks.onScroll();
  return dispose;
}
