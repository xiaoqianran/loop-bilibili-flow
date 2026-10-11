/** AI reading and rich output CSS in original cascade position. */
export function renderReadingStyles(panelId: string): string {
  return `
      /* v5.8 AI Workbench：主界面展示产物，不展示执行参数 */
      #${panelId} [data-view-panel="ai"] { position: relative; overflow: hidden; }
      #${panelId} .bsb-workbench-commandbar { gap: 10px; }
      #${panelId} .bsb-workbench-context { display:flex; align-items:center; gap:6px; min-width:0; }
      #${panelId} .bsb-context-button {
        display:flex; flex-direction:column; align-items:flex-start; gap:1px; min-width:0; max-width:220px;
        padding:5px 8px; border-radius:9px; border:1px solid transparent; background:transparent;
        color:var(--ctp-text); cursor:pointer; text-align:left;
      }
      #${panelId} .bsb-context-button:hover { background:var(--ctp-surface0); border-color:var(--ctp-surface1); }
      #${panelId} .bsb-context-button strong { max-width:100%; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; font-size:11.5px; }
      #${panelId} .bsb-context-kicker { color:var(--ctp-overlay1); font-size:8.5px; font-weight:900; letter-spacing:.08em; }
      #${panelId} .bsb-workbench-arrow { color:var(--ctp-overlay0); font-weight:900; }
      #${panelId} .bsb-ai-stage-tabs { display:flex; align-items:center; gap:6px; min-width:0; }
      #${panelId} .bsb-ai-stage-tabs > button { display:flex; align-items:center; gap:7px; min-width:118px; padding:6px 10px; border:1px solid var(--ctp-surface1); border-radius:10px; background:color-mix(in srgb,var(--ctp-base) 62%,transparent); color:var(--ctp-subtext0); cursor:pointer; text-align:left; }
      #${panelId} .bsb-ai-stage-tabs > button:hover { border-color:var(--ctp-overlay0); color:var(--ctp-text); }
      #${panelId} .bsb-ai-stage-tabs > button.active { border-color:color-mix(in srgb,var(--ctp-mauve) 62%,var(--ctp-surface1)); background:color-mix(in srgb,var(--ctp-mauve) 13%,var(--ctp-base)); color:var(--ctp-text); box-shadow:inset 0 -2px 0 var(--ctp-mauve); }
      #${panelId} .bsb-ai-stage-tabs strong { display:block; font-size:11.5px; line-height:1.2; }
      #${panelId} .bsb-ai-stage-tabs small { display:block; margin-top:2px; font-size:9px; color:var(--ctp-overlay1); white-space:nowrap; }
      #${panelId} .bsb-stage-index { width:20px; height:20px; border-radius:7px; display:grid; place-items:center; flex:0 0 auto; background:var(--ctp-surface0); color:var(--ctp-overlay1); font-size:9.5px; font-weight:850; }
      #${panelId} .bsb-ai-stage-tabs > button.active .bsb-stage-index { background:var(--ctp-mauve); color:var(--ctp-crust); }
      #${panelId} .bsb-stage-connector { color:var(--ctp-overlay0); font-size:14px; }
      #${panelId} .bsb-preprocess-nav { flex:0 0 auto; display:flex; align-items:center; justify-content:space-between; gap:10px; padding:5px 8px; border-bottom:1px solid var(--ctp-surface0); background:color-mix(in srgb,var(--ctp-mantle) 78%,transparent); }
      #${panelId} .bsb-preprocess-tabs { display:flex; gap:4px; min-width:0; }
      #${panelId} .bsb-preprocess-tabs button { display:inline-flex; align-items:center; gap:6px; padding:6px 10px; border:0; border-radius:8px; background:transparent; color:var(--ctp-subtext0); cursor:pointer; font-size:10.5px; font-weight:750; }
      #${panelId} .bsb-preprocess-tabs button:hover { background:var(--ctp-surface0); color:var(--ctp-text); }
      #${panelId} .bsb-preprocess-tabs button.active { background:var(--ctp-surface0); color:var(--ctp-text); box-shadow:inset 0 -2px 0 var(--ctp-sapphire); }
      #${panelId} .bsb-preprocess-tabs .dot { width:7px; height:7px; border-radius:50%; background:var(--ctp-overlay0); }
      #${panelId} .bsb-preprocess-tabs .dot.raw { background:var(--ctp-blue); }
      #${panelId} .bsb-preprocess-tabs .dot.processed { background:var(--ctp-green); }
      #${panelId} .bsb-preprocess-status { color:var(--ctp-overlay1); font-size:9.5px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
      #${panelId} .bsb-main-input-preview { margin:0; min-height:100%; white-space:pre-wrap; word-break:break-word; color:var(--ctp-text); background:transparent; border:0; padding:2px 0 24px; font:inherit; line-height:1.8; }

      /* v5.10.2 · 规范化字幕阅读卡片：让“处理后的字幕”具有明显的学习材料层级 */
      #${panelId} .bsb-preprocess-reading {
        --bsb-block-accent: var(--ctp-green);
        display:grid; gap:13px; padding:2px 0 34px;
      }
      #${panelId} .bsb-preprocess-source {
        display:flex; align-items:center; gap:9px; min-width:0;
        margin:3px 0 2px; padding:9px 11px; border-radius:11px;
        border:1px solid color-mix(in srgb,var(--ctp-teal) 22%,var(--ctp-surface0));
        background:linear-gradient(135deg,color-mix(in srgb,var(--ctp-teal) 9%,transparent),color-mix(in srgb,var(--ctp-base) 72%,transparent));
        color:var(--ctp-subtext1);
      }
      #${panelId} .bsb-preprocess-source-mark {
        width:25px; height:25px; flex:0 0 auto; display:grid; place-items:center;
        border-radius:8px; background:color-mix(in srgb,var(--ctp-teal) 16%,var(--ctp-surface0));
        color:var(--ctp-teal); font-size:11px; font-weight:900;
      }
      #${panelId} .bsb-preprocess-source-text { min-width:0; }
      #${panelId} .bsb-preprocess-source-text strong {
        display:block; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;
        color:var(--ctp-text); font-size:11.5px; font-weight:820;
      }
      #${panelId} .bsb-preprocess-source-text span { display:block; margin-top:1px; color:var(--ctp-overlay1); font-size:9.5px; }
      #${panelId} .bsb-preprocess-section-title {
        display:flex; align-items:center; gap:9px; margin:9px 2px 0;
        color:var(--ctp-subtext1); font-size:11.5px; font-weight:820; letter-spacing:.015em;
      }
      #${panelId} .bsb-preprocess-section-title::before {
        content:""; width:4px; height:14px; border-radius:999px;
        background:linear-gradient(180deg,var(--ctp-green),var(--ctp-teal));
        box-shadow:0 0 14px color-mix(in srgb,var(--ctp-green) 30%,transparent);
      }
      #${panelId} .bsb-preprocess-block {
        --bsb-block-accent: var(--ctp-green);
        position:relative; overflow:hidden; padding:12px 14px 13px 16px; border-radius:13px;
        border:1px solid color-mix(in srgb,var(--bsb-block-accent) 15%,var(--ctp-surface0));
        background:
          linear-gradient(105deg,color-mix(in srgb,var(--bsb-block-accent) 5.5%,transparent),transparent 36%),
          color-mix(in srgb,var(--ctp-mantle) 62%,transparent);
        box-shadow:0 4px 16px color-mix(in srgb,var(--ctp-crust) 15%,transparent);
        transition:border-color .16s ease, background .16s ease, transform .16s ease, box-shadow .16s ease;
      }
      #${panelId} .bsb-preprocess-block::before {
        content:""; position:absolute; inset:9px auto 9px 0; width:3px; border-radius:0 999px 999px 0;
        background:var(--bsb-block-accent); opacity:.7;
      }
      #${panelId} .bsb-preprocess-block:nth-of-type(4n+1) { --bsb-block-accent:var(--ctp-green); }
      #${panelId} .bsb-preprocess-block:nth-of-type(4n+2) { --bsb-block-accent:var(--ctp-teal); }
      #${panelId} .bsb-preprocess-block:nth-of-type(4n+3) { --bsb-block-accent:var(--ctp-blue); }
      #${panelId} .bsb-preprocess-block:nth-of-type(4n+4) { --bsb-block-accent:var(--ctp-lavender); }
      #${panelId} .bsb-preprocess-block:hover {
        transform:translateY(-1px);
        border-color:color-mix(in srgb,var(--bsb-block-accent) 30%,var(--ctp-surface1));
        background:
          linear-gradient(105deg,color-mix(in srgb,var(--bsb-block-accent) 9%,transparent),transparent 42%),
          color-mix(in srgb,var(--ctp-mantle) 76%,transparent);
        box-shadow:0 8px 24px color-mix(in srgb,var(--ctp-crust) 22%,transparent);
      }
      #${panelId} .bsb-preprocess-block-head {
        display:flex; align-items:center; gap:7px; min-height:22px; margin-bottom:7px;
      }
      #${panelId} .bsb-preprocess-block-index {
        display:inline-grid; place-items:center; min-width:23px; height:20px; padding:0 5px; box-sizing:border-box;
        border-radius:7px; background:color-mix(in srgb,var(--bsb-block-accent) 13%,var(--ctp-surface0));
        color:color-mix(in srgb,var(--bsb-block-accent) 88%,white 5%); font:800 9px/1 ui-monospace,monospace;
      }
      #${panelId} .bsb-preprocess-block-topic {
        min-width:0; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;
        color:var(--ctp-overlay1); font-size:9.5px; font-weight:650;
      }
      #${panelId} .bsb-preprocess-block-time {
        margin-left:auto; flex:0 0 auto; display:inline-flex; align-items:center; gap:5px;
      }
      #${panelId} .bsb-preprocess-block-time .bsb-time-link {
        margin:0; padding:.18em .58em; background:color-mix(in srgb,var(--bsb-block-accent) 9%,transparent);
        border-color:color-mix(in srgb,var(--bsb-block-accent) 25%,transparent); color:var(--bsb-block-accent);
      }
      #${panelId} .bsb-preprocess-time-end { color:var(--ctp-overlay1); font:650 9px/1.4 ui-monospace,monospace; }
      #${panelId} .bsb-preprocess-warning {
        display:inline-flex; align-items:center; gap:4px; flex:0 0 auto; padding:3px 6px; border-radius:999px;
        border:1px solid color-mix(in srgb,var(--ctp-peach) 28%,transparent);
        background:color-mix(in srgb,var(--ctp-peach) 8%,transparent); color:var(--ctp-peach); font-size:8.5px; font-weight:760;
      }
      #${panelId} .bsb-preprocess-block-body {
        color:color-mix(in srgb,var(--ctp-text) 94%,var(--ctp-subtext1));
        font-size:var(--bsb-note-font); line-height:1.86; letter-spacing:.018em;
        white-space:pre-wrap; overflow-wrap:anywhere; text-wrap:pretty;
      }
      /* AI 处理字幕：Markdown / 公式 / ==高亮== 富文本正文 */
      #${panelId} .bsb-preprocess-block-body.bsb-md-rich {
        white-space:normal;
      }
      #${panelId} .bsb-preprocess-block-body.bsb-md-rich > *:first-child { margin-top:0; }
      #${panelId} .bsb-preprocess-block-body.bsb-md-rich > *:last-child { margin-bottom:0; }
      #${panelId} .bsb-preprocess-block-body.bsb-md-rich p { margin:0 0 .7em; }
      #${panelId} .bsb-preprocess-block-body.bsb-md-rich ul,
      #${panelId} .bsb-preprocess-block-body.bsb-md-rich ol { margin:.35em 0 .7em; padding-left:1.25em; }
      #${panelId} .bsb-preprocess-block-body.bsb-md-rich li { margin:.2em 0; }
      #${panelId} .bsb-preprocess-block-body.bsb-md-rich strong {
        color:color-mix(in srgb,var(--ctp-rosewater) 88%,var(--ctp-text));
        font-weight:800;
      }
      #${panelId} .bsb-preprocess-block-body.bsb-md-rich code {
        font:650 .9em/1.4 ui-monospace,SFMono-Regular,Consolas,monospace;
        padding:.08em .35em; border-radius:5px;
        background:color-mix(in srgb,var(--bsb-block-accent) 10%,var(--ctp-surface0));
      }
      #${panelId} .bsb-preprocess-block-body.bsb-md-rich pre {
        margin:.5em 0 .8em; padding:10px 12px; border-radius:10px; overflow:auto;
        background:color-mix(in srgb,var(--ctp-crust) 35%,var(--ctp-mantle));
        border:1px solid color-mix(in srgb,var(--ctp-surface1) 70%,transparent);
      }
      #${panelId} .bsb-preprocess-block-body.bsb-md-rich pre code { padding:0; background:transparent; }
      #${panelId} .bsb-preprocess-block-body.bsb-md-rich blockquote {
        margin:.5em 0 .8em; padding:.2em 0 .2em .9em;
        border-left:3px solid color-mix(in srgb,var(--bsb-block-accent) 55%,transparent);
        color:var(--ctp-subtext1);
      }
      #${panelId} .bsb-preprocess-block-body.bsb-md-rich .bsb-katex-display {
        display:block; overflow-x:auto; margin:.65em 0 .85em; padding:.35em 0; text-align:center;
      }
      #${panelId} .bsb-preprocess-block-body.bsb-md-rich .bsb-katex-inline {
        display:inline-block; max-width:100%; overflow-x:auto; vertical-align:middle;
      }
      #${panelId} .bsb-preprocess-block-body.bsb-md-rich .katex { font-size:1.05em; }
      #${panelId} .bsb-preprocess-block-body::selection {
        background:color-mix(in srgb,var(--bsb-block-accent) 28%,transparent); color:var(--ctp-text);
      }
      #${panelId}[data-panel-size="small"] .bsb-preprocess-block { padding:10px 11px 11px 13px; border-radius:11px; }
      #${panelId}[data-panel-size="small"] .bsb-preprocess-block-topic { display:none; }
      #${panelId}[data-panel-size="small"] .bsb-preprocess-block-body { font-size:calc(var(--bsb-note-font) * .92); line-height:1.78; }
      #${panelId}[data-panel-size="small"] .bsb-knowledge-card-body,
      #${panelId}[data-panel-size="small"] .bsb-studio-answer .bsb-preprocess-block-body {
        font-size:var(--bsb-knowledge-font); line-height:1.7;
      }
`;
}
