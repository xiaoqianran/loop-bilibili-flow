// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { bindFolioViewport, releaseFolioViewport } from "../../apps/userscript/src/ui/workspaces/folio-viewport-controller";

afterEach(() => {
  document.body.replaceChildren();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("HTML folio viewport lifecycle", () => {
  it("replaces scroll, resize and ResizeObserver subscriptions on repeated renders", () => {
    const disconnects = vi.fn();
    const observed = vi.fn();
    class FakeResizeObserver {
      constructor(readonly callback: ResizeObserverCallback) {}
      observe = observed;
      disconnect = disconnects;
    }
    vi.stubGlobal("ResizeObserver", FakeResizeObserver);
    const box = document.createElement("div");
    document.body.appendChild(box);
    const first = { onScroll: vi.fn(), onResize: vi.fn() };
    const stopFirst = bindFolioViewport(box, first);
    expect(first.onScroll).toHaveBeenCalledTimes(1);
    expect(first.onResize).toHaveBeenCalledTimes(1);
    const second = { onScroll: vi.fn(), onResize: vi.fn() };
    bindFolioViewport(box, second);
    expect(disconnects).toHaveBeenCalledTimes(1);
    window.dispatchEvent(new Event("resize"));
    box.dispatchEvent(new Event("scroll"));
    expect(first.onScroll).toHaveBeenCalledTimes(1);
    expect(first.onResize).toHaveBeenCalledTimes(1);
    expect(second.onScroll).toHaveBeenCalledTimes(2);
    expect(second.onResize).toHaveBeenCalledTimes(2);
    expect(observed).toHaveBeenCalledTimes(2);
    stopFirst();
    releaseFolioViewport(box);
    releaseFolioViewport(box);
    expect(disconnects).toHaveBeenCalledTimes(2);
    window.dispatchEvent(new Event("resize"));
    box.dispatchEvent(new Event("scroll"));
    expect(second.onScroll).toHaveBeenCalledTimes(2);
    expect(second.onResize).toHaveBeenCalledTimes(2);
  });

  it("works without ResizeObserver and releases the live viewport on Markdown switch", () => {
    vi.stubGlobal("ResizeObserver", undefined);
    const box = document.createElement("div");
    const listeners = { onScroll: vi.fn(), onResize: vi.fn() };
    bindFolioViewport(box, listeners);
    box.dispatchEvent(new Event("scroll"));
    expect(listeners.onScroll).toHaveBeenCalledTimes(2);
    releaseFolioViewport(box);
    box.dispatchEvent(new Event("scroll"));
    expect(listeners.onScroll).toHaveBeenCalledTimes(2);
    expect(() => releaseFolioViewport(null)).not.toThrow();
  });
});
