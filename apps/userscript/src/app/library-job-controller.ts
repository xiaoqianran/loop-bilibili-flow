/** Browser-neutral library task state and progress projections. */
export interface LibraryJob { kind: string; index: number; total: number; label: string }
export interface LibraryJobState {
  scanBusy: boolean; batchBusy: boolean; scanPaused: boolean; batchPaused: boolean;
  cancel: boolean; cancelScan: boolean; cancelBatch: boolean;
  libraryJob?: LibraryJob;
}
export function currentKind(s: LibraryJobState): "scan" | "fetch" | "" {
  return s.batchBusy ? "fetch" : s.scanBusy ? "scan" : "";
}
export function isPaused(s: LibraryJobState): boolean {
  return s.batchBusy ? !!s.batchPaused : s.scanBusy ? !!s.scanPaused : false;
}
export function setBusy(s: LibraryJobState, kind: "scan" | "fetch", busy: boolean): void {
  if (kind === "scan") { s.scanBusy = !!busy; if (!busy) s.scanPaused = false; }
  else { s.batchBusy = !!busy; if (!busy) s.batchPaused = false; }
}
export function setProgress(s: LibraryJobState, patch: Partial<LibraryJob> = {}): void {
  const job = s.libraryJob || (s.libraryJob = { kind: "", index: 0, total: 0, label: "" });
  if (patch.kind != null) job.kind = patch.kind;
  if (patch.index != null) job.index = Math.max(0, Number(patch.index) || 0);
  if (patch.total != null) job.total = Math.max(0, Number(patch.total) || 0);
  if (patch.label != null) job.label = String(patch.label || "");
}
export function clearProgress(s: LibraryJobState): void {
  s.libraryJob = { kind: "", index: 0, total: 0, label: "" };
}
export function togglePause(s: LibraryJobState): { changed: boolean; text: string; css: string } {
  if (s.batchBusy) {
    s.batchPaused = !s.batchPaused;
    return { changed: true, text: s.batchPaused ? "已暂停字幕抓取 · 点「继续」恢复" : "继续抓取字幕…", css: s.batchPaused ? "ok" : "" };
  }
  if (s.scanBusy) {
    s.scanPaused = !s.scanPaused;
    return { changed: true, text: s.scanPaused ? "已暂停扫描 · 点「继续」恢复" : "继续扫描…", css: s.scanPaused ? "ok" : "" };
  }
  return { changed: false, text: "当前没有可暂停的扫描或抓取任务", css: "ok" };
}
export function stop(s: LibraryJobState): void {
  s.cancel = true; s.cancelScan = true; s.cancelBatch = true;
  s.scanPaused = false; s.batchPaused = false;
}
export async function waitWhilePaused(
  s: LibraryJobState, sleep: (ms: number) => Promise<unknown>,
): Promise<void> {
  while (isPaused(s) && !s.cancel && !s.cancelScan && !s.cancelBatch) await sleep(140);
}
export function view(s: LibraryJobState) {
  const kind = currentKind(s);
  const busy = !!kind;
  const paused = isPaused(s);
  const job = s.libraryJob || { kind: "", index: 0, total: 0, label: "" };
  const index = Number(job.index) || 0;
  const total = Number(job.total) || 0;
  const label = kind === "fetch" ? "抓取字幕" : kind === "scan" ? "扫描视频" : "任务";
  const parts: string[] = [];
  if (total > 0) parts.push(String(Math.min(index, total)) + " / " + total);
  if (job.label) parts.push(job.label);
  return {
    kind, busy, paused, title: paused ? label + "已暂停" : label,
    meta: parts.join(" · ") || (busy ? "进行中" : "空闲"),
    percent: total > 0 ? Math.max(0, Math.min(100, (index / total) * 100)) : (busy ? 8 : 0),
    pauseLabel: paused ? "继续" : "暂停",
    pauseTitle: paused ? "从暂停处继续" : "暂停当前任务，已完成的条目会保留",
  };
}
