/** Library filtering and status projection independent of DOM state. */
export interface LibraryItem {
  subStatus?: string | null;
  cue_count?: number | null;
  data?: readonly unknown[] | null;
  title?: string | null;
  bvid?: string | null;
  author?: string | null;
  part?: string | null;
  groupFolder?: string | null;
  parentFolder?: string | null;
  collectionName?: string | null;
  videoTitle?: string | null;
  collectionShortUrl?: string | null;
  sources?: readonly string[] | null;
}
export type LibraryStatus = "ok" | "empty" | "error" | "wait";

export function status(item: LibraryItem | null | undefined): LibraryStatus {
  const value = String(item?.subStatus || "wait");
  return value === "ok" || value === "empty" || value === "error" ? value : "wait";
}

export function statusLabel(item: LibraryItem | null | undefined): string {
  const value = status(item);
  if (value === "ok") return String(item?.cue_count || item?.data?.length || 0) + " 条";
  if (value === "empty") return "无字幕";
  if (value === "error") return "失败";
  return "待抓取";
}

export function filteredEntries<T extends LibraryItem>(
  items: readonly T[],
  queryValue: string,
  filterValue: string,
): Array<{ item: T; index: number }> {
  const query = String(queryValue || "").trim().toLocaleLowerCase();
  const filter = String(filterValue || "all");
  return items.map((item, index) => ({ item, index }))
    .filter(({ item }) => filter === "all" || status(item) === filter)
    .filter(({ item }) => {
      if (!query) return true;
      const haystack = [
        item?.title, item?.bvid, item?.author, item?.part,
        item?.groupFolder, item?.parentFolder, item?.collectionName, item?.videoTitle,
        item?.collectionShortUrl,
        ...(Array.isArray(item?.sources) ? item.sources : []),
      ].filter(Boolean).join(" ").toLocaleLowerCase();
      return haystack.includes(query);
    });
}
