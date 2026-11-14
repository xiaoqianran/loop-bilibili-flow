import { afterEach, describe, expect, it, vi } from "vitest";
import { settingsInteraction } from "../../apps/userscript/src/ui";

class FakeInput {
  value = "";
  checked = false;
  private readonly handlers = new Map<string, Set<(event: Event) => void>>();
  private readonly attributes = new Map<string, string>();
  setAttribute(key: string, value: string) { this.attributes.set(key, value); }
  getAttribute(key: string) { return this.attributes.get(key) ?? null; }
  addEventListener(name: string, fn: EventListener) {
    if (!this.handlers.has(name)) this.handlers.set(name, new Set());
    this.handlers.get(name)!.add(fn);
  }
  removeEventListener(name: string, fn: EventListener) { this.handlers.get(name)?.delete(fn); }
  listeners(name: string) { return this.handlers.get(name)?.size || 0; }
  fire(name: string) {
    for (const fn of this.handlers.get(name) || []) fn({ target: this } as unknown as Event);
  }
}
class FakePanel {
  private readonly inputs = new Map<string, FakeInput>();
  views: FakeInput[] = [];
  add(selector: string, value = "") {
    const input = new FakeInput();
    input.value = value;
    this.inputs.set(selector, input);
    return input;
  }
  querySelector(selector: string) { return this.inputs.get(selector) || null; }
  querySelectorAll(selector: string) { return selector === "[data-view]" ? this.views : []; }
}
function setup() {
  const root = new FakePanel();
  const view = new FakeInput();
  view.setAttribute("data-view", "knowledge");
  root.views.push(view);
  const selectors = [
    "max-pages", "delay", "auto-capture", "auto-analyze", "player-subtitle",
    "mode", "prompt-select", "preprocess-enabled", "preprocess-prompt-select",
    "preprocess-model-select", "prompt-search", "ai-search", "knowledge-search",
  ];
  for (const role of selectors) root.add('[data-role="' + role + '"]');
  const ports = {
    selectWorkspace: vi.fn(), maxPages: vi.fn(), delayMs: vi.fn(),
    autoCapture: vi.fn(), autoAnalyze: vi.fn(), playerSubtitle: vi.fn(),
    mode: vi.fn(), promptSelect: vi.fn(), preprocessEnabled: vi.fn(),
    preprocessPrompt: vi.fn(), preprocessModel: vi.fn(),
    promptSearch: vi.fn(), aiSearch: vi.fn(), knowledgeSearch: vi.fn(),
  };
  const defaults = {
    maxPages: 20, delayMs: 400, autoCapture: true, autoAnalyze: false,
    playerSubtitle: true, preprocessEnabled: false,
  };
  const bind = () => settingsInteraction.bind(root as unknown as HTMLElement, ports, defaults);
  const el = (name: string) => root.querySelector('[data-role="' + name + '"]')!;
  return { root, ports, bind, el, view };
}
afterEach(() => vi.useRealTimers());

describe("typed Settings and panel input event owner", () => {
  it("initializes checkboxes and dispatches workspace navigation exactly once", () => {
    const f = setup();
    const dispose = f.bind();
    expect(f.el("auto-capture").checked).toBe(true);
    expect(f.el("auto-analyze").checked).toBe(false);
    expect(f.el("preprocess-enabled").checked).toBe(false);
    expect(f.el("player-subtitle").checked).toBe(true);
    f.view.fire("click");
    expect(f.ports.selectWorkspace).toHaveBeenCalledExactlyOnceWith("knowledge");
    dispose();
    expect(f.view.listeners("click")).toBe(0);
  });

  it("preserves numeric max page/delay bounds and previous fallback semantics", () => {
    const f = setup();
    f.bind();
    f.el("max-pages").value = "999";
    f.el("max-pages").fire("change");
    f.el("max-pages").value = "-4";
    f.el("max-pages").fire("change");
    f.el("max-pages").value = "NaN";
    f.el("max-pages").fire("change");
    expect(f.ports.maxPages.mock.calls.map(args => args[0])).toEqual([100, 1, 20]);
    f.el("delay").value = "99999";
    f.el("delay").fire("change");
    f.el("delay").value = "0";
    f.el("delay").fire("change");
    expect(f.ports.delayMs.mock.calls.map(args => args[0])).toEqual([5000, 400]);
  });

  it("dispatches option changes with the correct string and boolean types", () => {
    const f = setup();
    f.bind();
    for (const name of ["auto-capture", "auto-analyze", "player-subtitle", "preprocess-enabled"]) {
      f.el(name).checked = true;
      f.el(name).fire("change");
    }
    expect(f.ports.autoCapture).toHaveBeenCalledExactlyOnceWith(true);
    expect(f.ports.autoAnalyze).toHaveBeenCalledExactlyOnceWith(true);
    expect(f.ports.playerSubtitle).toHaveBeenCalledExactlyOnceWith(true);
    expect(f.ports.preprocessEnabled).toHaveBeenCalledExactlyOnceWith(true);
    f.el("mode").value = "";
    f.el("mode").fire("change");
    expect(f.ports.mode).toHaveBeenCalledWith("auto");
    f.el("prompt-select").value = "x";
    f.el("prompt-select").fire("change");
    expect(f.ports.promptSelect).toHaveBeenCalledWith("x");
    f.el("preprocess-prompt-select").value = "pre";
    f.el("preprocess-prompt-select").fire("change");
    expect(f.ports.preprocessPrompt).toHaveBeenCalledWith("pre");
    f.el("preprocess-model-select").value = "model";
    f.el("preprocess-model-select").fire("change");
    expect(f.ports.preprocessModel).toHaveBeenCalledWith("model");
  });

  it("debounces three searches independently and cancels all pending callbacks on disposal", () => {
    vi.useFakeTimers();
    const f = setup();
    const dispose = f.bind();
    const prompt = f.el("prompt-search");
    const ai = f.el("ai-search");
    const knowledge = f.el("knowledge-search");
    prompt.value = "a"; prompt.fire("input");
    prompt.value = "ab"; prompt.fire("input");
    ai.value = "model"; ai.fire("input");
    knowledge.value = "term"; knowledge.fire("input");
    vi.advanceTimersByTime(60);
    expect(f.ports.promptSearch).toHaveBeenCalledExactlyOnceWith("ab");
    expect(f.ports.aiSearch).toHaveBeenCalledExactlyOnceWith("model");
    expect(f.ports.knowledgeSearch).not.toHaveBeenCalled();
    vi.advanceTimersByTime(10);
    expect(f.ports.knowledgeSearch).toHaveBeenCalledExactlyOnceWith("term");
    knowledge.value = "stale"; knowledge.fire("input");
    dispose();
    vi.advanceTimersByTime(100);
    expect(f.ports.knowledgeSearch).toHaveBeenCalledTimes(1);
  });

  it("replacing a binding removes previous handlers and does not duplicate events", () => {
    const f = setup();
    const old = f.bind();
    const latest = f.bind();
    expect(f.el("mode").listeners("change")).toBe(1);
    old();
    expect(f.el("mode").listeners("change")).toBe(1);
    f.el("mode").value = "collection";
    f.el("mode").fire("change");
    expect(f.ports.mode).toHaveBeenCalledExactlyOnceWith("collection");
    latest();
    expect(f.el("mode").listeners("change")).toBe(0);
    expect(f.el("ai-search").listeners("input")).toBe(0);
  });
});
