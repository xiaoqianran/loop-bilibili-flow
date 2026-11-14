import { describe, expect, it, vi } from "vitest";
import { reorderInteraction } from "../../apps/userscript/src/ui";

class FakeClasses {
  private values = new Set<string>();
  add(...tokens: string[]) { tokens.forEach(token => this.values.add(token)); }
  remove(...tokens: string[]) { tokens.forEach(token => this.values.delete(token)); }
  contains(token: string) { return this.values.has(token); }
}
class FakeElement {
  readonly selectors = new Set<string>();
  readonly classList = new FakeClasses();
  readonly dataset: Record<string, string> = {};
  parent: FakeElement | null = null;
  children: FakeElement[] = [];
  constructor(...selectors: string[]) { selectors.forEach(s => this.selectors.add(s)); }
  add(child: FakeElement): FakeElement { child.parent = this; this.children.push(child); return child; }
  matches(query: string): boolean {
    return query.split(",").some(raw => {
      const selector = raw.trim();
      for (const state of ["dragging", "drag-over"]) {
        if (selector.endsWith("." + state)) {
          return this.selectors.has(selector.slice(0, -state.length - 1)) && this.classList.contains(state);
        }
      }
      return this.selectors.has(selector);
    });
  }
  closest(query: string): FakeElement | null {
    return this.matches(query) ? this : this.parent?.closest(query) || null;
  }
  contains(node: FakeElement | null): boolean {
    return node === this || (node?.parent ? this.contains(node.parent) : false);
  }
  querySelectorAll(query: string): FakeElement[] {
    const result: FakeElement[] = [];
    const visit = (item: FakeElement) => {
      if (item.matches(query)) result.push(item);
      item.children.forEach(visit);
    };
    this.children.forEach(visit);
    return result;
  }
}
class FakeRoot extends FakeElement {
  private readonly handlers = new Map<string, Set<(event: DragEvent) => void>>();
  addEventListener(name: string, callback: (event: DragEvent) => void) {
    if (!this.handlers.has(name)) this.handlers.set(name, new Set());
    this.handlers.get(name)!.add(callback);
  }
  removeEventListener(name: string, callback: (event: DragEvent) => void) {
    this.handlers.get(name)?.delete(callback);
  }
  listeners(name: string) { return this.handlers.get(name)?.size || 0; }
  fire(name: string, target: FakeElement, relatedTarget: FakeElement | null = null): boolean {
    let prevented = false;
    const event = {
      target, relatedTarget, dataTransfer: { effectAllowed: "", dropEffect: "", setData: vi.fn() },
      preventDefault: () => { prevented = true; },
    } as unknown as DragEvent;
    for (const handler of this.handlers.get(name) || []) handler(event);
    return prevented;
  }
}
function fixtures() {
  const root = new FakeRoot();
  const prompt = root.add(new FakeElement('[data-role="prompt-list"]'));
  const ai = root.add(new FakeElement('[data-role="ai-list"]'));
  prompt.dataset.role = "prompt-list";
  ai.dataset.role = "ai-list";
  const p1 = prompt.add(new FakeElement(".bsb-config-list-item[draggable='true']", ".bsb-config-list-item"));
  p1.dataset.promptListId = "p1";
  const p2 = prompt.add(new FakeElement(".bsb-config-list-item[draggable='true']", ".bsb-config-list-item"));
  p2.dataset.promptListId = "p2";
  const a1 = ai.add(new FakeElement(".bsb-config-list-item[draggable='true']", ".bsb-config-list-item"));
  a1.dataset.aiListId = "a1";
  const a2 = ai.add(new FakeElement(".bsb-config-list-item[draggable='true']", ".bsb-config-list-item"));
  a2.dataset.aiListId = "a2";
  const firstCard = root.add(new FakeElement("[data-flow-task-id]"));
  firstCard.dataset.flowTaskId = "task1";
  const m1 = firstCard.add(new FakeElement(".bsb-model-rank[draggable='true']", ".bsb-model-rank"));
  m1.dataset.flowModelId = "m1";
  const m2 = firstCard.add(new FakeElement(".bsb-model-rank[draggable='true']", ".bsb-model-rank"));
  m2.dataset.flowModelId = "m2";
  const secondCard = root.add(new FakeElement("[data-flow-task-id]"));
  secondCard.dataset.flowTaskId = "task2";
  const other = secondCard.add(new FakeElement(".bsb-model-rank[draggable='true']", ".bsb-model-rank"));
  other.dataset.flowModelId = "m3";
  const ports = { reorderConfig: vi.fn(), reorderFlow: vi.fn() };
  return { root, prompt, ai, p1, p2, a1, a2, m1, m2, other, ports };
}
const bind = (root: FakeRoot, ports: ReturnType<typeof fixtures>["ports"]) =>
  reorderInteraction.bind(root as unknown as HTMLElement, ports);

