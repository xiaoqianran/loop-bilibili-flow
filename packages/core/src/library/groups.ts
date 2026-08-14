/**
 * Library list grouping for 视频选集 / 合集 / 个人主页 folder UI.
 *
 * 个人主页 nesting:
 *   📁 UP名称
 *     · 普通单视频 (items)
 *     📁 视频选集名 → P*
 *     📁 合集名 → 各集
 * Download paths mirror the same segments under loop-bilibili-subbatch/.
 */

export type LibraryGroupType = "selection" | "collection" | "single";

/** Folder UI kind; "space" is the top-level UP folder for 个人主页. */
export type LibraryFolderKind = LibraryGroupType | "space";

export interface LibraryGroupItem {
  bvid?: string;
  page?: number | string;
  title?: string;
  author?: string;
  part?: string;
  selected?: boolean;
  groupType?: LibraryGroupType | string;
  groupKey?: string;
  /** Leaf folder label (选集名/合集名, or flat "UP 名" when not nested). */
  groupFolder?: string;
  /**
   * Top-level UP folder for 个人主页 nesting.
   * When set, export path is parentFolder[/leaf]/file and UI nests under UP.
   */
  parentFolder?: string;
  /** Space mid for stable space: groupKey. */
  spaceMid?: string | number;
  videoTitle?: string;
  collectionName?: string;
  collectionMid?: string | number;
  collectionSid?: string | number;
  collectionShortUrl?: string;
  sources?: string[];
  subStatus?: string;
  /** Multi-P page list from Bilibili view payload (used to infer 选集). */
  pages?: Array<{ part?: string; cid?: number | string } | null | undefined> | null;
}

export interface LibraryEntry {
  item: LibraryGroupItem;
  index: number;
}

export interface LibraryFolderGroup {
  type: "folder";
  groupKey: string;
  groupType: LibraryFolderKind;
  folderLabel: string;
  collapsed: boolean;
  selectedCount: number;
  total: number;
  /** all | none | partial */
  checkState: "all" | "none" | "partial";
  /**
   * Leaf entries under this folder (all descendants for space parents;
   * direct children for selection/collection).
   */
  children: LibraryEntry[];
  /**
   * Nested render tree (space parent only). When present, UI should render
   * these instead of flattening `children` as item rows.
   */
  nodes?: LibraryRenderNode[];
  /** Nesting depth hint for UI indent (0 = top). */
  depth?: number;
}

export interface LibraryFlatItem {
  type: "item";
  entry: LibraryEntry;
  depth?: number;
}

export type LibraryRenderNode = LibraryFolderGroup | LibraryFlatItem;

const MULTI_PART_TITLE_RE = /^(.*)\s-\sP(\d+)【([\s\S]*)】\s*$/;

function cleanAuthor(author: string | null | undefined): string {
  const up = String(author || "").trim();
  if (!up || up === "未知UP") return "";
  return up;
}

function cleanParent(parent: string | null | undefined): string {
  return cleanAuthor(parent);
}

/** "UP名称 标题/合集名"；无 UP 时只保留名称（避免下载落到「未知UP …」）。 */
export function buildUpFolderLabel(
  author: string | null | undefined,
  name: string | null | undefined,
): string {
  const up = cleanAuthor(author);
  const n = String(name || "").trim() || "未命名";
  if (!up) return n;
  return `${up} ${n}`;
}

/** Short collection address used as stable index key. */
export function buildCollectionShortUrl(
  mid: string | number | null | undefined,
  seasonId: string | number | null | undefined,
): string {
  const m = String(mid || "").trim();
  const s = String(seasonId || "").trim();
  if (!m || !s) return "";
  return `space.bilibili.com/${m}/lists/${s}`;
}

export function inferLibraryGroupType(item: LibraryGroupItem | null | undefined): LibraryGroupType {
  const explicit = String(item?.groupType || "").trim();
  if (explicit === "selection" || explicit === "collection" || explicit === "single") {
    return explicit;
  }
  if (item?.collectionSid || item?.collectionName || item?.collectionShortUrl) {
    return "collection";
  }
  const page = Math.max(1, Number(item?.page) || 1);
  const title = String(item?.title || "");
  if (page > 1 || item?.part || MULTI_PART_TITLE_RE.test(title)) return "selection";
  return "single";
}

