export type FolioHeadingLevel = 2 | 3;

export interface FolioHeading {
  id: string;
  level: FolioHeadingLevel;
  text: string;
}

export interface FolioOutlineNode extends FolioHeading {
  children: FolioOutlineNode[];
}

export interface FolioOutlineStats {
  chapters: number;
  sections: number;
}

export function slugFolioHeading(text: string | null | undefined, index: number): string {
  const base = String(text || "")
    .toLowerCase()
    .replace(/[^\u4e00-\u9fff\w]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
  return `folio-${base || "s"}-${Math.max(0, Number(index) || 0) + 1}`;
}

export function normalizeFolioHeadingLevel(value: unknown): FolioHeadingLevel {
  return Number(value) >= 3 ? 3 : 2;
}

export function buildFolioOutline(
  headings: Array<FolioHeading | null | undefined> | null | undefined,
): FolioOutlineNode[] {
  const roots: FolioOutlineNode[] = [];
  let currentChapter: FolioOutlineNode | null = null;
  for (const heading of headings || []) {
    if (!heading) continue;
    const text = String(heading.text || "").replace(/\s+/g, " ").trim() || "未命名";
    const id = String(heading.id || "").trim();
    if (!id) continue;
    const node: FolioOutlineNode = {
      id,
      level: normalizeFolioHeadingLevel(heading.level),
      text,
      children: [],
    };
    if (node.level === 2 || !currentChapter) {
      node.level = 2;
      roots.push(node);
      currentChapter = node;
      continue;
    }
    currentChapter.children.push(node);
  }
  return roots;
}

export function flattenFolioOutline(nodes: FolioOutlineNode[] | null | undefined): FolioOutlineNode[] {
  const out: FolioOutlineNode[] = [];
  for (const node of nodes || []) {
    out.push(node);
    if (node.children?.length) out.push(...flattenFolioOutline(node.children));
  }
  return out;
}

export function countFolioOutline(nodes: FolioOutlineNode[] | null | undefined): FolioOutlineStats {
  const flat = flattenFolioOutline(nodes);
  return {
    chapters: (nodes || []).length,
    sections: flat.length,
  };
}

export function formatFolioChapterIndex(index: number): string {
  return String(Math.max(1, Number(index) || 1)).padStart(2, "0");
}

export function folioOutlineSummary(stats: FolioOutlineStats | null | undefined): string {
  const chapters = Math.max(0, Number(stats?.chapters) || 0);
  const sections = Math.max(0, Number(stats?.sections) || 0);
  if (!chapters) return "暂无章节";
  if (sections <= chapters) return `${chapters} 章`;
  return `${chapters} 章 · ${sections} 节`;
}
