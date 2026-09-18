import { describe, expect, it } from "vitest";

import {
  activation,
  navigation,
  video,
} from "../../apps/userscript/src/app";

class FakeTarget {
  private listeners = new Map<string, Set<(event: Event) => void>>();

  addEventListener(type: string, listener: EventListenerOrEventListenerObject): void {
    const fn =
      typeof listener === "function"
        ? listener
        : (event: Event) => listener.handleEvent(event);
    const bucket = this.listeners.get(type) ?? new Set<(event: Event) => void>();
    bucket.add(fn);
    this.listeners.set(type, bucket);
  }

  removeEventListener(type: string, listener: EventListenerOrEventListenerObject): void {
    if (typeof listener !== "function") return;
    this.listeners.get(type)?.delete(listener);
  }

  emit(type: string, event = { target: null } as unknown as Event): void {
    for (const listener of this.listeners.get(type) ?? []) listener(event);
  }
}

class FakeWindow extends FakeTarget {
  player?: unknown;
  interval: (() => void) | null = null;
  history = {
    pushState: () => {},
    replaceState: () => {},
  } as unknown as History;

  setTimeout(handler: TimerHandler): number {
    if (typeof handler === "function") handler();
    return 1;
  }

  setInterval(handler: TimerHandler): number {
    if (typeof handler === "function") this.interval = () => handler();
    return 1;
  }

  clearInterval(): void {
    this.interval = null;
  }
}

class FakeDocument extends FakeTarget {
  visibilityState: DocumentVisibilityState = "visible";
}

describe("userscript app boundary", () => {
  it("prefers the live player identity over a stale URL", () => {
    const runtime = {
      player: {
        getManifest: () => ({
          bvid: "BV1LIVEPLAYER01",
          cid: 22,
          pages: [{ cid: 11 }, { cid: 22 }],
        }),
      },
    };

    const ref = video.resolve(
      "https://www.bilibili.com/video/BV1STALEURL01?p=1",
      runtime,
    );

    expect(ref).toMatchObject({
      bvid: "BV1LIVEPLAYER01",
      page: 2,
      cid: 22,
      key: "BV1LIVEPLAYER01:P2",
      source: "player",
    });
  });

  it("boots normal pages immediately", () => {
    const pageWindow = new FakeWindow();
    const eventWindow = new FakeWindow();
    const document = new FakeDocument();
    let boots = 0;

    activation.start({
      pageWindow: pageWindow as unknown as Window,
      eventWindow: eventWindow as unknown as Window,
      document: document as unknown as Document,
      href: () => "https://www.bilibili.com/video/BV1NORMAL0001",
      boot: () => {
        boots += 1;
      },
    });

    expect(boots).toBe(1);
  });

  it("defers an activity shell until a live BV appears", () => {
    const pageWindow = new FakeWindow();
    const eventWindow = new FakeWindow();
    const document = new FakeDocument();
    let boots = 0;

    activation.start({
      pageWindow: pageWindow as unknown as Window,
      eventWindow: eventWindow as unknown as Window,
      document: document as unknown as Document,
      href: () => "https://www.bilibili.com/festival/knowledge2027",
      boot: () => {
        boots += 1;
      },
    });

    expect(boots).toBe(0);

    pageWindow.player = {
      getManifest: () => ({ bvid: "BV1CARRIER0001", cid: 33 }),
    };
    pageWindow.emit("popstate");

    expect(boots).toBe(1);
  });

  it("owns SPA history and browser navigation wiring", () => {
    const pageWindow = new FakeWindow();
    const eventWindow = new FakeWindow();
    const document = new FakeDocument();
    const originalPush = pageWindow.history.pushState;
    let navigations = 0;
    let pageShows = 0;
    let visible = 0;

    const cleanup = navigation.observe({
      pageWindow: pageWindow as unknown as Window,
      eventWindow: eventWindow as unknown as Window,
      document: document as unknown as Document,
      onNavigate: () => {
        navigations += 1;
      },
      onPageShow: () => {
        pageShows += 1;
      },
      onVisible: () => {
        visible += 1;
      },
    });

    pageWindow.history.pushState({}, "", "/next");
    expect(navigations).toBe(1);

    eventWindow.emit("pageshow");
    expect(navigations).toBe(2);
    expect(pageShows).toBe(1);

    document.emit("visibilitychange");
    expect(navigations).toBe(3);
    expect(visible).toBe(1);

    document.emit(
      "loadstart",
      { target: { tagName: "VIDEO" } } as unknown as Event,
    );
    expect(navigations).toBe(4);

    document.visibilityState = "hidden";
    document.emit("visibilitychange");
    expect(navigations).toBe(4);

    cleanup();
    expect(pageWindow.history.pushState).toBe(originalPush);
    pageWindow.emit("popstate");
    expect(navigations).toBe(4);
  });
});
