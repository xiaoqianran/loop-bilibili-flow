import { describe, expect, it } from "vitest";

import {
  SUBTITLE_EXPORT_ROOT,
  buildCollectionShortUrl,
  buildLibraryRenderNodes,
  buildSubtitleExportIndexPath,
  buildSubtitleExportRelativePath,
  buildUpFolderLabel,
  describeSubtitleExport,
  joinFileName,
  normalizeExportItem,
  parseExportIndexMd,
  renderExportIndexMd,
  resolveExportFolderName,
  resolvePartLabel,
  resolveSeriesTitle,
  resolveSubtitleFileStem,
  safePathSegment,
  setGroupSelection,
  attachCollectionGroupMeta,
  attachSelectionGroupMeta,
  applyUgcSeasonToItem,
  applyUgcSeasonToItems,
  buildGroupMetaPatches,
  applyGroupMetaPatchToItems,
  mergeGroupFields,
  buildVideoShortUrl,
  upsertCollectionExportIndex,
  upsertExportIndexMap,
  upsertIndexForExportItem,
  upsertVideoExportIndex,
} from "@subbatch/core";

describe("subtitle export layout", () => {
  const blenderPart = {
    bvid: "BV14u41147YH",
    page: 33,
    author: "Kurt",
    groupType: "selection" as const,
    videoTitle: "【Kurt】Blender零基础入门教程 | Blender中文区新手必刷教程(已完结)",
    groupFolder: buildUpFolderLabel(
      "Kurt",
      "【Kurt】Blender零基础入门教程 | Blender中文区新手必刷教程(已完结)",
    ),
    title:
      "【Kurt】Blender零基础入门教程 | Blender中文区新手必刷教程(已完结) - P33【【动画篇】6.5 头部跟随动画 - 物体约束】",
    part: "【动画篇】6.5 头部跟随动画 - 物体约束",
  };

  it("derives series folder and short P* part file names for 视频选集", () => {
    expect(resolveSeriesTitle(blenderPart)).toBe(
      "【Kurt】Blender零基础入门教程 | Blender中文区新手必刷教程(已完结)",
    );
    expect(resolvePartLabel(blenderPart)).toBe(
      "【动画篇】6.5 头部跟随动画 - 物体约束",
    );
    expect(resolveSubtitleFileStem(blenderPart)).toBe(
      "P33【动画篇】6.5 头部跟随动画 - 物体约束",
    );
    expect(resolveExportFolderName(blenderPart)).toBe(
      "Kurt 【Kurt】Blender零基础入门教程 | Blender中文区新手必刷教程(已完结)",
    );

    const path = buildSubtitleExportRelativePath(blenderPart, "txt");
    expect(path.startsWith(`${SUBTITLE_EXPORT_ROOT}/`)).toBe(true);
    expect(path.endsWith(".txt")).toBe(true);
    expect(path).not.toMatch(/-txt$/);
    // ASCII dots inside titles become middle-dot so the only real extension is .txt
    expect(path).toContain("/P33【动画篇】6·5 头部跟随动画 - 物体约束.txt");
    expect(path).not.toContain("BV14u41147YH_P");
    expect(path).not.toMatch(/- P33【/);
    expect(path).toContain("｜");
    expect(path.split("/")).toHaveLength(3);
  });

  it("never produces -txt suffix even when title has dots or question marks", () => {
    const item = {
      bvid: "BV1qmsXztEde",
      page: 1,
      author: "随意Official",
      title: "读主节点不能强一致？最实用的强一致方案 v2.0",
      groupType: "collection" as const,
      collectionName: "合集·分布式教程",
      groupFolder: "随意Official 合集·分布式教程",
    };
    const path = buildSubtitleExportRelativePath(item, "txt");
    expect(path.endsWith(".txt")).toBe(true);
    expect(path).not.toMatch(/-txt$/i);
    expect(path).not.toMatch(/\.txt\.txt$/);
    // ASCII dots inside title become middle-dot, not a fake extension.
    expect(joinFileName(item.title, "txt")).toMatch(/\.txt$/);
    expect(joinFileName(item.title, "txt")).not.toMatch(/-txt$/);
    expect(safePathSegment("a.b.c")).toBe("a·b·c");
  });

  it("uses UP + 合集名 as folder and video title as file for 合集", () => {
    const shortUrl = buildCollectionShortUrl("12345", "67890");
    const item = {
      bvid: "BV1qmsXztEde",
      page: 1,
      author: "示例UP",
      title: "合集内第 3 集：实战演示",
      groupType: "collection" as const,
      collectionName: "从入门到精通合集",
      collectionMid: "12345",
      collectionSid: "67890",
      collectionShortUrl: shortUrl,
      groupFolder: buildUpFolderLabel("示例UP", "从入门到精通合集"),
    };
    expect(resolveExportFolderName(item)).toBe("示例UP 从入门到精通合集");
    expect(resolveSubtitleFileStem(item)).toBe("合集内第 3 集：实战演示");
    expect(buildSubtitleExportRelativePath(item, "txt")).toBe(
      `${SUBTITLE_EXPORT_ROOT}/${safePathSegment("示例UP 从入门到精通合集")}/${joinFileName("合集内第 3 集：实战演示", "txt")}`,
    );

    let map = upsertIndexForExportItem({}, item);
    map = upsertIndexForExportItem(map, {
      ...item,
      collectionName: "从入门到精通合集（完结）",
      groupFolder: buildUpFolderLabel("示例UP", "从入门到精通合集（完结）"),
    });
    const md = renderExportIndexMd(map);
    expect(md).toContain(`示例UP ${shortUrl} 从入门到精通合集（完结）`);
    expect(md).not.toContain("BV1qmsXztEde");
    expect(md.match(new RegExp(shortUrl.replace(/\./g, "\\."), "g"))?.length).toBe(1);
  });

  it("repairs 未知UP folder from peer author (字幕 panel ↔ download)", () => {
    const peers = [
      {
        bvid: "BV1AAA",
        author: "随意Official",
        groupType: "collection" as const,
        groupKey: "collection:1/2",
        collectionName: "合集·分布式教程",
        groupFolder: "随意Official 合集·分布式教程",
      },
      {
        bvid: "BV1BBB",
        author: "",
        groupType: "collection" as const,
        groupKey: "collection:1/2",
        collectionName: "合集·分布式教程",
        groupFolder: "未知UP 合集·分布式教程",
        title: "某一集",
      },
    ];
    const fixed = normalizeExportItem(peers[1], peers);
    expect(fixed.author).toBe("随意Official");
    expect(fixed.groupFolder).toBe("随意Official 合集·分布式教程");
    expect(resolveExportFolderName(fixed)).toBe("随意Official 合集·分布式教程");
    expect(buildSubtitleExportRelativePath(fixed, "txt")).toContain("随意Official");
    expect(buildSubtitleExportRelativePath(fixed, "txt")).not.toContain("未知UP");
  });

  it("parses multipage title when part field is missing", () => {
    const item = {
      bvid: "BV14u41147YH",
      page: 33,
      title:
        "【Kurt】Blender零基础入门教程 | Blender中文区新手必刷教程(已完结) - P33【【动画篇】6.5 头部跟随动画 - 物体约束】",
    };
    expect(resolveSeriesTitle(item)).toBe(
      "【Kurt】Blender零基础入门教程 | Blender中文区新手必刷教程(已完结)",
    );
    expect(resolveSubtitleFileStem(item)).toBe(
      "P33【动画篇】6.5 头部跟随动画 - 物体约束",
    );
  });

  it("uses P{n} alone for single-part videos without part labels", () => {
    const item = {
      bvid: "BV1TEST00001",
      page: 1,
      title: "单集演示视频",
    };
    expect(resolveSeriesTitle(item)).toBe("单集演示视频");
    expect(resolveSubtitleFileStem(item)).toBe("P1");
    expect(buildSubtitleExportRelativePath(item, "srt")).toBe(
      `${SUBTITLE_EXPORT_ROOT}/单集演示视频/P1.srt`,
    );
  });

  it("index.md video lines are author + shortUrl + title (like 合集)", () => {
    let map = upsertVideoExportIndex(
      {},
      "KurTips",
      "BV14u41147YH",
      "旧标题",
    );
    map = upsertVideoExportIndex(
      map,
      "KurTips",
      "BV14u41147YH",
      "【Kurt】Blender零基础入门教程 | Blender中文区新手必刷教程(已完结)",
    );
    map = upsertIndexForExportItem(map, {
      bvid: "BV1OTHER0001",
      author: "UP乙",
      videoTitle: "另一个视频",
      groupType: "selection",
    });

    const md = renderExportIndexMd(map);
    const short = buildVideoShortUrl("BV14u41147YH");
    expect(md).toContain(
      `KurTips ${short} 【Kurt】Blender零基础入门教程 | Blender中文区新手必刷教程(已完结)`,
    );
    expect(md).not.toContain("旧标题");
    // Not the old bare "BV …" only form as the primary shape.
    expect(md).not.toMatch(/^BV14u41147YH /m);
    expect(md).toContain(`UP乙 ${buildVideoShortUrl("BV1OTHER0001")} 另一个视频`);
    expect(buildSubtitleExportIndexPath()).toBe(
      `${SUBTITLE_EXPORT_ROOT}/index.md`,
    );

    const parsed = parseExportIndexMd(md);
    expect(parsed.BV14u41147YH).toEqual({
      kind: "video",
      author: "KurTips",
      shortUrl: short,
      bvid: "BV14u41147YH",
      name: "【Kurt】Blender零基础入门教程 | Blender中文区新手必刷教程(已完结)",
    });
  });

  it("round-trips collection index lines by short URL", () => {
    const shortUrl = buildCollectionShortUrl("99", "88");
    let map = upsertCollectionExportIndex({}, "UP甲", shortUrl, "合集A");
    map = upsertCollectionExportIndex(map, "UP甲", shortUrl, "合集A改名");
    const md = renderExportIndexMd(map);
    expect(md).toBe(`UP甲 ${shortUrl} 合集A改名\n`);
    const parsed = parseExportIndexMd(md);
    expect(parsed[`collection:${shortUrl}`]).toEqual({
      kind: "collection",
      author: "UP甲",
      shortUrl,
      name: "合集A改名",
    });
  });

  it("upgrades legacy BV title lines when parsing index.md", () => {
    const parsed = parseExportIndexMd(
      "BV14u41147YH 【Kurt】Blender零基础入门教程\n",
    );
    expect(parsed.BV14u41147YH).toMatchObject({
      kind: "video",
      bvid: "BV14u41147YH",
      name: "【Kurt】Blender零基础入门教程",
      shortUrl: buildVideoShortUrl("BV14u41147YH"),
    });
  });

  it("describeSubtitleExport returns a complete layout descriptor", () => {
    const desc = describeSubtitleExport(blenderPart, "txt");
    expect(desc.bvid).toBe("BV14u41147YH");
    expect(desc.seriesTitle).toBe(
      "Kurt 【Kurt】Blender零基础入门教程 | Blender中文区新手必刷教程(已完结)",
    );
    expect(desc.fileStem).toBe("P33【动画篇】6.5 头部跟随动画 - 物体约束");
    expect(desc.relativePath).toBe(buildSubtitleExportRelativePath(blenderPart, "txt"));
    expect(desc.indexPath).toBe("loop-bilibili-subbatch/index.md");
    expect(desc.groupType).toBe("selection");
  });
});

