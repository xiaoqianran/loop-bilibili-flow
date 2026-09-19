import { describe, expect, it } from "vitest";

import * as bilibili from "@subbatch/bilibili";
import * as core from "@subbatch/core";
import * as runtime from "@subbatch/runtime";

import * as app from "../../apps/userscript/src/app";

describe("grouped public API", () => {
  it("groups core APIs behind short domain methods", () => {
    expect(core.ai.extractText).toBe(core.extractAssistantText);
    expect(core.ai.extractChoice).toBe(core.extractFromChoice);
    expect(core.ai.display).toBe(core.formatAiDisplay);
    expect(core.ai.truncateInput).toBe(core.truncateForAi);
    expect(core.ai.parseSseLine).toBe(core.parseSseDataLine);

    expect(core.aiSession.cacheKey).toBe(core.aiSessionCacheKey);
    expect(core.aiSession.shouldAutoRestore).toBe(
      core.shouldRestoreAutomaticAiSession,
    );
    expect(core.aiSession.shouldSkipPrepare).toBe(
      core.shouldSkipPrepareForCachedSession,
    );

    expect(core.mermaid.sanitizeMarkdown).toBe(
      core.sanitizeMermaidTimestampCitationsInMarkdown,
    );
    expect(core.mermaid.stripCitations).toBe(
      core.stripMermaidTimestampCitations,
    );

    expect(core.subtitleExport.buildPath).toBe(
      core.buildSubtitleExportRelativePath,
    );
    expect(core.preprocess.stitchChunks).toBe(core.stitchPreprocessChunks);
    expect(core.command.shortcuts).toBe(core.SHORTCUT_COMMANDS);
  });

  it("groups Bilibili and runtime APIs", () => {
    expect(bilibili.route.detect).toBe(bilibili.detectContext);
    expect(bilibili.route.resolveVideo).toBe(bilibili.resolvePlayingVideoRef);
    expect(bilibili.route.playingHint).toBe(bilibili.extractPlayingVideoHint);
    expect(bilibili.video.url).toBe(bilibili.videoViewUrl);
    expect(bilibili.video.runtimeView).toBe(bilibili.runtimeVideoView);
    expect(bilibili.video.pageMeta).toBe(bilibili.pageMeta);
    expect(bilibili.subtitle.normalizeUrl).toBe(bilibili.normalizeSubtitleUrl);
    expect(bilibili.subtitle.runtimeTracks).toBe(bilibili.runtimeSubtitleTracks);
    expect(bilibili.subtitle.playerUrl).toBe(bilibili.subtitlePlayerUrl);
    expect(bilibili.subtitle.dmUrl).toBe(bilibili.subtitleDmUrl);
    expect(bilibili.subtitle.aiStatUrl).toBe(bilibili.subtitleAiStatUrl);
    expect(bilibili.subtitle.preferredIndex).toBe(bilibili.preferredTrackIndex);
    expect(bilibili.wbi.navUrl).toBe(bilibili.navUrl);
    expect(bilibili.wbi.videoDetailUrl).toBe(bilibili.videoDetailUrl);
    expect(bilibili.wbi.playerUrl).toBe(bilibili.playerUrl);
    expect(bilibili.wbi.keyFromUrl).toBe(bilibili.keyFromUrl);
    expect(bilibili.wbi.sign).toBe(bilibili.sign);

    expect(runtime.userscript.create).toBe(runtime.createUserscriptRuntime);
    expect(runtime.spa.observe).toBe(runtime.installSpaNavigateAdapter);
    expect(runtime.shortcut.shouldIgnore).toBe(runtime.shouldIgnoreShortcutEvent);
    expect(runtime.shortcut.display).toBe(runtime.shortcutDisplayChord);
    expect(runtime.shortcut.register).toBe(runtime.registerShortcutRuntime);
  });

  it("groups userscript application APIs", () => {
    expect(app.video.resolve).toBe(app.resolveCurrentVideoRef);
    expect(app.acquisition.signWbi).toBe(app.signWbi);
    expect(app.acquisition.fetchVideoView).toBe(app.fetchVideoView);
    expect(app.acquisition.fetchVideoDetail).toBe(app.fetchVideoDetail);
    expect(app.acquisition.fetchSubtitleTracks).toBe(app.fetchSubtitleTracks);
    expect(app.acquisition.collectSubtitleTracks).toBe(app.collectSubtitleTracks);
    expect(app.acquisition.resolveSubtitleUrl).toBe(app.resolveSubtitleUrl);
    expect(app.acquisition.fetchSubtitleBody).toBe(app.fetchSubtitleBody);
    expect(app.navigation.observe).toBe(app.installNavigationLifecycle);
    expect(app.activation.start).toBe(app.startUserscriptLifecycle);
  });
});
