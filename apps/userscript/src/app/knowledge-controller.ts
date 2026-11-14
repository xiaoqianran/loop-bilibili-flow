import { createCoordinator } from "./ai-batch-coordinator";
export { createCoordinator as createRequestController } from "./ai-batch-coordinator";
export function selectAnchor<T extends { id: string; anchorId: string; updatedAt?: number }>(anchorId: string, nodes: readonly T[]) {
  const latest = nodes.filter(node => node.anchorId === anchorId)
    .reduce<T | undefined>((best, node) => !best || Number(node.updatedAt || 0) > Number(best.updatedAt || 0) ? node : best, undefined);
  return { anchorId, nodeId: latest?.id || "" };
}
export function createController() { return createCoordinator(); }
