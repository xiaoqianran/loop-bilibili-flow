/** Pure subtitle reading policies, independent of workbench DOM and global state. */
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
