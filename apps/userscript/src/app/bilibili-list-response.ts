/** Decode the four paginated Bilibili list APIs at the network trust boundary.
 * Never expose an unverified JSON object to the scan coordinator.
 */
export interface BilibiliVideoListRow {
  bvid: string;
  bv_id: string;
  aid: number;
  id: number;
  title: string;
  author: string;
  up_name: string;
  arcurl: string;
  type: number;
  owner: { name: string };
  upper: { name: string };
}
export interface BilibiliListData {
  list: { vlist: BilibiliVideoListRow[] };
  page: { pn?: number; ps?: number; count?: number; total?: number };
  medias: BilibiliVideoListRow[];
  archives: BilibiliVideoListRow[];
  result: BilibiliVideoListRow[];
  has_more: boolean;
  numPages: number;
  numResults: number;
  info: { title: string };
  meta: { name: string; title: string; author: string; name_upper: string; upper: { name: string } };
}
export interface BilibiliListResponse {
  code: number;
  message: string;
  data: BilibiliListData;
}
function record(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown> : {};
}
const str = (value: unknown): string => String(value ?? "");
const num = (value: unknown): number => {
  const converted = Number(value);
  return Number.isFinite(converted) ? converted : 0;
};
function optionalNumber(value: unknown): number | undefined {
  if (typeof value !== "number" && (typeof value !== "string" || !value.trim())) return undefined;
  const converted = Number(value);
  return Number.isFinite(converted) ? converted : undefined;
}
function row(value: unknown): BilibiliVideoListRow {
  const o = record(value);
  const owner = record(o.owner);
  const upper = record(o.upper);
  return {
    bvid: str(o.bvid), bv_id: str(o.bv_id), aid: num(o.aid), id: num(o.id),
    title: str(o.title), author: str(o.author), up_name: str(o.up_name),
    arcurl: str(o.arcurl), type: num(o.type),
    owner: { name: str(owner.name) }, upper: { name: str(upper.name) },
  };
}
const rows = (input: unknown): BilibiliVideoListRow[] => Array.isArray(input) ? input.map(row) : [];
export function parseListResponse(value: unknown): BilibiliListResponse {
  const payload = record(value);
  const code = optionalNumber(payload.code);
  if (code === undefined || !Number.isInteger(code)) {
    throw new Error("Bilibili 列表响应缺少有效 code");
  }
  const data = record(payload.data), list = record(data.list);
  const page = record(data.page), info = record(data.info), meta = record(data.meta);
  const metaUpper = record(meta.upper);
  const pagination: BilibiliListData["page"] = {};
  for (const key of ["pn", "ps", "count", "total"] as const) {
    const value = optionalNumber(page[key]);
    if (value !== undefined && value >= 0) pagination[key] = value;
  }
  return {
    code, message: str(payload.message),
    data: {
      list: { vlist: rows(list.vlist) },
      page: pagination,
      medias: rows(data.medias), archives: rows(data.archives), result: rows(data.result),
      has_more: data.has_more === true,
      numPages: num(data.numPages), numResults: num(data.numResults),
      info: { title: str(info.title) },
      meta: {
        name: str(meta.name), title: str(meta.title), author: str(meta.author),
        name_upper: str(meta.name_upper), upper: { name: str(metaUpper.name) },
      },
    },
  };
}
