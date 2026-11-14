import { describe, expect, it, vi } from "vitest";
import { settingsInteraction } from "../../apps/userscript/src/ui";

class Control {
  value = "";
  checked = false;
  dataset: Record<string, string> = {};
  private selectors = new Set<string>();
  children: Control[] = [];
  parent: Control | null = null;
  constructor(...selectors: string[]) { this.selectors = new Set(selectors); }
  append(child: Control): Control { child.parent = this; this.children.push(child); return child; }
  contains(node: Control | null): boolean {
    for (let n = node; n; n = n.parent) if (n === this) return true;
    return false;
  }
  closest(selector: string): Control | null {
    return this.selectors.has(selector) ? this : (this.parent?.closest(selector) || null);
  }
}
class Root extends Control {
  private handlers = new Map<string, Set<(event: Event) => void>>();
  addEventListener(name: string, callback: (event: Event) => void) {
    if (!this.handlers.has(name)) this.handlers.set(name, new Set());
    this.handlers.get(name)!.add(callback);
  }
  removeEventListener(name: string, callback: (event: Event) => void) {
    this.handlers.get(name)?.delete(callback);
  }
  listenerCount(name: string) { return this.handlers.get(name)?.size || 0; }
  change(target: Control) {
    for (const handler of this.handlers.get("change") || []) {
      handler({ target } as unknown as Event);
    }
  }
}
function fixture() {
  const root = new Root();
  const ports = {
    shortcutPreference: vi.fn(), knowledgeModel: vi.fn(), preprocessEnabled: vi.fn(),
    preprocessPrompt: vi.fn(), preprocessModel: vi.fn(), preprocessConcurrency: vi.fn(),
    preprocessTargetMinutes: vi.fn(), preprocessOverlapSeconds: vi.fn(),
    preprocessMaxChars: vi.fn(), preprocessRetries: vi.fn(),
    studioModel: vi.fn(), studioContext: vi.fn(), taskPrompt: vi.fn(),
  };
  return { root, ports, bind: () => settingsInteraction.bindFlowChanges(root as unknown as HTMLElement, ports) };
}
function value(root: Root, selector: string, value: string): Control {
  const input = root.append(new Control(selector));
  input.value = value;
  return input;
}
describe("delegated typed flow and shortcut settings", () => {
  it("handles shortcut changes and skips unknown preference names", () => {
    const { root, ports, bind } = fixture();
    bind();
    const enabled = value(root, "[data-shortcut-pref]", "some-value");
    enabled.dataset.shortcutPref = "enabled";
    enabled.checked = true;
    root.change(enabled);
    expect(ports.shortcutPreference).toHaveBeenCalledExactlyOnceWith("enabled", "some-value", true);
    enabled.dataset.shortcutPref = "preferredDock";
    enabled.value = "left";
    root.change(enabled);
    expect(ports.shortcutPreference).toHaveBeenCalledWith("preferredDock", "left", true);
    enabled.dataset.shortcutPref = "__proto__";
    root.change(enabled);
    expect(ports.shortcutPreference).toHaveBeenCalledTimes(2);
  });

  it("dispatches Knowledge model, preprocess switch and all numeric strings exactly", () => {
    const { root, ports, bind } = fixture();
    bind();
    const knowledge = value(root, '[data-role="knowledge-model"]', "k");
    root.change(knowledge);
    expect(ports.knowledgeModel).toHaveBeenCalledExactlyOnceWith("k");
    const enabled = value(root, "[data-flow-preprocess-enabled]", "ignored");
    enabled.checked = true;
    root.change(enabled);
    expect(ports.preprocessEnabled).toHaveBeenCalledExactlyOnceWith(true);
    const selectors: Array<[string, keyof typeof ports, string]> = [
      ["[data-flow-preprompt]", "preprocessPrompt", "pre-template"],
      ["[data-flow-premodel]", "preprocessModel", "model-a"],
      ["[data-flow-preconcurrency]", "preprocessConcurrency", "7"],
      ["[data-flow-pretarget-minutes]", "preprocessTargetMinutes", "16"],
      ["[data-flow-preoverlap-seconds]", "preprocessOverlapSeconds", "30"],
      ["[data-flow-premax-chars]", "preprocessMaxChars", "22000"],
      ["[data-flow-preretries]", "preprocessRetries", "3"],
      ["[data-flow-studiomodel]", "studioModel", "model-b"],
      ["[data-flow-studiocontext]", "studioContext", "processed"],
    ];
    for (const [selector, port, desired] of selectors) {
      root.change(value(root, selector, desired));
      expect(ports[port]).toHaveBeenLastCalledWith(desired);
    }
  });

  it("routes nested task Prompt changes to their own task without saving unrelated changes", () => {
    const { root, ports, bind } = fixture();
    bind();
    const card = root.append(new Control("[data-flow-task-id]"));
    card.dataset.flowTaskId = "task-11";
    const prompt = card.append(new Control("[data-flow-task-prompt]"));
    prompt.value = "prompt-2";
    const nested = prompt.append(new Control());
    root.change(nested);
    expect(ports.taskPrompt).toHaveBeenCalledExactlyOnceWith("task-11", "prompt-2");
    root.change(card.append(new Control("[data-flow-task-other]")));
    expect(ports.taskPrompt).toHaveBeenCalledTimes(1);
    card.dataset.flowTaskId = "";
    root.change(prompt);
    expect(ports.taskPrompt).toHaveBeenCalledTimes(1);
  });

  it("ignores unknown controls, non-element targets and unrelated events", () => {
    const { root, ports, bind } = fixture();
    bind();
    root.change(root.append(new Control("[data-ignore]")));
    root.change(root.append(new Control()));
    expect(Object.values(ports).every(mock => mock.mock.calls.length === 0)).toBe(true);
  });

  it("replaces existing root listeners and removes them on disposal", () => {
    const { root, ports, bind } = fixture();
    const first = bind();
    const next = bind();
    expect(root.listenerCount("change")).toBe(1);
    first();
    expect(root.listenerCount("change")).toBe(1);
    root.change(value(root, "[data-flow-premodel]", "model-a"));
    expect(ports.preprocessModel).toHaveBeenCalledTimes(1);
    next();
    expect(root.listenerCount("change")).toBe(0);
    root.change(value(root, "[data-flow-premodel]", "model-b"));
    expect(ports.preprocessModel).toHaveBeenCalledTimes(1);
  });
});
