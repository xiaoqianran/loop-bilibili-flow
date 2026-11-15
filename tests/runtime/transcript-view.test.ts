import { describe, expect, it, vi } from "vitest";
import { transcriptController as reader } from "../../apps/userscript/src/ui";
import { legacyFunction } from "../golden/legacy-harness";

// Minimal DOM fixture for deterministic tree comparison with the frozen script.
// Browser layout and actual media/scroll behavior still require Tampermonkey E2E.
class ElementFixture {
  children: ElementFixture[] = [];
  textContent: string | null = "";
  innerHTML = "";
  className = "";
  dataset: Record<string, string> = {};
  value = "";
  type = "";
  title = "";
  disabled = false;
  scrollIntoView = vi.fn();
  constructor(readonly tag: string, readonly ownerDocument: DocumentFixture) {}
  classList = {
    add: (value: string) => { this.className = [...new Set([...this.className.split(" "), value])].filter(Boolean).join(" "); },
    remove: (value: string) => { this.className = this.className.split(" ").filter(part => part !== value).join(" "); },
  };
  append(...nodes: ElementFixture[]) { this.children.push(...nodes); }
  appendChild(node: ElementFixture) { this.append(node); return node; }
  replaceChildren(...nodes: ElementFixture[]) {
    this.children = nodes.flatMap(node => node.tag === "fragment" ? node.children : [node]);
    this.innerHTML = "";
  }
  querySelector(selector: string): ElementFixture | null {
    const role = selector.match(/data-role="([^"]+)"/)?.[1];
    const index = selector.match(/data-cue-index="([^"]+)"/)?.[1];
    for (const child of this.children) {
      if (role && child.dataset.role === role) return child;
      if (selector.startsWith(".bsb-transcript-row") && child.className.split(" ").includes("bsb-transcript-row")
        && (index !== undefined ? child.dataset.cueIndex === index : child.className.split(" ").includes("active"))) return child;
      const nested = child.querySelector(selector);
      if (nested) return nested;
    }
    return null;
  }
}
class DocumentFixture {
  createElement(tag: string) { return new ElementFixture(tag, this); }
  createTextNode(text: string) { const node = this.createElement("text"); node.textContent = text; return node; }
  createDocumentFragment() { return this.createElement("fragment"); }
}
function setup() {
  const doc = new DocumentFixture();
  const root = doc.createElement("root");
  const slots = Object.fromEntries(["list", "title", "meta", "count", "track"].map(name => {
    const node = doc.createElement(name === "track" ? "select" : "div");
    node.dataset.role = "transcript-" + name;
    root.append(node);
    return [name, node];
  }));
  const state = {
    transcriptItemKey: "", transcriptQuery: "", transcriptFilteredIndexes: null as number[] | null,
    transcriptActiveCueIndex: -1, transcriptTrackIndex: -1, transcriptRenderEpoch: 0,
    transcriptAutoFollow: true, transcriptUserScrollUntil: 0, ui: { view: "subs" },
  };
  const ports = { routeKey: (bvid: string, page: number) => bvid + ":" + page,
    preferredTrack: () => 1, parseSeconds: (value: unknown) => Number(value) };
  // Cast only the DOM adapter boundary; application inputs remain strictly typed.
  return { doc, root, element: root as unknown as HTMLElement, slots, state, ports };
}
function tree(node: ElementFixture): unknown {
  return { tag: node.tag, text: node.textContent, html: node.innerHTML, classes: node.className,
    data: node.dataset, value: node.value, type: node.type, title: node.title,
    disabled: node.disabled, children: node.children.map(tree) };
}
const cues = [{ from_sec: 1, to_sec: 3, content: "<img onerror=bad()> MATCH match" },
  { from_sec: 4, to_sec: 6, content: "other" }, { from: "8", to: "9", content: "Match" }];

