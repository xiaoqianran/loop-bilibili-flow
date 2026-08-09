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
  fileURLToPath(new URL("../../loop-bilibili.js", import.meta.url)),
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
  it("retains every named function from the frozen external baseline", () => {
    const baselineNames = functionNames(legacySource);
    const maintainedNames = functionNames(maintainedSource);
    const missing = [...baselineNames].filter((name) => !maintainedNames.has(name));

    expect(baselineNames.size).toBeGreaterThan(250);
    expect(missing).toEqual([]);
    expect(maintainedSource).toContain("function boot()");
    expect(maintainedSource).toContain("scheduleAutoCapture(\"initial\", 180)");
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

  it("exports subtitles under loop-bilibili-subbatch with short P* names and index.md", () => {
    expect(maintainedSource).toContain('const SUBTITLE_EXPORT_ROOT = "loop-bilibili-subbatch"');
    expect(maintainedSource).toContain("function buildSubtitleExportRelativePath(");
    expect(maintainedSource).toContain("function downloadSubtitleExportBatch(");
    expect(maintainedSource).toContain("function renderExportIndexMd(");
    expect(maintainedSource).toContain("function attachCollectionGroupMeta(");
    expect(maintainedSource).toContain("function buildLibraryRenderNodes(");
    expect(maintainedSource).toContain("function stampUgcSeasonGroupMeta(");
    expect(maintainedSource).toContain("auto_promoted_ugc_season");
    expect(maintainedSource).toContain("folder-expand-all");
    expect(maintainedSource).toContain("GM_download");
    expect(maintainedSource).toContain("buildSubtitleExportIndexPath()");

    const batch = extractFunctionSource(maintainedSource, "downloadSubtitleExportBatch");
    expect(batch).toContain("buildSubtitleExportRelativePath(it, ext)");
    expect(batch).toContain("upsertIndexForExportItem");
    expect(batch).toContain("buildSubtitleExportIndexPath()");
    expect(batch).toContain("normalizeExportItem");
    expect(batch).toContain('overwrite: true');
    expect(maintainedSource).toContain("conflictAction");
    expect(maintainedSource).toContain("function joinFileName(");

    // Shipped product path must call the batch exporter (not flat BV_Pn_title files).
    const doBatch = extractFunctionSource(maintainedSource, "doBatch");
    expect(doBatch).toContain("downloadSubtitleExportBatch(pool, ext, convert)");
    expect(doBatch).not.toContain('`${it.bvid}${it.page > 1 ? "_P"');

    // Drive the real maintained source functions (not a re-implementation).
    const resolveStem = sourceFunction<UnknownFunction>(
      maintainedSource,
      "resolveSubtitleFileStem",
    );
    const buildPath = sourceFunction<UnknownFunction>(
      maintainedSource,
      "buildSubtitleExportRelativePath",
    );
    const upsertIndex = sourceFunction<UnknownFunction>(
      maintainedSource,
      "upsertIndexForExportItem",
    );
    const renderIndex = sourceFunction<UnknownFunction>(
      maintainedSource,
      "renderExportIndexMd",
    );
    const item = {
      bvid: "BV14u41147YH",
      page: 33,
      author: "Kurt",
      groupType: "selection",
      videoTitle: "【Kurt】Blender零基础入门教程 | Blender中文区新手必刷教程(已完结)",
      groupFolder: "Kurt 【Kurt】Blender零基础入门教程 | Blender中文区新手必刷教程(已完结)",
      title:
        "【Kurt】Blender零基础入门教程 | Blender中文区新手必刷教程(已完结) - P33【【动画篇】6.5 头部跟随动画 - 物体约束】",
      part: "【动画篇】6.5 头部跟随动画 - 物体约束",
    };
    expect(resolveStem(item)).toBe("P33【动画篇】6.5 头部跟随动画 - 物体约束");
    expect(buildPath(item, "txt")).toMatch(
      /^loop-bilibili-subbatch\/.+\/P33【动画篇】6·5 头部跟随动画 - 物体约束\.txt$/,
    );
    expect(buildPath(item, "txt")).toMatch(/\.txt$/);
    expect(buildPath(item, "txt")).not.toMatch(/-txt$/);
    const map = upsertIndex(
      upsertIndex({}, { ...item, bvid: "BV14u41147YH" }),
      item,
    );
    const md = renderIndex(map);
    expect(md).toContain("Kurt");
    expect(md).toContain("www.bilibili.com/video/BV14u41147YH");
    expect(md).toContain("【Kurt】Blender零基础入门教程 | Blender中文区新手必刷教程(已完结)");
    // New index shape: author + shortUrl + title (not bare "BV title")
    expect(md).toMatch(/Kurt\s+www\.bilibili\.com\/video\/BV14u41147YH\s+/);

    const collectionItem = {
      bvid: "BV1qmsXztEde",
      author: "示例UP",
      title: "合集内某一集",
      groupType: "collection",
      collectionName: "测试合集",
      collectionMid: "1",
      collectionSid: "2",
      collectionShortUrl: "space.bilibili.com/1/lists/2",
      groupFolder: "示例UP 测试合集",
    };
    const colMap = upsertIndex({}, collectionItem);
    const colMd = renderIndex(colMap);
    expect(colMd).toContain("示例UP space.bilibili.com/1/lists/2 测试合集");
    expect(colMd).not.toContain("BV1qmsXztEde");
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
    expect(maintainedSource).toContain("function renderKnowledgeAnswerCards(");
    expect(maintainedSource).toContain("bsb-knowledge-answer-card");
    expect(maintainedSource).toContain("bsb-preprocess-block bsb-knowledge-answer-card");
    // Markdown semantic highlight layer: ==phrase== → highlighter marks.
    expect(maintainedSource).toContain("function decorateMarkdownHighlights(");
    expect(maintainedSource).toContain("bsb-md-highlight");
    expect(maintainedSource).toContain("【阅读强调】");
    expect(maintainedSource).toContain("==关键短语==");
    expect(maintainedSource).toContain("PROMPT_SCHEMA_VERSION = 6");
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
});
