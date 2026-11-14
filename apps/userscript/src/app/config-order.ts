/** Deterministic ordering policies used by Settings and post-processing. */
export interface Identified { id: string }
export interface Staged extends Identified { stage: string }

export function reorderIds(ids: readonly string[] | null | undefined, fromId: string, toId: string): string[] {
  const list = Array.isArray(ids) ? ids.map(String) : [];
  const from = list.indexOf(String(fromId || ""));
  const to = list.indexOf(String(toId || ""));
  if (from < 0 || to < 0 || from === to) return list;
  const next = list.slice();
  const [item] = next.splice(from, 1);
  if (item === undefined) return list;
  next.splice(to, 0, item);
  return next;
}

/** Unknown ids are ignored; profiles absent from the visible order keep their order. */
export function applyConfigIdOrder<T extends Identified>(
  items: readonly T[] | null | undefined, orderedIds: readonly string[],
): T[] {
  const list = Array.isArray(items) ? [...items] : [];
  const byId = new Map(list.map(item => [String(item.id), item]));
  const seen = new Set<string>();
  const next: T[] = [];
  for (const id of orderedIds || []) {
    const hit = byId.get(String(id));
    if (!hit || seen.has(hit.id)) continue;
    seen.add(hit.id);
    next.push(hit);
  }
  for (const item of list) if (!seen.has(item.id)) next.push(item);
  return next;
}

/** Only reorder one stage; other stages stay in their original slots. */
export function applyPromptStageOrder<T extends Staged>(
  prompts: readonly T[] | null | undefined, stage: string, orderedIds: readonly string[],
): T[] {
  const list = Array.isArray(prompts) ? [...prompts] : [];
  const byId = new Map(list.map(item => [String(item.id), item]));
  const ordered: T[] = [];
  const seen = new Set<string>();
  for (const id of orderedIds || []) {
    const hit = byId.get(String(id));
    if (!hit || hit.stage !== stage || seen.has(hit.id)) continue;
    seen.add(hit.id);
    ordered.push(hit);
  }
  for (const item of list) {
    if (item.stage === stage && !seen.has(item.id)) ordered.push(item);
  }
  let index = 0;
  return list.map(item => item.stage === stage ? ordered[index++] || item : item);
}