/** Stable key for the top-level 个人主页 UP folder. */
export function resolveSpaceGroupKey(item: LibraryGroupItem | null | undefined): string {
  const mid = String(item?.spaceMid || "").trim();
  if (mid) return `space:${mid}`;
  const parent = cleanParent(item?.parentFolder);
  if (parent) return `space:${parent}`;
  return "";
}

export function resolveLibraryGroupKey(item: LibraryGroupItem | null | undefined): string {
  if (item?.groupKey) return String(item.groupKey);
  const kind = inferLibraryGroupType(item);
  if (kind === "collection") {
    const mid = item?.collectionMid;
    const sid = item?.collectionSid;
    if (mid && sid) return `collection:${mid}/${sid}`;
    if (item?.collectionShortUrl) return `collection:${item.collectionShortUrl}`;
  }
  if (kind === "selection") {
    const bvid = String(item?.bvid || "").trim();
    if (bvid) return `selection:${bvid}`;
  }
  const bvid = String(item?.bvid || "unknown").trim();
  const page = Math.max(1, Number(item?.page) || 1);
  return `single:${bvid}:P${page}`;
}

/** 个人主页下、不属于合集/选集的散视频统一文件夹名。 */
export const SPACE_LOOSE_VIDEOS_FOLDER = "视频";

/** Stable groupKey for the 个人主页「视频」bucket. */
export function resolveSpaceLooseVideosKey(
  item: LibraryGroupItem | null | undefined,
): string {
  const mid = String(item?.spaceMid || "").trim();
  if (mid) return `space-videos:${mid}`;
  const parent = cleanParent(item?.parentFolder);
  if (parent) return `space-videos:${parent}`;
  return "space-videos:unknown";
}

export function isSpaceLooseVideosKey(groupKey: string | null | undefined): boolean {
  return String(groupKey || "").startsWith("space-videos:");
}

/**
 * Leaf folder label for UI (selection/collection name).
 * When under parentFolder, omits UP prefix (parent folder already shows UP).
 * Flat mode keeps "UP 名称" for 选集/合集.
 */
export function resolveLibraryFolderLabel(item: LibraryGroupItem | null | undefined): string {
  const existing = String(item?.groupFolder || "").trim();
  const parent = cleanParent(item?.parentFolder);
  // Keep a real non-未知UP label; ignore stale "未知UP …" so download can recompute.
  if (existing && !/^未知UP\b/.test(existing)) {
    // If nested under UP and groupFolder still has "UP name" prefix, strip for leaf.
    if (parent && existing.startsWith(`${parent} `)) {
      const leaf = existing.slice(parent.length + 1).trim();
      if (leaf) return leaf;
    }
    return existing;
  }
  const kind = inferLibraryGroupType(item);
  const author = item?.author;
  if (kind === "collection") {
    const name = String(item?.collectionName || "未命名合集").trim() || "未命名合集";
    return parent ? name : buildUpFolderLabel(author, name);
  }
  if (kind === "selection") {
    const title = String(item?.videoTitle || "").trim()
      || String(item?.title || "").replace(/\s-\sP\d+【[\s\S]*】\s*$/, "").trim()
      || item?.bvid
      || "未命名视频";
    return parent ? title : buildUpFolderLabel(author, title);
  }
  // single under 个人主页 → leaf is「视频」(散视频桶)
  if (parent) {
    if (existing && !/^未知UP\b/.test(existing) && existing !== parent) {
      if (existing.startsWith(`${parent} `)) {
        const leaf = existing.slice(parent.length + 1).trim();
        if (leaf) return leaf;
      } else {
        return existing;
      }
    }
    return SPACE_LOOSE_VIDEOS_FOLDER;
  }
  return buildUpFolderLabel(author, item?.title || item?.bvid || "未命名视频");
}

/**
 * Path segments under loop-bilibili-subbatch (not including root or file).
 *
 * 个人主页:
 *   single     → [UP, 视频]
 *   selection  → [UP, 选集名]
 *   collection → [UP, 合集名]
 * Flat (非主页):
 *   → [resolveLibraryFolderLabel]  (keeps "UP 名称" one segment)
 */