describe("subtitle reader rendering", () => {
  it.each(["", " match ", "absent"])("matches frozen populated DOM and state for query %j", query => {
    const next = setup();
    const old = setup();
    next.state.transcriptQuery = old.state.transcriptQuery = query;
    next.state.transcriptActiveCueIndex = old.state.transcriptActiveCueIndex = 2;
    const item = { bvid: "BV1", subStatus: "ok", page: 2, data: cues,
      tracks: [{ lan: "en" }, { lan_doc: "中文" }], lan_doc: "中文", source: "NET" };
    const document = {
      getElementById: () => old.root, querySelector: () => old.slots.track,
      createDocumentFragment: () => old.doc.createDocumentFragment(),
      createElement: (tag: string) => old.doc.createElement(tag),
      createTextNode: (text: string) => old.doc.createTextNode(text),
    };
    const populate = legacyFunction<(item: reader.TranscriptItem) => void>("populateTranscriptTrackSelect", {
      document, PANEL_ID: "panel", state: old.state, preferredTrackIndex: old.ports.preferredTrack,
      Option: function(label: string, value: string) {
        const option = old.doc.createElement("option");
        option.textContent = label;
        option.value = value;
        return option;
      },
    });
    const render = legacyFunction<() => void>("renderTranscriptPanel", {
      document, PANEL_ID: "panel", state: old.state, currentTranscriptItem: () => item,
      routeVideoKey: old.ports.routeKey, parseSeconds: old.ports.parseSeconds,
      populateTranscriptTrackSelect: populate,
      filterTranscriptIndexes: legacyFunction<typeof reader.filterIndexes>("filterTranscriptIndexes"),
      formatTranscriptTime: legacyFunction<typeof reader.formatTime>("formatTranscriptTime"),
      appendTranscriptHighlightedText: legacyFunction<typeof reader.appendHighlightedText>("appendTranscriptHighlightedText", { document }),
      updateTranscriptActiveCue: vi.fn(), currentVideoTime: () => 0,
    });
    render();
    reader.renderPanel(next.element, item, next.state, next.ports);
    expect(tree(next.root)).toEqual(tree(old.root));
    expect(next.state).toEqual(old.state);
  });

  it.each([null, { bvid: "BV1", page: 2, subStatus: "error" },
    { bvid: "BV1", subStatus: "empty" }, { bvid: "BV1", subStatus: "wait" }])(
    "preserves frozen empty-state rendering for %j", item => {
      const next = setup();
      const old = setup();
      const render = legacyFunction<() => void>("renderTranscriptPanel", {
        document: { getElementById: () => old.root }, PANEL_ID: "panel", state: old.state,
        currentTranscriptItem: () => item,
        libraryStatus: (value: { subStatus: string }) => value.subStatus,
        populateTranscriptTrackSelect: () => reader.populateTrackSelect(
          old.slots.track as unknown as HTMLSelectElement, null, old.state, old.ports.preferredTrack),
      });
      render();
      expect(reader.renderPanel(next.element, item, next.state, next.ports)).toBe(false);
      expect(tree(next.root)).toEqual(tree(old.root));
    });

  it("keeps cue indices, text-node highlighting, timestamps, counts and track selection", () => {
    const { element, slots, state, ports } = setup();
    state.transcriptQuery = " match ";
    state.transcriptActiveCueIndex = 2;
    expect(reader.renderPanel(element, { bvid: "BV1", page: 2, subStatus: "ok", data: cues,
      lan_doc: "中文", cachePath: "L3", tracks: [{ lan: "en" }, { lan_doc: "中文" }] }, state, ports)).toBe(true);
    expect(state.transcriptItemKey).toBe("BV1:2");
    expect(state.transcriptFilteredIndexes).toEqual([0, 2]);
    expect(slots.count?.textContent).toBe("2/3");
    expect(slots.meta?.textContent).toBe("3 条 · 中文 · L3");
    expect(slots.track?.value).toBe("1");
    expect(slots.track?.disabled).toBe(false);
    const rows = slots.list!.children;
    expect(rows.map(row => row.dataset.cueIndex)).toEqual(["0", "2"]);
    expect(rows[1]?.className).toBe("bsb-transcript-row active");
    expect(rows[1]?.children[0]?.dataset.transcriptTime).toBe("8");
    expect(rows[1]?.children[0]?.textContent).toBe("00:08");
    const text = rows[0]!.children[1]!;
    expect(text.children.map(node => [node.tag, node.textContent])).toEqual([
      ["text", "<img onerror=bad()> "], ["mark", "MATCH"], ["text", " "], ["mark", "match"],
    ]);
    state.transcriptQuery = "";
    reader.renderPanel(element, { bvid: "BV1", subStatus: "ok", data: cues }, state, ports);
    expect(state.transcriptFilteredIndexes).toBeNull();
    expect(slots.count?.textContent).toBe("3");
    expect(slots.track?.disabled).toBe(true);
  });

  it("handles no search results and missing mounted slots", () => {
    const { element, root, slots, state, ports } = setup();
    state.transcriptQuery = "absent";
    reader.renderPanel(element, { bvid: "BV1", subStatus: "ok", data: cues }, state, ports);
    expect(slots.count?.textContent).toBe("0/3");
    expect(slots.list?.children).toEqual([]);
    root.children = [];
    expect(reader.renderPanel(element, null, state, ports)).toBe(false);
    expect(reader.renderPanel(null, null, state, ports)).toBe(false);
  });
});

describe("subtitle playback following", () => {
  it("honors scroll cooldown, force, reduced motion, hidden workspace and cue gaps", () => {
    const { element, root, slots, state, ports } = setup();
    reader.renderPanel(element, { bvid: "BV1", subStatus: "ok", data: cues }, state, ports);
    const follow = { ...ports, now: () => 1000, reducedMotion: () => true };
    state.transcriptUserScrollUntil = 2000;
    reader.updateActiveCue(element, cues, state, 1, false, follow);
    const first = slots.list!.children[0]!;
    expect(first.className).toContain("active");
    expect(first.scrollIntoView).not.toHaveBeenCalled();
    reader.updateActiveCue(element, cues, state, 1, true, follow);
    expect(first.scrollIntoView).toHaveBeenCalledWith({ block: "center", behavior: "auto" });
    reader.updateActiveCue(element, cues, state, 1, false, follow);
    expect(first.scrollIntoView).toHaveBeenCalledTimes(1);
    state.ui.view = "ai";
    reader.updateActiveCue(element, cues, state, 4, true, follow);
    expect(slots.list!.children[1]!.scrollIntoView).not.toHaveBeenCalled();
    reader.updateActiveCue(element, cues, state, 7, false, follow);
    expect(state.transcriptActiveCueIndex).toBe(-1);
    expect(root.querySelector(".bsb-transcript-row.active")).toBeNull();
    state.ui.view = "subs";
    state.transcriptUserScrollUntil = 0;
    reader.updateActiveCue(element, cues, state, 4, false, { ...follow, reducedMotion: () => false });
    expect(slots.list!.children[1]!.scrollIntoView).toHaveBeenCalledWith({ block: "center", behavior: "smooth" });
    state.transcriptAutoFollow = false;
    reader.updateActiveCue(element, cues, state, 8, true, follow);
    expect(slots.list!.children[2]!.scrollIntoView).not.toHaveBeenCalled();
  });
});
