/** Pure Knowledge navigation policies. DOM rendering stays with the workbench. */
export interface KnowledgeAnchor {
  id: string; selectedText?: string; title?: string; contextText?: string;
  sourceKey?: string; bvid?: string; page?: number; [key: string]: unknown;
}
export interface KnowledgeNode {
  id: string; anchorId: string; question?: string; answer?: string;
  preview?: string; updatedAt?: number; [key: string]: unknown;
}
export function nodesForAnchor<N extends KnowledgeNode>(nodes: readonly N[], anchorId: string): N[] {
  return nodes.filter(node => node.anchorId === anchorId);
}
export function anchorById<A extends KnowledgeAnchor>(anchors: readonly A[], id: string): A | null {
  return anchors.find(anchor => anchor.id === id) || null;
}
export function nodeById<N extends KnowledgeNode>(nodes: readonly N[], id: string): N | null {
  return nodes.find(node => node.id === id) || null;
}
export function filterAnchors<A extends KnowledgeAnchor, N extends KnowledgeNode>(
  anchors: readonly A[], nodes: readonly N[], search: string,
): A[] {
  const query = String(search || "").trim().toLocaleLowerCase();
  if (!query) return anchors as A[];
  const nodeMatches = new Set<string>();
  for (const node of nodes) {
    const haystack = [node.question || "", node.answer || "", node.preview || ""].join("\n").toLocaleLowerCase();
    if (haystack.includes(query)) nodeMatches.add(node.anchorId);
  }
  return anchors.filter(anchor =>
    [anchor.selectedText, anchor.title, anchor.contextText].join("\n").toLocaleLowerCase().includes(query)
    || nodeMatches.has(anchor.id));
}
export function resolveSelection<A extends KnowledgeAnchor, N extends KnowledgeNode>(
  anchors: readonly A[], nodes: readonly N[], anchorId: string, nodeId: string, isSmall: boolean,
): { anchorId: string; nodeId: string } {
  let selectedAnchor = anchorId;
  let selectedNode = nodeId;
  if (!anchors.some(anchor => anchor.id === selectedAnchor)) {
    selectedAnchor = isSmall ? "" : (anchors[0]?.id || "");
    selectedNode = "";
  }
  if (selectedAnchor) {
    const candidates = nodesForAnchor(nodes, selectedAnchor);
    if (!candidates.some(node => node.id === selectedNode)) {
      selectedNode = [...candidates].sort(
        (a,b) => Number(b.updatedAt || 0) - Number(a.updatedAt || 0),
      )[0]?.id || "";
    }
  }
  return { anchorId: selectedAnchor, nodeId: selectedNode };
}
export function groupAnchors<A extends KnowledgeAnchor>(
  anchors: readonly A[], sourceKey: (anchor: A) => string,
) {
  const groups = new Map<string, { key: string; label: string; anchors: A[] }>();
  for (const anchor of anchors) {
    const key = String(anchor.sourceKey || sourceKey(anchor) || "unknown");
    if (!groups.has(key)) {
      groups.set(key, {
        key,
        label: String(anchor.title || anchor.bvid || "未命名来源")
          + (anchor.bvid ? " · " + anchor.bvid : "")
          + (Number(anchor.page) > 1 ? " P" + anchor.page : ""),
        anchors: [],
      });
    }
    groups.get(key)!.anchors.push(anchor);
  }
  return [...groups.values()];
}