export function resolveFolderSegments(item: LibraryGroupItem | null | undefined): string[] {
  const parent = cleanParent(item?.parentFolder);
  const kind = inferLibraryGroupType(item);

  if (parent) {
    if (kind === "collection") {
      const name =
        String(item?.collectionName || "").trim()
        || String(item?.groupFolder || "").trim()
        || "未命名合集";
      // groupFolder may already be leaf or "UP name"
      const leaf = name.startsWith(`${parent} `) ? name.slice(parent.length + 1).trim() || name : name;
      return [parent, leaf || "未命名合集"];
    }
    if (kind === "selection") {
      const title =
        String(item?.videoTitle || "").trim()
        || String(item?.groupFolder || "").trim()
        || String(item?.title || "").replace(/\s-\sP\d+【[\s\S]*】\s*$/, "").trim()
        || item?.bvid
        || "未命名视频";
      const leaf = title.startsWith(`${parent} `) ? title.slice(parent.length + 1).trim() || title : title;
      return [parent, leaf || "未命名视频"];
    }
    // single under UP → UP/视频
    const loose =
      String(item?.groupFolder || "").trim()
      || SPACE_LOOSE_VIDEOS_FOLDER;
    const leaf = loose.startsWith(`${parent} `)
      ? loose.slice(parent.length + 1).trim() || SPACE_LOOSE_VIDEOS_FOLDER
      : loose;
    return [parent, leaf || SPACE_LOOSE_VIDEOS_FOLDER];
  }

  const label = resolveLibraryFolderLabel(item);
  return label ? [label] : [];
}

/**
 * Same BV appears more than once (different P) → 视频选集 folder even if
 * groupType metadata was lost (e.g. auto-capture then scan merge).
 */
function bvidMultiPageKeys(entries: LibraryEntry[]): Set<string> {
  const counts = new Map<string, number>();
  for (const entry of entries) {
    const bvid = String(entry.item?.bvid || "").trim();
    if (!bvid) continue;
    counts.set(bvid, (counts.get(bvid) || 0) + 1);
  }
  const multi = new Set<string>();
  for (const [bvid, n] of counts) {
    if (n > 1) multi.add(bvid);
  }
  return multi;
}

/**
 * Shared 合集 identity across different BVs → always folder.
 * Keys: collection:mid/sid | collection:shortUrl | collection:name|author
 */
function collectionIdentityKey(item: LibraryGroupItem | null | undefined): string {
  if (!item) return "";
  if (item.groupKey && String(item.groupKey).startsWith("collection:")) {
    return String(item.groupKey);
  }
  const mid = item.collectionMid;
  const sid = item.collectionSid;
  if (mid && sid) return `collection:${mid}/${sid}`;
  if (item.collectionShortUrl) return `collection:${item.collectionShortUrl}`;
  const name = String(item.collectionName || "").trim();
  if (name) {
    const author = String(item.author || "").trim();
    return `collection:name:${author}|${name}`;
  }
  return "";
}

/** Identities that appear on ≥1 collection-tagged item (even a single video in a 合集). */
function collectionFolderKeys(entries: LibraryEntry[]): Set<string> {
  const keys = new Set<string>();
  for (const entry of entries) {
    const item = entry.item;
    const kind = inferLibraryGroupType(item);
    const id = collectionIdentityKey(item);
    // Explicit collection meta → folder even if only one video is in the library.
    if (id && (kind === "collection" || item?.collectionSid || item?.collectionName || item?.collectionShortUrl)) {
      keys.add(id);
    }
  }
  // Also: 2+ items sharing the same collection identity without explicit groupType.
  const counts = new Map<string, number>();
  for (const entry of entries) {
    const id = collectionIdentityKey(entry.item);
    if (!id) continue;
    counts.set(id, (counts.get(id) || 0) + 1);
  }
  for (const [id, n] of counts) {
    if (n > 1) keys.add(id);
  }
  return keys;
}

function effectiveGroupType(
  item: LibraryGroupItem | null | undefined,
  multiBvids: Set<string>,
  collectionKeys: Set<string>,
): LibraryGroupType {
  const kind = inferLibraryGroupType(item);
  if (kind === "collection") return "collection";
  if (kind === "selection") return "selection";
  const colId = collectionIdentityKey(item);
  if (colId && collectionKeys.has(colId)) return "collection";
  const bvid = String(item?.bvid || "").trim();
  if (bvid && multiBvids.has(bvid)) return "selection";
  return "single";
}

function effectiveGroupKey(
  item: LibraryGroupItem | null | undefined,
  multiBvids: Set<string>,
  collectionKeys: Set<string>,
): string {
  if (item?.groupKey) return String(item.groupKey);
  const kind = effectiveGroupType(item, multiBvids, collectionKeys);
  if (kind === "collection") {
    const id = collectionIdentityKey(item);
    if (id) return id;
  }
  if (kind === "selection") {
    const bvid = String(item?.bvid || "").trim();
    if (bvid) return `selection:${bvid}`;
  }
  return resolveLibraryGroupKey(item);
}

