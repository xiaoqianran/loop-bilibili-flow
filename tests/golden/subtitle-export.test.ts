import { describe, expect, it } from "vitest";

import {
  SUBTITLE_EXPORT_ROOT,
  buildSubtitleExportIndexPath,
  buildSubtitleExportRelativePath,
  describeSubtitleExport,
  parseExportIndexMd,
  renderExportIndexMd,
  resolvePartLabel,
  resolveSeriesTitle,
  resolveSubtitleFileStem,
  safePathSegment,
  upsertExportIndexMap,
} from "@subbatch/core";

describe("subtitle export layout", () => {
  const blenderPart = {
    bvid: "BV14u41147YH",
    page: 33,
    title:
      "【Kurt】Blender零基础入门教程 | Blender中文区新手必刷教程(已完结) - P33【【动画篇】6.5 头部跟随动画 - 物体约束】",
    part: "【动画篇】6.5 头部跟随动画 - 物体约束",
  };

  it("derives series folder and short P* part file names", () => {
    expect(resolveSeriesTitle(blenderPart)).toBe(
      "【Kurt】Blender零基础入门教程 | Blender中文区新手必刷教程(已完结)",
    );
    expect(resolvePartLabel(blenderPart)).toBe(
      "【动画篇】6.5 头部跟随动画 - 物体约束",
    );
    expect(resolveSubtitleFileStem(blenderPart)).toBe(
      "P33【动画篇】6.5 头部跟随动画 - 物体约束",
    );

    const path = buildSubtitleExportRelativePath(blenderPart, "txt");
    expect(path.startsWith(`${SUBTITLE_EXPORT_ROOT}/`)).toBe(true);
    expect(path).toContain("/P33【动画篇】6.5 头部跟随动画 - 物体约束.txt");
    expect(path).not.toContain("BV14u41147YH_P");
    // Folder must not embed the full multipage suffix.
    expect(path).not.toMatch(/- P33【/);
    // Pipe is sanitized for filesystem paths.
    expect(path).toContain("｜");
    expect(path.split("/")).toHaveLength(3);
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
      `${SUBTITLE_EXPORT_ROOT}/${safePathSegment("单集演示视频")}/P1.srt`,
    );
  });

  it("upserts index.md BV → title and replaces same BV name", () => {
    let map = upsertExportIndexMap({}, "BV14u41147YH", "旧标题");
    map = upsertExportIndexMap(
      map,
      "BV14u41147YH",
      "【Kurt】Blender零基础入门教程 | Blender中文区新手必刷教程(已完结)",
    );
    map = upsertExportIndexMap(map, "BV1OTHER0001", "另一个合集");

    const md = renderExportIndexMd(map);
    expect(md).toContain(
      "BV14u41147YH 【Kurt】Blender零基础入门教程 | Blender中文区新手必刷教程(已完结)",
    );
    expect(md).not.toContain("旧标题");
    expect(md).toContain("BV1OTHER0001 另一个合集");
    expect(buildSubtitleExportIndexPath()).toBe(
      `${SUBTITLE_EXPORT_ROOT}/index.md`,
    );

    const parsed = parseExportIndexMd(md);
    expect(parsed.BV14u41147YH).toBe(
      "【Kurt】Blender零基础入门教程 | Blender中文区新手必刷教程(已完结)",
    );
  });

  it("describeSubtitleExport returns a complete layout descriptor", () => {
    const desc = describeSubtitleExport(blenderPart, "txt");
    expect(desc.bvid).toBe("BV14u41147YH");
    expect(desc.seriesTitle).toBe(
      "【Kurt】Blender零基础入门教程 | Blender中文区新手必刷教程(已完结)",
    );
    expect(desc.fileStem).toBe("P33【动画篇】6.5 头部跟随动画 - 物体约束");
    expect(desc.relativePath).toBe(buildSubtitleExportRelativePath(blenderPart, "txt"));
    expect(desc.indexPath).toBe("loop-bilibili-subbatch/index.md");
  });
});
