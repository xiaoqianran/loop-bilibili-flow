import { readFileSync } from "node:fs";
import { userscriptMetadata } from "../../apps/userscript/metadata";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { renderShellStyles } from "../../apps/userscript/src/ui/shell/styles";
import { renderAiWorkspace } from "../../apps/userscript/src/ui/workspaces/ai-markup";
import { renderKnowledgeDrilldownStyles } from "../../apps/userscript/src/ui/workspaces/knowledge-styles";
import { renderAiStyles } from "../../apps/userscript/src/ui/workspaces/ai-styles";
import { renderReadingStyles } from "../../apps/userscript/src/ui/workspaces/reading-styles";
import { renderWorkspaceOverrides } from "../../apps/userscript/src/ui/workspaces/workspace-overrides-styles";
import { renderKnowledgeWorkspaceMarkup } from "../../apps/userscript/src/ui/workspaces/knowledge-markup";

import {
  extractFunctionSource,
  legacyFunction,
  legacySource,
  sourceFunction,
} from "./legacy-harness";

type UnknownFunction = (...args: any[]) => any;

const maintainedSource = readFileSync(
  fileURLToPath(new URL("../../apps/userscript/src/workbench/runtime.ts", import.meta.url)),
  "utf8",
);

function functionNames(source: string): Set<string> {
  return new Set(
    [...source.matchAll(/\b(?:async\s+)?function\s+([A-Za-z_$][\w$]*)\s*(?:<[^>]*>)?\s*\(/g)]
      .map((match) => match[1])
      .filter((name): name is string => Boolean(name)),
  );
}

describe("Bundled full-feature workbench source", () => {
  it("delegates foundational shell CSS without removing workspace styles", () => {
    expect(maintainedSource).toContain("ui.panelStyles.renderShellStyles(PANEL_ID, MIN_W, MIN_H, DOCK_EDGE_PX)");
    expect(maintainedSource).toContain("ui.workspaceLayoutStyles.renderWorkspaceLayoutStyles(PANEL_ID)");
  });
  it("renders Studio chrome header from the extracted UI shell", () => {
    expect(maintainedSource).toContain("ui.panelMarkup.renderPanelHeader(SCRIPT_VERSION)");
    expect(maintainedSource).not.toContain('<div class="bsb-size-switch" role="group"');
  });
  it("delegates pointer event ownership to the extracted Studio shell controller", () => {
    expect(maintainedSource).toContain("ui?.panelPointer?.bindPanelPointerController");
    expect(maintainedSource).not.toContain('head.addEventListener("pointerdown"');
    expect(maintainedSource).not.toContain('handle.addEventListener("pointermove"');
  });
  it("routes both collection metadata lookups through the canonical acquisition owner", () => {
    expect(maintainedSource).not.toMatch(/await viewDetail\(/);
    expect(
      maintainedSource.match(/await appCall\("acquisition\.fetchVideoDetail", runtimeNetwork\(\), (?:bvid|id)\)/g),
    ).toHaveLength(3); // fetchSubtitle already used the canonical acquisition owner.
  });

  it("delegates flow drawer setting changes to the typed UI controller", () => {
    expect(maintainedSource).toContain("ui.settingsInteraction.bindFlowChanges(root,");
    expect(maintainedSource).not.toContain('root.addEventListener("change", (e) => {');
    expect(maintainedSource).toContain("taskPrompt: (taskId");
  });

  it("routes scan input requirements and paging policy through typed Application", () => {
    expect(maintainedSource).toContain('appCall("scan.validateContext", ctx)');
    expect(maintainedSource).toContain('appCall("scan.pageSizeFor", ctx.type)');
    expect(maintainedSource).not.toContain("function validateCtxForScan(");
  });

  it("uses only the canonical Application AI transport and core fingerprinting", () => {
    const ai = extractFunctionSource(maintainedSource, "requestChatCompletion");
    expect(ai).toContain('appCall("ai.request"');
    expect(ai).toContain("network: runtimeNetwork()");
    expect(maintainedSource).not.toContain("function requestChatViaPageFetch(");
    expect(maintainedSource).not.toContain("function requestChatViaGm(");
    expect(maintainedSource).not.toContain("function md5(");
    expect(maintainedSource).toContain('coreCall("md5", currentInputPreviewText("processed")');
    expect(maintainedSource).toContain('coreCall("md5", clean || block.text)');
  });

  it("only removes functions that have a registered canonical owner", () => {
    const baselineNames = functionNames(legacySource);
    const maintainedNames = functionNames(maintainedSource);
    const missing = [...baselineNames]
      .filter((name) => !maintainedNames.has(name))
      .sort();
    const migrated = [
      "scheduleAutoHide",
      "resolveAiScrollState",
      "shouldStickBottom",
      "knowledgeAncestorNodes",
      "knowledgeBranchContext",
      "knowledgeTreeHtml",
      "knowledgeBreadcrumbHtml",
      "knowledgeSuggestionsHtml",
      "openCacheDatabase",
      "openKnowledgeDb",
      "persistentCacheRead",
      "persistentCacheWrite",
      "persistentCacheDelete",
      "initCacheChannel",
      "sessionCacheRead",
      "sessionCacheWrite",
      "libraryStatus",
      "libraryStatusLabel",
      "libraryFilteredEntries",
      "formatTranscriptTime",
      "copySubtitleState",
      "filterTranscriptIndexes",
      "transcriptCueIndexAt",
      "appendTranscriptHighlightedText",
      "populateTranscriptTrackSelect",
      "aiSubtitleStat",
      "buildProcessedSubtitlePayload",
      "currentPreprocessSettings",
      "parseProcessedTimestampToken",
      "processedTranscriptReadingBlocks",
      "runPreprocessWorkerPool",
      "requestPreprocessChunkWithRetry",
      "worker",
      "cloneAiSessionInput",
      "collectTracks",
      "dmViewSubs",
      "endDrag",
      "endResize",
      "ensureSubtitlesForAi",
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
      "defaultUiGeom",
      "md5",
      "requestChatViaPageFetch",
      "requestChatViaGm",
      "startGmTextPath",
      "validateCtxForScan",
      "bytesToWords",
      "cmn",
      "ff",
      "gg",
      "hh",
      "ii",
      "toUtf8Bytes",
      "wordsToHex",
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
    const presentationSource = readFileSync(new URL("../../apps/userscript/src/ui/workspaces/mermaid-presentation.ts", import.meta.url), "utf8");
    const presentationOwners = ["buildMermaidCard", "closeMermaidFullscreen", "fitMermaidToViewport",
      "getMermaidScale", "openMermaidFullscreen", "parseMermaidViewBox", "setMermaidScale", "updateMermaidScaleLabel"];
    for (const name of presentationOwners) expect(functionNames(presentationSource).has(name)).toBe(true);
    expect(maintainedSource).toContain('from "../ui/workspaces/mermaid-presentation"');
    // These private compatibility helpers had no callers in the maintained runtime.
    // ESLint now checks the whole runtime; their active controllers remain covered above.
    const retiredUnused = ["debounce", "knowledgeMarkdownHtml", "loadAiConfig", "requestJsonFast",
      "saveAiConfig", "saveAiConfigFromForm", "setBusy"];
    for (const name of retiredUnused) expect(maintainedSource).not.toMatch(new RegExp(`\\b${name}\\s*\\(`));
    expect(missing).toEqual([...migrated, ...presentationOwners, ...retiredUnused].sort());
    expect(maintainedSource).toContain("function boot()");
    expect(maintainedSource).toContain("scheduleAutoCapture(\"initial\", 180)");
  });

  it("delegates all configuration and flow drag events to one typed UI owner", () => {
    const source = extractFunctionSource(maintainedSource, "commitConfigListReorder");
    expect(source).toContain('appCall("ordering.reorderIds"');
    expect(source).toContain('SubBatch.SubBatchMonorepo.app.ordering.applyConfigIdOrder(');
    expect(source).toContain('SubBatch.SubBatchMonorepo.app.ordering.applyPromptStageOrder(');
    expect(maintainedSource).toContain("ui.reorderInteraction.bind(root,");
    for (const obsolete of [
      "function bindConfigListDrag(", "function bindFlowModelDrag(",
      "function reorderIds(", "function applyConfigIdOrder(", "function applyPromptStageOrder(",
    ]) {
      expect(maintainedSource).not.toContain(obsolete);
    }
    expect(maintainedSource).toContain("function commitFlowModelReorder(");
  });

  it("delegates resource-library and transcript input listeners to a typed UI owner", () => {
    expect(maintainedSource).toContain("ui.resourceInteraction.bind(root,");
    expect(maintainedSource).not.toContain('const listBox = root.querySelector(\'[data-role="list"]\');');
    expect(maintainedSource).not.toContain('transcriptList?.addEventListener("wheel"');
    expect(maintainedSource).not.toContain('root.querySelector(\'[data-role="library-filters"]\')?.addEventListener');
    expect(maintainedSource).toContain("selectGroup: (key, checked) =>");
    expect(maintainedSource).toContain("recordUserScroll: () =>");
  });

  it("uses strict initial state, typed UI persistence and validated Application method calls", () => {
    expect(maintainedSource).toContain("const state = createWorkbenchState({");
    expect(maintainedSource).toContain("panelPersistence.loadUiGeometry(");
    expect(maintainedSource).toContain("panelPersistence.serializeUiGeometry(");
    expect(maintainedSource).toContain("return callApp(SubBatch?.SubBatchMonorepo?.app, path, ...args)");
    expect(maintainedSource).not.toContain("const state = {");
    expect(maintainedSource).not.toContain("const o = JSON.parse(raw)");
    expect(maintainedSource).not.toContain("let value = mono?.app");
  });

  it("delegates panel Settings form and workspace DOM handlers to strict UI ownership", () => {
    expect(maintainedSource).toContain("ui.settingsInteraction.bind(root,");
    expect(maintainedSource).not.toContain('root.querySelectorAll("[data-view]").forEach((btn)');
    expect(maintainedSource).not.toContain('root.querySelector(\'[data-role="max-pages"]\').addEventListener');
    expect(maintainedSource).not.toContain('root.querySelector(\'[data-role="knowledge-search"]\')?.addEventListener');
  });

  it("has exactly one lifecycle owner for startup and SPA navigation", () => {
    const boot = extractFunctionSource(maintainedSource, "boot");
    const start = extractFunctionSource(maintainedSource, "startUserscript");
    expect(boot).toContain('appCall("navigation.observe"');
    expect(start).toContain('appCall("activation.start"');
    expect(boot).not.toContain("history.pushState =");
    expect(start).not.toContain('addEventListener("loadstart"');
    expect(maintainedSource).not.toContain("function isDeferredVideoCarrierPage(");
  });

  it("routes subtitle reading policies through the bundled UI namespace", () => {
    const controller = "SubBatch.SubBatchMonorepo.ui.transcriptController.";
    for (const method of ["renderPanel", "updateActiveCue", "copySubtitleState"]) {
      expect(maintainedSource).toContain(controller + method + "(");
    }
    for (const obsolete of [
      "function formatTranscriptTime(",
      "function filterTranscriptIndexes(",
      "function transcriptCueIndexAt(",
      "function copySubtitleState(",
      "function appendTranscriptHighlightedText(",
      "function populateTranscriptTrackSelect(",
    ]) {
      expect(maintainedSource).not.toContain(obsolete);
    }
  });

  it("routes resource library and session cache through their new owners", () => {
    for (const name of ["status", "statusLabel", "filteredEntries"]) {
      expect(maintainedSource).toContain("SubBatch.SubBatchMonorepo.ui.libraryController." + name + "(");
    }
    expect(maintainedSource).toContain("readSessionCache<BilibiliVideoView>(() => sessionStorage,");
    expect(maintainedSource).toContain("readSessionCache<SubtitleTrack[]>(() => sessionStorage,");
    expect(maintainedSource).toContain("writeSessionCache(() => sessionStorage,");
    for (const obsolete of ["sessionCacheRead", "sessionCacheWrite", "function libraryStatus(", "function libraryFilteredEntries("]) {
      expect(maintainedSource).not.toContain(obsolete);
    }
  });

  it("delegates indexed storage and cache invalidation to Runtime", () => {
    expect(maintainedSource).toContain("createPersistentCache({");
    expect(maintainedSource).toContain("persistentCache.read(");
    expect(maintainedSource).toContain("persistentCache.write(");
    expect(maintainedSource).toContain("persistentCache.initChannel()");
    expect(maintainedSource).not.toContain("function openCacheDatabase(");
    expect(maintainedSource).not.toContain("function persistentCacheRead(");
  });

  it("delegates library job state transitions to the application controller", () => {
    for (const name of ["setBusy", "setProgress", "clearProgress", "view", "isPaused", "waitWhilePaused", "togglePause", "stop"]) {
      expect(maintainedSource).toContain('appCall("libraryJob.' + name + '"');
    }
    expect(maintainedSource).not.toContain("function currentLibraryJobKind(");
    expect(maintainedSource).not.toContain("function isLibraryJobPaused(");
    expect(maintainedSource).toContain("function updateLibraryJobBar()");
  });

  it("delegates scan pagination and library merge policy to Application", () => {
    expect(maintainedSource).toContain('appCall("libraryScan.collectPages"');
    expect(maintainedSource).toContain('"libraryScan.mergeItems"');
    expect(maintainedSource).not.toContain("const existingByKey = new Map(");
  });

  it("delegates collection member planning and multipart expansion to Application", () => {
    for (const name of ["expandCollectionParts", "collectUserSeasons"]) {
      expect(maintainedSource).toContain('"libraryScan.' + name + '"');
    }
    expect(maintainedSource).not.toContain("const pushItem = (item) => {");
    expect(maintainedSource).toContain("async function expandCollectionArchivesWithParts(items:");
  });

  it("delegates personal-space season paging to the Application coordinator", () => {
    expect(maintainedSource).toContain('appCall("libraryScan.collectUserSeasons"');
    expect(maintainedSource).toContain("async function loadUserSpaceSeasons(mid:");
    expect(maintainedSource).not.toContain("const seasonsList = lists.seasons_list || [];");
    expect(maintainedSource).not.toContain("const totalHint = pageInfo.total");
  });

  it("delegates Studio context and Knowledge tree policies to Application", () => {
    for (const name of [
      "transcriptContext", "compressTranscript", "refreshMemory",
      "compactMemoryText", "lastAssistantText",
    ]) {
      expect(maintainedSource).toContain('"studio.' + name + '"');
    }
    for (const name of ["ancestorNodes", "branchContext"]) {
      expect(maintainedSource.includes('appCall("knowledge.' + name + '"') || maintainedSource.includes("SubBatch.SubBatchMonorepo.app.knowledge." + name + "(")).toBe(true);
    }
    for (const obsolete of [
      "function compressStudioTranscript(",
      "function compactStudioMemoryText(",
      "function studioQueryTokens(",
      "function knowledgeAncestorNodes(",
      "function knowledgeBranchContext(",
    ]) {
      expect(maintainedSource).not.toContain(obsolete);
    }
  });

  it("delegates Studio turn lifecycle and Knowledge recovery to Application", () => {
    for (const name of ["beginTurn", "updateTurn", "finishTurn", "failTurn", "clearTurnHistory"]) {
      expect(maintainedSource).toContain('appCall("studio.' + name + '"');
    }
    for (const name of ["sortAnchors", "reconcileNodes"]) {
      expect(maintainedSource.includes('appCall("knowledge.' + name + '"') || maintainedSource.includes("SubBatch.SubBatchMonorepo.app.knowledge." + name + "(")).toBe(true);
    }
    expect(maintainedSource).not.toContain('const liveRunning = state.knowledgeBusy');
    expect(maintainedSource).not.toContain('botMsg.status = runtime.abort ?');
  });

  it("uses the Knowledge repository as the sole database writer and delete owner", () => {
    expect(maintainedSource).not.toContain("function openKnowledgeDb(");
    expect(maintainedSource).not.toContain("state.knowledgeDbPromise");
    for (const name of ["saveAnchor", "saveNode", "deleteAnchorCommitted"]) {
      expect(maintainedSource).toContain('SubBatch.SubBatchMonorepo.app.knowledge.' + name + '(');
    }
    expect(maintainedSource).toContain("repository.deleteAnchor(id)");
    expect(maintainedSource).not.toContain("const nodeIds = state.knowledgeNodes.filter(");
  });

  it("delegates Knowledge search, grouping and selection to the UI controller", () => {
    for (const method of [
      "nodesForAnchor", "anchorById", "nodeById",
      "filterAnchors", "resolveSelection", "groupAnchors",
    ]) {
      expect(maintainedSource).toContain("SubBatch.SubBatchMonorepo.ui.knowledgeNavigation." + method + "(");
    }
    expect(maintainedSource).not.toContain("const nodeMatchIds = new Set()");
    expect(maintainedSource).not.toContain("const groups = new Map();\n    for (const anchor of anchors)");
  });

  it("routes Knowledge tree HTML and navigation intent through the UI owner", () => {
    for (const name of ["treeHtml", "breadcrumbHtml", "suggestionsHtml", "dispatchNavigationClick"]) {
      expect(maintainedSource).toContain("SubBatch.SubBatchMonorepo.ui.knowledgeTreeRenderer." + name + "(");
    }
    for (const old of ["function knowledgeTreeHtml(", "function knowledgeBreadcrumbHtml(", "function knowledgeSuggestionsHtml("]) {
      expect(maintainedSource).not.toContain(old);
    }
  });

  it("delegates Knowledge reader markup and saved-node actions to UI", () => {
    for (const method of ["readerHtml", "dispatchReaderClick"]) {
      expect(maintainedSource).toContain("SubBatch.SubBatchMonorepo.ui.knowledgeReader." + method + "(");
    }
    expect(maintainedSource).toContain("const updated = { ...anchor, starred: !anchor.starred");
    expect(maintainedSource).toContain("const updated = { ...node, starred: !node.starred");
    expect(maintainedSource).not.toContain("anchor.starred = !anchor.starred");
    expect(maintainedSource).not.toContain("node.starred = !node.starred");
  });

  it("delegates Knowledge answer, evidence and streaming policies to UI/Application", () => {
    for (const method of ["evidenceHtml", "answerBodyHtml", "composerHtml", "answerCardsHtml"]) {
      expect(maintainedSource).toContain("SubBatch.SubBatchMonorepo.ui.knowledgeAnswerView." + method + "(");
    }
    expect(maintainedSource).toContain('appCall("knowledge.updateStreamPreview"');
    expect(maintainedSource).not.toContain("node.updatedAt - lastPreviewPersistAt > 1800");
  });

  it("delegates migrated acquisition rules to grouped Bilibili APIs", () => {
    expect(maintainedSource).toContain("function bilibiliCall<");
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
      "defaultUiGeom",
      "md5",
      "requestChatViaPageFetch",
      "requestChatViaGm",
      "startGmTextPath",
      "validateCtxForScan",
      "bytesToWords",
      "cmn",
      "ff",
      "gg",
      "hh",
      "ii",
      "toUtf8Bytes",
      "wordsToHex",
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
    expect(currentVideoSource).toContain('appCall("video.resolve", location.href, pageWindow)');
    expect(currentVideoSource).toContain('bilibiliFn("resolvePlayingVideoRef")');
    expect(currentVideoSource).toContain('bilibiliFn("extractPlayingVideoHint")');
    expect(extractFunctionSource(maintainedSource, "extractPageHints")).toContain(
      'bilibiliFn("extractPlayingVideoHint")',
    );
    const bootSource = extractFunctionSource(maintainedSource, "boot");
    expect(bootSource).toContain('appCall("navigation.observe"');
    expect(bootSource).not.toContain("HTMLMediaElement");
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
    expect(maintainedSource).toContain("function coreCall<");
    expect(maintainedSource).toContain('coreCall("buildSubtitleExportRelativePath"');
    expect(maintainedSource).toContain('coreCall("upsertIndexForExportItem"');
    expect(maintainedSource).toContain('coreCall("buildLibraryRenderNodes"');
    expect(maintainedSource).toContain('SubBatch.SubBatchMonorepo.core.attachSelectionGroupMeta(');
    expect(maintainedSource).toContain('SubBatch.SubBatchMonorepo.core.attachCollectionGroupMeta(');
    expect(maintainedSource).toContain('SubBatch.SubBatchMonorepo.core.applyUgcSeasonToItems(');
    expect(maintainedSource).toContain('coreCall("normalizeExportItem"');
    expect(maintainedSource).toContain('coreCall("suggestCaptureMode"');
    expect(maintainedSource).toContain("function syncCaptureModeFromItem(");
    expect(maintainedSource).toContain("function downloadSubtitleExportBatch(");
    expect(maintainedSource).toMatch(/function stampUgcSeasonGroupMeta(?:<[^>]+>)?\(/);
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
    expect(renderKnowledgeWorkspaceMarkup()).toContain('data-role="knowledge-nav"');
    expect(renderKnowledgeWorkspaceMarkup()).toContain('data-role="knowledge-nav-split"');
    expect(maintainedSource).toContain("bsb-knowledge-reader");
    expect(maintainedSource).toContain("knowledgeAnswerView.evidenceHtml(");
    expect(maintainedSource).toContain("knowledgeNavW");
    expect(maintainedSource).toContain("--bsb-knowledge-nav-w");
    expect(maintainedSource).not.toContain('data-role="knowledge-tree-split"');
    expect(maintainedSource).not.toContain('data-role="knowledge-list-split"');
    expect(maintainedSource).not.toContain("data-knowledge-workspace-tree-toggle");
    expect(maintainedSource).toContain("knowledgeAnswerView.composerHtml(");
    // Knowledge 页不得无条件 display:flex，否则会叠在 AI/字幕上。
    expect(maintainedSource).not.toMatch(
      /\[data-view-panel="knowledge"\]\s*\{\s*min-height:0;\s*height:100%;\s*display:flex/,
    );
    expect(renderWorkspaceOverrides("bili-subbatch-panel")).toContain(
      '.bsb-view[data-view-panel="knowledge"]',
    );
    // Knowledge answers reuse AI 处理字幕 segmented card chrome.
    expect(maintainedSource).toContain("function knowledgeAnswerReadingBlocks(");
    expect(renderKnowledgeDrilldownStyles("bili-subbatch-panel")).toContain("inset:9px 0 9px auto");
    expect(maintainedSource).toContain("function pinKnowledgeScrollTop(");
    expect(extractFunctionSource(maintainedSource, "renderKnowledgeRail")).not.toContain("stickBottom");
    expect(extractFunctionSource(maintainedSource, "renderKnowledgeWorkspace")).not.toContain("stickBottom");
    expect(extractFunctionSource(maintainedSource, "paintStudioAnswer")).not.toContain("scrollHeight");
    expect(maintainedSource).toContain("function renderKnowledgeAnswerCards(");
    expect(maintainedSource).toContain("knowledgeAnswerView.answerCardsHtml(");
    expect(maintainedSource).toContain("knowledgeAnswerView.answerCardsHtml(");
    // Markdown semantic highlight layer: ==phrase== → highlighter marks.
    expect(maintainedSource).toContain("function decorateMarkdownHighlights(");
    expect(maintainedSource).toContain("bsb-md-highlight");
    expect(maintainedSource).toContain("【阅读强调】");
    expect(maintainedSource).toContain("==关键短语==");
    expect(maintainedSource).toContain("PROMPT_SCHEMA_VERSION = 9");
    expect(maintainedSource).toContain("function sendStudioChat(");
    expect(maintainedSource).toContain("function paintStudioAnswer(");
    expect(maintainedSource).toContain("data-role=\"studio-answer\"");
    expect(renderAiStyles("bili-subbatch-panel")).toContain("align-self: flex-end");
    expect(userscriptMetadata.version).toBe("6.10.2");
    expect(userscriptMetadata.match).toContain("*://www.bilibili.com/festival/*");
    expect(userscriptMetadata.match).toContain("*://www.bilibili.com/blackboard/*");
    expect(maintainedSource).toContain('|| "6.10.2"');
    expect(maintainedSource).not.toContain("function isDeferredVideoCarrierPage(");
    expect(maintainedSource).toContain("function startUserscript(");
    const startSource = extractFunctionSource(maintainedSource, "startUserscript");
    expect(startSource).toContain('appCall("activation.start"');
    expect(startSource).not.toContain("isDeferredVideoCarrierPage(location.href)");
    expect(maintainedSource).toContain('bilibiliFn("extractPlayingVideoHint")');
    expect(renderShellStyles("bili-subbatch-panel", 420, 520, 32)).toContain("--bsb-ui-font: 14px");
    expect(renderWorkspaceOverrides("bili-subbatch-panel")).toContain("font-size: 14px !important");
    expect(maintainedSource).not.toContain("CORE_LOCAL_FALLBACKS");
    expect(maintainedSource).toContain("NOTE_FONT_DEFAULT = 14");
    expect(renderShellStyles("bili-subbatch-panel", 420, 520, 32)).toContain("--bsb-knowledge-font: 14px");
    expect(renderReadingStyles("bili-subbatch-panel")).toContain("font-size:var(--bsb-knowledge-font)");
    expect(maintainedSource).toContain("<strong>对话</strong>");
    expect(maintainedSource).toContain("function flowTaskModelsHtml(");
    expect(maintainedSource).toContain("ui.reorderInteraction.bind(root,");
    expect(maintainedSource).not.toContain("function bindFlowModelDrag(");
    expect(maintainedSource).not.toContain("function bindConfigListDrag(");
    expect(maintainedSource).toContain('appCall("studio.compressTranscript"');
    expect(maintainedSource).toContain("function refreshStudioMemory(");
    expect(renderAiWorkspace()).toContain("data-ai-stage=\"chat\"");
    expect(maintainedSource).toContain("看完能懂");
    expect(maintainedSource).toContain("builtin-html-reading-folio");
    expect(maintainedSource).toContain("function extractHtmlFolioSource(");
    expect(maintainedSource).toContain("function mountHtmlFolio(");
    expect(maintainedSource).toContain("bsb-folio-shell");
    expect(maintainedSource).toContain("function buildFolioToc(");
    expect(maintainedSource).toContain("bsb-folio-toc-title");
    expect(maintainedSource).toContain("阅读大纲");
    expect(extractFunctionSource(maintainedSource, "folioOutlineFromHeadings")).toContain(
      'coreCall("buildFolioOutline",',
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
      "async function doAiAnalyze(",
    );
    expect(analyzeStart).toBeGreaterThan(0);
    const analyzeSlice = maintainedSource.slice(analyzeStart, analyzeStart + 16000);
    expect(analyzeSlice).toContain('SubBatch.SubBatchMonorepo.app.ai.partitionRuns');
    expect(analyzeSlice).toContain("generateIds");
    expect(analyzeSlice).toContain("restoreAiSessionForRoute");
  });
});
