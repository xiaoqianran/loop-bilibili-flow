/** Legacy-preserving ai workspace markup. */
export function renderAiWorkspace(): string {
  return `<section class="bsb-view active" data-view-panel="ai">
            <div class="bsb-ai-commandbar bsb-workbench-commandbar">
              <div class="bsb-ai-command-main">
                <div class="bsb-ai-stage-tabs" data-role="ai-stage-tabs" aria-label="AI 处理阶段">
                  <button type="button" data-ai-stage="preprocess" class="active"><span class="bsb-stage-index">1</span><span><strong>预处理</strong><small>字幕整理</small></span></button>
                  <span class="bsb-stage-connector">→</span>
                  <button type="button" data-ai-stage="chat"><span class="bsb-stage-index">2</span><span><strong>对话</strong><small>对着字幕聊</small></span></button>
                  <span class="bsb-stage-connector">→</span>
                  <button type="button" data-ai-stage="postprocess"><span class="bsb-stage-index">3</span><span><strong>后处理</strong><small>Mermaid / HTML 页</small></span></button>
                </div>
                <div class="bsb-ai-compact-stats bsb-chips" data-role="ai-chips" title="当前选择状态">
                  <span class="bsb-chip">选 <em data-role="chip-sel">0</em></span>
                  <span class="bsb-chip">字幕 <em data-role="chip-ok">0</em></span>
                  <span class="bsb-chip" data-role="chip-model">0 runs</span>
                </div>
              </div>
              <div class="bsb-ai-command-actions">
                <button type="button" class="bsb-btn ghost" data-act="ai-flow-drawer" title="配置预处理和后处理流程">流程</button>
                <button type="button" class="bsb-btn danger" data-act="ai-stop" style="display:none">停止</button>
                <button type="button" class="bsb-btn accent" data-act="ai-send" data-pipeline-action title="按照当前处理方案运行">运行</button>
              </div>
            </div>
            <div class="bsb-preprocess-nav" data-role="ai-preprocess-nav" aria-label="预处理字幕导航">
              <div class="bsb-preprocess-tabs">
                <button type="button" data-ai-preprocess-view="raw" class="active"><span class="dot raw"></span><span>原始字幕</span></button>
                <button type="button" data-ai-preprocess-view="processed"><span class="dot processed"></span><span>AI 处理字幕</span></button>
              </div>
              <span class="bsb-preprocess-status" data-role="ai-preprocess-status">等待字幕</span>
            </div>
            <div class="bsb-output-nav" data-role="ai-postprocess-nav" aria-label="后处理产物导航" hidden>
              <div class="bsb-output-tabs" data-role="ai-result-tabs">
                <span class="bsb-ai-result-empty">在“处理方案”中添加一个或多个后处理产物</span>
              </div>
              <div class="bsb-model-tabs" data-role="ai-model-tabs"></div>
            </div>
            <div class="bsb-ai-drawer-backdrop" data-role="ai-drawer-backdrop" hidden></div>
            <aside class="bsb-ai-drawer" data-role="ai-flow-drawer" aria-hidden="true"></aside>
            <aside class="bsb-ai-drawer bsb-ai-input-drawer" data-role="ai-input-drawer" aria-hidden="true"></aside>
            <aside class="bsb-knowledge-rail" data-role="knowledge-rail" aria-hidden="true"></aside>
            <div class="bsb-ai-canvas-wrap">
              <div class="bsb-ai-canvas-bar">
                <span class="bsb-bar-left">
                  <span class="bsb-live-dot" aria-hidden="true"></span>
                  <span data-role="ai-canvas-stage-label">预处理</span>
                  <span data-role="ai-canvas-meta">原始字幕</span>
                </span>
                <span class="bsb-bar-actions">
                  <button type="button" class="bsb-mini bsb-focus-stop" data-act="ai-stop" title="停止本批次所有仍在生成的模型" style="display:none">停止</button>
                  <button type="button" class="bsb-mini" data-preprocess-action data-act="ai-copy-input" title="复制当前字幕">复制字幕</button>
                  <button type="button" class="bsb-mini" data-preprocess-action data-act="ai-reprocess" title="强制重新运行字幕预处理">重做预处理</button>
                  <button type="button" class="bsb-mini on" data-postprocess-action data-act="ai-stick" title="跟随最新 / 暂停跟随（上滑也会自动暂停）" hidden>粘底</button>
                  <button type="button" class="bsb-mini" data-postprocess-action data-act="ai-regenerate-current" title="只重新生成当前产物的当前模型版本" hidden>重试</button>
                  <button type="button" class="bsb-mini" data-postprocess-action data-act="ai-copy" title="复制当前输出" hidden>复制</button>
                  <button type="button" class="bsb-mini" data-postprocess-action data-act="ai-export" title="导出当前产物（HTML 页或 Markdown）" hidden>导出</button>
                  <button type="button" class="bsb-mini" data-studio-action data-act="studio-clear" title="清空当前对话" hidden>清空</button>
                  <button type="button" class="bsb-mini" data-studio-action data-act="studio-copy" title="复制上一条回答" hidden>复制</button>
                  <button type="button" class="bsb-mini" data-studio-action data-act="studio-export" title="导出对话" hidden>导出</button>
                  <button type="button" class="bsb-mini" data-act="ai-font-dec" title="减小正文字号">A−</button>
                  <button type="button" class="bsb-mini" data-act="ai-font-inc" title="增大正文字号">A+</button>
                  <button type="button" class="bsb-mini" data-act="ai-top" title="回到顶部">顶部</button>
                  <button type="button" class="bsb-mini bsb-focus-toggle" data-act="ai-focus" aria-pressed="false" title="铺满窗口，只保留模型标签与正文"><span class="focus-enter">专注</span><span class="focus-exit">退出专注</span></button>
                </span>
              </div>
              <div class="bsb-ai-stream" data-role="ai-stream">
                <pre class="bsb-ai-raw" data-role="ai-raw" hidden></pre>
                <div class="bsb-ai-md" data-role="ai-md">
                  <div class="bsb-ai-content" data-role="ai-content" aria-label="AI 笔记输出">
                    <div class="bsb-empty">
                      <div class="bsb-empty-ico">✦</div>
                      <strong>还没有分析结果</strong>
                      <span>在「字幕库」采集并勾选视频，再点「开始分析」。生成中上滑即可自由阅读（不会被拽回底部）；跟随时点「↓ 最新」。</span>
                    </div>
                  </div>
                  <div class="bsb-ai-anchor" data-role="ai-anchor"></div>
                </div>
                <button type="button" class="bsb-jump-latest" data-act="ai-jump" title="跳到最新输出">↓ 最新</button>
              </div>
              <div class="bsb-studio-dock" data-role="studio-dock" hidden>
                <div class="bsb-studio-slash" data-role="studio-slash" hidden></div>
                <div class="bsb-studio-composer">
                  <textarea data-role="studio-input" rows="1" placeholder="对着这一期提问… 输入 / 使用命令"></textarea>
                  <button type="button" class="bsb-btn accent" data-act="studio-send" title="发送">发送</button>
                </div>
              </div>
            </div>
          </section>`;
}