describe("library folder groups", () => {
  it("groups 选集/合集 and computes parent checkbox state", () => {
    const selection = [1, 2, 3].map((page, index) => ({
      item: {
        bvid: "BV14u41147YH",
        page,
        author: "Kurt",
        groupType: "selection" as const,
        groupKey: "selection:BV14u41147YH",
        groupFolder: "Kurt Blender教程",
        title: `P${page}`,
        selected: page !== 2,
      },
      index,
    }));
    const nodes = buildLibraryRenderNodes(selection, {});
    expect(nodes).toHaveLength(1);
    expect(nodes[0].type).toBe("folder");
    if (nodes[0].type !== "folder") return;
    expect(nodes[0].folderLabel).toBe("Kurt Blender教程");
    expect(nodes[0].checkState).toBe("partial");
    expect(nodes[0].total).toBe(3);

    const items = selection.map((e) => e.item);
    setGroupSelection(items, "selection:BV14u41147YH", true);
    expect(items.every((i) => i.selected)).toBe(true);
    const allNodes = buildLibraryRenderNodes(
      items.map((item, index) => ({ item, index })),
      { "selection:BV14u41147YH": true },
    );
    expect(allNodes[0].type === "folder" && allNodes[0].collapsed).toBe(true);
    expect(allNodes[0].type === "folder" && allNodes[0].checkState).toBe("all");
  });

  it("folders same-BV multi-P even without groupType metadata", () => {
    // Simulates: auto-capture lost groupType, but 视频选集 scan left many P under one BV.
    const entries = [1, 2, 3].map((page, index) => ({
      item: {
        bvid: "BV14u41147YH",
        page,
        author: "KurTips",
        title: `【Kurt】Blender - P${page}【第${page}集】`,
        part: `第${page}集`,
        selected: true,
      },
      index,
    }));
    const nodes = buildLibraryRenderNodes(entries, {});
    expect(nodes).toHaveLength(1);
    expect(nodes[0].type).toBe("folder");
    if (nodes[0].type === "folder") {
      expect(nodes[0].groupType).toBe("selection");
      expect(nodes[0].total).toBe(3);
      expect(nodes[0].folderLabel).toContain("KurTips");
    }
  });

  it("folders 合集 even for a single episode with collection meta", () => {
    // Opening one video inside a 合集 should still show a folder (auto), like multi-P 选集.
    const entries = [
      {
        item: {
          bvid: "BV1qmsXztEde",
          page: 1,
          author: "随意Official",
          title: "读主节点不能强一致？最实用的强一致方案",
          groupType: "collection" as const,
          groupKey: "collection:79356601/6622988",
          collectionName: "分布式教程",
          collectionMid: "79356601",
          collectionSid: "6622988",
          groupFolder: "随意Official 分布式教程",
          selected: true,
        },
        index: 0,
      },
    ];
    const nodes = buildLibraryRenderNodes(entries, {});
    expect(nodes).toHaveLength(1);
    expect(nodes[0].type).toBe("folder");
    if (nodes[0].type === "folder") {
      expect(nodes[0].groupType).toBe("collection");
      expect(nodes[0].total).toBe(1);
      expect(nodes[0].folderLabel).toBe("随意Official 分布式教程");
    }
  });

  it("folders multiple 合集 episodes sharing collectionSid without groupType", () => {
    const entries = [
      {
        item: {
          bvid: "BV1AAA",
          page: 1,
          author: "随意Official",
          title: "第1集",
          collectionMid: "79356601",
          collectionSid: "6622988",
          collectionName: "分布式教程",
          selected: true,
        },
        index: 0,
      },
      {
        item: {
          bvid: "BV1BBB",
          page: 1,
          author: "随意Official",
          title: "第2集",
          collectionMid: "79356601",
          collectionSid: "6622988",
          collectionName: "分布式教程",
          selected: false,
        },
        index: 1,
      },
    ];
    const nodes = buildLibraryRenderNodes(entries, {});
    expect(nodes).toHaveLength(1);
    expect(nodes[0].type).toBe("folder");
    if (nodes[0].type === "folder") {
      expect(nodes[0].groupType).toBe("collection");
      expect(nodes[0].total).toBe(2);
      expect(nodes[0].checkState).toBe("partial");
      expect(nodes[0].folderLabel).toContain("分布式教程");
    }
  });

  it("attachSelection / attachCollection / ugc_season are pure and reusable", () => {
    const sel = attachSelectionGroupMeta(
      [
        { bvid: "BV14u41147YH", page: 1, part: "开场", title: "x - P1【开场】" },
        { bvid: "BV14u41147YH", page: 2, part: "续", title: "x - P2【续】" },
      ],
      { author: "KurTips", title: "【Kurt】教程" },
    );
    expect(sel).toHaveLength(2);
    expect(sel[0].groupType).toBe("selection");
    expect(sel[0].groupKey).toBe("selection:BV14u41147YH");
    expect(sel[0].groupFolder).toBe("KurTips 【Kurt】教程");
    expect(sel[1].videoTitle).toBe("【Kurt】教程");

    const col = attachCollectionGroupMeta(
      [
        { bvid: "BV1AAA", title: "第1集", author: "" },
        { bvid: "BV1BBB", title: "第2集", author: "" },
      ],
      { mid: "1", season_id: "2", name: "分布式教程", author: "" },
      { authorHint: "随意Official" },
    );
    expect(col[0].groupType).toBe("collection");
    expect(col[0].groupKey).toBe("collection:1/2");
    expect(col[0].author).toBe("随意Official");
    expect(col[0].groupFolder).toBe("随意Official 分布式教程");

    const stamped = applyUgcSeasonToItem(
      { bvid: "BV1qms", title: "某一集", author: "" },
      {
        ugc_season: { id: 6622988, mid: 79356601, title: "分布式教程" },
        owner: { name: "随意Official", mid: 79356601 },
      },
    );
    expect(stamped.groupType).toBe("collection");
    expect(stamped.collectionSid).toBe("6622988");
    expect(stamped.groupFolder).toContain("随意Official");

    const multi = applyUgcSeasonToItems(
      [{ bvid: "A" }, { bvid: "B" }],
      { ugc_season: { id: 1, mid: 2, title: "合" }, owner: { name: "U" } },
    );
    expect(multi.every((x) => x.groupKey === "collection:2/1")).toBe(true);

    const patch = buildGroupMetaPatches({
      groupKey: "collection:1/2",
      author: "随意Official",
      groupFolder: "随意Official 分布式教程",
    });
    const patched = applyGroupMetaPatchToItems(
      [
        { bvid: "A", groupKey: "collection:1/2", author: "", groupFolder: "未知UP 分布式教程" },
        { bvid: "Z", groupKey: "other", author: "X" },
      ],
      patch,
    );
    expect(patched[0].author).toBe("随意Official");
    expect(patched[0].groupFolder).toBe("随意Official 分布式教程");
    expect(patched[1].author).toBe("X");

    const merged = mergeGroupFields(
      { bvid: "A", title: "t" },
      { groupType: "collection", groupKey: "collection:1/2", collectionName: "合" },
    );
    expect(merged.groupType).toBe("collection");
    expect(merged.groupKey).toBe("collection:1/2");
  });

  it("keeps single videos flat outside folders", () => {
    const entries = [
      {
        item: { bvid: "BV1AAA", page: 1, title: "单集", author: "A", groupType: "single" as const },
        index: 0,
      },
      {
        item: {
          bvid: "BV1BBB",
          page: 1,
          title: "合集视频1",
          author: "B",
          groupType: "collection" as const,
          groupKey: "collection:1/2",
          groupFolder: "B 合集X",
          collectionName: "合集X",
          selected: true,
        },
        index: 1,
      },
      {
        item: {
          bvid: "BV1CCC",
          page: 1,
          title: "合集视频2",
          author: "B",
          groupType: "collection" as const,
          groupKey: "collection:1/2",
          groupFolder: "B 合集X",
          collectionName: "合集X",
          selected: false,
        },
        index: 2,
      },
    ];
    const nodes = buildLibraryRenderNodes(entries, {});
    expect(nodes.map((n) => n.type)).toEqual(["item", "folder"]);
    if (nodes[1].type === "folder") {
      expect(nodes[1].children).toHaveLength(2);
      expect(nodes[1].checkState).toBe("partial");
    }
  });
});