describe("single delegated drag lifecycle", () => {
  it("handles Prompt and LLM list ordering with a single set of listeners", () => {
    const f = fixtures();
    const dispose = bind(f.root, f.ports);
    for (const event of ["dragstart", "dragover", "dragleave", "drop", "dragend"]) {
      expect(f.root.listeners(event)).toBe(1);
    }
    f.root.fire("dragstart", f.p1);
    expect(f.p1.classList.contains("dragging")).toBe(true);
    expect(f.root.fire("dragover", f.p2)).toBe(true);
    expect(f.p2.classList.contains("drag-over")).toBe(true);
    expect(f.root.fire("drop", f.p2)).toBe(true);
    expect(f.ports.reorderConfig).toHaveBeenCalledExactlyOnceWith("prompt", "p1", "p2");
    expect(f.p2.classList.contains("drag-over")).toBe(false);
    f.root.fire("dragstart", f.a2);
    f.root.fire("drop", f.a1);
    expect(f.ports.reorderConfig).toHaveBeenCalledWith("llm", "a2", "a1");
    dispose();
    expect(f.root.listeners("drop")).toBe(0);
  });

  it("prevents sorting while the list is search-locked or the destination is another list", () => {
    const f = fixtures();
    bind(f.root, f.ports);
    f.prompt.dataset.reorderLocked = "1";
    expect(f.root.fire("dragstart", f.p1)).toBe(true);
    f.root.fire("drop", f.p2);
    expect(f.ports.reorderConfig).not.toHaveBeenCalled();
    f.prompt.dataset.reorderLocked = "0";
    f.root.fire("dragstart", f.p1);
    expect(f.root.fire("drop", f.a1)).toBe(false);
    f.root.fire("dragend", f.p1);
    expect(f.ports.reorderConfig).not.toHaveBeenCalled();
    expect(f.p1.classList.contains("dragging")).toBe(false);
  });

  it("drops post-task models within the same task and refuses cross-task drops", () => {
    const f = fixtures();
    bind(f.root, f.ports);
    f.root.fire("dragstart", f.m1);
    expect(f.root.fire("drop", f.other)).toBe(false);
    expect(f.ports.reorderFlow).not.toHaveBeenCalled();
    expect(f.root.fire("dragover", f.m2)).toBe(true);
    expect(f.root.fire("drop", f.m2)).toBe(true);
    expect(f.ports.reorderFlow).toHaveBeenCalledExactlyOnceWith("task1", "m1", "m2");
  });

  it("ignores same-item drops and removal button dragstarts", () => {
    const f = fixtures();
    bind(f.root, f.ports);
    f.root.fire("dragstart", f.p2);
    f.root.fire("drop", f.p2);
    expect(f.ports.reorderConfig).not.toHaveBeenCalled();
    const remove = f.m1.add(new FakeElement("[data-flow-task-model-remove]"));
    expect(f.root.fire("dragstart", remove)).toBe(true);
    f.root.fire("drop", f.m2);
    expect(f.ports.reorderFlow).not.toHaveBeenCalled();
  });

  it("clears highlights on dragleave and supports dynamically inserted items", () => {
    const f = fixtures();
    bind(f.root, f.ports);
    const newItem = f.prompt.add(new FakeElement(".bsb-config-list-item[draggable='true']", ".bsb-config-list-item"));
    newItem.dataset.promptListId = "p3";
    f.root.fire("dragstart", f.p1);
    f.root.fire("dragover", newItem);
    expect(newItem.classList.contains("drag-over")).toBe(true);
    f.root.fire("dragleave", newItem, newItem);
    expect(newItem.classList.contains("drag-over")).toBe(true);
    f.root.fire("dragleave", newItem);
    expect(newItem.classList.contains("drag-over")).toBe(false);
    f.root.fire("drop", newItem);
    expect(f.ports.reorderConfig).toHaveBeenCalledExactlyOnceWith("prompt", "p1", "p3");
  });

  it("starting a new drag resets stale highlights and source identity", () => {
    const f = fixtures();
    bind(f.root, f.ports);
    f.root.fire("dragstart", f.p1);
    f.root.fire("dragover", f.p2);
    expect(f.p1.classList.contains("dragging")).toBe(true);
    expect(f.p2.classList.contains("drag-over")).toBe(true);
    f.root.fire("dragstart", f.p2);
    expect(f.p1.classList.contains("dragging")).toBe(false);
    expect(f.p2.classList.contains("drag-over")).toBe(false);
    f.root.fire("drop", f.p1);
    expect(f.ports.reorderConfig).toHaveBeenCalledExactlyOnceWith("prompt", "p2", "p1");
  });

  it("re-binding the same panel replaces listeners and disposal removes them", () => {
    const f = fixtures();
    const old = bind(f.root, f.ports);
    const newer = bind(f.root, f.ports);
    expect(f.root.listeners("dragstart")).toBe(1);
    old();
    expect(f.root.listeners("dragstart")).toBe(1);
    f.root.fire("dragstart", f.a1);
    newer();
    expect(f.root.listeners("drop")).toBe(0);
    expect(f.a1.classList.contains("dragging")).toBe(false);
  });
});