function folderCheckState(selectedCount: number, total: number): "all" | "none" | "partial" {
  if (selectedCount === 0) return "none";
  if (selectedCount === total) return "all";
  return "partial";
}

/** Whether this entry should render as a folder (选集/合集/个人主页「视频」桶). */
function isFolderedEntry(
  item: LibraryGroupItem | null | undefined,
  multiBvids: Set<string>,
  collectionKeys: Set<string>,
): boolean {
  const kind = effectiveGroupType(item, multiBvids, collectionKeys);
  if (kind !== "single") return true;
  // 散视频桶：groupKey=space-videos:… 即使 groupType=single 也建文件夹
  if (isSpaceLooseVideosKey(item?.groupKey)) return true;
  if (
    cleanParent(item?.parentFolder)
    && String(item?.groupFolder || "").trim() === SPACE_LOOSE_VIDEOS_FOLDER
  ) {
    return true;
  }
  return false;
}

function leafFolderKey(
  item: LibraryGroupItem | null | undefined,
  multiBvids: Set<string>,
  collectionKeys: Set<string>,
): string {
  if (isSpaceLooseVideosKey(item?.groupKey)) return String(item!.groupKey);
  if (
    cleanParent(item?.parentFolder)
    && String(item?.groupFolder || "").trim() === SPACE_LOOSE_VIDEOS_FOLDER
    && effectiveGroupType(item, multiBvids, collectionKeys) === "single"
  ) {
    return resolveSpaceLooseVideosKey(item);
  }
  return effectiveGroupKey(item, multiBvids, collectionKeys);
}

/**
 * Build flat folder/item nodes for a list that does NOT use space parent nesting
 * (or for entries already scoped under one parent).
 */
function buildLeafRenderNodes(
  entries: LibraryEntry[],
  collapsedMap: Record<string, boolean>,
  depth: number,
): LibraryRenderNode[] {
  const multiBvids = bvidMultiPageKeys(entries);
  const collectionKeys = collectionFolderKeys(entries);
  const folderBuckets = new Map<string, LibraryEntry[]>();

  for (const entry of entries) {
    if (!isFolderedEntry(entry.item, multiBvids, collectionKeys)) continue;
    const key = leafFolderKey(entry.item, multiBvids, collectionKeys);
    if (!folderBuckets.has(key)) folderBuckets.set(key, []);
    folderBuckets.get(key)!.push(entry);
  }

  const nodes: LibraryRenderNode[] = [];
  const emittedFolders = new Set<string>();

  for (const entry of entries) {
    if (!isFolderedEntry(entry.item, multiBvids, collectionKeys)) {
      nodes.push({ type: "item", entry, depth });
      continue;
    }
    const key = leafFolderKey(entry.item, multiBvids, collectionKeys);
    if (emittedFolders.has(key)) continue;
    emittedFolders.add(key);
    const children = folderBuckets.get(key) || [entry];
    const selectedCount = children.filter((c) => c.item.selected).length;
    const total = children.length;
    // Prefer a child that already has a good folder label / author (avoid 未知UP).
    const labeled =
      children.map((c) => c.item).find((it) => it.groupFolder && !/^未知UP\b/.test(String(it.groupFolder)))
      || children.map((c) => c.item).find((it) => String(it.author || "").trim() && it.author !== "未知UP")
      || children[0]?.item;
    const kind = effectiveGroupType(labeled, multiBvids, collectionKeys);
    nodes.push({
      type: "folder",
      groupKey: key,
      groupType: kind,
      folderLabel: resolveLibraryFolderLabel(labeled),
      collapsed: !!collapsedMap[key],
      selectedCount,
      total,
      checkState: folderCheckState(selectedCount, total),
      children,
      depth,
    });
  }

  return nodes;
}

/**
 * Group filtered library entries into folders (selection/collection/space) + flat singles.
 * Folder order follows first appearance of each groupKey.
 *
 * - 个人主页: items with parentFolder nest under 📁 UP → (singles | 选集 | 合集)
 * - 视频选集: multi-P same BV (or groupType=selection)
 * - 合集: groupType/collectionSid/… (even a single captured episode) auto-folders
 */
