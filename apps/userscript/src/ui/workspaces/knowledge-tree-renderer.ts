/** Knowledge tree markup and navigation event intents are UI-owned, with no transport dependency. */
export interface KnowledgeTreeNode {
  id: string;
  anchorId: string;
  parentId?: string | null;
  question: string;
  starred?: boolean;
  suggestions?: string[];
}
type Escaper = (text: string) => string;

export function treeHtml(anchorId: string, activeNodeId: string, nodes: readonly KnowledgeTreeNode[], escapeHtml: Escaper, escapeAttr: Escaper): string {
    const scoped = nodes.filter(node => node.anchorId === anchorId);
    const children = new Map<string, KnowledgeTreeNode[]>();
    for (const node of scoped) {
      const key = node.parentId || "__root__";
      if (!children.has(key)) children.set(key, []);
      children.get(key)!.push(node);
    }
    const renderLevel = (parentId: string | null, depth = 0): string => {
      if (depth > 64) return "";
      return (children.get(parentId || "__root__") || []).map((node) => {
        const kids = children.get(node.id) || [];
        const cls = node.id === activeNodeId ? " active" : "";
        return `<div class="bsb-knowledge-tree-node" style="--depth:${depth}"><button type="button" class="${cls}" data-knowledge-node-id="${escapeAttr(node.id)}"><span class="bsb-knowledge-tree-branch">${kids.length ? "⌄" : "·"}</span><span>${escapeHtml(node.question)}</span>${node.starred ? '<span class="bsb-knowledge-star">★</span>' : ""}</button>${kids.length ? renderLevel(node.id, depth + 1) : ""}</div>`;
      }).join("");
    };
    return renderLevel(null) || '<div class="bsb-knowledge-empty-small">还没有追问。直接提出第一个问题。</div>';
  }


export function breadcrumbHtml(node: KnowledgeTreeNode | null | undefined, ancestors: readonly KnowledgeTreeNode[], escapeHtml: Escaper, escapeAttr: Escaper): string {
    if (!node) return "";
    const chain = [...ancestors, node];
    return chain.map((n, i) => `<button type="button" data-knowledge-node-id="${escapeAttr(n.id)}" title="${escapeAttr(n.question)}">${escapeHtml(n.question.length > 28 ? `${n.question.slice(0, 28)}…` : n.question)}</button>${i < chain.length - 1 ? '<span>›</span>' : ""}`).join("");
  }


export function suggestionsHtml(node: KnowledgeTreeNode | null | undefined, escapeAttr: Escaper, escapeHtml: Escaper): string {
    const suggestions = Array.isArray(node?.suggestions) ? node.suggestions.filter(Boolean).slice(0, 4) : [];
    if (!suggestions.length) return "";
    return `<div class="bsb-knowledge-suggestions"><span class="bsb-knowledge-kicker">继续深入</span>${suggestions.map((q) => `<button type="button" data-knowledge-suggestion="${escapeAttr(q)}"><span>→</span>${escapeHtml(q)}</button>`).join("")}</div>`;
  }


export interface KnowledgeNavigationActions {
  backList(): void;
  toggleTree(): void;
  openWorkspace(): void;
  newRoot(): void;
  selectAnchor(id: string): void;
  selectNode(id: string): void;
  askSuggestion(text: string): void;
}
interface ClickTarget {
  closest(selector: string): { getAttribute(name: string): string | null } | null;
}
/** Dispatch navigation-specific actions before the workbench's generic click handler. */
export function dispatchNavigationClick(
  target: ClickTarget | null | undefined,
  actions: KnowledgeNavigationActions,
): boolean {
  if (!target) return false;
  for (const [selector, action] of [
    ["[data-knowledge-back-list]", "backList"],
    ["[data-knowledge-tree-toggle]", "toggleTree"],
    ["[data-knowledge-open-workspace]", "openWorkspace"],
    ["[data-knowledge-new-root]", "newRoot"],
  ] as const) {
    if (target.closest?.(selector)) {
      actions[action]();
      return true;
    }
  }
  const anchor = target.closest?.("[data-knowledge-anchor-list]");
  if (anchor) {
    actions.selectAnchor(anchor.getAttribute("data-knowledge-anchor-list") || "");
    return true;
  }
  const node = target.closest?.("[data-knowledge-node-id]");
  if (node) {
    actions.selectNode(node.getAttribute("data-knowledge-node-id") || "");
    return true;
  }
  const suggestion = target.closest?.("[data-knowledge-suggestion]");
  if (suggestion) {
    actions.askSuggestion(suggestion.getAttribute("data-knowledge-suggestion") || "");
    return true;
  }
  return false;
}
