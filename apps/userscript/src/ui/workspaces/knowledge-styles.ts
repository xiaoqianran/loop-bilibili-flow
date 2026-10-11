/** Legacy-preserving workspace CSS; original cascade order retained. */
export function renderKnowledgeDrilldownStyles(panelId: string): string {
  return `
      /* v6 Knowledge Drill-down */
      #${panelId} .bsb-selection-toolbar {
        pointer-events:auto;
        position:fixed; z-index:2147483646; width:300px; box-sizing:border-box;
        padding:6px; border-radius:13px; border:1px solid color-mix(in srgb,var(--ctp-mauve) 32%,var(--ctp-surface1));
        background:color-mix(in srgb,var(--ctp-base) 96%,transparent); box-shadow:0 16px 40px rgba(0,0,0,.42);
        backdrop-filter:blur(14px) saturate(1.15); -webkit-backdrop-filter:blur(14px) saturate(1.15);
      }
      #${panelId} .bsb-selection-toolbar-text { display:block; padding:3px 7px 6px; color:var(--ctp-overlay1); font-size:9.5px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
      #${panelId} .bsb-selection-toolbar-actions { display:grid; grid-template-columns:repeat(4,1fr); gap:4px; }
      #${panelId} .bsb-selection-toolbar-actions button { border:0; border-radius:8px; padding:7px 4px; background:transparent; color:var(--ctp-subtext1); cursor:pointer; font-size:10px; font-weight:720; }
      #${panelId} .bsb-selection-toolbar-actions button:hover { background:var(--ctp-surface0); color:var(--ctp-text); }
      #${panelId} .bsb-selection-toolbar-actions button:first-child { color:var(--ctp-mauve); background:color-mix(in srgb,var(--ctp-mauve) 10%,transparent); }
      #${panelId} .bsb-knowledge-anchor-mark { padding:0 .08em; border-radius:4px; background:color-mix(in srgb,var(--ctp-mauve) 17%,transparent); color:inherit; text-decoration:underline; text-decoration-color:color-mix(in srgb,var(--ctp-mauve) 72%,transparent); text-decoration-thickness:1.5px; text-underline-offset:3px; cursor:pointer; }
      #${panelId} .bsb-knowledge-anchor-mark:hover { background:color-mix(in srgb,var(--ctp-mauve) 28%,transparent); }
      #${panelId} .bsb-preprocess-block.has-knowledge::after { content:""; position:absolute; top:11px; right:10px; width:6px; height:6px; border-radius:50%; background:var(--ctp-mauve); box-shadow:0 0 10px color-mix(in srgb,var(--ctp-mauve) 55%,transparent); }

      #${panelId} .bsb-knowledge-rail {
        position:absolute; z-index:43; top:0; right:0; bottom:0; width:var(--bsb-knowledge-rail-w,400px); max-width:calc(100% - 36px); transform:translateX(102%);
        display:flex; flex-direction:column; overflow:hidden; border-left:1px solid color-mix(in srgb,var(--ctp-mauve) 22%,var(--ctp-surface0));
        background:color-mix(in srgb,var(--ctp-base) 97%,transparent); box-shadow:-18px 0 42px rgba(0,0,0,.30); transition:transform .19s ease;
      }
      #${panelId} .bsb-knowledge-rail.open { transform:translateX(0); }
      #${panelId} .bsb-knowledge-rail.resizing { transition:none; user-select:none; }
      #${panelId} .bsb-knowledge-rail-resize {
        position:absolute; z-index:5; left:0; top:0; bottom:0; width:8px; cursor:col-resize;
        background:linear-gradient(90deg,transparent,color-mix(in srgb,var(--ctp-mauve) 18%,transparent));
      }
      #${panelId} .bsb-knowledge-rail-resize:hover,
      #${panelId} .bsb-knowledge-rail.resizing .bsb-knowledge-rail-resize { background:color-mix(in srgb,var(--ctp-mauve) 36%,transparent); }
      #${panelId} [data-view-panel="ai"].knowledge-open .bsb-ai-commandbar,
      #${panelId} [data-view-panel="ai"].knowledge-open .bsb-preprocess-nav,
      #${panelId} [data-view-panel="ai"].knowledge-open .bsb-output-nav,
      #${panelId} [data-view-panel="ai"].knowledge-open .bsb-ai-canvas-wrap { margin-right:var(--bsb-knowledge-rail-w,400px); }
      #${panelId} .bsb-knowledge-rail-head { flex:0 0 auto; display:flex; align-items:flex-start; gap:10px; padding:13px 12px 11px 14px; border-bottom:1px solid var(--ctp-surface0); background:linear-gradient(180deg,color-mix(in srgb,var(--ctp-mauve) 7%,transparent),transparent); }
      #${panelId} .bsb-knowledge-anchor-title { flex:1 1 auto; min-width:0; }
      #${panelId} .bsb-knowledge-kicker { display:block; color:var(--ctp-overlay1); font-size:8px; font-weight:900; letter-spacing:.12em; text-transform:uppercase; }
      #${panelId} .bsb-knowledge-anchor-title strong { display:block; margin-top:3px; color:var(--ctp-text); font-size:14px; line-height:1.35; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
      #${panelId} .bsb-knowledge-anchor-title small { display:block; margin-top:3px; color:var(--ctp-overlay1); font-size:9.5px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
      #${panelId} .bsb-knowledge-rail-actions { display:flex; gap:3px; }
      #${panelId} .bsb-knowledge-rail-actions .active { color:var(--ctp-mauve); background:color-mix(in srgb,var(--ctp-mauve) 12%,var(--ctp-surface0)); }
      #${panelId} .bsb-knowledge-rail-body { flex:1 1 auto; min-height:0; display:flex; flex-direction:column; }
      #${panelId} .bsb-knowledge-evidence {
        flex:0 0 auto; position:relative; padding:6px 14px 8px; border-bottom:1px solid color-mix(in srgb,var(--ctp-surface0) 80%,transparent);
      }
      #${panelId} .bsb-knowledge-evidence-chip {
        max-width:100%; display:inline-flex; align-items:center; gap:6px; border:1px solid color-mix(in srgb,var(--ctp-mauve) 28%,var(--ctp-surface1));
        border-radius:999px; padding:5px 10px; background:color-mix(in srgb,var(--ctp-mauve) 8%,var(--ctp-mantle));
        color:var(--ctp-subtext1); cursor:pointer; font-size:10.5px; line-height:1.3; text-align:left;
      }
      #${panelId} .bsb-knowledge-evidence-chip:hover { color:var(--ctp-text); border-color:color-mix(in srgb,var(--ctp-mauve) 48%,var(--ctp-surface1)); }
      #${panelId} .bsb-knowledge-evidence-chip strong { color:var(--ctp-mauve); font-weight:780; }
      #${panelId} .bsb-knowledge-evidence-chip em { font-style:normal; color:var(--ctp-text); max-width:min(42ch,52vw); overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
      #${panelId} .bsb-knowledge-evidence-chip span.action { color:var(--ctp-overlay1); white-space:nowrap; }
      #${panelId} .bsb-knowledge-evidence-panel {
        position:absolute; z-index:8; left:14px; right:14px; top:calc(100% - 2px); max-height:220px; overflow:auto;
        border:1px solid color-mix(in srgb,var(--ctp-mauve) 24%,var(--ctp-surface1)); border-radius:12px;
        background:color-mix(in srgb,var(--ctp-base) 98%,transparent); box-shadow:0 14px 36px rgba(0,0,0,.34);
        padding:10px 12px; display:flex; flex-direction:column; gap:8px;
      }
      #${panelId} .bsb-knowledge-evidence-panel[hidden] { display:none !important; }
      #${panelId} .bsb-knowledge-evidence-panel strong { display:block; margin-bottom:3px; color:var(--ctp-mauve); font-size:9px; letter-spacing:.08em; text-transform:uppercase; }
      #${panelId} .bsb-knowledge-evidence-panel pre {
        margin:0; white-space:pre-wrap; overflow-wrap:anywhere; color:var(--ctp-subtext1);
        font:500 11px/1.55 ui-sans-serif,system-ui,sans-serif;
      }
      #${panelId} .bsb-knowledge-rail-split {
        flex:1 1 auto; min-height:0; display:grid; grid-template-columns:minmax(0,1fr); overflow:hidden;
      }
      #${panelId} .bsb-knowledge-rail-split.with-tree {
        grid-template-columns:minmax(110px,36%) minmax(0,1fr);
      }
      #${panelId} .bsb-knowledge-split-main { min-width:0; min-height:0; display:flex; flex-direction:column; overflow:hidden; }
      #${panelId} .bsb-knowledge-splitter {
        flex:0 0 auto; width:5px; cursor:col-resize; background:color-mix(in srgb,var(--ctp-surface0) 80%,transparent);
        border:0; padding:0; position:relative;
      }
      #${panelId} .bsb-knowledge-splitter::after {
        content:""; position:absolute; inset:12% 1px; border-radius:99px;
        background:color-mix(in srgb,var(--ctp-overlay0) 45%,transparent);
      }
      #${panelId} .bsb-knowledge-splitter:hover::after,
      #${panelId}.knowledge-resizing .bsb-knowledge-splitter::after { background:var(--ctp-mauve); }
      #${panelId} .bsb-knowledge-pane-head {
        flex:0 0 auto; display:flex; align-items:center; justify-content:space-between; gap:6px; padding:6px 8px 4px;
      }
      #${panelId} .bsb-knowledge-crumbs { flex:0 0 auto; min-height:28px; display:flex; align-items:center; gap:4px; overflow-x:auto; padding:5px 12px; border-bottom:1px solid color-mix(in srgb,var(--ctp-surface0) 75%,transparent); scrollbar-width:none; }
      #${panelId} .bsb-knowledge-crumbs button { flex:0 0 auto; max-width:145px; border:0; background:transparent; color:var(--ctp-overlay1); cursor:pointer; font-size:9px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; padding:2px 3px; }
      #${panelId} .bsb-knowledge-crumbs button:last-of-type { color:var(--ctp-subtext1); }
      #${panelId} .bsb-knowledge-crumbs span { color:var(--ctp-surface2); }
      #${panelId} .bsb-knowledge-panel-main { flex:1 1 auto; min-height:0; overflow:auto; padding:14px 16px 18px; }
      #${panelId} .bsb-knowledge-question-meta { display:flex; align-items:center; justify-content:space-between; gap:8px; }
      #${panelId} .bsb-knowledge-question-meta > span { color:var(--ctp-overlay1); font-size:8.5px; font-weight:850; letter-spacing:.08em; }
      #${panelId} .bsb-knowledge-node-star { width:28px; height:28px; display:grid; place-items:center; border:0; border-radius:8px; background:transparent; color:var(--ctp-overlay1); cursor:pointer; font-size:15px; line-height:1; }
      #${panelId} .bsb-knowledge-node-star:hover { background:var(--ctp-surface0); color:var(--ctp-yellow); }
      #${panelId} .bsb-knowledge-node-star.active { color:var(--ctp-yellow); background:color-mix(in srgb,var(--ctp-yellow) 9%,transparent); }
      #${panelId} .bsb-knowledge-question-card {
        --bsb-block-accent: var(--ctp-mauve);
        position:relative; overflow:hidden; margin:0 0 12px auto; max-width:min(92%, 36em);
        padding:12px 16px 13px 14px; border-radius:13px;
        border:1px solid color-mix(in srgb,var(--ctp-mauve) 22%,var(--ctp-surface0));
        background:
          linear-gradient(255deg,color-mix(in srgb,var(--ctp-mauve) 8%,transparent),transparent 40%),
          color-mix(in srgb,var(--ctp-mantle) 70%,transparent);
        box-shadow:0 4px 16px color-mix(in srgb,var(--ctp-crust) 15%,transparent);
      }
      #${panelId} .bsb-knowledge-question-card::before {
        content:""; position:absolute; inset:9px 0 9px auto; width:3px; border-radius:999px 0 0 999px;
        background:var(--ctp-mauve); opacity:.8;
      }
      #${panelId} .bsb-knowledge-question h3 { margin:5px 0 0; color:var(--ctp-text); font-size:var(--bsb-knowledge-font); line-height:1.5; font-weight:760; }
      #${panelId} .bsb-knowledge-answer { color:var(--ctp-text); }
      #${panelId} .bsb-knowledge-answer-reading {
        display:flex; flex-direction:column; gap:10px;
      }
      #${panelId} .bsb-knowledge-answer-card.bsb-preprocess-block {
        /* reuse preprocess card chrome; accent cycles via nth-of-type */
      }
      #${panelId} .bsb-knowledge-card-body {
        white-space:normal;
        color:color-mix(in srgb,var(--ctp-text) 94%,var(--ctp-subtext1));
        font-size:var(--bsb-knowledge-font); line-height:1.7; letter-spacing:.01em;
        overflow-wrap:anywhere; text-wrap:pretty;
      }
      #${panelId} .bsb-knowledge-card-body h1,
      #${panelId} .bsb-knowledge-card-body h2,
      #${panelId} .bsb-knowledge-card-body h3,
      #${panelId} .bsb-knowledge-card-body h4 {
        margin:.75em 0 .35em; color:var(--ctp-lavender); font-size:var(--bsb-knowledge-font);
        font-weight:760; line-height:1.4;
      }
      #${panelId} .bsb-knowledge-card-body > *:first-child { margin-top:0; }
      #${panelId} .bsb-knowledge-card-body > *:last-child { margin-bottom:0; }
      #${panelId} .bsb-knowledge-card-body p { margin:0 0 .7em; }
      #${panelId} .bsb-knowledge-card-body ul,
      #${panelId} .bsb-knowledge-card-body ol { margin:.35em 0 .7em; padding-left:1.25em; }
      #${panelId} .bsb-knowledge-card-body li { margin:.2em 0; }
      #${panelId} .bsb-knowledge-card-body strong {
        color:color-mix(in srgb,var(--ctp-rosewater) 88%,var(--ctp-text));
        font-weight:800;
      }
      /* ==核心记忆点== ：荧光笔只划文字下半，高度/颜色受控错落，文字 baseline 不乱 */
      #${panelId} .bsb-md-highlight {
        --bsb-hl-color:color-mix(in srgb,var(--ctp-mauve) 38%,transparent);
        --bsb-hl-start:58%;
        --bsb-hl-end:94%;
        color:inherit;
        font-weight:760;
        padding:0 .07em;
        margin:0 .015em;
        border-radius:.18em;
        background:linear-gradient(
          180deg,
          transparent 0,
          transparent var(--bsb-hl-start),
          var(--bsb-hl-color) var(--bsb-hl-start),
          var(--bsb-hl-color) var(--bsb-hl-end),
          transparent var(--bsb-hl-end)
        );
        -webkit-box-decoration-break:clone;
        box-decoration-break:clone;
      }
      #${panelId} .bsb-md-highlight-0 {
        --bsb-hl-color:color-mix(in srgb,var(--ctp-mauve) 38%,transparent);
        --bsb-hl-start:61%;
        --bsb-hl-end:96%;
      }
      #${panelId} .bsb-md-highlight-1 {
        --bsb-hl-color:color-mix(in srgb,var(--ctp-teal) 31%,transparent);
        --bsb-hl-start:52%;
        --bsb-hl-end:89%;
      }
      #${panelId} .bsb-md-highlight-2 {
        --bsb-hl-color:color-mix(in srgb,var(--ctp-peach) 29%,transparent);
        --bsb-hl-start:64%;
        --bsb-hl-end:93%;
      }
      #${panelId} .bsb-md-highlight-3 {
        --bsb-hl-color:color-mix(in srgb,var(--ctp-lavender) 30%,transparent);
        --bsb-hl-start:56%;
        --bsb-hl-end:92%;
      }
      #${panelId} .bsb-knowledge-card-body code {
        font:650 .9em/1.4 ui-monospace,SFMono-Regular,Consolas,monospace;
        padding:.08em .35em; border-radius:5px;
        background:color-mix(in srgb,var(--bsb-block-accent) 10%,var(--ctp-surface0));
      }
      #${panelId} .bsb-knowledge-card-body pre {
        margin:.5em 0 .8em; padding:10px 12px; border-radius:10px; overflow:auto;
        background:color-mix(in srgb,var(--ctp-crust) 35%,var(--ctp-mantle));
        border:1px solid color-mix(in srgb,var(--ctp-surface1) 70%,transparent);
      }
      #${panelId} .bsb-knowledge-card-body pre code { padding:0; background:transparent; }
      #${panelId} .bsb-knowledge-card-body .bsb-katex-display,
      #${panelId} .bsb-knowledge-answer .bsb-katex-display {
        display:block; overflow-x:auto; overflow-y:hidden; margin:.65em 0 .85em; padding:.35em 0;
        text-align:center;
      }
      #${panelId} .bsb-knowledge-card-body .bsb-katex-inline,
      #${panelId} .bsb-knowledge-answer .bsb-katex-inline {
        display:inline-block; max-width:100%; overflow-x:auto; vertical-align:middle;
      }
      #${panelId} .bsb-knowledge-card-body .katex,
      #${panelId} .bsb-knowledge-answer .katex { font-size:1.05em; }
      #${panelId} .bsb-knowledge-card-body .bsb-math-fallback {
        white-space:pre-wrap; color:var(--ctp-subtext1); font-family:ui-monospace,Consolas,monospace;
      }
      #${panelId} .bsb-knowledge-card-body blockquote {
        margin:.5em 0 .8em; padding:.2em 0 .2em .9em;
        border-left:3px solid color-mix(in srgb,var(--bsb-block-accent) 55%,transparent);
        color:var(--ctp-subtext1);
      }
      #${panelId} .bsb-knowledge-answer.streaming .bsb-knowledge-answer-card:last-of-type .bsb-knowledge-card-body::after {
        content:""; display:inline-block; width:7px; height:13px; margin-left:4px; vertical-align:-2px;
        border-radius:2px; background:var(--ctp-mauve); animation:bsb-pulse 1s ease-in-out infinite;
      }
      #${panelId} .bsb-knowledge-thinking {
        color:var(--ctp-overlay1); padding:18px 14px; border-radius:13px;
        border:1px dashed color-mix(in srgb,var(--ctp-surface2) 55%,transparent);
        background:color-mix(in srgb,var(--ctp-mantle) 55%,transparent); font-size:12px; line-height:1.55;
      }
      #${panelId} .bsb-knowledge-suggestions {
        margin-top:14px; padding:12px 12px 10px; border-radius:13px;
        border:1px solid color-mix(in srgb,var(--ctp-mauve) 14%,var(--ctp-surface0));
        background:color-mix(in srgb,var(--ctp-mantle) 58%,transparent);
      }
      #${panelId} .bsb-knowledge-suggestions .bsb-knowledge-kicker { display:block; margin-bottom:6px; }
      #${panelId} .bsb-knowledge-suggestions button {
        width:100%; display:flex; gap:7px; align-items:flex-start; border:0; border-radius:9px;
        padding:8px 7px; background:transparent; color:var(--ctp-subtext1); cursor:pointer;
        text-align:left; line-height:1.45; font-size:11px;
      }
      #${panelId} .bsb-knowledge-suggestions button:hover { background:var(--ctp-surface0); color:var(--ctp-text); }
      #${panelId} .bsb-knowledge-suggestions button span { color:var(--ctp-mauve); flex:0 0 auto; }
      #${panelId} .bsb-knowledge-composer {
        flex:0 0 auto; padding:10px 14px 12px; border-top:1px solid var(--ctp-surface0);
        background:color-mix(in srgb,var(--ctp-mantle) 88%,transparent); backdrop-filter:blur(10px);
      }
      #${panelId} .bsb-knowledge-composer-box {
        display:flex; flex-direction:column; gap:6px; border:1px solid var(--ctp-surface1); border-radius:14px;
        background:var(--ctp-base); padding:8px 10px 8px; box-shadow:0 1px 0 color-mix(in srgb,var(--ctp-surface0) 55%,transparent);
      }
      #${panelId} .bsb-knowledge-composer-box:focus-within {
        border-color:color-mix(in srgb,var(--ctp-mauve) 55%,var(--ctp-surface1));
        box-shadow:0 0 0 3px color-mix(in srgb,var(--ctp-mauve) 10%,transparent);
      }
      #${panelId} .bsb-knowledge-composer textarea {
        width:100%; min-height:44px; max-height:120px; resize:none; box-sizing:border-box; border:0; padding:4px 2px;
        background:transparent; color:var(--ctp-text); outline:none; font:inherit;
        font-size:var(--bsb-knowledge-font); line-height:1.5;
      }
      #${panelId} .bsb-knowledge-composer-tools { display:flex; align-items:center; justify-content:space-between; gap:8px; }
      #${panelId} .bsb-knowledge-model-select {
        min-width:0; max-width:min(220px,48%); height:28px; border:0; border-radius:8px; background:var(--ctp-mantle);
        color:var(--ctp-overlay1); padding:0 24px 0 8px; outline:none; font-size:10px;
      }
      #${panelId} .bsb-knowledge-composer-tools .bsb-btn { min-width:72px; height:30px; border-radius:9px; }
      #${panelId} .bsb-knowledge-welcome { min-height:220px; display:flex; flex-direction:column; align-items:center; justify-content:center; text-align:center; color:var(--ctp-overlay1); }
      #${panelId} .bsb-knowledge-welcome strong { color:var(--ctp-text); margin-top:8px; font-size:14px; }
      #${panelId} .bsb-knowledge-welcome span { max-width:260px; margin-top:6px; font-size:10px; line-height:1.55; }
      #${panelId} .bsb-knowledge-welcome button { margin-top:14px; border:1px solid color-mix(in srgb,var(--ctp-mauve) 30%,var(--ctp-surface1)); border-radius:9px; padding:7px 11px; background:color-mix(in srgb,var(--ctp-mauve) 10%,transparent); color:var(--ctp-mauve); cursor:pointer; }
      #${panelId} .bsb-knowledge-orb { width:36px; height:36px; display:grid; place-items:center; border-radius:12px; background:color-mix(in srgb,var(--ctp-mauve) 14%,var(--ctp-surface0)); color:var(--ctp-mauve); font-size:17px; }
      #${panelId} .bsb-knowledge-tree { display:flex; flex-direction:column; gap:2px; }
      #${panelId} .bsb-knowledge-tree-node > button { width:100%; display:grid; grid-template-columns:14px minmax(0,1fr) auto; gap:5px; align-items:start; padding:6px 7px 6px calc(7px + var(--depth) * 13px); border:1px solid transparent; border-radius:8px; background:transparent; color:var(--ctp-subtext0); cursor:pointer; text-align:left; font-size:10px; line-height:1.35; }
      #${panelId} .bsb-knowledge-tree-node > button:hover { background:var(--ctp-surface0); color:var(--ctp-text); }
      #${panelId} .bsb-knowledge-tree-node > button.active { border-color:color-mix(in srgb,var(--ctp-mauve) 28%,transparent); background:color-mix(in srgb,var(--ctp-mauve) 9%,var(--ctp-surface0)); color:var(--ctp-text); }
      #${panelId} .bsb-knowledge-tree-branch { color:var(--ctp-overlay0); }
      #${panelId} .bsb-knowledge-star { color:var(--ctp-yellow); font-size:9px; }
      #${panelId} .bsb-knowledge-empty-small { padding:12px; color:var(--ctp-overlay1); font-size:10px; text-align:center; }
      #${panelId} .bsb-knowledge-rail-empty { height:100%; display:flex; flex-direction:column; align-items:center; justify-content:center; gap:7px; padding:24px; color:var(--ctp-overlay1); text-align:center; }
      #${panelId} .bsb-knowledge-rail-empty > span { color:var(--ctp-mauve); font-size:26px; }
      #${panelId} .bsb-knowledge-rail-empty strong { color:var(--ctp-text); font-size:15px; }
      #${panelId} .bsb-knowledge-rail-empty p { max-width:260px; font-size:10.5px; line-height:1.55; }

`;
}
