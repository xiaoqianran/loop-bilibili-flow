/** Pure Studio state transitions. Keep the v1 persisted format unchanged. */
export interface StudioMessage {
  id?: string;
  role?: string;
  content?: string;
  status?: string;
  [key: string]: unknown;
}

export interface StudioSnapshot {
  studioMessages: StudioMessage[];
  studioMemory: string;
  studioMemoryUntilId: string;
  studioMemoryTurns: number;
  studioContextPref: "auto" | "raw" | "processed";
  studioLastContextMeta: null;
}

export interface StudioState {
  studioMessages?: StudioMessage[];
  studioMemory?: string;
  studioMemoryUntilId?: string;
  studioMemoryTurns?: number;
  studioContextPref?: string;
}

interface StudioEntry {
  messages: StudioMessage[];
  memory: string;
  memoryUntilId: string;
  memoryTurns: number;
  contextPref: string;
  updatedAt: number;
}

export type StudioStore = Record<string, StudioEntry>;

export function parseStore(raw: unknown): StudioStore {
  try {
    const value = typeof raw === "string" ? JSON.parse(raw) : raw;
    return value && typeof value === "object" && !Array.isArray(value)
      ? value as StudioStore
      : {};
  } catch {
    return {};
  }
}

export function persist(
  current: StudioStore,
  routeKey: string,
  state: StudioState,
  now: number,
): StudioStore {
  const key = String(routeKey || "").trim();
  if (!key) return current;
  const next: StudioStore = { ...current };
  next[key] = {
    messages: (state.studioMessages || []).slice(-40),
    memory: String(state.studioMemory || ""),
    memoryUntilId: String(state.studioMemoryUntilId || ""),
    memoryTurns: Number(state.studioMemoryTurns) || 0,
    contextPref: state.studioContextPref || "auto",
    updatedAt: now,
  };
  const keys = Object.keys(next).sort((a, b) =>
    Number(next[b]?.updatedAt || 0) - Number(next[a]?.updatedAt || 0));
  for (const extra of keys.slice(24)) delete next[extra];
  return next;
}

export function restore(store: StudioStore, routeKey: string): StudioSnapshot {
  const entry = String(routeKey || "").trim() ? store[routeKey] : null;
  const pref = entry?.contextPref;
  return {
    studioMessages: Array.isArray(entry?.messages) ? entry.messages : [],
    studioMemory: String(entry?.memory || ""),
    studioMemoryUntilId: String(entry?.memoryUntilId || ""),
    studioMemoryTurns: Number(entry?.memoryTurns) || 0,
    studioLastContextMeta: null,
    studioContextPref: pref === "raw" || pref === "processed" ? pref : "auto",
  };
}

export function buildChatMessages(
  system: string,
  messages: readonly StudioMessage[],
  currentUserId: string,
  question: string,
  keepRecent: number,
): Array<{ role: string; content: string }> {
  // The new user message already exists in Studio state but must appear only
  // once in the actual model prompt. Exclude both it and the running reply.
  const history = messages
    .filter((message) => (message.role === "user" || message.role === "assistant")
      && message.id !== currentUserId
      && Boolean(message.content)
      && message.status !== "running")
    .slice(-Math.max(0, keepRecent))
    .map((message) => ({ role: String(message.role), content: String(message.content) }));
  return [{ role: "system", content: system }, ...history, { role: "user", content: question }];
}
