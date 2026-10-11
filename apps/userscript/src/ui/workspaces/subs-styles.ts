/** Initial subtitle library CSS block, preserving legacy cascade order. */
export function renderSubsStyles(panelId: string): string {
  return `
      /* ── 字幕资源库：采集入口 + 左侧资源 Master + 右侧 Detail ── */
      #${panelId} .bsb-view[data-view-panel="subs"] {
        position: relative; gap: 8px; overflow: hidden;
      }
      #${panelId} .bsb-library-jobbar {
        display: none; flex-shrink: 0; align-items: center; gap: 10px;
        min-height: 42px; padding: 7px 10px;
        border: 1px solid color-mix(in srgb, var(--ctp-blue) 28%, var(--ctp-surface1));
        border-radius: 12px;
        background: color-mix(in srgb, var(--ctp-mantle) 82%, var(--ctp-base));
      }
      #${panelId} .bsb-library-jobbar.is-on { display: flex; }
      #${panelId} .bsb-library-jobbar.is-paused {
        border-color: color-mix(in srgb, var(--ctp-yellow) 40%, var(--ctp-surface1));
      }
      #${panelId} .bsb-job-progress {
        flex: 1 1 auto; min-width: 0; display: grid; gap: 5px;
        grid-template-columns: 10px minmax(0,1fr);
        align-items: center;
      }
      #${panelId} .bsb-job-dot {
        width: 8px; height: 8px; border-radius: 50%;
        background: var(--ctp-blue);
        box-shadow: 0 0 0 4px color-mix(in srgb, var(--ctp-blue) 18%, transparent);
        animation: bsb-job-pulse 1.2s ease-in-out infinite;
      }
      #${panelId} .bsb-library-jobbar.is-paused .bsb-job-dot {
        background: var(--ctp-yellow); animation: none;
        box-shadow: 0 0 0 4px color-mix(in srgb, var(--ctp-yellow) 16%, transparent);
      }
      @keyframes bsb-job-pulse {
        0%, 100% { opacity: 1; transform: scale(1); }
        50% { opacity: .55; transform: scale(.86); }
      }
      #${panelId} .bsb-job-copy { min-width: 0; display: grid; gap: 2px; }
      #${panelId} .bsb-job-copy strong {
        font-size: 11.5px; color: var(--ctp-text); font-weight: 700;
        overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
      }
      #${panelId} .bsb-job-copy span {
        font-size: 10px; color: var(--ctp-overlay1); font-variant-numeric: tabular-nums;
        overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
      }
      #${panelId} .bsb-job-meter {
        grid-column: 1 / -1; height: 3px; border-radius: 999px;
        background: color-mix(in srgb, var(--ctp-surface1) 70%, transparent); overflow: hidden;
      }
      #${panelId} .bsb-job-meter i {
        display: block; height: 100%; width: 0; border-radius: inherit;
        background: linear-gradient(90deg, var(--ctp-blue), var(--ctp-lavender));
        transition: width .2s ease;
      }
      #${panelId} .bsb-library-jobbar.is-paused .bsb-job-meter i {
        background: var(--ctp-yellow);
      }
      #${panelId} .bsb-job-actions { display: flex; gap: 6px; flex-shrink: 0; }
      #${panelId} .bsb-job-actions button {
        height: 28px; padding: 0 10px; border-radius: 8px; cursor: pointer; font-size: 11px; font-weight: 650;
        border: 1px solid color-mix(in srgb, var(--ctp-surface1) 60%, transparent);
        background: color-mix(in srgb, var(--ctp-surface0) 50%, transparent); color: var(--ctp-text);
      }
      #${panelId} .bsb-job-actions [data-act="job-pause"] {
        border-color: color-mix(in srgb, var(--ctp-yellow) 38%, transparent);
        background: color-mix(in srgb, var(--ctp-yellow) 12%, transparent); color: var(--ctp-yellow);
      }
      #${panelId} .bsb-job-actions [data-act="job-stop"] {
        border-color: color-mix(in srgb, var(--ctp-red) 38%, transparent);
        background: color-mix(in srgb, var(--ctp-red) 10%, transparent); color: var(--ctp-red);
      }
      #${panelId} .bsb-library-topbar {
        display: flex; align-items: center; gap: 7px; min-height: 34px; flex-shrink: 0;
      }
      #${panelId} .bsb-library-search {
        flex: 1 1 180px; min-width: 120px; height: 32px; display: grid;
        grid-template-columns: auto minmax(0,1fr); align-items: center; gap: 6px;
        border: 1px solid color-mix(in srgb, var(--ctp-surface2) 55%, transparent);
        border-radius: 10px; padding: 0 9px;
        background: color-mix(in srgb, var(--ctp-mantle) 62%, transparent);
      }
      #${panelId} .bsb-library-search input {
        width: 100%; min-width: 0; border: 0; outline: 0; background: transparent;
        color: var(--ctp-text); font-size: 11.5px;
      }
      #${panelId} .bsb-library-filterbar {
        display: flex; gap: 4px; overflow-x: auto; scrollbar-width: none; flex-shrink: 1;
      }
      #${panelId} .bsb-library-filterbar::-webkit-scrollbar { display: none; }
      #${panelId} .bsb-library-filterbar button {
        height: 29px; border-radius: 9px; padding: 0 8px; white-space: nowrap; cursor: pointer;
        border: 1px solid color-mix(in srgb, var(--ctp-surface1) 65%, transparent);
        background: transparent; color: var(--ctp-subtext0); font-size: 10.5px;
      }
      #${panelId} .bsb-library-filterbar button.active {
        color: var(--ctp-sapphire); border-color: color-mix(in srgb, var(--ctp-sapphire) 42%, transparent);
        background: color-mix(in srgb, var(--ctp-sapphire) 12%, transparent);
      }
      #${panelId} .bsb-library-layout {
        display: grid; grid-template-columns: minmax(190px, 31%) minmax(0, 1fr);
        gap: 9px; flex: 1 1 0; min-height: 0; overflow: hidden;
      }
      #${panelId} .bsb-library-master {
        display: flex; flex-direction: column; min-width: 0; min-height: 0;
        border: 1px solid color-mix(in srgb, var(--ctp-surface1) 52%, transparent);
        border-radius: 14px; overflow: hidden;
        background: color-mix(in srgb, var(--ctp-mantle) 55%, transparent);
      }
      #${panelId} .bsb-library-master-head {
        padding: 8px 9px; display: flex; align-items: center; justify-content: space-between; gap: 6px;
        border-bottom: 1px solid color-mix(in srgb, var(--ctp-surface0) 72%, transparent);
        color: var(--ctp-subtext1); font-size: 10.5px;
      }
      #${panelId} .bsb-library-master-head strong { color: var(--ctp-text); font-size: 11.5px; }
      #${panelId} .bsb-library-master-head {
        flex-wrap: wrap;
      }
      #${panelId} .bsb-library-folder-tools { display: flex; gap: 4px; margin-left: auto; }
      #${panelId} .bsb-library-folder-tools button {
        height: 22px; border-radius: 6px; padding: 0 6px; cursor: pointer; font-size: 10px;
        border: 1px solid color-mix(in srgb, var(--ctp-surface1) 62%, transparent);
        background: transparent; color: var(--ctp-subtext1);
      }
      #${panelId} .bsb-list {
        flex: 1 1 0; min-height: 0; overflow-y: auto; padding: 5px;
      }
      #${panelId} .bsb-resource-item,
      #${panelId} .bsb-resource-folder {
        position: relative; display: grid; gap: 6px;
        padding: 8px 7px; border: 1px solid transparent; border-radius: 10px; cursor: pointer;
        transition: background .12s, border-color .12s; align-items: start;
      }
      #${panelId} .bsb-resource-item { grid-template-columns: 20px minmax(0,1fr); }
      #${panelId} .bsb-resource-folder { grid-template-columns: 16px 20px minmax(0,1fr); background: color-mix(in srgb, var(--ctp-surface0) 55%, transparent); margin-top: 3px; }
      #${panelId} .bsb-resource-item.child,
      #${panelId} .bsb-resource-folder.child {
        margin-left: 14px; border-radius: 0 10px 10px 0;
        border-left: 2px solid color-mix(in srgb, var(--ctp-overlay0) 35%, transparent);
      }
      #${panelId} .bsb-resource-item.child-2,
      #${panelId} .bsb-resource-folder.child-2 {
        margin-left: 28px;
      }
      #${panelId} .bsb-resource-item:hover,
      #${panelId} .bsb-resource-folder:hover {
        background: color-mix(in srgb, var(--ctp-surface0) 45%, transparent);
      }
      #${panelId} .bsb-resource-item.active {
        border-color: color-mix(in srgb, var(--ctp-sapphire) 42%, transparent);
        background: color-mix(in srgb, var(--ctp-sapphire) 10%, transparent);
      }
      #${panelId} .bsb-resource-item input[type="checkbox"],
      #${panelId} .bsb-resource-folder input[type="checkbox"] { margin-top: 2px; accent-color: var(--ctp-mauve); }
      #${panelId} .bsb-folder-toggle {
        border: 0; background: transparent; color: var(--ctp-overlay1); cursor: pointer;
        width: 16px; height: 16px; padding: 0; margin-top: 2px; font-size: 10px; line-height: 1;
      }
      #${panelId} .bsb-folder-toggle:hover { color: var(--ctp-text); }
      #${panelId} .bsb-resource-main { min-width: 0; display: grid; gap: 3px; }
      #${panelId} .bsb-resource-title {
        color: var(--ctp-text); font-weight: 590; font-size: 11.5px;
        overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
      }
      #${panelId} .bsb-resource-folder .bsb-resource-title { font-weight: 650; }
      #${panelId} .bsb-resource-meta {
        display: flex; gap: 6px; align-items: center; min-width: 0;
        color: var(--ctp-overlay1); font-size: 9.8px;
      }
      #${panelId} .bsb-resource-meta span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
      #${panelId} .bsb-resource-status { font-weight: 650; flex-shrink: 0; }
      #${panelId} .bsb-resource-status.st-ok { color: var(--ctp-green); }
      #${panelId} .bsb-resource-status.st-empty { color: var(--ctp-peach); }
      #${panelId} .bsb-resource-status.st-err { color: var(--ctp-red); }
      #${panelId} .bsb-resource-status.st-wait { color: var(--ctp-overlay1); }
      #${panelId} .bsb-library-master-foot {
        display: grid; gap: 6px; padding: 7px;
        border-top: 1px solid color-mix(in srgb, var(--ctp-surface0) 72%, transparent);
      }
      #${panelId} .bsb-library-select-tools {
        display: flex; flex-wrap: wrap; gap: 4px;
      }
      #${panelId} .bsb-library-select-tools button {
        height: 24px; border-radius: 7px; padding: 0 7px; cursor: pointer; font-size: 10px;
        border: 1px solid transparent; background: transparent; color: var(--ctp-overlay1);
      }
      #${panelId} .bsb-library-select-tools button:hover {
        color: var(--ctp-text);
        background: color-mix(in srgb, var(--ctp-surface0) 55%, transparent);
      }
      #${panelId} .bsb-library-primary-tools {
        display: grid; grid-template-columns: 1fr 1fr; gap: 6px;
      }
      #${panelId} .bsb-library-primary-tools button {
        height: 32px; border-radius: 9px; cursor: pointer; font-size: 11.5px; font-weight: 680;
        border: 1px solid color-mix(in srgb, var(--ctp-surface1) 62%, transparent);
        background: color-mix(in srgb, var(--ctp-surface0) 42%, transparent); color: var(--ctp-subtext1);
        padding: 0 8px;
      }
      #${panelId} .bsb-library-primary-tools button.primary {
        border-color: color-mix(in srgb, var(--ctp-blue) 42%, transparent);
        background: color-mix(in srgb, var(--ctp-blue) 16%, var(--ctp-surface0));
        color: var(--ctp-text);
      }
      #${panelId} .bsb-library-primary-tools button:hover {
        border-color: color-mix(in srgb, var(--ctp-lavender) 40%, transparent);
      }
      #${panelId} .bsb-library-detail { min-width: 0; min-height: 0; display: flex; }
      #${panelId} .bsb-transcript-head-actions { display: flex; align-items: center; gap: 6px; flex-shrink: 0; }
      #${panelId} .bsb-transcript-ai-link {
        height: 26px; padding: 0 8px; border-radius: 8px; cursor: pointer; font-size: 10.5px;
        border: 1px solid color-mix(in srgb, var(--ctp-lavender) 32%, transparent);
        background: color-mix(in srgb, var(--ctp-lavender) 10%, transparent); color: var(--ctp-lavender);
      }
      #${panelId} .bsb-capture-drawer {
        position: absolute; z-index: 12; top: 52px; left: 14px; right: 14px;
        padding: 12px; display: grid; gap: 9px;
        border: 1px solid color-mix(in srgb, var(--ctp-mauve) 35%, var(--ctp-surface1));
        border-radius: 14px; background: color-mix(in srgb, var(--ctp-base) 96%, transparent);
        box-shadow: 0 18px 50px rgba(0,0,0,.42); backdrop-filter: blur(18px); -webkit-backdrop-filter: blur(18px);
      }
      #${panelId} .bsb-capture-drawer[hidden] { display: none !important; }
      #${panelId} .bsb-capture-head { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
      #${panelId} .bsb-capture-head strong { font-size: 13px; }
      #${panelId} .bsb-capture-head span { font-size: 10px; color: var(--ctp-overlay1); }
      #${panelId} .bsb-capture-actions { display:flex; gap:6px; justify-content:flex-end; }
      @media (max-width: 700px) {
        #${panelId} .bsb-library-layout { grid-template-columns: minmax(150px, 38%) minmax(0,1fr); }
        #${panelId} .bsb-library-filterbar { display: none; }
      }
      #${panelId} .bsb-transcript-shell {
        flex: 1 1 0; min-width: 0; min-height: 0; overflow: hidden;
        display: flex; flex-direction: column;
        border: 1px solid color-mix(in srgb, var(--ctp-surface1) 55%, transparent);
        border-radius: 14px; background: color-mix(in srgb, var(--ctp-base) 62%, transparent);
        contain: layout paint style;
      }
      #${panelId} .bsb-transcript-head {
        display: flex; align-items: center; justify-content: space-between; gap: 8px;
        padding: 9px 10px 7px; border-bottom: 1px solid color-mix(in srgb, var(--ctp-surface0) 70%, transparent);
      }
      #${panelId} .bsb-transcript-title { min-width: 0; display: grid; gap: 2px; }
      #${panelId} .bsb-transcript-title strong {
        font-size: 12px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
      }
      #${panelId} .bsb-transcript-title span { font-size: 10px; color: var(--ctp-overlay1); }
      #${panelId} .bsb-transcript-tools {
        padding: 8px 10px; display: flex; flex-wrap: wrap; gap: 6px; align-items: center;
        border-bottom: 1px solid color-mix(in srgb, var(--ctp-surface0) 62%, transparent);
      }
      #${panelId} .bsb-transcript-toolbar-end {
        display: flex; flex-wrap: wrap; align-items: center; gap: 6px; margin-left: auto;
      }
      #${panelId} .bsb-toolbar-sep {
        width: 1px; height: 16px; background: color-mix(in srgb, var(--ctp-surface1) 70%, transparent);
      }
      #${panelId} .bsb-export-group { display: flex; gap: 4px; }
      #${panelId} .bsb-export-group button {
        height: 31px; padding: 0 8px; border-radius: 9px; cursor: pointer; font-size: 10.5px;
        border: 1px solid color-mix(in srgb, var(--ctp-surface2) 58%, transparent);
        background: color-mix(in srgb, var(--ctp-surface0) 50%, transparent); color: var(--ctp-text);
      }
      #${panelId} .bsb-export-group button.primary {
        border-color: color-mix(in srgb, var(--ctp-blue) 38%, transparent);
        background: color-mix(in srgb, var(--ctp-blue) 14%, var(--ctp-surface0));
      }
      #${panelId} .bsb-transcript-search {
        flex: 1 1 160px; min-width: 140px;
        height: 31px; display: grid; grid-template-columns: auto minmax(0,1fr) auto;
        align-items: center; gap: 6px; padding: 0 8px; border-radius: 9px;
        border: 1px solid color-mix(in srgb, var(--ctp-surface2) 58%, transparent);
        background: color-mix(in srgb, var(--ctp-mantle) 60%, transparent);
      }
      #${panelId} .bsb-transcript-search input {
        min-width: 0; width: 100%; border: 0; outline: 0; background: transparent;
        color: var(--ctp-text); font-size: 11.5px;
      }
      #${panelId} .bsb-transcript-count { font-size: 10px; color: var(--ctp-overlay1); font-variant-numeric: tabular-nums; }
      #${panelId} .bsb-transcript-track {
        max-width: 118px; height: 31px; border-radius: 9px; padding: 0 7px;
        border: 1px solid color-mix(in srgb, var(--ctp-surface2) 58%, transparent);
        background: color-mix(in srgb, var(--ctp-mantle) 60%, transparent); color: var(--ctp-text); font-size: 10.5px;
      }
      #${panelId} .bsb-transcript-follow { font-size: 10.5px; color: var(--ctp-subtext0); white-space: nowrap; }
      #${panelId} .bsb-transcript-follow input { accent-color: var(--ctp-sapphire); }
      #${panelId} .bsb-transcript-refresh {
        height: 31px; padding: 0 8px; border-radius: 9px; cursor: pointer;
        border: 1px solid color-mix(in srgb, var(--ctp-surface2) 58%, transparent);
        background: color-mix(in srgb, var(--ctp-surface0) 50%, transparent); color: var(--ctp-text); font-size: 10.5px;
      }
      #${panelId} .bsb-transcript-list {
        flex: 1 1 0; min-height: 0; overflow-y: auto; overscroll-behavior: contain;
        padding: 4px 7px 14px; scroll-padding-block: 38%;
      }
      #${panelId} .bsb-transcript-row {
        content-visibility: auto; contain-intrinsic-size: auto 58px; contain: layout paint style;
        display: grid; grid-template-columns: 52px minmax(0,1fr); gap: 8px; align-items: start;
        padding: 8px 7px; border-radius: 9px; border-left: 3px solid transparent;
      }
      #${panelId} .bsb-transcript-row:hover { background: color-mix(in srgb, var(--ctp-surface0) 45%, transparent); }
      #${panelId} .bsb-transcript-row.active {
        background: color-mix(in srgb, var(--ctp-sapphire) 12%, transparent);
        border-left-color: var(--ctp-sapphire);
      }
      #${panelId} .bsb-transcript-time {
        border: 0; background: transparent; color: var(--ctp-sapphire); cursor: pointer;
        padding: 2px 0; text-align: left; font-size: 10.5px; font-variant-numeric: tabular-nums;
      }
      #${panelId} .bsb-transcript-text {
        margin: 0; color: var(--ctp-subtext1); font-size: 12px; line-height: 1.62; overflow-wrap: anywhere;
      }
      #${panelId} .bsb-transcript-row.active .bsb-transcript-text { color: var(--ctp-text); font-weight: 600; }
      #${panelId} .bsb-transcript-text mark {
        background: color-mix(in srgb, var(--ctp-yellow) 48%, transparent); color: inherit; border-radius: 3px; padding: 0 .08em;
      }
      #${panelId} .bsb-transcript-empty {
        min-height: 120px; display: grid; place-items: center; text-align: center;
        color: var(--ctp-overlay1); font-size: 11.5px; line-height: 1.55; padding: 20px;
      }
      @media (max-width: 640px) {
        #${panelId} .bsb-transcript-follow { display: none; }
        #${panelId} .bsb-library-jobbar { flex-wrap: wrap; }
      }

      #${panelId} .bsb-empty {
        padding: 36px 16px; text-align: center; color: var(--ctp-overlay1);
        display: flex; flex-direction: column; align-items: center; gap: 8px;
      }
      #${panelId} .bsb-empty .bsb-empty-ico {
        width: 48px; height: 48px; border-radius: 16px;
        display: flex; align-items: center; justify-content: center;
        font-size: 22px;
        background: color-mix(in srgb, var(--ctp-surface0) 55%, transparent);
        border: 1px solid color-mix(in srgb, var(--ctp-surface1) 45%, transparent);
      }
      #${panelId} .bsb-empty strong { color: var(--ctp-subtext1); font-size: 13px; }
      #${panelId} .bsb-empty span { font-size: 12px; max-width: 280px; line-height: 1.45; }

`;
}
