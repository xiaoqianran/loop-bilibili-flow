/**
 * Monorepo userscript composition root (P4.5 Real Takeover).
 *
 * Production path is owned by apps/userscript + packages/*.
 * Full Studio UI still lives only in the compat build (maintained body);
 * pure build must never append the frozen v6.0.2 body.
 *
 * Vite IIFE global: `SubBatch` with named exports
 * (`SubBatch.SubBatchMonorepo`, `SubBatch.runtime`, `SubBatch.host`).
 * The maintained body bridges pure cores via `SubBatch.SubBatchMonorepo.core`.
 */
import * as bilibili from "@subbatch/bilibili";
import * as core from "@subbatch/core";
import { createUserscriptRuntime } from "@subbatch/runtime";
import * as schemas from "@subbatch/schemas";

import { createUserscriptHost } from "./userscript-host";

const host = createUserscriptHost();
const runtime = createUserscriptRuntime(host);

/**
 * Public monorepo API surface.
 * `core` is the single source of truth for export paths, index.md, and library groups.
 * Product body must call `SubBatch.SubBatchMonorepo.core.*` (or top-level aliases).
 */
const SubBatchMonorepo = {
  version: "6.5.0",
  runtime,
  host,
  /** Entire pure core namespace — preferred bridge target. */
  core,
  bilibili,
  schemas,
  detectContext(href?: string, hints?: bilibili.BilibiliPageHints) {
    return bilibili.detectContext(href ?? runtime.page.href(), hints);
  },
  extractBvid: bilibili.extractBvid,
  extractUrlHints: bilibili.extractUrlHints,
  routeVideoKey: bilibili.routeVideoKey,
  renderPromptTemplate: core.renderPromptTemplate,
  splitCuesForPreprocess: core.splitCuesForPreprocess,
  stitchPreprocessChunks: core.stitchPreprocessChunks,
  preprocessCacheKey: core.preprocessCacheKey,
  // ── export + library (also on core.* ; aliases for clarity) ──
  safePathSegment: core.safePathSegment,
  joinFileName: core.joinFileName,
  resolveSeriesTitle: core.resolveSeriesTitle,
  resolvePartLabel: core.resolvePartLabel,
  resolveSubtitleFileStem: core.resolveSubtitleFileStem,
  resolveExportFolderName: core.resolveExportFolderName,
  buildSubtitleExportRelativePath: core.buildSubtitleExportRelativePath,
  buildSubtitleExportIndexPath: core.buildSubtitleExportIndexPath,
  buildVideoShortUrl: core.buildVideoShortUrl,
  upsertVideoExportIndex: core.upsertVideoExportIndex,
  upsertExportIndexMap: core.upsertExportIndexMap,
  upsertCollectionExportIndex: core.upsertCollectionExportIndex,
  upsertIndexForExportItem: core.upsertIndexForExportItem,
  resolveIndexVideoTitle: core.resolveIndexVideoTitle,
  normalizeExportItem: core.normalizeExportItem,
  renderExportIndexMd: core.renderExportIndexMd,
  parseExportIndexMd: core.parseExportIndexMd,
  buildUpFolderLabel: core.buildUpFolderLabel,
  buildCollectionShortUrl: core.buildCollectionShortUrl,
  buildLibraryRenderNodes: core.buildLibraryRenderNodes,
  resolveLibraryGroupKey: core.resolveLibraryGroupKey,
  resolveLibraryFolderLabel: core.resolveLibraryFolderLabel,
  attachSelectionGroupMeta: core.attachSelectionGroupMeta,
  attachCollectionGroupMeta: core.attachCollectionGroupMeta,
  applyUgcSeasonToItem: core.applyUgcSeasonToItem,
  applyUgcSeasonToItems: core.applyUgcSeasonToItems,
  buildGroupMetaPatches: core.buildGroupMetaPatches,
  applyGroupMetaPatchToItems: core.applyGroupMetaPatchToItems,
  mergeGroupFields: core.mergeGroupFields,
  setGroupSelection: core.setGroupSelection,
  shortcutCommands: core.SHORTCUT_COMMANDS,
  shouldIgnoreShortcutEvent: core.shouldIgnoreShortcutEvent,
};

export { runtime, host, SubBatchMonorepo };
