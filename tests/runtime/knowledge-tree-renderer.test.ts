import { describe, expect, it, vi } from "vitest";
import { knowledgeTreeRenderer as tree } from "../../apps/userscript/src/ui";

const escape = (input: string) => input.replace(/&/g, "&amp;").replace(/</g, "&lt;")
  .replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const nodes = [
  { id: "n1", anchorId: "a1", question: "Root <special>", starred: true },
  { id: "n2", anchorId: "a1", parentId: "n1", question: "Follow-up" },
  { id: "n3", anchorId: "a1", parentId: "n2", question: "Deep" },
  { id: "n4", anchorId: "a2", question: "Other anchor" },
];

describe("Knowledge tree HTML", () => {
  it("renders nested tree and active/starred state while excluding other anchors", () => {
    const html = tree.treeHtml("a1", "n2", nodes, escape, escape);
    expect(html).toContain('data-knowledge-node-id="n1"');
    expect(html).toContain('data-knowledge-node-id="n2"');
    expect(html).toContain('data-knowledge-node-id="n3"');
    expect(html).not.toContain("Other anchor");
    expect(html).toContain("Root &lt;special&gt;");
    expect(html).toContain('class=" active" data-knowledge-node-id="n2"');
    expect(html).toContain("bsb-knowledge-star");
    expect((html.match(/--depth:/g) || []).length).toBe(3);
  });
  it("shows empty tree guidance and guards cyclic/unbounded children", () => {
    expect(tree.treeHtml("missing", "", nodes, escape, escape)).toContain("还没有追问");
    const loop = [
      { id: "a", anchorId: "x", parentId: "b", question: "a" },
      { id: "b", anchorId: "x", parentId: "a", question: "b" },
    ];
    expect(tree.treeHtml("x", "", loop, escape, escape)).toContain("还没有追问");
  });
  it("renders breadcrumb truncation and escapes attributes", () => {
    const node = { id: 'node"1', anchorId: "a", question: "X".repeat(40) };
    const html = tree.breadcrumbHtml(node, [{ id: "root", anchorId: "a", question: "<Root>" }], escape, escape);
    expect(html).toContain('data-knowledge-node-id="node&quot;1"');
    expect(html).toContain("title=");
    expect(html).toContain("X".repeat(28) + "…");
    expect(html).toContain("&lt;Root&gt;");
    expect(html).toContain("<span>›</span>");
    expect(tree.breadcrumbHtml(null, [], escape, escape)).toBe("");
  });
  it("renders no more than four escaped suggestions", () => {
    const html = tree.suggestionsHtml({
      id: "x", anchorId: "a", question: "q",
      suggestions: ["<one>", 'two"two', "three", "four", "five"],
    }, escape, escape);
    expect(html).toContain('data-knowledge-suggestion="two&quot;two"');
    expect(html).toContain("&lt;one&gt;");
    expect(html).not.toContain("five");
    expect((html.match(/data-knowledge-suggestion=/g) || []).length).toBe(4);
    expect(tree.suggestionsHtml(null, escape, escape)).toBe("");
  });
});

describe("Knowledge navigation click intent", () => {
  const actions = () => ({
    backList: vi.fn(), toggleTree: vi.fn(), openWorkspace: vi.fn(),
    newRoot: vi.fn(), selectAnchor: vi.fn(), selectNode: vi.fn(), askSuggestion: vi.fn(),
  });
  const target = (selector: string, attr: string, value: string) => ({
    closest: (query: string) => query === selector ? { getAttribute: (name: string) => name === attr ? value : null } : null,
  });
  it.each([
    ["[data-knowledge-back-list]", "backList"],
    ["[data-knowledge-tree-toggle]", "toggleTree"],
    ["[data-knowledge-open-workspace]", "openWorkspace"],
    ["[data-knowledge-new-root]", "newRoot"],
  ] as const)("dispatches %s exactly once", (selector, action) => {
    const callbacks = actions();
    expect(tree.dispatchNavigationClick(target(selector, "", ""), callbacks)).toBe(true);
    expect(callbacks[action]).toHaveBeenCalledOnce();
  });
  it("passes element attributes for anchor/node/suggestion navigation", () => {
    const callbacks = actions();
    expect(tree.dispatchNavigationClick(target("[data-knowledge-anchor-list]", "data-knowledge-anchor-list", "a2"), callbacks)).toBe(true);
    expect(tree.dispatchNavigationClick(target("[data-knowledge-node-id]", "data-knowledge-node-id", "n3"), callbacks)).toBe(true);
    expect(tree.dispatchNavigationClick(target("[data-knowledge-suggestion]", "data-knowledge-suggestion", "What next?"), callbacks)).toBe(true);
    expect(callbacks.selectAnchor).toHaveBeenCalledWith("a2");
    expect(callbacks.selectNode).toHaveBeenCalledWith("n3");
    expect(callbacks.askSuggestion).toHaveBeenCalledWith("What next?");
  });
  it("leaves unrelated and non-Element clicks to the workbench", () => {
    const callbacks = actions();
    expect(tree.dispatchNavigationClick(target("[data-knowledge-star-node]", "", ""), callbacks)).toBe(false);
    expect(tree.dispatchNavigationClick(null, callbacks)).toBe(false);
    expect(tree.dispatchNavigationClick({ closest: undefined as never }, callbacks)).toBe(false);
    for (const cb of Object.values(callbacks)) expect(cb).not.toHaveBeenCalled();
  });
});
