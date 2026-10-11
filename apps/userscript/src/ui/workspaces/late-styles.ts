/** Final cascade layer for Studio shell/read mode and compact widths. */
export function renderLateStudioStyles(panelId: string): string {
  return `
      /* ── v5.2 阅读优先布局：默认紧凑，专注模式铺满视口 ── */
      #${panelId} .bsb-view[data-view-panel="ai"] {
        gap: 6px;
        padding: 7px 8px 8px;
      }
      #${panelId} .bsb-ai-commandbar {
        min-height: 36px;
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 8px;
        flex: 0 0 auto;
      }
      #${panelId} .bsb-ai-command-main {
        min-width: 0;
        flex: 1 1 auto;
        display: flex;
        align-items: center;
        gap: 6px;
      }
      #${panelId} .bsb-ai-mode-compact {
        display: inline-flex;
        align-items: center;
        gap: 5px;
        flex: 0 0 auto;
        color: var(--ctp-subtext0);
        font-size: 10.5px;
        font-weight: 650;
      }
      #${panelId} .bsb-ai-mode-compact select {
        width: auto;
        max-width: 150px;
        height: 30px;
        padding: 0 25px 0 8px;
        border-radius: 9px;
        border: 1px solid color-mix(in srgb, var(--ctp-surface2) 55%, transparent);
        background: var(--ctp-mantle);
        color: var(--ctp-text);
        outline: none;
        font-size: 11px;
      }
      #${panelId} .bsb-ai-compact-stats {
        flex-wrap: nowrap;
        overflow: hidden;
        gap: 4px;
      }
      #${panelId} .bsb-ai-compact-stats .bsb-chip {
        height: 24px;
        padding: 0 7px;
        font-size: 10px;
        white-space: nowrap;
      }
      #${panelId} .bsb-mode-hint { display: none; }
      #${panelId} .bsb-ai-command-actions {
        display: inline-flex;
        align-items: center;
        gap: 5px;
        flex: 0 0 auto;
      }
      #${panelId} .bsb-ai-command-actions .bsb-btn {
        height: 30px;
        padding: 0 10px;
        border-radius: 9px;
        font-size: 11px;
      }
      #${panelId} .bsb-ai-command-actions .bsb-btn.accent {
        height: 32px;
        padding-inline: 12px;
      }
      #${panelId} .bsb-ai-result-tabs {
        padding: 0 0 2px;
        gap: 5px;
      }
      #${panelId} .bsb-ai-result-tab {
        height: 30px;
        min-width: 96px;
        border-radius: 9px;
      }
      #${panelId} .bsb-ai-canvas-wrap {
        min-height: 320px;
        border-radius: 12px;
      }
      #${panelId} .bsb-ai-md {
        padding: 24px clamp(16px, 4vw, 44px) 72px;
      }
      #${panelId} .bsb-ai-content {
        width: 100%;
        max-width: 56em;
      }
      #${panelId}:not(.ai-focus) .bsb-focus-stop { display: none !important; }
      #${panelId} .bsb-focus-stop {
        color: var(--ctp-red) !important;
        border-color: color-mix(in srgb, var(--ctp-red) 42%, transparent) !important;
      }
      #${panelId} .focus-exit { display: none; }

      #${panelId}.ai-focus .bsb-sidebar {
        display: flex !important;
        left: 6px !important;
        top: 6px !important;
        right: auto !important;
        bottom: auto !important;
        width: calc(100vw - 12px) !important;
        height: calc(100dvh - 12px) !important;
        min-width: 0 !important;
        min-height: 0 !important;
        border-radius: 12px !important;
      }
      #${panelId}.ai-focus .bsb-head,
      #${panelId}.ai-focus .bsb-nav,
      #${panelId}.ai-focus .bsb-ai-commandbar,
      #${panelId}.ai-focus .bsb-dock-tab,
      #${panelId}.ai-focus .bsb-resize {
        display: none !important;
      }
      #${panelId}.ai-focus .bsb-view { display: none !important; }
      #${panelId}.ai-focus .bsb-view[data-view-panel="ai"] {
        display: flex !important;
        gap: 5px;
        padding: 6px;
      }
      #${panelId}.ai-focus .bsb-ai-result-tabs {
        flex: 0 0 31px;
        min-height: 31px;
        padding: 0;
      }
      #${panelId}.ai-focus .bsb-output-nav { flex:0 0 auto; border-radius:8px; overflow:hidden; }
      #${panelId}.ai-focus .bsb-output-tabs { padding-top:3px; }
      #${panelId}.ai-focus .bsb-ai-canvas-wrap {
        min-height: 0;
        border-radius: 9px;
      }
      #${panelId}.ai-focus .bsb-ai-md {
        padding-top: 28px;
        padding-bottom: 76px;
      }
      #${panelId}.ai-focus .focus-enter { display: none; }
      #${panelId}.ai-focus .focus-exit { display: inline; }
      #${panelId}.ai-focus .bsb-focus-toggle {
        color: var(--ctp-lavender);
        border-color: color-mix(in srgb, var(--ctp-lavender) 42%, transparent);
      }

      @media (max-width: 700px) {
        #${panelId} .bsb-ai-compact-stats .bsb-chip:not([data-role="chip-model"]) { display: none; }
      }
      @media (max-width: 520px) {
        #${panelId} .bsb-ai-mode-compact > span,
        #${panelId} .bsb-ai-compact-stats { display: none; }
        #${panelId} .bsb-ai-command-actions .bsb-btn { padding-inline: 8px; }
        #${panelId} .bsb-ai-md { padding-inline: 15px; }
      }

      /* ── v5.10 Studio Shell ──────────────────────────────────────────────
         Design goal: navigation is spatial (left rail), actions are contextual,
         and the reading canvas owns the visual hierarchy. Historical rules
         above are intentionally overridden here so the runtime logic stays
         stable while the product shell changes substantially. */
      #${panelId} {
        --studio-bg: #111319;
        --studio-panel: #171a21;
        --studio-raised: #1d212a;
        --studio-hover: #242936;
        --studio-line: rgba(255,255,255,.075);
        --studio-line-strong: rgba(255,255,255,.115);
        --studio-text: #eef0f6;
        --studio-muted: #9299a8;
        --studio-faint: #666d7b;
        --studio-accent: #a99df7;
        --studio-accent-soft: rgba(169,157,247,.13);
        --studio-success: #75c995;
        --studio-danger: #ef8299;
      }
      #${panelId} .bsb-sidebar {
        display: none;
        grid-template-columns: 64px minmax(0, 1fr);
        grid-template-rows: 54px minmax(0, 1fr);
        flex-direction: initial;
        border-radius: 16px;
        border: 1px solid var(--studio-line-strong);
        background: color-mix(in srgb, var(--studio-bg) 96%, transparent);
        backdrop-filter: blur(24px) saturate(1.15);
        -webkit-backdrop-filter: blur(24px) saturate(1.15);
        box-shadow: 0 26px 80px rgba(0,0,0,.48), 0 1px 0 rgba(255,255,255,.04) inset;
      }
      #${panelId}.open:not(.docked) .bsb-sidebar,
      #${panelId}.docked.dock-expanded .bsb-sidebar { display: grid; }

      #${panelId} .bsb-head {
        grid-column: 1 / -1;
        grid-row: 1;
        min-width: 0;
        padding: 8px 10px 8px 12px;
        border-bottom: 1px solid var(--studio-line);
        background: rgba(17,19,25,.88);
      }
      #${panelId} .bsb-head-title { flex-wrap: nowrap !important; gap: 9px !important; }
      #${panelId} .bsb-logo {
        width: 30px; height: 30px; border-radius: 9px;
        color: #111319;
        background: #d8d2ff;
        box-shadow: none;
        font-size: 13px;
      }
      #${panelId} .bsb-brand-stack { display:flex; min-width:0; align-items:baseline; gap:8px; }
      #${panelId} .bsb-head strong { font-size: 13px; font-weight: 720; letter-spacing: -.01em; }
      #${panelId} .bsb-head-context {
        color: var(--studio-muted); font-size: 11px; font-weight: 560;
        overflow:hidden; text-overflow:ellipsis; white-space:nowrap;
      }
      #${panelId} .bsb-ver {
        border:0 !important; padding:0 !important; background:transparent !important;
        color:var(--studio-faint) !important; font-size:9.5px !important;
      }
      #${panelId} .bsb-size-switch {
        height: 28px; padding: 2px; border-radius: 8px;
        border-color: var(--studio-line); background: #14171e;
      }
      #${panelId} .bsb-size-switch button {
        width: 23px; height:22px; border-radius:6px; color:var(--studio-faint); font-size:9px;
      }
      #${panelId} .bsb-size-switch button.active {
        color: var(--studio-text); background: var(--studio-hover); box-shadow:none;
      }
      #${panelId} .bsb-icon-btn {
        width: 28px; height:28px; border-radius:8px;
        border:1px solid transparent; background:transparent; color:var(--studio-muted);
      }
      #${panelId} .bsb-icon-btn:hover {
        color:var(--studio-text); border-color:var(--studio-line); background:var(--studio-hover);
      }

      #${panelId} .bsb-nav {
        grid-column: 1;
        grid-row: 2;
        min-width: 0;
        padding: 10px 7px 9px;
        border: 0;
        border-right: 1px solid var(--studio-line);
        background: #12151b;
        display:flex;
        flex-direction:column;
        justify-content:space-between;
        gap:10px;
      }
      #${panelId} .bsb-nav-primary,
      #${panelId} .bsb-nav-secondary { display:flex; flex-direction:column; gap:5px; }
      #${panelId} .bsb-nav button {
        flex:0 0 auto;
        width:50px; height:48px;
        padding:5px 3px 4px;
        border-radius:10px;
        display:flex; flex-direction:column; align-items:center; justify-content:center; gap:2px;
        color:var(--studio-muted); background:transparent; box-shadow:none;
      }
      #${panelId} .bsb-nav button:hover { color:var(--studio-text); background:var(--studio-hover); }
      #${panelId} .bsb-nav button.active {
        color:var(--studio-text);
        background:var(--studio-accent-soft);
        box-shadow: inset 2px 0 0 var(--studio-accent);
      }
      #${panelId} .bsb-nav-icon { font-size:17px; line-height:18px; font-weight:550; }
      #${panelId} .bsb-nav-label { font-size:9.5px; line-height:12px; font-weight:650; }

      #${panelId} .bsb-body {
        grid-column: 2;
        grid-row: 2;
        min-width:0; min-height:0;
        background:var(--studio-panel);
      }
      #${panelId} .bsb-view { padding:12px; gap:8px; }
      #${panelId} .bsb-view[data-view-panel="ai"] { padding:10px 12px 12px; gap:7px; }

      /* Contextual AI toolbar: phase first, controls second. */
      #${panelId} .bsb-ai-commandbar {
        min-height:42px;
        padding:0;
        border:0;
        background:transparent;
      }
      #${panelId} .bsb-ai-command-main { gap:10px; }
      #${panelId} .bsb-ai-stage-tabs {
        height:34px; padding:3px; gap:2px;
        border:1px solid var(--studio-line); border-radius:10px;
        background:#13161d;
      }
      #${panelId} .bsb-ai-stage-tabs .bsb-stage-connector { display:none; }
      #${panelId} .bsb-ai-stage-tabs button {
        min-width:105px; height:26px; padding:0 10px;
        border-radius:7px; border:0; background:transparent;
        display:flex; align-items:center; gap:6px; color:var(--studio-muted);
      }
      #${panelId} .bsb-ai-stage-tabs button.active {
        color:var(--studio-text); background:var(--studio-hover); box-shadow:none;
      }
      #${panelId} .bsb-ai-stage-tabs button small,
      #${panelId} .bsb-ai-stage-tabs .bsb-stage-index { display:none; }
      #${panelId} .bsb-ai-stage-tabs button strong { font-size:11.5px; font-weight:680; }
      #${panelId} .bsb-ai-compact-stats { opacity:.76; }
      #${panelId} .bsb-chip {
        border-color:var(--studio-line) !important; background:transparent !important;
        color:var(--studio-muted) !important; box-shadow:none !important;
      }
      #${panelId} .bsb-ai-command-actions .bsb-btn {
        height:31px; border-radius:9px; border-color:var(--studio-line);
        background:transparent; color:var(--studio-muted);
      }
      #${panelId} .bsb-ai-command-actions .bsb-btn:hover { color:var(--studio-text); background:var(--studio-hover); }
      #${panelId} .bsb-ai-command-actions .bsb-btn.accent {
        color:#111319; background:#d8d2ff; border-color:#d8d2ff; font-weight:720; box-shadow:none;
      }
      #${panelId} .bsb-ai-command-actions .bsb-btn.accent:hover { background:#e3dfff; }

      #${panelId} .bsb-preprocess-nav,
      #${panelId} .bsb-output-nav {
        border:1px solid var(--studio-line);
        border-radius:11px;
        background:#14171e;
        box-shadow:none;
      }
      #${panelId} .bsb-preprocess-tabs button,
      #${panelId} .bsb-output-tabs button,
      #${panelId} .bsb-model-tabs button {
        box-shadow:none !important;
      }
      #${panelId} .bsb-ai-canvas-wrap {
        border:1px solid var(--studio-line);
        background:#15181f;
        border-radius:13px;
        box-shadow:none;
      }
      #${panelId} .bsb-ai-canvas-bar {
        min-height:38px;
        border-bottom:1px solid var(--studio-line);
        background:#15181f;
      }
      #${panelId} .bsb-ai-md { padding-top:30px; }
      #${panelId} .bsb-ai-content { color:var(--studio-text); }

      /* Library: source list behaves like a stable product sidebar. */
      #${panelId} .bsb-library-topbar {
        gap:7px; padding:0; background:transparent; border:0;
      }
      #${panelId} .bsb-library-search,
      #${panelId} .bsb-config-search,
      #${panelId} .bsb-transcript-search {
        border-color:var(--studio-line) !important;
        background:#13161d !important;
        box-shadow:none !important;
      }
      #${panelId} .bsb-library-filterbar {
        border-color:var(--studio-line); background:#13161d;
      }
      #${panelId} .bsb-library-layout {
        gap:0;
        border:1px solid var(--studio-line);
        border-radius:13px;
        overflow:hidden;
        background:#14171e;
      }
      #${panelId} .bsb-library-master {
        border:0; border-right:1px solid var(--studio-line); border-radius:0; background:#12151b;
      }
      #${panelId} .bsb-library-detail { background:#171a21; }
      #${panelId} .bsb-transcript-shell { border:0; border-radius:0; background:transparent; }
      #${panelId} .bsb-library-master-foot {
        border-top:1px solid var(--studio-line); background:#12151b;
      }
      #${panelId} .bsb-library-master-foot button { border-radius:7px; }

      /* Settings: editor owns the page; category navigation stays compact. */
      #${panelId} .bsb-settings { gap:9px; }
      #${panelId} .bsb-settings-tabs {
        align-self:flex-start; width:auto; padding:3px;
        border:1px solid var(--studio-line); border-radius:10px; background:#13161d;
      }
      #${panelId} .bsb-settings-tabs button {
        min-width:82px; height:28px; border:0; border-radius:7px; background:transparent;
        color:var(--studio-muted); box-shadow:none;
      }
      #${panelId} .bsb-settings-tabs button.active { color:var(--studio-text); background:var(--studio-hover); }
      #${panelId} .bsb-prompt-stage-tabs {
        border-bottom:1px solid var(--studio-line); background:transparent;
      }
      #${panelId} .bsb-config-master-detail {
        border:1px solid var(--studio-line); border-radius:13px; overflow:hidden; background:#14171e;
      }
      #${panelId} .bsb-config-sidebar {
        border:0; border-right:1px solid var(--studio-line); border-radius:0; background:#12151b;
      }
      #${panelId} .bsb-config-editor-shell { background:#171a21; }

      /* Status is feedback, not permanent navigation. */
      #${panelId} .bsb-statusbar {
        position:absolute;
        right:12px; bottom:12px;
        z-index:20;
        width:auto; max-width:min(420px, calc(100% - 92px));
        min-height:32px; padding:7px 10px;
        border:1px solid var(--studio-line-strong);
        border-radius:10px;
        background:rgba(23,26,33,.94);
        box-shadow:0 10px 28px rgba(0,0,0,.28);
        backdrop-filter:blur(12px);
        pointer-events:none;
      }
      #${panelId} .bsb-status { overflow:hidden; text-overflow:ellipsis; white-space:nowrap; color:var(--studio-muted); }
      #${panelId} .bsb-status-dot { width:6px; height:6px; box-shadow:none !important; }

      /* Small shell keeps icons only; medium/large show labels. */
      #${panelId}[data-panel-size="small"] .bsb-sidebar { grid-template-columns:50px minmax(0,1fr); }
      #${panelId}[data-panel-size="small"] .bsb-nav { padding-inline:5px; }
      #${panelId}[data-panel-size="small"] .bsb-nav button { width:39px; height:40px; }
      #${panelId}[data-panel-size="small"] .bsb-nav-label { display:none; }
      #${panelId}[data-panel-size="small"] .bsb-ai-stage-tabs button { min-width:78px; padding-inline:8px; }
      #${panelId}[data-panel-size="small"] .bsb-brand-stack { gap:5px; }
      #${panelId}[data-panel-size="small"] .bsb-head-context { display:none; }

      /* v6.0.1 · shortcut center */
      #${panelId} .bsb-shortcut-settings { height:100%; min-height:0; overflow:auto; }
      #${panelId} .bsb-appearance-settings {
        height: 100%; min-height: 0; overflow: auto; padding: 14px 16px 18px;
      }
      #${panelId} .bsb-appearance-head {
        display: flex; flex-direction: column; gap: 4px; margin-bottom: 14px;
      }
      #${panelId} .bsb-appearance-head strong {
        font-size: 13.5px; color: var(--ctp-text); font-weight: 750;
      }
      #${panelId} .bsb-appearance-head span {
        font-size: 11px; color: var(--ctp-overlay1); line-height: 1.45;
      }
      #${panelId} .bsb-theme-grid {
        display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px;
      }
      #${panelId} .bsb-theme-card {
        display: grid; grid-template-columns: 52px minmax(0, 1fr); gap: 10px; align-items: center;
        width: 100%; text-align: left; cursor: pointer; padding: 10px 11px;
        border-radius: 12px; border: 1px solid color-mix(in srgb, var(--ctp-surface1) 55%, transparent);
        background: color-mix(in srgb, var(--ctp-base) 55%, transparent); color: var(--ctp-text);
        transition: border-color .15s ease, background .15s ease, transform .12s ease;
      }
      #${panelId} .bsb-theme-card:hover {
        border-color: color-mix(in srgb, var(--ctp-lavender) 42%, transparent);
        background: color-mix(in srgb, var(--ctp-surface0) 45%, transparent);
        transform: translateY(-1px);
      }
      #${panelId} .bsb-theme-card.selected {
        border-color: color-mix(in srgb, var(--ctp-lavender) 55%, transparent);
        background: color-mix(in srgb, var(--ctp-lavender) 12%, var(--ctp-surface0));
        box-shadow: 0 0 0 1px color-mix(in srgb, var(--ctp-lavender) 18%, transparent);
      }
      #${panelId} .bsb-theme-preview {
        width: 52px; height: 40px; border-radius: 10px; overflow: hidden; position: relative;
        border: 1px solid color-mix(in srgb, var(--p2) 70%, transparent);
        background:
          linear-gradient(135deg, var(--p0) 0 42%, transparent 42%),
          linear-gradient(225deg, var(--p1) 0 55%, transparent 55%),
          var(--p2);
        box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--tx) 8%, transparent);
      }
      #${panelId} .bsb-theme-preview i {
        position: absolute; width: 8px; height: 8px; border-radius: 50%;
        bottom: 6px; box-shadow: 0 0 0 1px color-mix(in srgb, var(--p0) 35%, transparent);
      }
      #${panelId} .bsb-theme-preview i:nth-child(1) { left: 7px; background: var(--a0); }
      #${panelId} .bsb-theme-preview i:nth-child(2) { left: 18px; background: var(--a1); }
      #${panelId} .bsb-theme-preview i:nth-child(3) { left: 29px; background: var(--a2); }
      #${panelId} .bsb-theme-meta { min-width: 0; display: grid; gap: 2px; }
      #${panelId} .bsb-theme-meta strong {
        display: block; font-size: 12px; font-weight: 750; color: var(--ctp-text);
        white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
      }
      #${panelId} .bsb-theme-meta small {
        display: block; font-size: 10.5px; color: var(--ctp-overlay1); line-height: 1.35;
      }
      @media (max-width: 720px) {
        #${panelId} .bsb-theme-grid { grid-template-columns: 1fr; }
      }
      #${panelId} .bsb-shortcut-page { display:flex; flex-direction:column; gap:10px; max-width:920px; padding:2px 0 14px; }
      #${panelId} .bsb-shortcut-hero {
        display:flex; align-items:flex-start; justify-content:space-between; gap:18px;
        padding:15px 16px; border:1px solid var(--studio-line); border-radius:13px;
        background:linear-gradient(135deg,rgba(137,180,250,.08),rgba(203,166,247,.035) 55%,rgba(23,26,33,.5));
      }
      #${panelId} .bsb-shortcut-kicker { display:block; margin-bottom:4px; color:var(--ctp-blue); font-size:9px; font-weight:850; letter-spacing:.16em; }
      #${panelId} .bsb-shortcut-hero h3 { margin:0; color:var(--studio-text); font-size:16px; line-height:1.35; }
      #${panelId} .bsb-shortcut-hero p { margin:5px 0 0; max-width:650px; color:var(--studio-muted); font-size:10.5px; line-height:1.55; }
      #${panelId} .bsb-shortcut-card { border:1px solid var(--studio-line); border-radius:13px; overflow:hidden; background:#14171e; }
      #${panelId} .bsb-shortcut-section-title { display:flex; align-items:baseline; gap:9px; padding:12px 14px 10px; border-bottom:1px solid var(--studio-line); background:#15181f; }
      #${panelId} .bsb-shortcut-section-title strong { color:var(--studio-text); font-size:12px; }
      #${panelId} .bsb-shortcut-section-title span { color:var(--studio-muted); font-size:9.5px; }
      #${panelId} .bsb-shortcut-prefs { display:grid; grid-template-columns:repeat(3,minmax(0,1fr)); gap:9px; padding:12px 14px 14px; }
      #${panelId} .bsb-shortcut-prefs > label { display:flex; flex-direction:column; gap:5px; min-width:0; color:var(--studio-muted); font-size:9.5px; }
      #${panelId} .bsb-shortcut-prefs .bsb-flow-select { width:100%; }
      #${panelId} .bsb-shortcut-list { display:flex; flex-direction:column; }
      #${panelId} .bsb-shortcut-row {
        display:grid; grid-template-columns:minmax(180px,1fr) minmax(230px,auto); gap:14px; align-items:center;
        padding:11px 14px; border-bottom:1px solid color-mix(in srgb,var(--studio-line) 72%,transparent);
      }
      #${panelId} .bsb-shortcut-row:last-child { border-bottom:0; }
      #${panelId} .bsb-shortcut-row:hover { background:rgba(255,255,255,.018); }
      #${panelId} .bsb-shortcut-copy { display:flex; flex-direction:column; gap:3px; min-width:0; }
      #${panelId} .bsb-shortcut-copy strong { color:var(--studio-text); font-size:11.5px; }
      #${panelId} .bsb-shortcut-copy span { color:var(--studio-muted); font-size:9.5px; line-height:1.42; }
      #${panelId} .bsb-shortcut-control { display:grid; grid-template-columns:minmax(150px,1fr) 30px; gap:6px; align-items:center; min-width:230px; }
      #${panelId} .bsb-shortcut-key {
        height:34px; min-width:150px; padding:0 10px; border:1px solid var(--studio-line-strong); border-radius:9px;
        background:#10131a; color:var(--studio-text); font:700 10.5px/1 ui-monospace,SFMono-Regular,Consolas,monospace;
        letter-spacing:.015em; cursor:pointer; box-shadow:inset 0 1px 0 rgba(255,255,255,.025); outline:none;
      }
      #${panelId} .bsb-shortcut-key:hover { border-color:color-mix(in srgb,var(--ctp-blue) 40%,var(--studio-line-strong)); background:#151a24; }
      #${panelId} .bsb-shortcut-key:focus-visible { border-color:var(--ctp-blue); box-shadow:0 0 0 3px rgba(137,180,250,.12); }
      #${panelId} .bsb-shortcut-key.recording { color:var(--ctp-blue); border-color:var(--ctp-blue); background:rgba(137,180,250,.08); animation:bsb-shortcut-pulse 1.1s ease-in-out infinite; }
      @keyframes bsb-shortcut-pulse { 50% { box-shadow:0 0 0 4px rgba(137,180,250,.08); } }
      #${panelId} .bsb-shortcut-reset { width:30px; height:30px; border:1px solid transparent; border-radius:8px; background:transparent; color:var(--studio-muted); cursor:pointer; }
      #${panelId} .bsb-shortcut-reset:hover { color:var(--studio-text); background:var(--studio-hover); border-color:var(--studio-line); }
      #${panelId} .bsb-shortcut-state { grid-column:1 / -1; justify-self:end; min-height:13px; color:var(--studio-muted); font-size:8.8px; }
      #${panelId} .bsb-shortcut-state.ok { color:var(--ctp-green); }
      #${panelId} .bsb-shortcut-state.warn { color:var(--ctp-yellow); }
      #${panelId} .bsb-shortcut-state.error { color:var(--ctp-red); }
      #${panelId} .bsb-shortcut-state.off { color:var(--ctp-overlay0); }
      #${panelId} .bsb-shortcut-foot { display:flex; align-items:center; justify-content:space-between; gap:10px; padding:10px 14px; border-top:1px solid var(--studio-line); color:var(--studio-muted); font-size:9px; background:#12151b; }
      #${panelId}[data-panel-size="small"] .bsb-shortcut-prefs { grid-template-columns:1fr; }
      #${panelId}[data-panel-size="small"] .bsb-shortcut-row { grid-template-columns:1fr; gap:8px; }
      #${panelId}[data-panel-size="small"] .bsb-shortcut-control { width:100%; min-width:0; }
      #${panelId}[data-panel-size="small"] .bsb-shortcut-foot { align-items:flex-start; flex-direction:column; }

      /* Focus mode: rail and chrome leave, content becomes a clean reading surface. */
      #${panelId}.ai-focus .bsb-sidebar {
        display:grid !important;
        grid-template-columns:minmax(0,1fr) !important;
        grid-template-rows:minmax(0,1fr) !important;
      }
      #${panelId}.ai-focus .bsb-body { grid-column:1; grid-row:1; }
      #${panelId}.ai-focus .bsb-head,
      #${panelId}.ai-focus .bsb-nav,
      #${panelId}.ai-focus .bsb-statusbar { display:none !important; }
`;
}
