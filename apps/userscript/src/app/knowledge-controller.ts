import { createCoordinator } from "./ai-batch-coordinator";
export { createCoordinator as createRequestController } from "./ai-batch-coordinator";
export function selectAnchor<T extends { id: string; anchorId: string; updatedAt?: number }>(anchorId: string, nodes: readonly T[]) {
  const latest = nodes.filter(node => node.anchorId === anchorId)
    .reduce<T | undefined>((best, node) => !best || Number(node.updatedAt || 0) > Number(best.updatedAt || 0) ? node : best, undefined);
  return { anchorId, nodeId: latest?.id || "" };
}
export function createController() { return createCoordinator(); }

export interface AnswerNode {
  answer: string; preview: string; suggestions: string[]; status: string;
  updatedAt: number; error?: string;
}
export function completeAnswer<T extends AnswerNode>(node: T, parsed: { answer: string; suggestions: string[] }, text: string, stopped: boolean, now = Date.now()): T {
  return Object.assign(node, {
    answer: parsed.answer || text.trim(), preview: "", suggestions: parsed.suggestions,
    status: stopped ? "stopped" : "done", updatedAt: now, error: "",
  });
}
export function failAnswer<T extends AnswerNode>(node: T, partial: string, error: unknown, stopped: boolean, now = Date.now()): T {
  return Object.assign(node, {
    answer: partial, preview: "", status: stopped ? "stopped" : "error",
    error: stopped ? "" : String(error instanceof Error ? error.message : error || "请求失败"), updatedAt: now,
  });
}
export function removeAnchor<A extends { id: string }, N extends { anchorId: string }>(anchors: readonly A[], nodes: readonly N[], anchorId: string) {
  return { anchors: anchors.filter(anchor => anchor.id !== anchorId), nodes: nodes.filter(node => node.anchorId !== anchorId) };
}

interface AnswerExecution<N extends AnswerNode> {
  node: N;
  generate(): Promise<string>;
  parse(text: string): { answer: string; suggestions: string[] };
  visible(text: string): string;
  partial(): string;
  stopped(): boolean;
  exists(): boolean;
  persist(node: N): Promise<unknown>;
  onSuccess(node: N): Promise<unknown>;
  onFailure(node: N): void;
  cleanup(): Promise<unknown>;
}
/** Owns answer state transitions and persistence ordering, independent of DOM/transport. */
export async function runAnswer<N extends AnswerNode>(execution: AnswerExecution<N>): Promise<void> {
  const { node } = execution;
  try {
    const text = await execution.generate();
    if (!execution.exists()) return;
    completeAnswer(node, execution.parse(text), text, execution.stopped());
    await execution.persist(node);
    await execution.onSuccess(node);
  } catch (error) {
    if (!execution.exists()) return;
    failAnswer(node, execution.visible(execution.partial()), error, execution.stopped());
    await execution.persist(node).catch(() => {});
    execution.onFailure(node);
  } finally {
    await execution.cleanup();
  }
}

/** Resolve breadcrumb ancestors from source nodes; retain 12-level and cycle guards. */
export function ancestorNodes<T extends { id: string; parentId?: string | null }>(
  node: T | null | undefined, nodes: readonly T[],
): T[] {
  const out: T[] = [];
  let current = node;
  const seen = new Set<string>();
  while (current?.parentId && !seen.has(current.parentId) && out.length < 12) {
    const parentId: string = current.parentId;
    seen.add(parentId);
    const parent = nodes.find(item => item.id === parentId);
    if (!parent) break;
    out.unshift(parent);
    current = parent;
  }
  return out;
}

/** Compose the bounded ancestor/answer context for a Knowledge follow-up. */
export function branchContext<T extends {
  id: string; parentId?: string | null; question?: string; answer?: string;
}>(parentNode: T | null | undefined, nodes: readonly T[]): string {
  if (!parentNode) return "（这是该锚点下的新分支）";
  const chain = [...ancestorNodes(parentNode, nodes), parentNode].slice(-6);
  return chain.map((node, index) => {
    const answer = String(node.answer || "").trim().replace(/\s+/g, " ").slice(0, 1800);
    return (index + 1) + ". 问题：" + node.question
      + "\n   回答摘要：" + (answer || "（尚无回答）");
  }).join("\n");
}

export interface StoredKnowledgeNode {
  id: string; status?: string; answer?: string; preview?: string;
  updatedAt?: number; createdAt?: number; [key: string]: unknown;
}
/** Recover interrupted persistent answers without overwriting live streams. */
export function reconcileNodes<T extends StoredKnowledgeNode>(
  stored: readonly T[] | null | undefined,
  current: readonly T[] | null | undefined,
  busy: boolean,
  visibleAnswer: (text: string) => string,
  now = Date.now(),
): { nodes: T[]; recovered: T[] } {
  const recovered: T[] = [];
  const live = busy
    ? new Map((current || []).filter(node => node?.status === "running").map(node => [node.id, node]))
    : new Map<string, T>();
  const nodes = (stored || []).map(node => {
    const active = live.get(node?.id);
    if (active) return active;
    if (!busy && node?.status === "running") {
      const fixed = { ...node, answer: visibleAnswer(node.answer || node.preview || ""),
        preview: "", status: "stopped", error: "", updatedAt: now } as T;
      recovered.push(fixed);
      return fixed;
    }
    return node;
  }).sort((a, b) => Number(a.createdAt || 0) - Number(b.createdAt || 0));
  return { nodes, recovered };
}
export function sortAnchors<T extends { updatedAt?: number }>(
  anchors: readonly T[] | null | undefined,
): T[] {
  return [...(anchors || [])].sort((a, b) => Number(b.updatedAt || 0) - Number(a.updatedAt || 0));
}

/** Apply successful repository commits without replacing unrelated live objects. */
export function cacheAnchor<T extends { id: string; updatedAt?: number }>(
  anchors: T[], anchor: T,
): T {
  const index = anchors.findIndex(item => item.id === anchor.id);
  if (index >= 0) anchors[index] = anchor;
  else anchors.unshift(anchor);
  anchors.sort((a, b) => Number(b.updatedAt || 0) - Number(a.updatedAt || 0));
  return anchor;
}
export function cacheNode<T extends { id: string }>(nodes: T[], node: T): T {
  const index = nodes.findIndex(item => item.id === node.id);
  if (index >= 0) nodes[index] = node;
  else nodes.push(node);
  return node;
}

/** Keep in-memory collections unchanged until the storage transaction commits. */
export async function saveAnchor<T extends { id: string; updatedAt?: number }>(
  anchors: T[], anchor: T, commit: (value: T) => Promise<unknown>,
): Promise<T> {
  await commit(anchor);
  return cacheAnchor(anchors, anchor);
}
export async function saveNode<T extends { id: string }>(
  nodes: T[], node: T, commit: (value: T) => Promise<unknown>,
): Promise<T> {
  await commit(node);
  return cacheNode(nodes, node);
}
export async function deleteAnchorCommitted<A extends { id: string }, N extends { anchorId: string }>(
  anchors: readonly A[], nodes: readonly N[], anchorId: string,
  commit: (id: string) => Promise<unknown>,
) {
  await commit(anchorId);
  return removeAnchor(anchors, nodes, anchorId);
}
