/** Legacy-preserving base shell CSS, rendered before workspace styles and later overrides. */
export function renderShellStyles(panelId: string, minW: number, minH: number, dockEdgePx: number): string {
  return `      #${panelId} {
        position: fixed;
        top: 0;
        left: 0;
        width: 0;
        height: 0;
        z-index: 2147483646;
        --bsb-note-font: 14px;
        --bsb-knowledge-font: 14px;
        --bsb-ui-font: 14px;
        font-family: Inter, ui-sans-serif, system-ui, -apple-system, "Segoe UI",
          "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", sans-serif;
        font-size: 14px;
        font-synthesis: none;
        isolation: isolate;
        contain: style;
        color: var(--ctp-text);
        color-scheme: dark;
        line-height: 1.45;
        pointer-events: none;
      }
      #${panelId}[data-ctp-flavor="latte"] { color-scheme: light; }
      #${panelId} * { box-sizing: border-box; }

      #${panelId} .bsb-fab,
      #${panelId} .bsb-sidebar,
      #${panelId} .bsb-dock-tab {
        pointer-events: auto;
      }

      #${panelId} .bsb-fab {
        position: fixed;
        right: 14px;
        bottom: 88px;
        width: 46px;
        height: 46px;
        border-radius: 14px;
        border: 1px solid color-mix(in srgb, var(--ctp-lavender) 45%, transparent);
        cursor: pointer;
        background: color-mix(in srgb, var(--ctp-mantle) 55%, transparent);
        color: var(--ctp-lavender);
        font-weight: 700;
        font-size: 12px;
        letter-spacing: 0.04em;
        box-shadow: 0 8px 28px color-mix(in srgb, var(--ctp-crust) 55%, transparent);
        backdrop-filter: blur(14px) saturate(1.2);
        -webkit-backdrop-filter: blur(14px) saturate(1.2);
        display: flex;
        align-items: center;
        justify-content: center;
        transition: transform .15s ease, border-color .15s ease, color .15s ease,
          background .15s ease, opacity .15s ease;
      }
      #${panelId} .bsb-fab:hover {
        transform: translateY(-1px);
        color: var(--ctp-base);
        background: color-mix(in srgb, var(--ctp-lavender) 88%, transparent);
        border-color: var(--ctp-lavender);
      }
      #${panelId}.open .bsb-fab,
      #${panelId}.docked .bsb-fab {
        opacity: 0;
        visibility: hidden;
        pointer-events: none;
      }

      /* 悬浮玻璃工作台 */
      #${panelId} .bsb-sidebar {
        position: fixed;
        display: none;
        flex-direction: column;
        overflow: hidden;
        border-radius: 18px;
        border: 1px solid color-mix(in srgb, var(--ctp-overlay0) 32%, transparent);
        background: color-mix(in srgb, var(--ctp-base) 72%, transparent);
        backdrop-filter: blur(22px) saturate(1.4);
        -webkit-backdrop-filter: blur(22px) saturate(1.4);
        box-shadow:
          0 24px 64px color-mix(in srgb, var(--ctp-crust) 55%, transparent),
          0 0 0 1px color-mix(in srgb, var(--ctp-lavender) 8%, transparent),
          inset 0 1px 0 color-mix(in srgb, var(--ctp-overlay2) 22%, transparent);
        min-width: ${minW}px;
        min-height: ${minH}px;
        contain: layout paint style;
      }
      #${panelId}.open:not(.docked) .bsb-sidebar {
        display: flex;
      }
      /* 贴边收起时：主面板隐藏，只留 dock-tab；展开时显示 */
      #${panelId}.docked.dock-expanded .bsb-sidebar {
        display: flex;
      }

      /* 贴边标签 */
      #${panelId} .bsb-dock-tab {
        display: none;
        position: fixed;
        top: 50%;
        transform: translateY(-50%);
        width: ${dockEdgePx}px;
        padding: 14px 0;
        writing-mode: vertical-rl;
        text-orientation: mixed;
        letter-spacing: 0.18em;
        font-size: 12px;
        font-weight: 650;
        color: var(--ctp-lavender);
        cursor: pointer;
        user-select: none;
        border: 1px solid color-mix(in srgb, var(--ctp-lavender) 40%, transparent);
        background: color-mix(in srgb, var(--ctp-mantle) 62%, transparent);
        backdrop-filter: blur(14px) saturate(1.2);
        -webkit-backdrop-filter: blur(14px) saturate(1.2);
        box-shadow: 0 8px 28px color-mix(in srgb, var(--ctp-crust) 40%, transparent);
        z-index: 1;
      }
      #${panelId}.docked .bsb-dock-tab { display: flex; align-items: center; justify-content: center; }
      #${panelId}.docked[data-dock="right"] .bsb-dock-tab {
        right: 0;
        border-radius: 12px 0 0 12px;
        border-right: none;
      }
      #${panelId}.docked[data-dock="left"] .bsb-dock-tab {
        left: 0;
        border-radius: 0 12px 12px 0;
        border-left: none;
      }
      #${panelId} .bsb-dock-tab:hover {
        color: var(--ctp-base);
        background: color-mix(in srgb, var(--ctp-lavender) 85%, transparent);
      }

      #${panelId} .bsb-head {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 12px 14px 10px;
        flex-shrink: 0;
        gap: 10px;
        border-bottom: 1px solid color-mix(in srgb, var(--ctp-surface0) 80%, transparent);
        background:
          linear-gradient(180deg,
            color-mix(in srgb, var(--ctp-mantle) 70%, transparent) 0%,
            color-mix(in srgb, var(--ctp-base) 35%, transparent) 100%);
        cursor: grab;
        user-select: none;
        touch-action: none;
      }
      #${panelId} .bsb-head:active { cursor: grabbing; }
      #${panelId} .bsb-head .bsb-head-title {
        flex: 1;
        min-width: 0;
        display: flex;
        align-items: center;
        flex-wrap: wrap;
        gap: 6px;
      }
      #${panelId} .bsb-logo {
        width: 28px; height: 28px; border-radius: 9px;
        display: inline-flex; align-items: center; justify-content: center;
        font-size: 11px; font-weight: 800; letter-spacing: -0.02em;
        color: var(--ctp-crust);
        background: linear-gradient(135deg, var(--ctp-lavender), var(--ctp-mauve));
        box-shadow: 0 4px 14px color-mix(in srgb, var(--ctp-mauve) 35%, transparent);
      }
      #${panelId} .bsb-head strong {
        font-size: 14px;
        font-weight: 700;
        color: var(--ctp-text);
        letter-spacing: 0.01em;
      }
      #${panelId} .bsb-head .bsb-ver {
        font-size: 10px;
        color: var(--ctp-overlay1);
        font-weight: 500;
        padding: 2px 7px;
        border-radius: 999px;
        background: color-mix(in srgb, var(--ctp-surface0) 55%, transparent);
      }
      #${panelId} .bsb-flavor {
        display: none;
      }
      #${panelId} .bsb-size-switch {
        display: inline-flex;
        align-items: center;
        padding: 2px;
        gap: 1px;
        border-radius: 9px;
        border: 1px solid color-mix(in srgb, var(--ctp-surface1) 58%, transparent);
        background: color-mix(in srgb, var(--ctp-crust) 36%, transparent);
      }
      #${panelId} .bsb-size-switch button {
        width: 25px;
        height: 23px;
        padding: 0;
        border: 0;
        border-radius: 6px;
        background: transparent;
        color: var(--ctp-overlay1);
        cursor: pointer;
        font-size: 10.5px;
        font-weight: 700;
      }
      #${panelId} .bsb-size-switch button:hover {
        color: var(--ctp-text);
        background: color-mix(in srgb, var(--ctp-surface1) 55%, transparent);
      }
      #${panelId} .bsb-size-switch button.active {
        color: var(--ctp-crust);
        background: linear-gradient(135deg, var(--ctp-lavender), var(--ctp-mauve));
        box-shadow: 0 3px 10px color-mix(in srgb, var(--ctp-mauve) 24%, transparent);
      }
      #${panelId}[data-panel-size="small"] .bsb-head {
        padding-inline: 10px;
        gap: 6px;
      }
      #${panelId}[data-panel-size="small"] .bsb-head .bsb-ver,
      #${panelId}[data-panel-size="small"] .bsb-ai-compact-stats {
        display: none;
      }
      #${panelId}[data-panel-size="small"] .bsb-ai-commandbar {
        gap: 5px;
      }
      #${panelId}[data-panel-size="small"] .bsb-ai-command-actions {
        gap: 3px;
      }
      #${panelId}[data-panel-size="small"] .bsb-ai-command-actions .bsb-btn {
        padding-inline: 7px;
      }
      #${panelId}[data-panel-size="small"] .bsb-ai-md {
        padding-inline: 15px;
      }
      #${panelId}[data-panel-size="small"] .bsb-ai-content {
        max-width: 100%;
      }
      #${panelId}[data-panel-size="medium"] .bsb-ai-content {
        max-width: 56em;
      }
      #${panelId}[data-panel-size="large"] .bsb-ai-content {
        max-width: 72em;
      }
      /* 主导航 */
      #${panelId} .bsb-nav {
        display: flex;
        gap: 4px;
        padding: 8px 12px;
        flex-shrink: 0;
        border-bottom: 1px solid color-mix(in srgb, var(--ctp-surface0) 70%, transparent);
        background: color-mix(in srgb, var(--ctp-mantle) 35%, transparent);
      }
      #${panelId} .bsb-nav button {
        flex: 1;
        height: 36px;
        border: none;
        border-radius: 11px;
        cursor: pointer;
        font-size: 12.5px;
        font-weight: 650;
        color: var(--ctp-subtext0);
        background: transparent;
        transition: background .15s, color .15s, box-shadow .15s;
        letter-spacing: 0.01em;
      }
      #${panelId} .bsb-nav button:hover {
        color: var(--ctp-text);
        background: color-mix(in srgb, var(--ctp-surface0) 45%, transparent);
      }
      #${panelId} .bsb-nav button.active {
        color: var(--ctp-crust);
        background: linear-gradient(135deg,
          color-mix(in srgb, var(--ctp-lavender) 92%, transparent),
          color-mix(in srgb, var(--ctp-mauve) 88%, transparent));
        box-shadow: 0 6px 18px color-mix(in srgb, var(--ctp-mauve) 28%, transparent);
      }
      #${panelId} .bsb-head-actions {
        display: flex;
        align-items: center;
        gap: 4px;
        flex-shrink: 0;
      }
      #${panelId} .bsb-icon-btn {
        width: 28px;
        height: 28px;
        border-radius: 8px;
        background: color-mix(in srgb, var(--ctp-surface0) 55%, transparent);
        border: 1px solid color-mix(in srgb, var(--ctp-surface1) 60%, transparent);
        color: var(--ctp-subtext0);
        cursor: pointer;
        font-size: 14px;
        line-height: 1;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        transition: color .12s, background .12s, border-color .12s;
      }
      #${panelId} .bsb-icon-btn:hover {
        color: var(--ctp-lavender);
        border-color: color-mix(in srgb, var(--ctp-lavender) 40%, transparent);
        background: color-mix(in srgb, var(--ctp-lavender) 12%, transparent);
      }
      #${panelId} .bsb-icon-btn.bsb-close:hover {
        color: var(--ctp-red);
        border-color: color-mix(in srgb, var(--ctp-red) 40%, transparent);
        background: color-mix(in srgb, var(--ctp-red) 12%, transparent);
      }

      /* 拉伸手柄 */
      #${panelId} .bsb-resize {
        position: absolute;
        z-index: 3;
        background: transparent;
      }
      #${panelId} .bsb-resize.n { top: 0; left: 10px; right: 10px; height: 6px; cursor: ns-resize; }
      #${panelId} .bsb-resize.s { bottom: 0; left: 10px; right: 10px; height: 6px; cursor: ns-resize; }
      #${panelId} .bsb-resize.e { right: 0; top: 10px; bottom: 10px; width: 6px; cursor: ew-resize; }
      #${panelId} .bsb-resize.w { left: 0; top: 10px; bottom: 10px; width: 6px; cursor: ew-resize; }
      #${panelId} .bsb-resize.ne { top: 0; right: 0; width: 12px; height: 12px; cursor: nesw-resize; }
      #${panelId} .bsb-resize.nw { top: 0; left: 0; width: 12px; height: 12px; cursor: nwse-resize; }
      #${panelId} .bsb-resize.se { bottom: 0; right: 0; width: 14px; height: 14px; cursor: nwse-resize; }
      #${panelId} .bsb-resize.sw { bottom: 0; left: 0; width: 12px; height: 12px; cursor: nesw-resize; }
      #${panelId} .bsb-resize.se::after {
        content: "";
        position: absolute;
        right: 3px;
        bottom: 3px;
        width: 8px;
        height: 8px;
        border-right: 2px solid color-mix(in srgb, var(--ctp-overlay1) 70%, transparent);
        border-bottom: 2px solid color-mix(in srgb, var(--ctp-overlay1) 70%, transparent);
        border-radius: 0 0 2px 0;
      }
      #${panelId}.docked .bsb-resize { display: none; }
      #${panelId} .bsb-sidebar.dragging,
      #${panelId} .bsb-sidebar.resizing {
        transition: none !important;
        user-select: none;
      }

      /* 内容区：三工作区切换 */
`;
}