export function buildLibraryRenderNodes(
  entries: LibraryEntry[],
  collapsedMap: Record<string, boolean> | null | undefined = {},
): LibraryRenderNode[] {
  const collapsed = collapsedMap || {};
  const spaceBuckets = new Map<string, { label: string; entries: LibraryEntry[] }>();
  const flatEntries: LibraryEntry[] = [];

  for (const entry of entries) {
    const spaceKey = resolveSpaceGroupKey(entry.item);
    const parent = cleanParent(entry.item?.parentFolder);
    if (spaceKey && parent) {
      if (!spaceBuckets.has(spaceKey)) {
        spaceBuckets.set(spaceKey, { label: parent, entries: [] });
      }
      const bucket = spaceBuckets.get(spaceKey)!;
      if (parent && parent !== "未知UP") bucket.label = parent;
      bucket.entries.push(entry);
    } else {
      flatEntries.push(entry);
    }
  }

  // Pre-build space folder nodes and flat leaf nodes.
  const spaceNodeByKey = new Map<string, LibraryFolderGroup>();
  for (const [spaceKey, bucket] of spaceBuckets) {
    const nested = buildLeafRenderNodes(bucket.entries, collapsed, 1);
    const selectedCount = bucket.entries.filter((c) => c.item.selected).length;
    const total = bucket.entries.length;
    spaceNodeByKey.set(spaceKey, {
      type: "folder",
      groupKey: spaceKey,
      groupType: "space",
      folderLabel: bucket.label,
      collapsed: !!collapsed[spaceKey],
      selectedCount,
      total,
      checkState: folderCheckState(selectedCount, total),
      children: bucket.entries,
      nodes: nested,
      depth: 0,
    });
  }
  const flatNodes = buildLeafRenderNodes(flatEntries, collapsed, 0);

  // Walk original entry order to interleave space folders with flat nodes.
  const nodes: LibraryRenderNode[] = [];
  const emittedSpace = new Set<string>();
  const emittedFlatKeys = new Set<string>();

  const flatNodeKey = (node: LibraryRenderNode): string => {
    if (node.type === "item") return `item:${node.entry.index}`;
    return `folder:${node.groupKey}`;
  };

  // Map each flat entry index → the leaf node that owns it (for order emission).
  const flatOwnerByIndex = new Map<number, LibraryRenderNode>();
  for (const node of flatNodes) {
    if (node.type === "item") {
      flatOwnerByIndex.set(node.entry.index, node);
    } else {
      for (const child of node.children) {
        flatOwnerByIndex.set(child.index, node);
      }
    }
  }

  for (const entry of entries) {
    const spaceKey = resolveSpaceGroupKey(entry.item);
    if (spaceKey && cleanParent(entry.item?.parentFolder)) {
      if (emittedSpace.has(spaceKey)) continue;
      emittedSpace.add(spaceKey);
      const spaceNode = spaceNodeByKey.get(spaceKey);
      if (spaceNode) nodes.push(spaceNode);
      continue;
    }
    const owner = flatOwnerByIndex.get(entry.index);
    if (!owner) continue;
    const k = flatNodeKey(owner);
    if (emittedFlatKeys.has(k)) continue;
    emittedFlatKeys.add(k);
    nodes.push(owner);
  }

  return nodes;
}

export function setGroupSelection(
  items: LibraryGroupItem[],
  groupKey: string,
  selected: boolean,
): void {
  const key = String(groupKey || "").trim();
  if (!key) return;

  if (key.startsWith("space:") && !key.startsWith("space-videos:")) {
    for (const item of items) {
      if (resolveSpaceGroupKey(item) === key) item.selected = selected;
    }
    return;
  }

  if (isSpaceLooseVideosKey(key)) {
    for (const item of items) {
      if (String(item.groupKey || "") === key || resolveSpaceLooseVideosKey(item) === key) {
        // Only loose singles under this bucket (not 合集/选集)
        const kind = inferLibraryGroupType(item);
        if (kind === "collection" || kind === "selection") continue;
        if (item.collectionSid || item.collectionName) continue;
        item.selected = selected;
      }
    }
    return;
  }

  for (const item of items) {
    if (resolveLibraryGroupKey(item) === key) item.selected = selected;
    // multip without groupKey still folders as selection:bvid via effective key —
    // also match selection:BV when item bvid equals and multi-P heuristic would apply.
    if (key.startsWith("selection:")) {
      const bvid = key.slice("selection:".length);
      if (bvid && String(item.bvid || "").trim() === bvid) {
        item.selected = selected;
      }
    }
  }
}
