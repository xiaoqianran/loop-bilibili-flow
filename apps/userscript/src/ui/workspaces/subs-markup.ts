/** Legacy-preserving subs workspace markup. */
export function renderSubsWorkspace(maxPages: number, delayMs: number): string {
  return `<section class="bsb-view" data-view-panel="subs">
            <div class="bsb-library-jobbar" data-role="library-jobbar" hidden>
              <div class="bsb-job-progress">
                <span class="bsb-job-dot" data-role="job-dot" aria-hidden="true"></span>
                <div class="bsb-job-copy">
                  <strong data-role="job-title">准备任务</strong>
                  <span data-role="job-meta">空闲</span>
                </div>
                <div class="bsb-job-meter" aria-hidden="true"><i data-role="job-meter"></i></div>
              </div>
              <div class="bsb-job-actions">
                <button type="button" data-act="job-pause" title="暂停当前扫描或字幕抓取，稍后再继续">暂停</button>
                <button type="button" data-act="job-stop" title="停止任务，已完成的条目会保留">停止</button>
              </div>
            </div>
            <div class="bsb-library-topbar">
              <button type="button" class="bsb-btn primary" data-act="capture-toggle">＋ 采集视频</button>
              <label class="bsb-library-search" title="搜索标题、BV、UP 或来源">
                <span>⌕</span>
                <input type="search" data-role="library-search" placeholder="搜索视频 / BV / UP…" autocomplete="off">
              </label>
              <div class="bsb-library-filterbar" data-role="library-filters" aria-label="字幕状态筛选">
                <button type="button" data-library-filter="all" class="active">全部 <span data-library-count="all">0</span></button>
                <button type="button" data-library-filter="ok">有字幕 <span data-library-count="ok">0</span></button>
                <button type="button" data-library-filter="wait">待抓取 <span data-library-count="wait">0</span></button>
                <button type="button" data-library-filter="error">失败 <span data-library-count="error">0</span></button>
                <button type="button" data-library-filter="empty">无字幕 <span data-library-count="empty">0</span></button>
              </div>
            </div>

            <div class="bsb-capture-drawer" data-role="capture-drawer" hidden>
              <div class="bsb-capture-head">
                <div><strong>采集视频</strong><br><span>扫描结果会按 BV + P 增量合并到资源库，不会覆盖已有字幕。</span></div>
                <button type="button" class="bsb-btn ghost" data-act="capture-toggle">关闭</button>
              </div>
              <div>
                <span class="bsb-badge" data-role="type">—</span>
                <div class="bsb-meta" data-role="ctx">—</div>
              </div>
              <div class="bsb-mode-row">
                <label>来源
                  <select data-role="mode" title="自动识别或强制类型">
                    <option value="auto" selected>自动识别</option>
                    <option value="video">单个视频</option>
                    <option value="selection">视频选集</option>
                    <option value="user">个人主页</option>
                    <option value="favorite">收藏夹</option>
                    <option value="collection">合集</option>
                    <option value="search">搜索页</option>
                  </select>
                </label>
                <span class="bsb-auto-hint" data-role="auto-hint">识别：—</span>
              </div>
              <div class="bsb-opts">
                <label class="bsb-auto-capture"><input type="checkbox" data-role="auto-capture" checked> 打开视频自动抓字幕</label>
                <label><input type="checkbox" data-role="auto-analyze" checked> 抓到字幕后自动分析</label>
                <label><input type="checkbox" data-role="player-subtitle" checked> 自动开启播放器字幕</label>
                <label>最多页 <input type="number" data-role="max-pages" min="1" max="100" value="${maxPages}"></label>
                <label>间隔ms <input type="number" data-role="delay" min="0" max="5000" step="50" value="${delayMs}"></label>
              </div>
              <div class="bsb-capture-actions">
                <button type="button" class="bsb-btn danger" data-act="cancel" style="display:none">停止</button>
                <button type="button" class="bsb-btn primary" data-act="scan">扫描并加入资源库</button>
              </div>
            </div>

            <div class="bsb-library-layout">
              <aside class="bsb-library-master">
                <div class="bsb-library-master-head">
                  <strong>视频资源</strong>
                  <span data-role="library-visible-count">0 / 0</span>
                  <div class="bsb-library-folder-tools">
                    <button type="button" data-act="folder-expand-all" title="展开全部文件夹">全部展开</button>
                    <button type="button" data-act="folder-collapse-all" title="收起全部文件夹">全部收起</button>
                  </div>
                </div>
                <div class="bsb-list" data-role="list">
                  <div class="bsb-empty">
                    <div class="bsb-empty-ico">≡</div>
                    <strong>字幕库为空</strong>
                    <span>点击「＋ 采集视频」，或直接打开一个视频自动加入。</span>
                  </div>
                </div>
                <div class="bsb-library-master-foot">
                  <div class="bsb-library-select-tools">
                    <button type="button" data-act="sel-all">全选</button>
                    <button type="button" data-act="sel-none">不选</button>
                    <button type="button" data-act="clear" title="清空资源库列表">清空</button>
                    <button type="button" data-act="copy-bvid" title="复制已勾选 BV">复制 BV</button>
                  </div>
                  <div class="bsb-library-primary-tools">
                    <button type="button" class="primary" data-act="fetch-selected" title="抓取勾选项字幕，可随时暂停">抓取字幕</button>
                    <button type="button" data-act="ai-send" title="把已有字幕送进 AI 工作台">送去 AI</button>
                  </div>
                </div>
              </aside>

              <main class="bsb-library-detail">
                <section class="bsb-transcript-shell" aria-label="当前视频工作区">
                  <div class="bsb-transcript-head">
                    <div class="bsb-transcript-title">
                      <strong data-role="transcript-title">当前视频字幕</strong>
                      <span data-role="transcript-meta">从左侧选择一个视频</span>
                    </div>
                    <div class="bsb-transcript-head-actions">
                      <button type="button" class="bsb-transcript-ai-link" data-act="open-ai-workspace" title="打开 AI 学习图谱工作区">AI ↗</button>
                    </div>
                  </div>
                  <div class="bsb-transcript-tools">
                    <label class="bsb-transcript-search" title="检索当前视频字幕">
                      <span>⌕</span>
                      <input type="search" data-role="transcript-search" placeholder="检索当前字幕…" autocomplete="off">
                      <span class="bsb-transcript-count" data-role="transcript-count"></span>
                    </label>
                    <div class="bsb-transcript-toolbar-end">
                      <select class="bsb-transcript-track" data-role="transcript-track" aria-label="字幕语言" disabled>
                        <option>自动</option>
                      </select>
                      <label class="bsb-transcript-follow"><input type="checkbox" data-role="transcript-follow" checked> 跟随</label>
                      <button type="button" class="bsb-transcript-refresh" data-act="transcript-refresh" title="忽略缓存重新读取">刷新</button>
                      <span class="bsb-toolbar-sep" aria-hidden="true"></span>
                      <div class="bsb-export-group" role="group" aria-label="导出字幕">
                        <button type="button" data-act="copy" title="复制当前字幕全文">复制</button>
                        <button type="button" data-act="dl-txt" title="下载 TXT">TXT</button>
                        <button type="button" class="primary" data-act="dl-srt" title="下载 SRT">SRT</button>
                      </div>
                    </div>
                  </div>
                  <div class="bsb-transcript-list" data-role="transcript-list">
                    <div class="bsb-transcript-empty">从左侧选择已有字幕的视频即可阅读全文。<br>点击时间可以跳转到播放器对应位置。</div>
                  </div>
                </section>
              </main>
            </div>
          </section>`;
}
