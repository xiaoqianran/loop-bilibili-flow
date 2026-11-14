import { describe, expect, it, vi } from "vitest";
import { libraryJob } from "../../apps/userscript/src/app";

const state = () => ({
  scanBusy: false, batchBusy: false, scanPaused: false, batchPaused: false,
  cancel: false, cancelScan: false, cancelBatch: false,
  libraryJob: { kind: "", index: 0, total: 0, label: "" },
});

describe("library job lifecycle", () => {
  it("prioritizes subtitle fetching, resets pause on completion", () => {
    const s = state();
    expect(libraryJob.currentKind(s)).toBe("");
    expect(libraryJob.isPaused(s)).toBe(false);
    libraryJob.setBusy(s, "scan", true);
    s.scanPaused = true;
    expect(libraryJob.currentKind(s)).toBe("scan");
    expect(libraryJob.isPaused(s)).toBe(true);
    libraryJob.setBusy(s, "fetch", true);
    expect(libraryJob.currentKind(s)).toBe("fetch");
    expect(libraryJob.isPaused(s)).toBe(false);
    libraryJob.setBusy(s, "fetch", false);
    expect(libraryJob.currentKind(s)).toBe("scan");
    libraryJob.setBusy(s, "scan", false);
    expect(s.scanPaused).toBe(false);
  });
  it("normalizes progress updates and projects legacy progress-bar metadata", () => {
    const s = state();
    libraryJob.setBusy(s, "scan", true);
    libraryJob.setProgress(s, { kind: "scan", index: 8, total: 4, label: "第 8 页" });
    expect(s.libraryJob).toEqual({ kind: "scan", index: 8, total: 4, label: "第 8 页" });
    expect(libraryJob.view(s)).toMatchObject({
      kind: "scan", busy: true, paused: false, title: "扫描视频",
      meta: "4 / 4 · 第 8 页", percent: 100, pauseLabel: "暂停",
    });
    libraryJob.setProgress(s, { index: -20, total: Number.NaN, label: "" });
    expect(s.libraryJob).toEqual({ kind: "scan", index: 0, total: 0, label: "" });
    expect(libraryJob.view(s)).toMatchObject({ meta: "进行中", percent: 8 });
    libraryJob.clearProgress(s);
    expect(s.libraryJob).toEqual({ kind: "", index: 0, total: 0, label: "" });
    libraryJob.setBusy(s, "scan", false);
    expect(libraryJob.view(s)).toMatchObject({ busy: false, meta: "空闲", percent: 0 });
  });
  it("toggles the active job with the same user notices and preserves completed entries", () => {
    const s = state();
    expect(libraryJob.togglePause(s)).toMatchObject({
      changed: false, text: "当前没有可暂停的扫描或抓取任务", css: "ok",
    });
    libraryJob.setBusy(s, "fetch", true);
    expect(libraryJob.togglePause(s)).toMatchObject({ changed: true, css: "ok" });
    expect(s.batchPaused).toBe(true);
    expect(libraryJob.view(s)).toMatchObject({
      paused: true, title: "抓取字幕已暂停", pauseLabel: "继续",
    });
    expect(libraryJob.togglePause(s)).toMatchObject({ changed: true, css: "" });
    expect(s.batchPaused).toBe(false);
    s.libraryJob.index = 3;
    libraryJob.stop(s);
    expect(s).toMatchObject({
      cancel: true, cancelScan: true, cancelBatch: true,
      scanPaused: false, batchPaused: false,
      libraryJob: { index: 3 },
    });
  });
  it("pauses polling at 140ms and exits on resume or any cancellation flag", async () => {
    const s = state();
    const sleep = vi.fn(async () => { s.scanPaused = false; });
    libraryJob.setBusy(s, "scan", true);
    s.scanPaused = true;
    await libraryJob.waitWhilePaused(s, sleep);
    expect(sleep).toHaveBeenCalledExactlyOnceWith(140);
    s.scanPaused = true;
    s.cancelScan = true;
    sleep.mockClear();
    await libraryJob.waitWhilePaused(s, sleep);
    expect(sleep).not.toHaveBeenCalled();
  });
});
