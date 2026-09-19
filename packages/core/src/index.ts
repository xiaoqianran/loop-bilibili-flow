import * as aiProtocolApi from "./ai-protocol";
import * as aiSessionApi from "./ai-session";
import * as commandApi from "./commands";
import * as subtitleExportApi from "./export/subtitle-download";
import * as folioApi from "./folio";
import * as knowledgeApi from "./knowledge";
import * as libraryMetaApi from "./library/group-meta";
import * as libraryGroupApi from "./library/groups";
import * as mermaidApi from "./mermaid";
import * as preprocessApi from "./preprocess";
import * as promptApi from "./prompts";
import * as transcriptApi from "./transcript";

export const CORE_VERSION = "0.6.0";

export const ai = {
  extractText: aiProtocolApi.extractAssistantText,
  extractChoice: aiProtocolApi.extractFromChoice,
  display: aiProtocolApi.formatAiDisplay,
  truncateInput: aiProtocolApi.truncateForAi,
  parseSseLine: aiProtocolApi.parseSseDataLine,
} as const;

/**
 * Canonical grouped API.
 *
 * Rule: module/object owns the domain context; method names only describe the
 * action. Flat exports below are kept for compatibility with the maintained
 * userscript body and older callers.
 */
export const aiSession = {
  ttlMs: aiSessionApi.aiSessionCacheTtlMs,
  cacheKey: aiSessionApi.aiSessionCacheKey,
  shouldAutoRestore: aiSessionApi.shouldRestoreAutomaticAiSession,
  hasCache: aiSessionApi.isUsableAiSessionCache,
  serializeRun: aiSessionApi.serializeAiRunForCache,
  serializePreprocess: aiSessionApi.serializePreprocessRunForCache,
  sanitizeInput: aiSessionApi.sanitizeSessionInputForCache,
  buildCache: aiSessionApi.buildAiSessionCachePayload,
  resolveActiveRun: aiSessionApi.resolveRestoredActiveRunId,
  hydrateRun: aiSessionApi.draftHydratedAiRun,
  inputHash: aiSessionApi.aiSessionInputHash,
  runKey: aiSessionApi.aiRunIdentityKey,
  partitionRuns: aiSessionApi.partitionPlannedAiRuns,
  shouldSkipPrepare: aiSessionApi.shouldSkipPrepareForCachedSession,
  hydratePreprocess: aiSessionApi.draftHydratedPreprocessRun,
} as const;

export const command = {
  shortcuts: commandApi.SHORTCUT_COMMANDS,
} as const;

export const subtitleExport = {
  root: subtitleExportApi.SUBTITLE_EXPORT_ROOT,
  indexName: subtitleExportApi.SUBTITLE_EXPORT_INDEX_NAME,
  videoUrl: subtitleExportApi.buildVideoShortUrl,
  videoKey: subtitleExportApi.videoIndexKey,
  safeSegment: subtitleExportApi.safePathSegment,
  fileName: subtitleExportApi.joinFileName,
  seriesTitle: subtitleExportApi.resolveSeriesTitle,
  partLabel: subtitleExportApi.resolvePartLabel,
  fileStem: subtitleExportApi.resolveSubtitleFileStem,
  folderName: subtitleExportApi.resolveExportFolderName,
  folderSegments: subtitleExportApi.resolveExportFolderSegments,
  buildPath: subtitleExportApi.buildSubtitleExportRelativePath,
  indexPath: subtitleExportApi.buildSubtitleExportIndexPath,
  collectionKey: subtitleExportApi.collectionIndexKey,
  parseIndex: subtitleExportApi.parseExportIndexMd,
  upsertVideo: subtitleExportApi.upsertVideoExportIndex,
  upsertIndex: subtitleExportApi.upsertExportIndexMap,
  upsertCollection: subtitleExportApi.upsertCollectionExportIndex,
  renderIndex: subtitleExportApi.renderExportIndexMd,
  normalizeItem: subtitleExportApi.normalizeExportItem,
  indexVideoTitle: subtitleExportApi.resolveIndexVideoTitle,
  upsertItem: subtitleExportApi.upsertIndexForExportItem,
  describe: subtitleExportApi.describeSubtitleExport,
} as const;

