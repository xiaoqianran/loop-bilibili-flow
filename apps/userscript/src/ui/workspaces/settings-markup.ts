/** Legacy-preserving settings workspace markup. */
export function renderSettingsWorkspace(): string {
  return `<section class="bsb-view" data-view-panel="settings">
            <div class="bsb-settings">
              <div class="bsb-settings-tabs" role="tablist" aria-label="设置分类">
                <button type="button" class="active" data-settings-tab="prompt" role="tab">Prompt</button>
                <button type="button" data-settings-tab="llm" role="tab">LLM</button>
                <button type="button" data-settings-tab="appearance" role="tab">外观</button>
                <button type="button" data-settings-tab="shortcuts" role="tab">快捷键</button>
              </div>

              <section class="bsb-settings-pane active" data-settings-pane="prompt">
                <div class="bsb-prompt-stage-tabs" role="tablist" aria-label="Prompt 阶段">
                  <button type="button" class="active" data-prompt-stage-tab="preprocess" role="tab">预处理</button>
                  <button type="button" data-prompt-stage-tab="postprocess" role="tab">后处理</button>
                  <button type="button" data-prompt-stage-tab="knowledge" role="tab">Knowledge</button>
                </div>
                <div class="bsb-prompt-stage-context" data-role="prompt-stage-context">
                  <span>预处理 · 原始字幕 → 规范化简体中文字幕稿</span>
                  <span>PRE</span>
                </div>
                <div class="bsb-config-master-detail">
                  <aside class="bsb-config-sidebar">
                    <div class="bsb-config-sidebar-head">
                      <label class="bsb-config-search"><span>⌕</span><input type="search" data-role="prompt-search" placeholder="搜索预处理 Prompt…" autocomplete="off"></label>
                      <button type="button" class="bsb-btn ghost bsb-config-create" data-act="prompt-add-pre" data-prompt-create-stage="preprocess">＋ 新建预处理</button>
                      <button type="button" class="bsb-btn ghost bsb-config-create" data-act="prompt-add" data-prompt-create-stage="postprocess" hidden>＋ 新建后处理</button>
                      <button type="button" class="bsb-btn ghost bsb-config-create" data-act="prompt-add-knowledge" data-prompt-create-stage="knowledge" hidden>＋ 新建 Knowledge</button>
                    </div>
                    <div class="bsb-config-list" data-role="prompt-list"></div>
                    <div class="bsb-config-sidebar-foot">
                      <button type="button" class="bsb-btn ghost" data-act="prompt-reset">恢复内置 Prompt</button>
                    </div>
                  </aside>
                  <main class="bsb-config-editor-shell bsb-ai-config" data-role="prompt-editor"></main>
                </div>
              </section>

              <section class="bsb-settings-pane" data-settings-pane="llm">
                <div class="bsb-config-master-detail">
                  <aside class="bsb-config-sidebar">
                    <div class="bsb-config-sidebar-head">
                      <label class="bsb-config-search"><span>⌕</span><input type="search" data-role="ai-search" placeholder="搜索模型配置…" autocomplete="off"></label>
                      <button type="button" class="bsb-btn ghost bsb-config-create" data-act="ai-profile-add">＋ 新建 LLM</button>
                    </div>
                    <div class="bsb-config-list" data-role="ai-list"></div>
                    <div class="bsb-config-sidebar-foot">
                      <button type="button" class="bsb-btn ghost" data-act="ai-reset">恢复默认模型</button>
                    </div>
                  </aside>
                  <main class="bsb-config-editor-shell bsb-ai-config" data-role="ai-editor"></main>
                </div>
              </section>

              <section class="bsb-settings-pane" data-settings-pane="appearance">
                <div class="bsb-appearance-settings" data-role="appearance-settings"></div>
              </section>

              <section class="bsb-settings-pane" data-settings-pane="shortcuts">
                <div class="bsb-shortcut-settings" data-role="shortcut-settings"></div>
              </section>
            </div>
          </section>`;
}
