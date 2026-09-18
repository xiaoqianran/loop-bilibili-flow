import { describe, expect, it } from "vitest";

import * as bilibili from "@subbatch/bilibili";
import * as core from "@subbatch/core";
import * as runtime from "@subbatch/runtime";

import * as app from "../../apps/userscript/src/app";

describe("grouped public API", () => {
  it("groups core APIs behind short domain methods", () => {
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

    expect(runtime.userscript.create).toBe(runtime.createUserscriptRuntime);
    expect(runtime.spa.observe).toBe(runtime.installSpaNavigateAdapter);
    expect(runtime.shortcut.shouldIgnore).toBe(runtime.shouldIgnoreShortcutEvent);
    expect(runtime.shortcut.display).toBe(runtime.shortcutDisplayChord);
    expect(runtime.shortcut.register).toBe(runtime.registerShortcutRuntime);
  });

  it("groups userscript application APIs", () => {
    expect(app.video.resolve).toBe(app.resolveCurrentVideoRef);
    expect(app.navigation.observe).toBe(app.installNavigationLifecycle);
    expect(app.activation.start).toBe(app.startUserscriptLifecycle);
  });
});
