/** Preserves legacy CSS cascade sequence. */
export function renderWorkspaceOverrides(panelId: string): string {
  return `
      /* 仅当知识页 active 时调整 Toast，避免误伤其他工作区 */
      #${panelId}[data-panel-view="knowledge"] .bsb-view[data-view-panel="knowledge"].active ~ .bsb-statusbar,
      #${panelId}[data-panel-view="knowledge"] .bsb-statusbar {
        top:10px; bottom:auto; right:12px; left:auto;
        max-width:min(360px, calc(100% - 24px));
      }
      #${panelId}[data-panel-size="small"] [data-view-panel="ai"].knowledge-open .bsb-ai-commandbar,
      #${panelId}[data-panel-size="small"] [data-view-panel="ai"].knowledge-open .bsb-preprocess-nav,
      #${panelId}[data-panel-size="small"] [data-view-panel="ai"].knowledge-open .bsb-output-nav,
      #${panelId}[data-panel-size="small"] [data-view-panel="ai"].knowledge-open .bsb-ai-canvas-wrap { margin-right:0; visibility:hidden; }
      #${panelId}[data-panel-size="small"] .bsb-knowledge-rail { width:100%; max-width:100%; --bsb-knowledge-rail-w:100%; }
      #${panelId} .bsb-knowledge-mobile-back { display:none; }
      #${panelId}[data-panel-size="medium"] .bsb-knowledge-workspace { --bsb-knowledge-nav-w:240px; grid-template-columns:minmax(0,var(--bsb-knowledge-nav-w,240px)) 5px minmax(0,1fr); }
      #${panelId}[data-panel-size="small"] .bsb-knowledge-workspace { position:relative; grid-template-columns:1fr; }
      #${panelId}[data-panel-size="small"] .bsb-knowledge-workspace > .bsb-knowledge-splitter { display:none; }
      #${panelId}[data-panel-size="small"] .bsb-knowledge-nav { border-right:0; }
      #${panelId}[data-panel-size="small"] .bsb-knowledge-reader { display:none; }
      #${panelId}[data-panel-size="small"] .bsb-knowledge-workspace.detail-open .bsb-knowledge-nav { display:none; }
      #${panelId}[data-panel-size="small"] .bsb-knowledge-workspace.detail-open .bsb-knowledge-reader {
        display:flex; position:absolute; inset:0; z-index:2; background:var(--ctp-base);
      }
      #${panelId}[data-panel-size="small"] .bsb-knowledge-mobile-back { display:inline-flex; }
      #${panelId}[data-panel-size="small"] .bsb-knowledge-rail-split.with-tree { grid-template-columns:1fr; grid-template-rows:minmax(90px,36%) 1fr; }
      #${panelId}[data-panel-size="small"] .bsb-knowledge-rail-split.with-tree .bsb-knowledge-tree-pane { border-bottom:1px solid var(--ctp-surface0); border-right:0; }
      /* 可见文字默认 14px。图标/公式除外。 */
      #${panelId} .bsb-fab,
      #${panelId} .bsb-sidebar,
      #${panelId} .bsb-dock-tab,
      #${panelId} .bsb-selection-toolbar {
        font-size: 14px;
      }
      #${panelId} .bsb-sidebar :is(h1,h2,h3,h4,h5,h6,p,li,td,th,dt,dd,button,input,textarea,select,label,span,strong,small,em,b,i,a,code,pre,summary,option,legend,blockquote,cite,figcaption):not(.bsb-empty-ico):not(.bsb-knowledge-orb),
      #${panelId} .bsb-selection-toolbar :is(button,span),
      #${panelId} .bsb-dock-tab,
      #${panelId} .bsb-folio,
      #${panelId} .bsb-folio :is(h1,h2,h3,h4,p,li,td,th,code,pre,blockquote,figcaption,.kicker,.lede),
      #${panelId} .bsb-ai-md,
      #${panelId} .bsb-ai-md :is(h1,h2,h3,h4,p,li,td,th,code,pre,blockquote),
      #${panelId} .bsb-preprocess-block-body,
      #${panelId} .bsb-knowledge-card-body,
      #${panelId} .bsb-knowledge-card-body :is(h1,h2,h3,h4,p,li),
      #${panelId}[data-panel-size="small"] .bsb-preprocess-block-body,
      #${panelId}[data-panel-size="small"] .bsb-knowledge-card-body {
        font-size: 14px !important;
      }
      #${panelId} [hidden] { display:none !important; }
      #${panelId} .bsb-output-nav { flex:0 0 auto; border-bottom:1px solid var(--ctp-surface0); background:color-mix(in srgb,var(--ctp-mantle) 78%,transparent); }
      #${panelId} .bsb-output-tabs { display:flex; gap:3px; overflow-x:auto; padding:6px 8px 3px; scrollbar-width:thin; }
      #${panelId} .bsb-output-tab {
        display:inline-flex; align-items:center; gap:6px; max-width:220px; flex:0 0 auto;
        border:0; border-radius:9px 9px 5px 5px; padding:7px 10px; background:transparent;
        color:var(--ctp-subtext0); cursor:pointer; font-size:11.5px; font-weight:750;
      }
      #${panelId} .bsb-output-tab:hover { background:var(--ctp-surface0); color:var(--ctp-text); }
      #${panelId} .bsb-output-tab.active { color:var(--ctp-text); background:var(--ctp-surface0); box-shadow:inset 0 -2px 0 var(--ctp-mauve); }
      #${panelId} .bsb-output-tab .dot { width:7px; height:7px; border-radius:50%; background:var(--ctp-overlay0); flex:0 0 auto; }
      #${panelId} .bsb-output-tab.running .dot { background:var(--ctp-green); animation:bsb-pulse 1.1s ease-in-out infinite; }
      #${panelId} .bsb-output-tab.done .dot { background:var(--ctp-teal); }
      #${panelId} .bsb-output-tab.error .dot { background:var(--ctp-red); }
      #${panelId} .bsb-output-tab.stopped .dot { background:var(--ctp-peach); }
      #${panelId} .bsb-output-tab .name { overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
      #${panelId} .bsb-output-tab .count { color:var(--ctp-overlay1); font-size:9.5px; font-weight:700; }
      #${panelId} .bsb-model-tabs { min-height:32px; display:flex; align-items:center; gap:4px; overflow-x:auto; padding:3px 8px 6px; }
      #${panelId} .bsb-model-tab {
        display:inline-flex; align-items:center; gap:5px; flex:0 0 auto; max-width:190px;
        border:1px solid transparent; border-radius:999px; padding:4px 9px; background:transparent;
        color:var(--ctp-overlay1); cursor:pointer; font-size:10.5px;
      }
      #${panelId} .bsb-model-tab:hover { color:var(--ctp-text); background:var(--ctp-surface0); }
      #${panelId} .bsb-model-tab.active { color:var(--ctp-text); border-color:var(--ctp-surface2); background:var(--ctp-surface1); }
      #${panelId} .bsb-model-tab .dot { width:6px; height:6px; border-radius:50%; background:var(--ctp-overlay0); }
      #${panelId} .bsb-model-tab.running .dot { background:var(--ctp-green); animation:bsb-pulse 1.1s ease-in-out infinite; }
      #${panelId} .bsb-model-tab.done .dot { background:var(--ctp-teal); }
      #${panelId} .bsb-model-tab.error .dot { background:var(--ctp-red); }
      #${panelId} .bsb-model-tab.stopped .dot { background:var(--ctp-peach); }
      #${panelId} .bsb-ai-drawer-backdrop { position:absolute; inset:0; z-index:44; background:rgba(10,10,18,.34); backdrop-filter:blur(1.5px); }
      #${panelId} .bsb-ai-drawer {
        position:absolute; z-index:45; top:0; right:0; bottom:0; width:min(520px,92%); transform:translateX(102%);
        display:flex; flex-direction:column; overflow:hidden; border-left:1px solid var(--ctp-surface1);
        background:color-mix(in srgb,var(--ctp-base) 96%,transparent); box-shadow:-18px 0 42px rgba(0,0,0,.28);
        transition:transform .18s ease;
      }
      #${panelId} .bsb-ai-drawer.open { transform:translateX(0); }
      #${panelId} .bsb-ai-input-drawer { width:min(620px,94%); }
      #${panelId} .bsb-drawer-head { flex:0 0 auto; display:flex; align-items:center; justify-content:space-between; gap:10px; padding:14px 16px 11px; border-bottom:1px solid var(--ctp-surface0); }
      #${panelId} .bsb-drawer-title { min-width:0; }
      #${panelId} .bsb-drawer-title strong { display:block; font-size:14px; }
      #${panelId} .bsb-drawer-title span { display:block; margin-top:2px; color:var(--ctp-overlay1); font-size:10.5px; }
      #${panelId} .bsb-drawer-body { flex:1 1 auto; min-height:0; overflow:auto; padding:12px 14px 18px; }
      /* Flow controls — visually quiet, native semantics underneath. */
      #${panelId} .bsb-flow-section {
        padding:14px; margin-bottom:10px; border-radius:15px;
        border:1px solid color-mix(in srgb,var(--ctp-surface1) 58%,transparent);
        background:linear-gradient(180deg,color-mix(in srgb,var(--ctp-mantle) 92%,transparent),color-mix(in srgb,var(--ctp-base) 72%,transparent));
        box-shadow:0 1px 0 color-mix(in srgb,var(--ctp-text) 3%,transparent) inset;
      }
      #${panelId} .bsb-flow-section-head { display:flex; align-items:center; justify-content:space-between; gap:12px; margin-bottom:12px; }
      #${panelId} .bsb-flow-section-head > div { min-width:0; }
      #${panelId} .bsb-flow-section-head strong { display:block; font-size:12.5px; line-height:1.2; letter-spacing:.01em; }
      #${panelId} .bsb-flow-section-head span { display:block; margin-top:3px; color:var(--ctp-overlay1); font-size:10px; line-height:1.35; }
      #${panelId} .bsb-flow-grid { display:grid; grid-template-columns:minmax(0,1fr) minmax(0,1fr); gap:10px; }
      #${panelId} .bsb-flow-field { min-width:0; display:flex; flex-direction:column; gap:6px; }
      #${panelId} .bsb-flow-label { color:var(--ctp-subtext0); font-size:10px; font-weight:700; letter-spacing:.02em; }

      #${panelId} .bsb-flow-select {
        position:relative; min-width:0; height:38px; border-radius:11px;
        border:1px solid color-mix(in srgb,var(--ctp-surface2) 58%,transparent);
        background:color-mix(in srgb,var(--ctp-base) 66%,transparent);
        transition:border-color .14s ease,background .14s ease,box-shadow .14s ease;
      }
      #${panelId} .bsb-flow-select:hover { border-color:color-mix(in srgb,var(--ctp-overlay0) 64%,transparent); background:color-mix(in srgb,var(--ctp-base) 82%,transparent); }
      #${panelId} .bsb-flow-select:focus-within { border-color:color-mix(in srgb,var(--ctp-blue) 68%,transparent); box-shadow:0 0 0 3px color-mix(in srgb,var(--ctp-blue) 13%,transparent); }
      #${panelId} .bsb-flow-select select {
        appearance:none; -webkit-appearance:none; width:100%; height:100%; min-width:0; border:0!important; outline:0!important;
        padding:0 34px 0 11px!important; border-radius:inherit; background:transparent!important; box-shadow:none!important;
        color:var(--ctp-text); font:inherit; font-size:11.5px; font-weight:650; cursor:pointer;
      }
      #${panelId} .bsb-flow-select select:disabled { cursor:not-allowed; color:var(--ctp-overlay0); }
      #${panelId} .bsb-flow-select:has(select:disabled) { opacity:.46; }
      #${panelId} .bsb-flow-select-icon {
        pointer-events:none; position:absolute; right:11px; top:50%; transform:translateY(-54%);
        color:var(--ctp-overlay1); font-size:15px; font-weight:800; line-height:1;
      }

      #${panelId} .bsb-flow-stepper {
        height:38px; display:grid; grid-template-columns:34px minmax(0,1fr) 34px; align-items:stretch;
        overflow:hidden; border-radius:11px; border:1px solid color-mix(in srgb,var(--ctp-surface2) 58%,transparent);
        background:color-mix(in srgb,var(--ctp-base) 66%,transparent);
        transition:border-color .14s ease,box-shadow .14s ease;
      }
      #${panelId} .bsb-flow-stepper:focus-within { border-color:color-mix(in srgb,var(--ctp-blue) 68%,transparent); box-shadow:0 0 0 3px color-mix(in srgb,var(--ctp-blue) 13%,transparent); }
      #${panelId} .bsb-flow-stepper.disabled { opacity:.46; }
      #${panelId} .bsb-flow-stepper > button {
        width:34px; border:0; background:transparent; color:var(--ctp-subtext0); cursor:pointer;
        font:700 17px/1 ui-sans-serif,system-ui,sans-serif; transition:background .12s ease,color .12s ease;
      }
      #${panelId} .bsb-flow-stepper > button:first-child { border-right:1px solid color-mix(in srgb,var(--ctp-surface1) 70%,transparent); }
      #${panelId} .bsb-flow-stepper > button:last-child { border-left:1px solid color-mix(in srgb,var(--ctp-surface1) 70%,transparent); }
      #${panelId} .bsb-flow-stepper > button:hover:not(:disabled) { background:var(--ctp-surface0); color:var(--ctp-text); }
      #${panelId} .bsb-flow-stepper > button:active:not(:disabled) { background:var(--ctp-surface1); }
      #${panelId} .bsb-flow-stepper > button:disabled { cursor:not-allowed; }
      #${panelId} .bsb-flow-stepper-value { min-width:0; display:flex; align-items:center; justify-content:center; gap:5px; padding:0 5px; }
      #${panelId} .bsb-flow-stepper input[type="number"] {
        width:100%; min-width:0; height:100%; padding:0; border:0!important; outline:0!important; background:transparent!important; box-shadow:none!important;
        color:var(--ctp-text); text-align:center; font:750 11.5px/1 ui-sans-serif,system-ui,sans-serif; appearance:textfield; -moz-appearance:textfield;
      }
      #${panelId} .bsb-flow-stepper input[type="number"]::-webkit-inner-spin-button,
      #${panelId} .bsb-flow-stepper input[type="number"]::-webkit-outer-spin-button { -webkit-appearance:none; margin:0; }
      #${panelId} .bsb-flow-stepper-unit { flex:0 0 auto; color:var(--ctp-overlay1); font-size:9.5px; font-weight:650; white-space:nowrap; }

      #${panelId} .bsb-flow-switch { display:inline-flex; align-items:center; gap:7px; cursor:pointer; user-select:none; }
      #${panelId} .bsb-flow-switch input { position:absolute; opacity:0; pointer-events:none; }
      #${panelId} .bsb-flow-switch-track {
        width:34px; height:20px; padding:2px; box-sizing:border-box; border-radius:999px;
        background:var(--ctp-surface1); border:1px solid color-mix(in srgb,var(--ctp-surface2) 70%,transparent);
        transition:background .16s ease,border-color .16s ease,box-shadow .16s ease;
      }
      #${panelId} .bsb-flow-switch-track::after {
        content:""; display:block; width:14px; height:14px; border-radius:50%; background:var(--ctp-subtext0);
        box-shadow:0 1px 3px rgba(0,0,0,.28); transition:transform .16s ease,background .16s ease;
      }
      #${panelId} .bsb-flow-switch input:checked + .bsb-flow-switch-track { background:color-mix(in srgb,var(--ctp-green) 72%,var(--ctp-surface1)); border-color:color-mix(in srgb,var(--ctp-green) 72%,transparent); }
      #${panelId} .bsb-flow-switch input:checked + .bsb-flow-switch-track::after { transform:translateX(14px); background:var(--ctp-base); }
      #${panelId} .bsb-flow-switch input:focus-visible + .bsb-flow-switch-track { box-shadow:0 0 0 3px color-mix(in srgb,var(--ctp-green) 16%,transparent); }
      #${panelId} .bsb-flow-switch-text { color:var(--ctp-subtext0); font-size:10px; font-weight:750; }

      #${panelId} .bsb-flow-advanced { margin-top:11px; padding-top:9px; border-top:1px solid color-mix(in srgb,var(--ctp-surface1) 70%,transparent); }
      #${panelId} .bsb-flow-advanced > summary {
        list-style:none; display:flex; align-items:center; gap:7px; cursor:pointer; color:var(--ctp-subtext0);
        font-size:10.5px; font-weight:700; user-select:none; outline:none;
      }
      #${panelId} .bsb-flow-advanced > summary::-webkit-details-marker { display:none; }
      #${panelId} .bsb-flow-advanced > summary::before { content:"›"; color:var(--ctp-overlay1); font-size:16px; line-height:1; transition:transform .14s ease; }
      #${panelId} .bsb-flow-advanced[open] > summary::before { transform:rotate(90deg); }
      #${panelId} .bsb-flow-advanced .bsb-flow-grid { margin-top:10px; }

      #${panelId} .bsb-output-task-card {
        padding:11px; margin-top:8px; border-radius:13px; border:1px solid color-mix(in srgb,var(--ctp-surface1) 64%,transparent);
        background:color-mix(in srgb,var(--ctp-base) 52%,transparent);
      }
      #${panelId} .bsb-output-task-head { display:flex; align-items:center; gap:8px; margin-bottom:10px; }
      #${panelId} .bsb-output-task-index { width:24px; height:24px; display:grid; place-items:center; flex:0 0 auto; border-radius:8px; background:var(--ctp-surface0); color:var(--ctp-overlay1); font-size:9.5px; font-weight:850; }
      #${panelId} .bsb-output-task-name { flex:1 1 auto; min-width:0; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; font-size:11.5px; font-weight:800; }
      #${panelId} .bsb-model-picks { display:flex; flex-wrap:wrap; gap:6px; margin-top:7px; }
      #${panelId} .bsb-model-order { display:grid; gap:8px; margin-top:7px; }
      #${panelId} .bsb-model-rank-list { display:flex; flex-direction:column; gap:5px; }
      #${panelId} .bsb-model-rank {
        display:grid; grid-template-columns:14px 28px minmax(0,1fr) 22px; align-items:center; gap:6px;
        min-height:32px; padding:0 6px 0 8px; user-select:none;
        border:1px solid color-mix(in srgb,var(--ctp-blue) 32%,var(--ctp-surface1));
        border-radius:10px; background:color-mix(in srgb,var(--ctp-blue) 10%,var(--ctp-base));
        color:var(--ctp-text);
      }
      #${panelId} .bsb-model-rank[draggable="true"] { cursor:grab; }
      #${panelId} .bsb-model-rank.dragging { opacity:.45; cursor:grabbing; }
      #${panelId} .bsb-model-rank.drag-over {
        border-color:color-mix(in srgb,var(--ctp-sapphire) 55%,transparent);
        box-shadow:inset 0 0 0 1px color-mix(in srgb,var(--ctp-sapphire) 30%,transparent);
      }
      #${panelId} .bsb-model-rank-handle { color:var(--ctp-overlay0); font-size:12px; letter-spacing:-1px; }
      #${panelId} .bsb-model-rank-n {
        width:22px; height:18px; display:grid; place-items:center; border-radius:6px;
        background:var(--ctp-lavender); color:var(--ctp-crust); font-size:9px; font-weight:850;
      }
      #${panelId} .bsb-model-rank-name { min-width:0; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; font-size:11px; font-weight:700; }
      #${panelId} .bsb-model-rank-remove {
        width:22px; height:22px; border:0; border-radius:7px; background:transparent;
        color:var(--ctp-overlay1); cursor:pointer; font-size:14px; line-height:1;
      }
      #${panelId} .bsb-model-rank-remove:hover { color:var(--ctp-red); background:color-mix(in srgb,var(--ctp-red) 12%,transparent); }
      #${panelId} .bsb-model-add-list { display:flex; flex-wrap:wrap; gap:6px; align-items:center; }
      #${panelId} .bsb-model-add {
        min-height:28px; padding:0 9px; border-radius:999px; cursor:pointer; font-size:10.5px; font-weight:650;
        border:1px dashed color-mix(in srgb,var(--ctp-overlay0) 45%,transparent);
        background:transparent; color:var(--ctp-subtext0);
      }
      #${panelId} .bsb-model-add:hover { color:var(--ctp-text); border-color:var(--ctp-lavender); background:color-mix(in srgb,var(--ctp-lavender) 10%,transparent); }
      #${panelId} .bsb-model-pick {
        position:relative; display:inline-flex; align-items:center; gap:6px; min-height:30px; padding:0 9px;
        border:1px solid color-mix(in srgb,var(--ctp-surface1) 75%,transparent); border-radius:999px;
        background:color-mix(in srgb,var(--ctp-base) 42%,transparent); color:var(--ctp-subtext0); font-size:10px; font-weight:650; cursor:pointer;
        transition:background .12s ease,border-color .12s ease,color .12s ease;
      }
      #${panelId} .bsb-model-pick:hover { border-color:var(--ctp-surface2); color:var(--ctp-text); }
      #${panelId} .bsb-model-pick::before { content:""; width:12px; height:12px; display:grid; place-items:center; border:1px solid var(--ctp-overlay0); border-radius:4px; box-sizing:border-box; font-size:8px; font-weight:900; }
      #${panelId} .bsb-model-pick:has(input:checked) { color:var(--ctp-text); border-color:color-mix(in srgb,var(--ctp-blue) 56%,var(--ctp-surface1)); background:color-mix(in srgb,var(--ctp-blue) 12%,transparent); }
      #${panelId} .bsb-model-pick:has(input:checked)::before { content:"✓"; color:var(--ctp-base); border-color:var(--ctp-blue); background:var(--ctp-blue); }
      #${panelId} .bsb-model-pick input { position:absolute; opacity:0; pointer-events:none; }
      #${panelId} .bsb-input-tabs { display:inline-flex; gap:3px; padding:3px; border:1px solid var(--ctp-surface0); border-radius:9px; background:var(--ctp-mantle); }
      #${panelId} .bsb-input-tabs button { border:0; border-radius:7px; padding:5px 9px; background:transparent; color:var(--ctp-overlay1); cursor:pointer; font-size:10.5px; }
      #${panelId} .bsb-input-tabs button.active { background:var(--ctp-surface1); color:var(--ctp-text); }
      #${panelId} .bsb-input-preview { margin:10px 0 0; white-space:pre-wrap; word-break:break-word; font:11px/1.65 ui-monospace,SFMono-Regular,Consolas,monospace; color:var(--ctp-subtext1); }
      #${panelId} .bsb-input-empty { padding:28px 12px; text-align:center; color:var(--ctp-overlay1); font-size:11px; line-height:1.6; }
      #${panelId} .bsb-settings-tabs {
        flex: 0 0 auto;
        display: inline-flex; align-self: flex-start; gap: 4px;
        padding: 4px; border-radius: 12px;
        border: 1px solid color-mix(in srgb, var(--ctp-surface1) 52%, transparent);
        background: color-mix(in srgb, var(--ctp-mantle) 58%, transparent);
      }
      #${panelId} .bsb-settings-tabs button {
        min-width: 92px; height: 32px; padding: 0 16px;
        border-radius: 9px; border: 0; background: transparent;
        color: var(--ctp-subtext0); font-weight: 800; font-size: 12px; cursor: pointer;
      }
      #${panelId} .bsb-settings-tabs button.active {
        color: var(--ctp-text);
        background: color-mix(in srgb, var(--ctp-surface1) 72%, transparent);
        box-shadow: 0 1px 7px color-mix(in srgb, var(--ctp-crust) 35%, transparent);
      }
      #${panelId} .bsb-settings-pane { display: none; flex: 1 1 auto; min-height: 0; }
      #${panelId} .bsb-settings-pane.active { display: block; }
      #${panelId} .bsb-config-master-detail {
        height: 100%; min-height: 0;
        display: grid; grid-template-columns: minmax(190px, 230px) minmax(0, 1fr); gap: 10px;
      }
      #${panelId} .bsb-config-sidebar,
      #${panelId} .bsb-config-editor-shell {
        min-height: 0; border-radius: 14px;
        border: 1px solid color-mix(in srgb, var(--ctp-surface1) 48%, transparent);
        background: color-mix(in srgb, var(--ctp-mantle) 43%, transparent);
      }
      #${panelId} .bsb-config-sidebar {
        display: flex; flex-direction: column; overflow: hidden;
      }
      #${panelId} .bsb-config-sidebar-head { padding: 10px; display: grid; gap: 8px; }
      #${panelId} .bsb-config-search {
        display: flex; align-items: center; gap: 7px; padding: 0 9px; height: 34px;
        border-radius: 9px; border: 1px solid color-mix(in srgb, var(--ctp-surface2) 52%, transparent);
        background: color-mix(in srgb, var(--ctp-base) 55%, transparent); color: var(--ctp-overlay1);
      }
      #${panelId} .bsb-config-search input {
        width: 100%; min-width: 0; border: 0; outline: 0; padding: 0; background: transparent;
        color: var(--ctp-text); font: inherit; font-size: 12px;
      }
      #${panelId} .bsb-config-create { width: 100%; justify-content: center; }
      #${panelId} .bsb-config-list {
        flex: 1 1 auto; min-height: 0; overflow: auto; padding: 2px 7px 8px;
        display: flex; flex-direction: column; gap: 4px;
      }
      #${panelId} .bsb-config-list-item {
        width: 100%; text-align: left; border: 1px solid transparent; cursor: pointer;
        padding: 9px 8px; border-radius: 10px; background: transparent; color: var(--ctp-text);
        display: grid; grid-template-columns: 14px 10px minmax(0, 1fr) auto; column-gap: 6px; row-gap: 2px;
        align-items: start; user-select: none;
      }
      #${panelId} .bsb-config-list-item:hover { background: color-mix(in srgb, var(--ctp-surface0) 55%, transparent); }
      #${panelId} .bsb-config-list-item.selected {
        border-color: color-mix(in srgb, var(--ctp-blue) 38%, transparent);
        background: color-mix(in srgb, var(--ctp-blue) 12%, var(--ctp-surface0));
      }
      #${panelId} .bsb-config-list-item[draggable="true"] { cursor: grab; }
      #${panelId} .bsb-config-list-item.dragging {
        opacity: 0.45; cursor: grabbing;
        border-color: color-mix(in srgb, var(--ctp-blue) 45%, transparent);
      }
      #${panelId} .bsb-config-list-item.drag-over {
        border-color: color-mix(in srgb, var(--ctp-sapphire) 55%, transparent);
        box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--ctp-sapphire) 35%, transparent);
        background: color-mix(in srgb, var(--ctp-sapphire) 10%, var(--ctp-surface0));
      }
      #${panelId} .bsb-config-list[data-reorder-locked="1"] .bsb-config-list-item { cursor: pointer; }
      #${panelId} .bsb-config-list[data-reorder-locked="1"] .bsb-config-drag { opacity: 0.28; cursor: default; }
      #${panelId} .bsb-config-drag {
        display: inline-flex; align-items: center; justify-content: center;
        margin-top: 2px; width: 14px; height: 16px; line-height: 1;
        color: var(--ctp-overlay0); font-size: 12px; letter-spacing: -1px;
        cursor: grab; touch-action: none;
      }
      #${panelId} .bsb-config-list-item.dragging .bsb-config-drag { cursor: grabbing; }
      #${panelId} .bsb-config-dot {
        width: 7px; height: 7px; margin-top: 5px; border-radius: 50%;
        background: var(--ctp-overlay0); box-shadow: 0 0 0 2px color-mix(in srgb, var(--ctp-overlay0) 18%, transparent);
      }
      #${panelId} .bsb-config-dot.current,
      #${panelId} .bsb-config-dot.enabled { background: var(--ctp-green); box-shadow: 0 0 0 2px color-mix(in srgb, var(--ctp-green) 18%, transparent); }
      #${panelId} .bsb-config-item-main { min-width: 0; }
      #${panelId} .bsb-config-item-name { display:block; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; font-size:11.5px; font-weight:750; }
      #${panelId} .bsb-config-item-sub { display:block; margin-top:2px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; color:var(--ctp-overlay1); font-size:10px; }
      #${panelId} .bsb-config-badge {
        align-self: start; padding: 2px 5px; border-radius: 999px; font-size: 9px; line-height: 1.3;
        color: var(--ctp-green); background: color-mix(in srgb, var(--ctp-green) 12%, transparent);
      }
      #${panelId} .bsb-config-sidebar-foot {
        flex: 0 0 auto; padding: 8px; border-top: 1px solid color-mix(in srgb, var(--ctp-surface0) 58%, transparent);
      }
      #${panelId} .bsb-config-sidebar-foot button { width: 100%; }
      #${panelId} .bsb-config-editor-shell { overflow: auto; padding: 12px 14px; }
      #${panelId} .bsb-config-editor-empty {
        height: 100%; min-height: 260px; display:flex; align-items:center; justify-content:center; text-align:center;
        color: var(--ctp-overlay1); font-size:12px; line-height:1.6;
      }
      #${panelId} .bsb-config-editor-head {
        display:flex; align-items:flex-start; justify-content:space-between; gap:10px; margin-bottom:12px;
      }
      #${panelId} .bsb-config-editor-title { min-width:0; }
      #${panelId} .bsb-config-editor-title strong { display:block; font-size:14px; color:var(--ctp-text); }
      #${panelId} .bsb-config-editor-title span { display:block; margin-top:3px; font-size:10.5px; color:var(--ctp-overlay1); line-height:1.45; }
      #${panelId} .bsb-config-editor-actions { display:flex; gap:5px; flex-wrap:wrap; justify-content:flex-end; }
      #${panelId} .bsb-config-editor-actions button { height:28px; padding:0 8px; font-size:10.5px; border-radius:8px; }
      #${panelId} .bsb-config-editor-shell textarea[data-prompt-field="systemPrompt"] { min-height: 300px; font-family: ui-monospace, SFMono-Regular, Consolas, monospace; font-size: 11.5px; }
      #${panelId} .bsb-config-editor-shell textarea[data-prompt-field="userPromptTemplate"] { min-height: 220px; font-family: ui-monospace, SFMono-Regular, Consolas, monospace; font-size: 11.5px; }
      #${panelId} .bsb-config-list-empty { padding:16px 8px; color:var(--ctp-overlay1); font-size:11px; text-align:center; line-height:1.5; }
      @media (max-width: 720px) {
        #${panelId} .bsb-config-master-detail { grid-template-columns: minmax(150px, 185px) minmax(0, 1fr); }
      }

      /* 底栏状态 */
      #${panelId} .bsb-statusbar {
        flex-shrink: 0;
        display: flex; align-items: center; gap: 8px;
        padding: 8px 14px 10px;
        border-top: 1px solid color-mix(in srgb, var(--ctp-surface0) 75%, transparent);
        background: color-mix(in srgb, var(--ctp-mantle) 50%, transparent);
        font-size: 11.5px; color: var(--ctp-subtext0);
        min-height: 36px;
      }
      #${panelId} .bsb-status-dot {
        width: 7px; height: 7px; border-radius: 50%; flex-shrink: 0;
        background: var(--ctp-overlay0);
        box-shadow: 0 0 0 3px color-mix(in srgb, var(--ctp-overlay0) 20%, transparent);
      }
      #${panelId} .bsb-status-dot.ok {
        background: var(--ctp-green);
        box-shadow: 0 0 0 3px color-mix(in srgb, var(--ctp-green) 22%, transparent);
      }
      #${panelId} .bsb-status-dot.err {
        background: var(--ctp-red);
        box-shadow: 0 0 0 3px color-mix(in srgb, var(--ctp-red) 22%, transparent);
      }
      #${panelId} .bsb-status-dot.busy {
        background: var(--ctp-yellow);
        box-shadow: 0 0 0 3px color-mix(in srgb, var(--ctp-yellow) 22%, transparent);
        animation: bsb-pulse 1.2s ease-in-out infinite;
      }
      @keyframes bsb-pulse {
        0%, 100% { opacity: 1; }
        50% { opacity: 0.45; }
      }
      #${panelId} .bsb-status {
        flex: 1; min-width: 0; word-break: break-word; line-height: 1.35;
      }
      #${panelId} .bsb-status.ok { color: var(--ctp-green); }
      #${panelId} .bsb-status.err { color: var(--ctp-red); }

      /* 滚动条 */
      #${panelId} .bsb-list::-webkit-scrollbar,
      #${panelId} .bsb-ai-md::-webkit-scrollbar,
      #${panelId} .bsb-settings::-webkit-scrollbar { width: 8px; height: 8px; }
      #${panelId} .bsb-list::-webkit-scrollbar-thumb,
      #${panelId} .bsb-ai-md::-webkit-scrollbar-thumb,
      #${panelId} .bsb-settings::-webkit-scrollbar-thumb {
        background: color-mix(in srgb, var(--ctp-surface2) 65%, transparent);
        border-radius: 8px;
      }
      #${panelId} .bsb-list::-webkit-scrollbar-thumb:hover,
      #${panelId} .bsb-ai-md::-webkit-scrollbar-thumb:hover {
        background: var(--ctp-overlay0);
      }

`;
}
