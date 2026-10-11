/** CSS extracted without reordering original rules. */
export function renderKnowledgeWorkspaceStyles(panelId: string): string {
  return `
      /* Knowledge Workspace: Navigator | Reader only.
         严禁在此写无条件 display:flex —— 会覆盖 .bsb-view{display:none} 叠到 AI/字幕上。 */
      #${panelId} .bsb-view[data-view-panel="knowledge"] {
        min-height:0; height:100%; padding:0; gap:0; overflow:hidden;
      }
      #${panelId} .bsb-knowledge-workspace {
        flex:1 1 auto; height:100%; min-height:0; display:grid;
        grid-template-columns:minmax(0,var(--bsb-knowledge-nav-w,280px)) 5px minmax(0,1fr);
      }
      #${panelId} .bsb-knowledge-nav {
        min-width:0; min-height:0; display:flex; flex-direction:column; overflow:hidden;
        background:color-mix(in srgb,var(--ctp-mantle) 78%,var(--ctp-base)); border-right:1px solid var(--ctp-surface0);
      }
      #${panelId} .bsb-knowledge-nav-head {
        flex:0 0 auto; display:flex; flex-direction:column; gap:8px; padding:12px 12px 10px;
        border-bottom:1px solid var(--ctp-surface0);
      }
      #${panelId} .bsb-knowledge-nav-title {
        display:flex; align-items:baseline; justify-content:space-between; gap:8px;
        color:var(--ctp-overlay1); font-size:10px; font-weight:800; letter-spacing:.1em; text-transform:uppercase;
      }
      #${panelId} .bsb-knowledge-nav-title span { color:var(--ctp-subtext0); font-size:10px; font-weight:650; letter-spacing:0; text-transform:none; }
      #${panelId} .bsb-knowledge-search {
        display:flex; align-items:center; gap:7px; border:1px solid var(--ctp-surface1); border-radius:10px;
        padding:0 10px; background:var(--ctp-base);
      }
      #${panelId} .bsb-knowledge-search input { width:100%; height:32px; border:0; outline:none; background:transparent; color:var(--ctp-text); font-size:12px; }
      #${panelId} .bsb-knowledge-nav-scroll { flex:1 1 auto; min-height:0; overflow:auto; padding:8px; }
      #${panelId} .bsb-knowledge-source-group { margin-bottom:10px; }
      #${panelId} .bsb-knowledge-source-label {
        padding:4px 8px 6px; color:var(--ctp-overlay1); font-size:9px; font-weight:800;
        letter-spacing:.08em; text-transform:uppercase; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;
      }
      #${panelId} .bsb-knowledge-nav-anchor { margin-bottom:2px; }
      #${panelId} .bsb-knowledge-list-item {
        width:100%; display:grid; grid-template-columns:8px minmax(0,1fr) auto; gap:7px; align-items:start;
        padding:8px; border:1px solid transparent; border-radius:10px; background:transparent; color:var(--ctp-text);
        cursor:pointer; text-align:left;
      }
      #${panelId} .bsb-knowledge-list-item:hover { background:var(--ctp-surface0); }
      #${panelId} .bsb-knowledge-list-item.active {
        border-color:color-mix(in srgb,var(--ctp-mauve) 32%,transparent);
        background:color-mix(in srgb,var(--ctp-mauve) 9%,var(--ctp-surface0));
      }
      #${panelId} .bsb-knowledge-list-dot { width:6px; height:6px; margin-top:5px; border-radius:50%; background:var(--ctp-mauve); }
      #${panelId} .bsb-knowledge-list-main { min-width:0; }
      #${panelId} .bsb-knowledge-list-main strong {
        display:-webkit-box; -webkit-line-clamp:2; -webkit-box-orient:vertical; overflow:hidden;
        font-size:11.5px; line-height:1.35; font-weight:720;
      }
      #${panelId} .bsb-knowledge-list-main small {
        display:block; margin-top:3px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;
        color:var(--ctp-overlay1); font-size:9px;
      }
      #${panelId} .bsb-knowledge-nav-threads {
        margin:2px 0 6px 14px; padding-left:8px; border-left:1px solid color-mix(in srgb,var(--ctp-surface1) 80%,transparent);
      }
      #${panelId} .bsb-knowledge-nav-threads .bsb-knowledge-tree-node > button {
        font-size:10px; padding:5px 6px 5px calc(6px + var(--depth) * 10px);
      }
      #${panelId} .bsb-knowledge-library-empty { padding:28px 14px; color:var(--ctp-overlay1); text-align:center; font-size:11px; line-height:1.6; }
      #${panelId} .bsb-knowledge-reader {
        min-width:0; min-height:0; display:flex; flex-direction:column; overflow:hidden; background:var(--ctp-base);
      }
      #${panelId} .bsb-knowledge-reader-head {
        flex:0 0 auto; display:flex; align-items:flex-start; justify-content:space-between; gap:10px;
        min-height:64px; max-height:84px; padding:10px 16px 8px; border-bottom:1px solid var(--ctp-surface0);
      }
      #${panelId} .bsb-knowledge-reader-head-main { min-width:0; flex:1 1 auto; }
      #${panelId} .bsb-knowledge-reader-title {
        margin:0; color:var(--ctp-text); font-size:15px; font-weight:780; line-height:1.35;
        display:-webkit-box; -webkit-line-clamp:2; -webkit-box-orient:vertical; overflow:hidden;
      }
      #${panelId} .bsb-knowledge-reader-meta {
        margin:4px 0 0; color:var(--ctp-overlay1); font-size:10px; line-height:1.35;
        overflow:hidden; text-overflow:ellipsis; white-space:nowrap;
      }
      #${panelId} .bsb-knowledge-reader-actions { flex:0 0 auto; display:flex; align-items:center; gap:4px; }
      #${panelId} .bsb-knowledge-reader-actions .active {
        color:var(--ctp-yellow); border-color:color-mix(in srgb,var(--ctp-yellow) 30%,var(--ctp-surface1));
        background:color-mix(in srgb,var(--ctp-yellow) 8%,transparent);
      }
      #${panelId} .bsb-knowledge-more { position:relative; }
      #${panelId} .bsb-knowledge-more-menu {
        position:absolute; z-index:12; right:0; top:calc(100% + 4px); min-width:132px;
        border:1px solid var(--ctp-surface1); border-radius:10px; padding:4px;
        background:color-mix(in srgb,var(--ctp-base) 98%,transparent); box-shadow:0 12px 28px rgba(0,0,0,.32);
      }
      #${panelId} .bsb-knowledge-more-menu[hidden] { display:none !important; }
      #${panelId} .bsb-knowledge-more-menu button {
        width:100%; border:0; border-radius:8px; padding:8px 10px; background:transparent;
        color:var(--ctp-subtext1); cursor:pointer; text-align:left; font-size:11px;
      }
      #${panelId} .bsb-knowledge-more-menu button:hover { background:var(--ctp-surface0); color:var(--ctp-text); }
      #${panelId} .bsb-knowledge-more-menu button.danger { color:var(--ctp-red); }
      #${panelId} .bsb-knowledge-reader .bsb-knowledge-crumbs { padding:4px 16px; }
      #${panelId} .bsb-knowledge-reader-scroll {
        flex:1 1 auto; min-height:0; overflow:auto; padding:8px 0 18px;
      }
      #${panelId} .bsb-knowledge-reader-scroll-inner {
        width:min(860px, 100%); max-width:82ch; margin:0 auto; padding:4px 20px 8px; box-sizing:border-box;
      }
      #${panelId} .bsb-knowledge-reader .bsb-knowledge-composer {
        padding:10px 16px 12px;
      }
      #${panelId} .bsb-knowledge-reader .bsb-knowledge-composer-box {
        width:min(860px, 100%); max-width:82ch; margin:0 auto;
      }
      #${panelId} .bsb-knowledge-tree-pane { min-height:0; overflow:auto; padding:8px 6px 12px; display:flex; flex-direction:column; border-right:1px solid var(--ctp-surface0); }
      #${panelId} .bsb-knowledge-tree-pane .bsb-knowledge-tree { flex:1 1 auto; min-height:0; overflow:auto; }
`;
}
