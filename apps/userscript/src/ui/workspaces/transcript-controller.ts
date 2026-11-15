/** Subtitle reading UI, independent of workbench globals and acquisition I/O. */
import { status } from "./library-controller";
export interface TranscriptCue {
  content?: string | null;
  from_sec?: number | null;
  to_sec?: number | null;
  from?: unknown;
  to?: unknown;
}

export function formatTime(seconds: unknown, withHours = false): string {
  const total = Math.max(0, Math.floor(Number(seconds) || 0));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const sec = total % 60;
  if (withHours || h > 0) {
    return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
  }
  return `${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
}

export function filterIndexes(cues: readonly TranscriptCue[] | null | undefined, query: string): number[] {
  const needle = String(query || "").trim().toLocaleLowerCase();
  const indexes: number[] = [];
  (cues || []).forEach((cue, index) => {
    if (!needle || String(cue?.content || "").toLocaleLowerCase().includes(needle)) indexes.push(index);
  });
  return indexes;
}

/** Binary search preserves the historical 0.2-second tail tolerance. */
export function cueIndexAt(
  cues: readonly TranscriptCue[],
  time: number,
  parseSeconds: (value: unknown) => number,
): number {
  let low = 0;
  let high = cues.length - 1;
  let candidate = -1;
  while (low <= high) {
    const mid = (low + high) >> 1;
    const cue = cues[mid]!;
    const from = Number(cue.from_sec ?? parseSeconds(cue.from));
    if (time < from) high = mid - 1;
    else { candidate = mid; low = mid + 1; }
  }
  if (candidate < 0) return -1;
  const cue = cues[candidate]!;
  const to = Number(cue.to_sec ?? parseSeconds(cue.to));
  return time <= to + 0.2 ? candidate : -1;
}

const SUBTITLE_STATE_FIELDS = [
  "aid", "cid", "pages", "subStatus", "cue_count", "data", "error",
  "lan", "lan_doc", "tracks", "activeTrackIndex", "cachePath", "cacheLevel",
  "cacheStale", "source", "autoCaptured",
] as const;

export function copySubtitleState<T extends Record<string, unknown>>(
  target: T | null | undefined,
  source: Record<string, unknown> | null | undefined,
): T | null | undefined {
  if (!target || !source) return target;
  for (const field of SUBTITLE_STATE_FIELDS) {
    if (source[field] !== undefined) (target as Record<string, unknown>)[field] = source[field];
  }
  return target;
}

export interface TranscriptTrack {
  lan?: string;
  lan_doc?: string;
}
export interface TranscriptItem {
  bvid: string;
  title?: string;
  page?: number;
  subStatus?: string;
  data?: readonly TranscriptCue[] | null;
  tracks?: readonly TranscriptTrack[];
  activeTrackIndex?: number;
  cue_count?: number | null;
  lan?: string;
  lan_doc?: string;
  cachePath?: string;
  source?: string;
}
export interface TranscriptViewState {
  transcriptItemKey: string;
  transcriptQuery: string;
  transcriptFilteredIndexes: number[] | null;
  transcriptActiveCueIndex: number;
  transcriptTrackIndex: number;
  transcriptRenderEpoch: number;
}
interface TranscriptViewPorts {
  routeKey(bvid: string, page: number): string;
  preferredTrack(tracks: readonly TranscriptTrack[]): number;
  parseSeconds(value: unknown): number;
}

/** Use text nodes for subtitle content, including search matches. */
export function appendHighlightedText(container: HTMLElement, text: string | null, query: string): void {
  if (!query) {
    container.textContent = text;
    return;
  }
  const doc = container.ownerDocument;
  const source = String(text || "");
  const lower = source.toLocaleLowerCase();
  const needle = query.toLocaleLowerCase();
  let cursor = 0;
  let index = lower.indexOf(needle);
  while (index >= 0) {
    if (index > cursor) container.append(doc.createTextNode(source.slice(cursor, index)));
    const mark = doc.createElement("mark");
    mark.textContent = source.slice(index, index + query.length);
    container.append(mark);
    cursor = index + query.length;
    index = lower.indexOf(needle, cursor);
  }
  if (cursor < source.length) container.append(doc.createTextNode(source.slice(cursor)));
}

export function populateTrackSelect(
  select: HTMLSelectElement | null, item: TranscriptItem | null,
  state: Pick<TranscriptViewState, "transcriptTrackIndex">,
  preferredTrack: TranscriptViewPorts["preferredTrack"],
): void {
  if (!select) return;
  const tracks = item?.tracks || [];
  const add = (label: string, value: string) => {
    const option = select.ownerDocument.createElement("option");
    option.textContent = label;
    option.value = value;
    select.appendChild(option);
  };
  select.replaceChildren();
  if (!tracks.length) {
    add(item?.lan_doc || item?.lan || "默认字幕", "0");
    select.disabled = true;
    return;
  }
  tracks.forEach((track, index) => add(track.lan_doc || track.lan || `字幕 ${index + 1}`, String(index)));
  const active = item?.activeTrackIndex;
  const selected = active !== undefined && Number.isInteger(active) ? active : preferredTrack(tracks);
  state.transcriptTrackIndex = selected;
  select.value = String(Math.max(0, selected));
  select.disabled = tracks.length <= 1;
}

/** Render only when all reader slots are mounted; keep original cue indices. */
export function renderPanel(
  root: HTMLElement | null, item: TranscriptItem | null,
  state: TranscriptViewState, ports: TranscriptViewPorts,
): boolean {
  if (!root) return false;
  const list = root.querySelector<HTMLElement>('[data-role="transcript-list"]');
  const title = root.querySelector<HTMLElement>('[data-role="transcript-title"]');
  const meta = root.querySelector<HTMLElement>('[data-role="transcript-meta"]');
  const count = root.querySelector<HTMLElement>('[data-role="transcript-count"]');
  if (!list || !title || !meta || !count) return false;
  const select = root.querySelector<HTMLSelectElement>('[data-role="transcript-track"]');
  if (!item || item.subStatus !== "ok" || !item.data?.length) {
    title.textContent = item?.title || "当前视频字幕";
    const value = status(item);
    const page = item?.page || 1;
    meta.textContent = !item ? "从左侧选择一个视频"
      : `${item.bvid || ""}${page > 1 ? ` · P${page}` : ""} · ${value === "error" ? "抓取失败" : value === "empty" ? "无字幕" : "待抓取"}`;
    count.textContent = "";
    populateTrackSelect(select, null, state, ports.preferredTrack);
    list.innerHTML = item
      ? `<div class="bsb-transcript-empty">${value === "error" ? "字幕抓取失败，可点击右上角刷新重试。" : value === "empty" ? "这个视频没有可读取字幕。" : "该视频尚未抓取字幕，可勾选后点击左侧「抓取所选」。"}</div>`
      : '<div class="bsb-transcript-empty">从左侧选择一个视频。<br>已有字幕的项目会直接显示全文。</div>';
    return false;
  }
  if (!state.transcriptItemKey) state.transcriptItemKey = ports.routeKey(item.bvid, item.page || 1);
  title.textContent = item.title || `${item.bvid} 字幕`;
  meta.textContent = `${item.cue_count || item.data.length} 条 · ${item.lan_doc || item.lan || "字幕"} · ${item.cachePath || item.source || "已加载"}`;
  populateTrackSelect(select, item, state, ports.preferredTrack);
  const query = state.transcriptQuery.trim();
  const indexes = filterIndexes(item.data, query);
  state.transcriptFilteredIndexes = query ? indexes : null;
  count.textContent = query ? `${indexes.length}/${item.data.length}` : String(item.data.length);
  const epoch = ++state.transcriptRenderEpoch;
  const doc = root.ownerDocument;
  const fragment = doc.createDocumentFragment();
  for (const index of indexes) {
    const cue = item.data[index];
    if (!cue) continue;
    const row = doc.createElement("div");
    row.className = "bsb-transcript-row";
    if (index === state.transcriptActiveCueIndex) row.classList.add("active");
    row.dataset.cueIndex = String(index);
    const seconds = cue.from_sec ?? ports.parseSeconds(cue.from);
    const time = doc.createElement("button");
    time.type = "button";
    time.className = "bsb-transcript-time";
    time.dataset.transcriptTime = String(seconds);
    time.textContent = formatTime(seconds);
    time.title = `跳转到 ${formatTime(seconds, true)}`;
    const text = doc.createElement("p");
    text.className = "bsb-transcript-text";
    appendHighlightedText(text, cue.content || "", query);
    row.append(time, text);
    fragment.appendChild(row);
  }
  if (epoch !== state.transcriptRenderEpoch) return false;
  list.replaceChildren(fragment);
  return true;
}

export interface TranscriptFollowState {
  transcriptActiveCueIndex: number;
  transcriptAutoFollow: boolean;
  transcriptUserScrollUntil: number;
  ui: { view: string } | null;
}
export function updateActiveCue(
  root: HTMLElement | null, cues: readonly TranscriptCue[], state: TranscriptFollowState,
  time: number, force: boolean,
  ports: { parseSeconds(value: unknown): number; now(): number; reducedMotion(): boolean },
): void {
  if (!cues.length) return;
  const index = cueIndexAt(cues, Number(time) || 0, ports.parseSeconds);
  if (index < 0) {
    root?.querySelector(".bsb-transcript-row.active")?.classList.remove("active");
    state.transcriptActiveCueIndex = -1;
    return;
  }
  if (!force && index === state.transcriptActiveCueIndex) return;
  root?.querySelector(".bsb-transcript-row.active")?.classList.remove("active");
  state.transcriptActiveCueIndex = index;
  const row = root?.querySelector<HTMLElement>(`.bsb-transcript-row[data-cue-index="${index}"]`);
  row?.classList.add("active");
  if (!row || !state.transcriptAutoFollow || state.ui?.view !== "subs") return;
  if (!force && ports.now() < state.transcriptUserScrollUntil) return;
  row.scrollIntoView({ block: "center", behavior: ports.reducedMotion() ? "auto" : "smooth" });
}
