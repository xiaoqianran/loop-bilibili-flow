/** Legacy-preserving knowledge workspace markup. */
export function renderKnowledgeWorkspaceMarkup(): string {
  return `<section class="bsb-view" data-view-panel="knowledge">
            <div class="bsb-knowledge-workspace" data-role="knowledge-workspace">
              <aside class="bsb-knowledge-nav" data-role="knowledge-nav">
                <div class="bsb-knowledge-nav-head">
                  <div class="bsb-knowledge-nav-title">锚点 <span data-role="knowledge-count">0</span></div>
                  <label class="bsb-knowledge-search"><span>⌕</span><input type="search" data-role="knowledge-search" placeholder="搜索锚点 / 视频 / 追问…" autocomplete="off"></label>
                </div>
                <div class="bsb-knowledge-nav-scroll" data-role="knowledge-list"></div>
              </aside>
              <button type="button" class="bsb-knowledge-splitter" data-role="knowledge-nav-split" title="拖拽调整导航宽度" aria-label="调整导航宽度"></button>
              <main class="bsb-knowledge-reader" data-role="knowledge-detail"><div class="bsb-empty"><div class="bsb-empty-ico">◇</div><strong>选择知识锚点</strong><span>从左侧选择锚点，或在 AI 处理字幕里划选文字创建。</span></div></main>
            </div>
          </section>`;
}
