/** Knowledge reader presentation and click-intent routing. */
export interface KnowledgeReaderAnchor {
  id: string;
  selectedText?: string;
  title?: string;
  bvid?: string;
  page?: number;
  timeStart?: number | null;
  starred?: boolean;
}
export interface KnowledgeReaderOptions {
  isSmall?: boolean;
  escapeAttr: (text: string) => string;
  escapeHtml: (text: string) => string;
  formatClock: (time: number) => string;
  contextHtml: string;
  breadcrumbHtml: string;
  answerHtml: string;
  composerHtml: string;
}

export function readerHtml(
  anchor: KnowledgeReaderAnchor,
  options: KnowledgeReaderOptions,
): string {
  const { isSmall = false, escapeAttr, escapeHtml, formatClock, contextHtml, breadcrumbHtml, answerHtml, composerHtml } = options;
    const meta = [
      anchor.title || "",
      anchor.bvid ? `${anchor.bvid}${(anchor.page || 1) > 1 ? ` P${anchor.page}` : ""}` : "",
      anchor.timeStart != null ? formatClock(anchor.timeStart) : "",
    ].filter(Boolean).join(" · ");
    return `<header class="bsb-knowledge-reader-head">
        <div class="bsb-knowledge-reader-head-main">
          ${isSmall ? '<button type="button" class="bsb-btn ghost bsb-knowledge-mobile-back" data-knowledge-back-list style="margin-bottom:4px">← 返回列表</button>' : ""}
          <h2 class="bsb-knowledge-reader-title" title="${escapeAttr(anchor.selectedText || "")}">${escapeHtml(anchor.selectedText || "")}</h2>
          <p class="bsb-knowledge-reader-meta" title="${escapeAttr(meta)}">${escapeHtml(meta || "局部字幕锚点")}</p>
        </div>
        <div class="bsb-knowledge-reader-actions">
          <button type="button" class="bsb-icon-btn${anchor.starred ? " active" : ""}" data-knowledge-star-anchor title="${anchor.starred ? "取消收藏" : "收藏"}">${anchor.starred ? "★" : "☆"}</button>
          <button type="button" class="bsb-icon-btn" data-knowledge-seek title="回到字幕">⏱</button>
          <div class="bsb-knowledge-more">
            <button type="button" class="bsb-icon-btn" data-knowledge-more-toggle title="更多" aria-haspopup="menu">···</button>
            <div class="bsb-knowledge-more-menu" data-role="knowledge-more-menu" hidden>
              <button type="button" class="danger" data-knowledge-delete-anchor>删除锚点</button>
            </div>
          </div>
        </div>
      </header>
      ${contextHtml}
      <div class="bsb-knowledge-crumbs">${breadcrumbHtml}</div>
      <div class="bsb-knowledge-reader-scroll" data-role="knowledge-reader-scroll">
        <div class="bsb-knowledge-reader-scroll-inner">${answerHtml}</div>
      </div>
      ${composerHtml}`;
  }



export interface KnowledgeReaderActions {
  starAnchor(): void;
  starNode(): void;
  deleteAnchor(): void;
  toggleMore(): void;
}
interface KnowledgeClickTarget {
  closest?: (selector: string) => unknown;
}
export function dispatchReaderClick(
  target: KnowledgeClickTarget | null | undefined,
  actions: KnowledgeReaderActions,
): boolean {
  if (!target) return false;
  for (const [selector, action] of [
    ["[data-knowledge-star-anchor]", "starAnchor"],
    ["[data-knowledge-star-node]", "starNode"],
    ["[data-knowledge-delete-anchor]", "deleteAnchor"],
    ["[data-knowledge-more-toggle]", "toggleMore"],
  ] as const) {
    if (target.closest?.(selector)) {
      actions[action]();
      return true;
    }
  }
  return false;
}
