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

/** Selects the source without reading workbench DOM or preview state. */
export function transcriptContext(raw: string, processed: string, pref: string) {
  if (pref === "raw") return { text: raw, source: "原始字幕" };
  return { text: processed || raw, source: processed ? "规范化稿" : "原始字幕" };
}

function queryTokens(...parts: string[]) {
  const raw = parts.filter(Boolean).join(" ").toLowerCase();
  return raw.split(/[^\u4e00-\u9fffA-Za-z0-9_]+/).map(token => token.trim())
    .filter(token => token.length >= 2);
}
function splitTranscriptChunks(text: string): string[] {
  const lines = String(text || "").replace(/\r\n/g, "\n").split("\n");
  const chunks: string[] = [];
  let buffer: string[] = [];
  const flush = () => {
    const value = buffer.join("\n").trim();
    if (value) chunks.push(value);
    buffer = [];
  };
  for (const line of lines) {
    const trimmed = line.trim();
    const boundary = !trimmed || /^#{1,4}\s/.test(trimmed)
      || /^\[BV/i.test(trimmed) || /^===\s/.test(trimmed);
    if (boundary && buffer.length) flush();
    if (trimmed) buffer.push(line);
    if (buffer.join("\n").length >= 720) flush();
  }
  flush();
  return chunks;
}
function scoreChunk(chunk: string, tokens: string[]): number {
  const lower = String(chunk || "").toLowerCase();
  let score = 0;
  for (const token of tokens) {
    if (!lower.includes(token)) continue;
    score += token.length >= 4 ? 2 : 1;
  }
  if (/^#{1,4}\s/.test(chunk.trim())) score += 0.4;
  return score;
}

/** Preserve the original relevance ranking and first-two-chunks policy. */
export function compressTranscript(text: string, query: string, budget = 12000) {
  const value = String(text || "");
  if (!value) return { text: "", compressed: false, original: 0, kept: 0, chunks: 0, total: 0 };
  if (value.length <= budget) {
    return { text: value, compressed: false, original: value.length, kept: value.length, chunks: 1, total: 1 };
  }
  const chunks = splitTranscriptChunks(value);
  const tokens = queryTokens(query);
  const selected = new Set<number>();
  const head = Math.min(2, chunks.length);
  for (let i = 0; i < head; i++) selected.add(i);
  const ranked = chunks.map((chunk, index) => ({ chunk, index, score: scoreChunk(chunk, tokens) }))
    .filter(row => !selected.has(row.index))
    .sort((a, b) => b.score - a.score || a.index - b.index);
  let used = [...selected].reduce((sum, index) => sum + chunks[index]!.length, 0);
  for (const row of ranked) {
    if (row.score <= 0 && used > budget * 0.55) continue;
    if (used + row.chunk.length > budget) continue;
    selected.add(row.index);
    used += row.chunk.length;
    if (used >= budget * 0.94) break;
  }
  const ordered = [...selected].sort((a, b) => a - b);
  const parts: string[] = [];
  let prev = -2;
  for (const index of ordered) {
    if (index !== prev + 1) parts.push("…");
    parts.push(chunks[index]!);
    prev = index;
  }
  return { text: parts.join("\n\n"), compressed: true, original: value.length,
    kept: used, chunks: selected.size, total: chunks.length };
}

function clipSnippet(text: string, max: number): string {
  const value = String(text || "").replace(/\s+/g, " ").trim();
  if (value.length <= max) return value;
  return value.slice(0, Math.max(0, max - 1)) + "…";
}

export function compactMemoryText(text: string, budget = 2400): string {
  const lines = String(text || "").split("\n").map(line => line.trim()).filter(Boolean);
  if (!lines.length) return "";
  const kept: string[] = [];
  let used = 0;
  for (let i = lines.length - 1; i >= 0; i--) {
    const line = lines[i]!;
    if (used + line.length + 1 > budget && kept.length) break;
    kept.unshift(line);
    used += line.length + 1;
  }
  return kept.join("\n");
}

export function refreshMemory(state: StudioState, keepRecent = 8, budget = 2400): boolean {
  const all = (state.studioMessages || []).filter(message =>
    (message.role === "user" || message.role === "assistant") && message.content
    && message.status !== "running");
  if (all.length <= keepRecent) return false;
  const foldable = all.slice(0, -keepRecent);
  const lastId = String(state.studioMemoryUntilId || "");
  const already = lastId ? foldable.findIndex(message => message.id === lastId) : -1;
  const fresh = already >= 0 ? foldable.slice(already + 1) : foldable;
  if (!fresh.length) return !!state.studioMemory;
  const bullets = fresh.map(message => message.role === "user"
    ? "- 问：" + clipSnippet(String(message.content), 72)
    : "- 答：" + clipSnippet(String(message.content), 140));
  state.studioMemory = compactMemoryText([state.studioMemory, ...bullets].filter(Boolean).join("\n"), budget);
  state.studioMemoryUntilId = foldable[foldable.length - 1]?.id || lastId;
  state.studioMemoryTurns = foldable.length;
  return true;
}

export function lastAssistantText(messages: readonly StudioMessage[]): string {
  for (let i = messages.length - 1; i >= 0; i--) {
    const message = messages[i]!;
    if (message.role === "assistant" && message.content) return String(message.content);
  }
  return "";
}
