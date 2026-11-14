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
