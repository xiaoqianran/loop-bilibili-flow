import { afterEach, describe, expect, it, vi } from "vitest";
import { resourceInteraction } from "../../apps/userscript/src/ui";

class FakeControl {
  readonly selectors = new Set<string>();
  readonly dataset: Record<string, string> = {};
  private listeners = new Map<string, Set<(event: Event) => void>>();
  parent: FakeControl | null = null;
  value = "";
  checked = false;
  private attrs = new Map<string, string>();
  constructor(...selectors: string[]) { selectors.forEach(selector => this.selectors.add(selector)); }
  add(selector: string, child: FakeControl) { child.parent = this; this.attrs.set(selector, ""); return child; }
  setAttr(key: string, value: string) { this.attrs.set(key, value); }
  getAttribute(name: string) { return this.attrs.get(name) || null; }
  closest(selector: string): FakeControl | null {
    return this.selectors.has(selector) ? this : this.parent?.closest(selector) || null;
  }
  addEventListener(name: string, fn: EventListener) {
    if (!this.listeners.has(name)) this.listeners.set(name, new Set());
    this.listeners.get(name)!.add(fn);
  }
  removeEventListener(name: string, fn: EventListener) { this.listeners.get(name)?.delete(fn); }
  listenerCount(name: string) { return this.listeners.get(name)?.size || 0; }
  fire(name: string, target: FakeControl = this) {
    let prevented = false;
    let stopped = false;
    const event = {
      target,
      preventDefault: () => { prevented = true; },
      stopPropagation: () => { stopped = true; },
    } as unknown as Event;
    for (const listener of this.listeners.get(name) || []) listener(event);
    return { prevented, stopped };
  }
}
class FakeRoot {
  private elements = new Map<string, FakeControl>();
  set(selector: string, control = new FakeControl()): FakeControl {
    this.elements.set(selector, control);
    return control;
  }
  querySelector(selector: string): FakeControl | null { return this.elements.get(selector) || null; }
}
function fixture() {
  const root = new FakeRoot();
  const list = root.set('[data-role="list"]');
  const libSearch = root.set('[data-role="library-search"]');
  const libFilters = root.set('[data-role="library-filters"]');
  const transSearch = root.set('[data-role="transcript-search"]');
  const track = root.set('[data-role="transcript-track"]');
  const follow = root.set('[data-role="transcript-follow"]');
  const transcript = root.set('[data-role="transcript-list"]');
  const ports = {
    followEnabled: vi.fn(() => true),
    selectGroup: vi.fn(), selectItem: vi.fn(), toggleFolder: vi.fn(),
    openItem: vi.fn(), searchLibrary: vi.fn(), filterLibrary: vi.fn(),
    searchTranscript: vi.fn(), switchTrack: vi.fn(), setFollow: vi.fn(),
    seekTranscript: vi.fn(), recordUserScroll: vi.fn(),
  };
  const bind = () => resourceInteraction.bind(root as unknown as HTMLElement, ports);
  return { root, list, libSearch, libFilters, transSearch, track, follow, transcript, ports, bind };
}
afterEach(() => vi.useRealTimers());

describe("resource-library and transcript UI event ownership", () => {
  it("delegates group and item checkbox changes without mixing them", () => {
    const f = fixture();
    f.bind();
    const group = new FakeControl('input[type="checkbox"][data-group-check]', 'input[type="checkbox"]');
    group.setAttr("data-group-check", "course/x");
    group.checked = true;
    f.list.fire("change", group);
    expect(f.ports.selectGroup).toHaveBeenCalledExactlyOnceWith("course/x", true);
    expect(f.ports.selectItem).not.toHaveBeenCalled();
    const item = new FakeControl('input[type="checkbox"][data-i]', 'input[type="checkbox"]');
    item.setAttr("data-i", "4");
    f.list.fire("change", item);
    expect(f.ports.selectItem).toHaveBeenCalledExactlyOnceWith(4, false);
  });
  it("toggles folders without opening items and otherwise selects video items", () => {
    const f = fixture();
    f.bind();
    const folder = new FakeControl("[data-folder-toggle]");
    folder.setAttr("data-folder-toggle", "my folder");
    expect(f.list.fire("click", folder)).toEqual({ prevented: true, stopped: true });
    expect(f.ports.toggleFolder).toHaveBeenCalledWith("my folder");
    const item = new FakeControl("[data-transcript-i]");
    item.dataset.transcriptI = "7";
    f.list.fire("click", item);
    expect(f.ports.openItem).toHaveBeenCalledWith(7);
    f.list.fire("click", new FakeControl('input[type="checkbox"]'));
    f.list.fire("click", new FakeControl(".bsb-resource-folder"));
    expect(f.ports.openItem).toHaveBeenCalledTimes(1);
  });
  it("debounces search independently for library and transcript and trims whitespace", () => {
    vi.useFakeTimers();
    const f = fixture();
    const dispose = f.bind();
    f.libSearch.value = "  B  ";
    f.libSearch.fire("input");
    f.libSearch.value = "  BV1  ";
    f.libSearch.fire("input");
    f.transSearch.value = "  test  ";
    f.transSearch.fire("input");
    vi.advanceTimersByTime(70);
    expect(f.ports.searchLibrary).toHaveBeenCalledExactlyOnceWith("BV1");
    expect(f.ports.searchTranscript).not.toHaveBeenCalled();
    vi.advanceTimersByTime(10);
    expect(f.ports.searchTranscript).toHaveBeenCalledExactlyOnceWith("test");
    f.libSearch.value = "late";
    f.libSearch.fire("input");
    dispose();
    vi.advanceTimersByTime(100);
    expect(f.ports.searchLibrary).toHaveBeenCalledTimes(1);
  });
  it("dispatches filter, subtitle track and auto-follow changes", () => {
    const f = fixture();
    f.bind();
    expect(f.follow.checked).toBe(true);
    const filter = new FakeControl("[data-library-filter]");
    filter.dataset.libraryFilter = "ok";
    f.libFilters.fire("click", filter);
    expect(f.ports.filterLibrary).toHaveBeenCalledExactlyOnceWith("ok");
    f.track.value = "2";
    f.track.fire("change");
    expect(f.ports.switchTrack).toHaveBeenCalledExactlyOnceWith(2);
    f.follow.checked = false;
    f.follow.fire("change");
    expect(f.ports.setFollow).toHaveBeenCalledExactlyOnceWith(false);
  });
  it("seeks from nested timestamp elements and marks wheel and touch scrolling", () => {
    const f = fixture();
    f.bind();
    const time = new FakeControl("[data-transcript-time]");
    time.dataset.transcriptTime = "125.5";
    const nested = new FakeControl();
    nested.parent = time;
    f.transcript.fire("click", nested);
    expect(f.ports.seekTranscript).toHaveBeenCalledExactlyOnceWith(125.5);
    f.transcript.fire("wheel");
    f.transcript.fire("touchmove");
    expect(f.ports.recordUserScroll).toHaveBeenCalledTimes(2);
  });
  it("binds once on repeated initialization and cleans all listeners on dispose", () => {
    const f = fixture();
    const previous = f.bind();
    const latest = f.bind();
    expect(f.list.listenerCount("click")).toBe(1);
    expect(f.transcript.listenerCount("wheel")).toBe(1);
    previous();
    expect(f.list.listenerCount("click")).toBe(1);
    latest();
    expect(f.libSearch.listenerCount("input")).toBe(0);
    expect(f.list.listenerCount("change")).toBe(0);
    expect(f.transcript.listenerCount("touchmove")).toBe(0);
    expect(f.track.listenerCount("change")).toBe(0);
  });
});
