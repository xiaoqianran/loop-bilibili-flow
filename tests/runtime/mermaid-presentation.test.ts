import { afterEach, describe, expect, it, vi } from "vitest";
import { buildMermaidCard, createMermaidFullscreen, fitMermaidToViewport, getMermaidScale, parseMermaidViewBox, setMermaidScale } from "../../apps/userscript/src/ui/workspaces/mermaid-presentation";
import type { MermaidElement } from "../../apps/userscript/src/ui/workspaces/mermaid-presentation";
import { legacyFunction } from "../golden/legacy-harness";

// DOM adapter fixture: node identity and tree moves are real fixture operations;
// layout, focus and installed userscript integration still need browser E2E.
class NodeFixture {
  parentNode: NodeFixture | null = null;
  children: NodeFixture[] = [];
  className = "";
  textContent: string | null = "";
  dataset: Record<string, string> = {};
  attributes: Record<string, string> = {};
  properties: Record<string, string> = {};
  style = { setProperty: (key: string, value: string) => { this.properties[key] = value; }, removeProperty: (key: string) => { delete this.properties[key]; } };
  scrollLeft = 80;
  scrollTop = 90;
  clientWidth = 796;
  title = "";
  type = "";
  tabIndex = -1;
  listeners = new Map<string, (event: { target: NodeFixture }) => void>();
  _bsbMermaidPlaceholder: NodeFixture | null = null;
  constructor(readonly tag: string) {}
  classList = {
    add: (name: string) => { this.className = [...new Set([...this.className.split(" "), name])].filter(Boolean).join(" "); },
    remove: (name: string) => { this.className = this.className.split(" ").filter(value => value !== name).join(" "); },
  };
  getAttribute(name: string) { return this.attributes[name] ?? null; }
  hasAttribute(name: string) { return name in this.attributes; }
  setAttribute(name: string, value: string) { this.attributes[name] = value; }
  removeAttribute(name: string) { delete this.attributes[name]; }
  append(...nodes: NodeFixture[]) { nodes.forEach(node => this.appendChild(node)); }
  appendChild(node: NodeFixture) { node.remove(); this.children.push(node); node.parentNode = this; return node; }
  remove() {
    if (this.parentNode) this.parentNode.children = this.parentNode.children.filter(node => node !== this);
    this.parentNode = null;
  }
  before(node: NodeFixture) {
    const parent = this.parentNode;
    if (!parent) return;
    node.remove(); parent.children.splice(parent.children.indexOf(this), 0, node); node.parentNode = parent;
  }
  replaceWith(node: NodeFixture) { this.before(node); this.remove(); }
  matches(selector: string) {
    return selector.startsWith(".") ? this.className.split(" ").includes(selector.slice(1))
      : selector === '[data-mmd-act="fullscreen"]' && this.dataset.mmdAct === "fullscreen";
  }
  closest(selector: string): NodeFixture | null { return this.matches(selector) ? this : this.parentNode?.closest(selector) ?? null; }
  querySelector(selector: string): NodeFixture | null {
    for (const node of this.children) { if (node.matches(selector)) return node; const child = node.querySelector(selector); if (child) return child; }
    return null;
  }
  addEventListener(name: string, callback: (event: { target: NodeFixture }) => void) { this.listeners.set(name, callback); }
}
const element = (node: NodeFixture) => node as unknown as MermaidElement;
const doc = { createElement: (tag: string) => new NodeFixture(tag), createComment: () => new NodeFixture("comment") };
function setup() {
  vi.stubGlobal("document", doc);
  const root = new NodeFixture("panel");
  const host = new NodeFixture("host"); root.append(host);
  const svg = new NodeFixture("svg"); svg.setAttribute("viewBox", "0 0 1520 800");
  const card = buildMermaidCard(svg as unknown as SVGSVGElement, 1, element(host));
  const fixture = card as unknown as NodeFixture; host.append(fixture);
  return { root, host, card, fixture, svg };
}
afterEach(() => vi.unstubAllGlobals());

describe("Mermaid presentation boundary", () => {
  it.each(["0 0 1520 800", "-10,20,800,600", "invalid", "0 0 0 0"])("retains frozen viewBox fallback for %s", value => {
    const svg = new NodeFixture("svg"); svg.setAttribute("viewBox", value);
    const old = legacyFunction<(svg: NodeFixture) => object>("parseMermaidViewBox");
    expect(parseMermaidViewBox(svg)).toEqual(old(svg));
  });

  it("builds accessible controls, retains the original SVG, clamps zoom and resets fit scroll", () => {
    const { card, fixture, svg } = setup();
    expect(fixture.querySelector(".bsb-mermaid-stage")?.children).toEqual([svg]);
    expect(fixture.querySelector(".bsb-mermaid-viewport")?.tabIndex).toBe(0);
    expect(fixture.querySelector('[data-mmd-act="fullscreen"]')?.attributes["aria-label"]).toBe("全屏查看");
    setMermaidScale(card, 99); expect(getMermaidScale(card)).toBe(3);
    setMermaidScale(card, -1); expect(getMermaidScale(card)).toBe(0.35);
    fitMermaidToViewport(card);
    expect(getMermaidScale(card)).toBe(0.5);
    expect(fixture.dataset.fit).toBe("fit");
    expect(fixture.querySelector(".bsb-mermaid-scale")?.textContent).toBe("50%");
    expect(fixture.querySelector(".bsb-mermaid-stage")?.properties["--bsb-mermaid-width"]).toBe("760px");
    expect(fixture.querySelector(".bsb-mermaid-viewport")?.scrollTop).toBe(0);
  });

  it("restores the same card to its placeholder, ignores inner clicks and closes on backdrop", () => {
    const { root, host, card, fixture } = setup();
    const frames: Array<() => void> = [];
    const controller = createMermaidFullscreen({ root: () => element(root), requestFrame: callback => frames.push(callback) });
    controller.openMermaidFullscreen(card);
    const modal = root.querySelector(".bsb-mermaid-modal");
    expect(modal?.attributes.role).toBe("dialog");
    expect(fixture.parentNode).toBe(modal);
    expect(host.children[0]?.tag).toBe("comment");
    controller.openMermaidFullscreen(card); expect(frames).toHaveLength(1);
    frames[0]?.();
    modal?.listeners.get("click")?.({ target: fixture });
    expect(root.querySelector(".bsb-mermaid-modal")).toBe(modal);
    if (modal) modal.listeners.get("click")?.({ target: modal });
    expect(host.children).toEqual([fixture]);
    expect(fixture._bsbMermaidPlaceholder).toBeNull();
    expect(fixture.querySelector('[data-mmd-act="fullscreen"]')?.textContent).toBe("全屏");
    expect(root.querySelector(".bsb-mermaid-modal")).toBeNull();
    controller.closeMermaidFullscreen();
  });

  it("tolerates an absent panel, detached placeholder and missing viewport", () => {
    const { root, card, fixture } = setup();
    createMermaidFullscreen({ root: () => null, requestFrame: vi.fn() }).openMermaidFullscreen(card);
    expect(fixture._bsbMermaidPlaceholder).toBeNull();
    const controller = createMermaidFullscreen({ root: () => element(root), requestFrame: vi.fn() });
    controller.openMermaidFullscreen(card); fixture._bsbMermaidPlaceholder?.remove();
    expect(() => controller.closeMermaidFullscreen()).not.toThrow();
    const empty = element(new NodeFixture("empty"));
    expect(() => fitMermaidToViewport(empty)).not.toThrow();
    expect(() => setMermaidScale(empty, 2)).not.toThrow();
  });
});
