/** Static Studio shell chrome; business workspace markup stays in Compat. */
export function renderPanelHeader(version: string): string {
  return `
      <button type="button" class="bsb-dock-tab" title="展开 SubBatch 工作台">AI · CC</button>
      <aside class="bsb-sidebar" role="complementary" aria-label="Bili SubBatch Workspace" aria-hidden="true">
        <div class="bsb-resize n" data-dir="n"></div>
        <div class="bsb-resize s" data-dir="s"></div>
        <div class="bsb-resize e" data-dir="e"></div>
        <div class="bsb-resize w" data-dir="w"></div>
        <div class="bsb-resize ne" data-dir="ne"></div>
        <div class="bsb-resize nw" data-dir="nw"></div>
        <div class="bsb-resize se" data-dir="se"></div>
        <div class="bsb-resize sw" data-dir="sw"></div>
        <div class="bsb-head">
          <div class="bsb-head-title">
            <span class="bsb-logo" aria-hidden="true">S</span>
            <span class="bsb-brand-stack"><strong>SubBatch</strong><span class="bsb-head-context" data-role="workspace-title">AI 工作台</span></span>
            <span class="bsb-ver">v${version}</span>
          </div>
          <div class="bsb-head-actions">
            <div class="bsb-size-switch" role="group" aria-label="面板宽度">
              <button type="button" data-act="panel-size" data-size="small" aria-pressed="false" title="紧凑宽度">S</button>
              <button type="button" data-act="panel-size" data-size="medium" aria-pressed="false" title="标准宽度">M</button>
              <button type="button" data-act="panel-size" data-size="large" aria-pressed="false" title="宽屏阅读">L</button>
            </div>
            <button type="button" class="bsb-icon-btn" data-act="dock" title="贴边收起" aria-label="贴边收起">◧</button>
            <button type="button" class="bsb-icon-btn" data-act="collapse" title="最小化" aria-label="最小化">−</button>
            <button type="button" class="bsb-icon-btn bsb-close" title="关闭" aria-label="关闭">×</button>
          </div>
        </div>
        <nav class="bsb-nav" aria-label="Workspace">
          <div class="bsb-nav-primary">
            <button type="button" data-view="ai" class="active" title="AI 工作台"><span class="bsb-nav-icon" aria-hidden="true">✦</span><span class="bsb-nav-label">AI</span></button>
            <button type="button" data-view="subs" title="字幕库"><span class="bsb-nav-icon" aria-hidden="true">≡</span><span class="bsb-nav-label">字幕</span></button>
            <button type="button" data-view="knowledge" title="Knowledge"><span class="bsb-nav-icon" aria-hidden="true">◇</span><span class="bsb-nav-label">知识</span></button>
          </div>
          <div class="bsb-nav-secondary">
            <button type="button" data-view="settings" title="设置"><span class="bsb-nav-icon" aria-hidden="true">⚙</span><span class="bsb-nav-label">设置</span></button>
          </div>
        </nav>
`;
}
