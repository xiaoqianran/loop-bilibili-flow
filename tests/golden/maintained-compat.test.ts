import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import {
  extractFunctionSource,
  legacyFunction,
  legacySource,
  sourceFunction,
} from "./legacy-harness";

type UnknownFunction = (...args: any[]) => any;

const maintainedSource = readFileSync(
  fileURLToPath(new URL("../../compat/maintained-runtime.js", import.meta.url)),
  "utf8",
);

function functionNames(source: string): Set<string> {
  return new Set(
    [...source.matchAll(/\b(?:async\s+)?function\s+([A-Za-z_$][\w$]*)\s*\(/g)]
      .map((match) => match[1])
      .filter((name): name is string => Boolean(name)),
  );
}

describe("Maintained full-feature compatibility source", () => {
  it("only removes functions that have a registered canonical owner", () => {
    const baselineNames = functionNames(legacySource);
    const maintainedNames = functionNames(maintainedSource);
    const missing = [...baselineNames]
      .filter((name) => !maintainedNames.has(name))
      .sort();
    const migrated = [
      "aiSubtitleStat",
      "collectTracks",
      "dmViewSubs",
      "encWbi",
      "extractAssistantText",
      "extractFromChoice",
      "formatAiDisplay",
      "formatSubtitleUrl",
      "getWbiKeys",
      "isChargeExclusiveBlocked",
      "keyFromUrl",
      "mixinKey",
      "pickTrack",
      "playerWbiV2",
      "preferredTrackIndex",
      "parseSseDataLine",
      "resolveUrl",
      "runtimeSubtitleTracks",
      "runtimeVideoView",
      "truncateForAi",
      "toCues",
      "parseSeconds",
      "formatSrtTimestamp",
      "cuesToSrt",
      "cuesToTxt",
      "formatClock",
      "cuesToAiText",
      "cueTextLength",
      "splitCuesForPreprocess",
      "parseEvidenceTimestampSeconds",
      "trimProcessedOverlap",
      "dedupeExactBlocks",
      "stitchPreprocessChunks",
      "preprocessCacheKey",
      "makePromptProfileId",
      "createPromptProfile",
      "normalizePromptProfiles",
      "resolvePromptActiveIds",
      "makeAiProfileId",
      "createAiProfile",
      "normalizeAiProfiles",
      "viewDetail",
    ].sort();

    expect(baselineNames.size).toBeGreaterThan(250);
    expect(missing).toEqual(migrated);
    expect(maintainedSource).toContain("function boot()");
    expect(maintainedSource).toContain("scheduleAutoCapture(\"initial\", 180)");
  });

  it("delegates migrated acquisition rules to grouped Bilibili APIs", () => {
    expect(maintainedSource).toContain("function bilibiliCall(");
    expect(maintainedSource).toContain('bilibiliCall("video.runtimeView"');
    expect(maintainedSource).toContain('bilibiliCall("video.pageMeta"');
    expect(maintainedSource).toContain('bilibiliCall("video.isChargeBlocked"');
    expect(maintainedSource).toContain('bilibiliCall("subtitle.runtimeTracks"');
    expect(maintainedSource).toContain('bilibiliCall("subtitle.pickTrack"');
    expect(maintainedSource).toContain('bilibiliCall("subtitle.preferredIndex"');
    expect(maintainedSource).toContain('"acquisition.fetchVideoView"');
    expect(maintainedSource).toContain('"acquisition.fetchSubtitleTracks"');
    expect(maintainedSource).toContain('"acquisition.fetchVideoDetail"');
    expect(maintainedSource).toContain('"acquisition.collectSubtitleTracks"');
    expect(maintainedSource).toContain('"acquisition.resolveSubtitleUrl"');
    expect(maintainedSource).toContain('"acquisition.signWbi"');

    const viewFetch = extractFunctionSource(maintainedSource, "fetchVideoViewFast");
    expect(viewFetch).toContain("appCall(");
    expect(viewFetch).toContain('"acquisition.fetchVideoView"');
    expect(viewFetch).not.toContain("requestJsonFast");
    expect(viewFetch).not.toContain("/x/web-interface/view");

    const trackFetch = extractFunctionSource(
      maintainedSource,
      "fetchSubtitleTracksFast",
    );
    expect(trackFetch).toContain("appCall(");
    expect(trackFetch).toContain('"acquisition.fetchSubtitleTracks"');
    expect(trackFetch).not.toContain("requestJsonFast");
    expect(trackFetch).not.toContain("/x/player/");

    const bodyFetch = extractFunctionSource(maintainedSource, "fetchTrackBodyFast");
    expect(bodyFetch).toContain('"acquisition.fetchSubtitleBody"');
    expect(bodyFetch).not.toContain("requestJsonFast");

    const subtitleFetch = extractFunctionSource(maintainedSource, "fetchSubtitle");
    expect(subtitleFetch).toContain('"acquisition.fetchVideoDetail"');
    expect(subtitleFetch).toContain('"acquisition.collectSubtitleTracks"');
    expect(subtitleFetch).toContain('"acquisition.resolveSubtitleUrl"');
    expect(subtitleFetch).toContain('"acquisition.fetchSubtitleBody"');
    expect(subtitleFetch).not.toContain("/x/player/");
    expect(subtitleFetch).not.toContain("/x/v2/dm/view");

    const listFetch = extractFunctionSource(maintainedSource, "fetchListPage");
    expect(listFetch).toContain('"acquisition.signWbi"');
    expect(listFetch).not.toContain("getWbiKeys");
    expect(listFetch).not.toContain("encWbi");

    for (const name of [
      "aiSubtitleStat",
      "collectTracks",
      "dmViewSubs",
      "encWbi",
      "extractAssistantText",
      "extractFromChoice",
      "formatAiDisplay",
      "formatSubtitleUrl",
      "getWbiKeys",
      "isChargeExclusiveBlocked",
      "keyFromUrl",
      "mixinKey",
      "pickTrack",
      "playerWbiV2",
      "preferredTrackIndex",
      "parseSseDataLine",
      "resolveUrl",
      "runtimeSubtitleTracks",
      "runtimeVideoView",
      "truncateForAi",
      "toCues",
      "parseSeconds",
      "formatSrtTimestamp",
      "cuesToSrt",
      "cuesToTxt",
      "formatClock",
      "cuesToAiText",
      "cueTextLength",
      "splitCuesForPreprocess",
      "parseEvidenceTimestampSeconds",
      "trimProcessedOverlap",
      "dedupeExactBlocks",
      "stitchPreprocessChunks",
      "preprocessCacheKey",
      "makePromptProfileId",
      "createPromptProfile",
      "normalizePromptProfiles",
      "resolvePromptActiveIds",
      "makeAiProfileId",
      "createAiProfile",
      "normalizeAiProfiles",
      "viewDetail",
    ]) {
      expect(maintainedSource).not.toContain(`function ${name}(`);
    }
  });

  it("fixes query-key BV corruption while documenting the baseline behavior", () => {
    const baselineExtract = legacyFunction<UnknownFunction>("extractBvid");
    const maintainedExtract = sourceFunction<UnknownFunction>(
      maintainedSource,
      "extractBvid",
    );
    const input = "https://www.bilibili.com/list/1?bvid=BV1Q541167Qg";

    expect(baselineExtract(input)).toBe("BVid");
    expect(maintainedExtract(input)).toBe("BV1Q541167Qg");
  });

  it("renders PRE chunk boundary variables in the maintained product path", () => {
    const render = sourceFunction<UnknownFunction>(
      maintainedSource,
      "renderPromptTemplate",
    );
    expect(
      render("{{chunkStart}}|{{coreStart}}|{{chunkEnd}}", {
        chunkStart: "00:30",
        coreStart: "01:00",
        chunkEnd: "02:00",
      }),
    ).toBe("00:30|01:00|02:00");
  });

  it("clears transcript search state when SPA navigation changes videos", () => {
    const navigateSource = extractFunctionSource(maintainedSource, "onMaybeNavigate");

    expect(navigateSource).toContain('state.transcriptQuery = ""');
    expect(navigateSource).toContain("state.transcriptFilteredIndexes = null");
    expect(navigateSource).toContain("transcriptSearch.value = \"\"");
    expect(navigateSource).toContain('bilibiliFn("playingVideoChanged")');
  });

  it("delegates current video resolution to the userscript app boundary", () => {
    const currentVideoSource = extractFunctionSource(
      maintainedSource,
      "currentRouteVideoRef",
    );
    expect(currentVideoSource).toContain('appFn("resolveCurrentVideoRef")');
    expect(currentVideoSource).toContain('bilibiliFn("resolvePlayingVideoRef")');
    expect(currentVideoSource).toContain('bilibiliFn("extractPlayingVideoHint")');
    expect(extractFunctionSource(maintainedSource, "extractPageHints")).toContain(
      'bilibiliFn("extractPlayingVideoHint")',
    );
    const bootSource = extractFunctionSource(maintainedSource, "boot");
    expect(bootSource).toContain('appFn("installNavigationLifecycle")');
    expect(bootSource).toContain("HTMLMediaElement");
    expect(bootSource).toContain("800");
  });

  it("resets preprocess view to raw when SPA navigation aborts AI state", () => {
    const abortSource = extractFunctionSource(
      maintainedSource,
      "abortAiForAutoNavigation",
    );
    expect(abortSource).toContain('state.aiInputView = "raw"');
    expect(abortSource).toContain("state.preprocessRun = null");
  });

  it("falls back preprocess canvas to raw when processed text is empty", () => {
    const canvasSource = extractFunctionSource(
      maintainedSource,
      "renderPreprocessCanvas",
    );
    expect(canvasSource).toContain(
      'if (state.aiInputView === "processed" && !processed && raw)',
    );
    expect(canvasSource).toContain('state.aiInputView = "raw"');
  });

  it("bridges pure monorepo cores when SubBatch bootstrap is present", () => {
    expect(maintainedSource).toContain("SubBatchMonorepo");
    expect(extractFunctionSource(maintainedSource, "extractBvid")).toContain(
      "SubBatch?.SubBatchMonorepo?.bilibili?.extractBvid",
    );
    expect(extractFunctionSource(maintainedSource, "detectContext")).toContain(
      "SubBatch?.SubBatchMonorepo?.bilibili?.detectContext",
    );
    expect(extractFunctionSource(maintainedSource, "routeVideoKey")).toContain(
      "SubBatch?.SubBatchMonorepo?.bilibili?.routeVideoKey",
    );
    expect(
      extractFunctionSource(maintainedSource, "renderPromptTemplate"),
    ).toContain("SubBatch?.SubBatchMonorepo");
  });

  it("bridges subtitle export/library groups to monorepo core (no dual implementation)", () => {
    // Architecture: product body is a thin bridge; rules live only in packages/core.
    expect(maintainedSource).toContain("function subbatchCore(");
    expect(maintainedSource).toContain("function coreCall(");
    expect(maintainedSource).toContain('coreCall("buildSubtitleExportRelativePath"');
    expect(maintainedSource).toContain('coreCall("upsertIndexForExportItem"');
    expect(maintainedSource).toContain('coreCall("buildLibraryRenderNodes"');
    expect(maintainedSource).toContain('coreCall("attachSelectionGroupMeta"');
    expect(maintainedSource).toContain('coreCall("attachCollectionGroupMeta"');
    expect(maintainedSource).toContain('coreCall("applyUgcSeasonToItems"');
    expect(maintainedSource).toContain('coreCall("normalizeExportItem"');
    expect(maintainedSource).toContain('coreCall("suggestCaptureMode"');
    expect(maintainedSource).toContain("function syncCaptureModeFromItem(");
    expect(maintainedSource).toContain("function downloadSubtitleExportBatch(");
    expect(maintainedSource).toContain("function stampUgcSeasonGroupMeta(");
    expect(maintainedSource).toContain("auto_promoted_ugc_season");
    expect(maintainedSource).toContain("folder-expand-all");
    expect(maintainedSource).toContain("GM_download");
    expect(maintainedSource).toContain("conflictAction");
    expect(maintainedSource).toContain("syncCaptureModeFromItem(liveItem");
    // Must NOT re-implement sanitize / index rules inline (architecture guard).
    expect(maintainedSource).not.toContain(".replace(/\\./g, \"·\")");
    expect(maintainedSource).not.toContain("kind: \"video\"");

    const batch = extractFunctionSource(maintainedSource, "downloadSubtitleExportBatch");
    expect(batch).toContain("normalizeExportItem");
    expect(batch).toContain("upsertIndexForExportItem");
    expect(batch).toContain("buildSubtitleExportRelativePath");
    expect(batch).toContain("buildGroupMetaPatches");
    expect(batch).toContain("applyGroupMetaPatchToItems");
    expect(batch).toContain('overwrite: true');

    const doBatch = extractFunctionSource(maintainedSource, "doBatch");
    expect(doBatch).toContain("downloadSubtitleExportBatch(pool, ext, convert)");
    expect(doBatch).not.toContain('`${it.bvid}${it.page > 1 ? "_P"');
  });

  it("uses two-pane Knowledge Workspace (Navigator | Reader)", () => {
    expect(maintainedSource).toContain("function knowledgeNavigatorHtml(");
    expect(maintainedSource).toContain("function knowledgeReaderHtml(");
    expect(maintainedSource).toContain("function knowledgeContextHtml(");
    expect(maintainedSource).toContain('data-role="knowledge-nav"');
    expect(maintainedSource).toContain('data-role="knowledge-nav-split"');
    expect(maintainedSource).toContain("bsb-knowledge-reader");
    expect(maintainedSource).toContain("bsb-knowledge-evidence-chip");
    expect(maintainedSource).toContain("knowledgeNavW");
    expect(maintainedSource).toContain("--bsb-knowledge-nav-w");
    expect(maintainedSource).not.toContain('data-role="knowledge-tree-split"');
    expect(maintainedSource).not.toContain('data-role="knowledge-list-split"');
    expect(maintainedSource).not.toContain("data-knowledge-workspace-tree-toggle");
    expect(maintainedSource).toContain("Enter 发送");
    // Knowledge 页不得无条件 display:flex，否则会叠在 AI/字幕上。
    expect(maintainedSource).not.toMatch(
      /\[data-view-panel="knowledge"\]\s*\{\s*min-height:0;\s*height:100%;\s*display:flex/,
    );
    expect(maintainedSource).toContain(
      '.bsb-view[data-view-panel="knowledge"]',
    );
    // Knowledge answers reuse AI 处理字幕 segmented card chrome.
    expect(maintainedSource).toContain("function knowledgeAnswerReadingBlocks(");
    expect(maintainedSource).toContain("inset:9px 0 9px auto");
    expect(maintainedSource).toContain("function pinKnowledgeScrollTop(");
    expect(extractFunctionSource(maintainedSource, "renderKnowledgeRail")).not.toContain("stickBottom");
    expect(extractFunctionSource(maintainedSource, "renderKnowledgeWorkspace")).not.toContain("stickBottom");
    expect(extractFunctionSource(maintainedSource, "paintStudioAnswer")).not.toContain("scrollHeight");
    expect(maintainedSource).toContain("function renderKnowledgeAnswerCards(");
    expect(maintainedSource).toContain("bsb-knowledge-answer-card");
    expect(maintainedSource).toContain("bsb-preprocess-block bsb-knowledge-answer-card");
    // Markdown semantic highlight layer: ==phrase== → highlighter marks.
    expect(maintainedSource).toContain("function decorateMarkdownHighlights(");
    expect(maintainedSource).toContain("bsb-md-highlight");
    expect(maintainedSource).toContain("【阅读强调】");
    expect(maintainedSource).toContain("==关键短语==");
    expect(maintainedSource).toContain("PROMPT_SCHEMA_VERSION = 9");
    expect(maintainedSource).toContain("function sendStudioChat(");
    expect(maintainedSource).toContain("function paintStudioAnswer(");
    expect(maintainedSource).toContain("data-role=\"studio-answer\"");
    expect(maintainedSource).toContain("align-self: flex-end");
    expect(maintainedSource).toContain("// @version      6.9.16");
    expect(maintainedSource).toContain("// @match        *://www.bilibili.com/festival/*");
    expect(maintainedSource).toContain("// @match        *://www.bilibili.com/blackboard/*");
    expect(maintainedSource).toContain('|| "6.9.16"');
    expect(maintainedSource).toContain("function isDeferredVideoCarrierPage(");
    expect(maintainedSource).toContain("function startUserscript(");
    const startSource = extractFunctionSource(maintainedSource, "startUserscript");
    expect(startSource).toContain('appFn("startUserscriptLifecycle")');
    expect(startSource).toContain("isDeferredVideoCarrierPage(location.href)");
    expect(maintainedSource).toContain('bilibiliFn("extractPlayingVideoHint")');
    expect(maintainedSource).toContain("--bsb-ui-font: 14px");
    expect(maintainedSource).toContain("font-size: 14px !important");
    expect(maintainedSource).toContain("CORE_LOCAL_FALLBACKS");
    expect(maintainedSource).toContain("NOTE_FONT_DEFAULT = 14");
    expect(maintainedSource).toContain("--bsb-knowledge-font: 14px");
    expect(maintainedSource).toContain("font-size:var(--bsb-knowledge-font)");
    expect(maintainedSource).toContain("<strong>对话</strong>");
    expect(maintainedSource).toContain("function flowTaskModelsHtml(");
    expect(maintainedSource).toContain("function bindFlowModelDrag(");
    expect(maintainedSource).toContain("function compressStudioTranscript(");
    expect(maintainedSource).toContain("function refreshStudioMemory(");
    expect(maintainedSource).toContain("data-ai-stage=\"chat\"");
    expect(maintainedSource).toContain("看完能懂");
    expect(maintainedSource).toContain("builtin-html-reading-folio");
    expect(maintainedSource).toContain("function extractHtmlFolioSource(");
    expect(maintainedSource).toContain("function mountHtmlFolio(");
    expect(maintainedSource).toContain("bsb-folio-shell");
    expect(maintainedSource).toContain("function buildFolioToc(");
    expect(maintainedSource).toContain("bsb-folio-toc-title");
    expect(maintainedSource).toContain("阅读大纲");
    expect(extractFunctionSource(maintainedSource, "folioOutlineFromHeadings")).toContain(
      'coreFn("buildFolioOutline")',
    );
    expect(extractFunctionSource(maintainedSource, "collectFolioHeadings")).toContain("h2, h3");
    expect(extractFunctionSource(maintainedSource, "setFolioTocCurrent")).not.toContain("scrollIntoView");
    expect(extractFunctionSource(maintainedSource, "setFolioTocCurrent")).toContain("scrollFolioTocLinkIntoNav");
    expect(maintainedSource).toContain("function syncFolioTocViewport(");
    expect(maintainedSource).toContain("--folio-toc-h");
    // Knowledge MD/math: full-doc prepare + lib ensure before paint.
    expect(maintainedSource).toContain("function ensureKnowledgeRenderLibs(");
    expect(maintainedSource).toContain("function knowledgeChunkToHtml(");
    expect(maintainedSource).toContain("function hydrateKnowledgeAnswerDom(");
    expect(maintainedSource).toContain('ADD_ATTR: ["target", "rel", "aria-label", "data-bsb-m", "class", "style", "xmlns", "encoding"]');
    // AI 处理字幕 cards share Knowledge MD/math/highlight rendering.
    expect(maintainedSource).toContain("function renderProcessedTranscriptBodyHtml(");
    expect(maintainedSource).toContain("bsb-preprocess-block-body bsb-md-rich");
    expect(maintainedSource).toContain("function wrapFirstTextOccurrence(");
  });

  it("refreshes the preprocess canvas after automatic subtitle capture", () => {
    const captureStart = maintainedSource.indexOf(
      "async function autoCaptureCurrentVideo(",
    );
    const captureEnd = maintainedSource.indexOf("// ─── SPA watch", captureStart);
    const refreshStatement =
      'if (currentAiWorkbenchStage() === "preprocess") await renderPreprocessCanvas()';

    expect(captureStart).toBeGreaterThan(0);
    expect(captureEnd).toBeGreaterThan(captureStart);
    expect(maintainedSource.slice(captureStart, captureEnd)).toContain(refreshStatement);
  });

  it("bridges AI session cache to monorepo core instead of re-implementing rules", () => {
    expect(maintainedSource).toContain("function persistAiSessionCache(");
    expect(maintainedSource).toContain("function restoreAiSessionForRoute(");
    expect(extractFunctionSource(maintainedSource, "persistAiSessionCache")).toContain(
      'coreFn("buildAiSessionCachePayload")',
    );
    expect(extractFunctionSource(maintainedSource, "replaceMermaidBlockAt")).toContain(
      'coreFn("replaceMermaidBlockAt")',
    );
    expect(extractFunctionSource(maintainedSource, "currentMermaidRepairResolution")).toContain(
      'coreFn("resolveMermaidRepairConfig")',
    );
    expect(extractFunctionSource(maintainedSource, "handleMermaidTool")).toContain('action === "open-llm"');
    expect(maintainedSource).toContain("打开 设置 → LLM");
    expect(maintainedSource).toContain("就填在这里，不用去翻设置");
    expect(extractFunctionSource(maintainedSource, "persistRepairedMermaid")).toContain(
      "persistAiSessionCache()",
    );
    expect(extractFunctionSource(maintainedSource, "handleMermaidTool")).toContain(
      "persistAiSessionCache",
    );
    expect(extractFunctionSource(maintainedSource, "boot")).toContain(
      "restoreAiSessionForRoute(routeKey)",
    );
    expect(extractFunctionSource(maintainedSource, "onMaybeNavigate")).toContain(
      "restoreAiSessionForRoute(nextVideoKey)",
    );
    const analyzeStart = maintainedSource.indexOf(
      "async function doAiAnalyze(options = {})",
    );
    const analyzeSlice = maintainedSource.slice(analyzeStart, analyzeStart + 16000);
    expect(analyzeSlice).toContain("partitionPlannedAiRuns");
    expect(analyzeSlice).toContain("generateIds");
    expect(analyzeSlice).toContain("restoreAiSessionForRoute");
  });
});
