/** Strict runtime guard for Bilibili scan modes and their required identifiers. */
export type ScanMode = "auto" | "video" | "selection" | "user" |
  "favorite" | "collection" | "search" | "unknown";

export interface ScanContext {
  type: ScanMode | (string & {});
  bvid?: string;
  mid?: string;
  season_id?: string;
  media_id?: string;
  keyword?: string;
  [key: string]: unknown;
}

export function validateContext(value: unknown): asserts value is ScanContext {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("缺少扫描上下文，请打开 Bilibili 页面后重试");
  }
  const ctx = value as Record<string, unknown>;
  switch (ctx.type) {
    case "video":
    case "selection":
      if (!ctx.bvid) throw new Error("缺少 BV 号。请打开视频页，或切到「单个视频/视频选集」后重试");
      break;
    case "user":
      if (!ctx.mid) throw new Error("缺少 mid。请打开个人主页，或模式选「个人主页」");
      break;
    case "collection":
      if (!ctx.mid || !ctx.season_id) {
        throw new Error("合集需要 mid + season_id。请打开合集页（space/lists 或 /list/{mid}?sid=），或从合集内视频页切到「合集」后重试");
      }
      break;
    case "favorite":
      if (!ctx.media_id) throw new Error("收藏夹需要 fid/media_id。请打开带 fid 的收藏夹页");
      break;
    case "search":
      if (!ctx.keyword) throw new Error("搜索需要 keyword。请打开搜索结果页");
      break;
    case "unknown":
      throw new Error("未能识别页面。可手动选择模式：单个视频 / 视频选集 / 个人主页 / 收藏夹 / 合集 / 搜索页");
    default:
      // A custom/auto mode can still fall back to DOM video discovery.
      break;
  }
}

export function pageSizeFor(mode: string): number {
  return mode === "favorite" ? 20 : mode === "search" ? 42 : 30;
}