export const folio = {
  slugHeading: folioApi.slugFolioHeading,
  normalizeLevel: folioApi.normalizeFolioHeadingLevel,
  buildOutline: folioApi.buildFolioOutline,
  flattenOutline: folioApi.flattenFolioOutline,
  countOutline: folioApi.countFolioOutline,
  chapterIndex: folioApi.formatFolioChapterIndex,
  summary: folioApi.folioOutlineSummary,
} as const;

export const knowledge = {
  parse: knowledgeApi.parseKnowledgeOutput,
  branchContext: knowledgeApi.knowledgeBranchContext,
} as const;

export const library = {
  group: {
    upFolderLabel: libraryGroupApi.buildUpFolderLabel,
    collectionUrl: libraryGroupApi.buildCollectionShortUrl,
    inferType: libraryGroupApi.inferLibraryGroupType,
    spaceKey: libraryGroupApi.resolveSpaceGroupKey,
    groupKey: libraryGroupApi.resolveLibraryGroupKey,
    looseKey: libraryGroupApi.resolveSpaceLooseVideosKey,
    isLooseKey: libraryGroupApi.isSpaceLooseVideosKey,
    folderLabel: libraryGroupApi.resolveLibraryFolderLabel,
    folderSegments: libraryGroupApi.resolveFolderSegments,
    renderNodes: libraryGroupApi.buildLibraryRenderNodes,
    setSelection: libraryGroupApi.setGroupSelection,
  },
  meta: {
    attachUserSpace: libraryMetaApi.attachUserSpaceGroupMeta,
    attachLooseVideos: libraryMetaApi.attachSpaceLooseVideosMeta,
    attachSelection: libraryMetaApi.attachSelectionGroupMeta,
    attachCollection: libraryMetaApi.attachCollectionGroupMeta,
    applyUgcSeason: libraryMetaApi.applyUgcSeasonToItem,
    applyUgcSeasons: libraryMetaApi.applyUgcSeasonToItems,
    applyCollectionMembership: libraryMetaApi.applySpaceCollectionMembership,
    countCollectionMatches: libraryMetaApi.countSpaceCollectionMatches,
    buildPatches: libraryMetaApi.buildGroupMetaPatches,
    applyPatch: libraryMetaApi.applyGroupMetaPatchToItems,
    mergeFields: libraryMetaApi.mergeGroupFields,
    refreshFolder: libraryMetaApi.refreshGroupFolder,
    suggestCaptureMode: libraryMetaApi.suggestCaptureMode,
  },
} as const;

export const mermaid = {
  stripCitations: mermaidApi.stripMermaidTimestampCitations,
  sanitizeMarkdown: mermaidApi.sanitizeMermaidTimestampCitationsInMarkdown,
  resolveRepair: mermaidApi.resolveMermaidRepairConfig,
  repairHint: mermaidApi.mermaidRepairSetupHint,
  replaceBlock: mermaidApi.replaceMermaidBlockAt,
} as const;

export const preprocess = {
  splitCues: preprocessApi.splitCuesForPreprocess,
  parseTimestamp: preprocessApi.parseEvidenceTimestampSeconds,
  trimOverlap: preprocessApi.trimProcessedOverlap,
  dedupeBlocks: preprocessApi.dedupeExactBlocks,
  stitchChunks: preprocessApi.stitchPreprocessChunks,
  cacheKey: preprocessApi.preprocessCacheKey,
} as const;

export const prompt = {
  render: promptApi.renderPromptTemplate,
} as const;

export const transcript = {
  parseSeconds: transcriptApi.parseSeconds,
  toCues: transcriptApi.toCues,
  srtTimestamp: transcriptApi.formatSrtTimestamp,
  toSrt: transcriptApi.cuesToSrt,
  toTxt: transcriptApi.cuesToTxt,
  clock: transcriptApi.formatClock,
  toAiText: transcriptApi.cuesToAiText,
} as const;

// Compatibility surface. Keep until the maintained body no longer depends on
// flat function names.
export * from "./ai-protocol";
export * from "./ai-session";
export * from "./commands";
export * from "./export/subtitle-download";
export * from "./folio";
export * from "./knowledge";
export * from "./library/group-meta";
export * from "./library/groups";
export * from "./mermaid";
export * from "./preprocess";
export * from "./prompts";
export * from "./transcript";
export * from "./utils/md5";
