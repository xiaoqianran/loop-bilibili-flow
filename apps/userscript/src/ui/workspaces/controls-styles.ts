/** Shared Studio controls and capture form CSS; preserve cascade placement. */
export function renderWorkspaceControlsStyles(panelId: string): string {
  return `
      #${panelId} .bsb-badge {
        display: inline-flex; align-items: center; gap: 4px;
        background: color-mix(in srgb, var(--ctp-sapphire) 16%, transparent);
        color: var(--ctp-sapphire);
        border: 1px solid color-mix(in srgb, var(--ctp-sapphire) 28%, transparent);
        border-radius: 999px;
        padding: 3px 10px;
        font-weight: 650;
        font-size: 11px;
      }
      #${panelId} .bsb-badge.manual {
        background: color-mix(in srgb, var(--ctp-mauve) 16%, transparent);
        color: var(--ctp-mauve);
        border-color: color-mix(in srgb, var(--ctp-mauve) 28%, transparent);
      }
      #${panelId} .bsb-meta {
        margin-top: 3px;
        color: var(--ctp-subtext0);
        word-break: break-all;
        font-size: 11px;
        line-height: 1.4;
      }
      #${panelId} .bsb-mode-row {
        display: flex; flex-wrap: wrap; gap: 8px; align-items: center;
      }
      #${panelId} .bsb-mode-row label {
        display: inline-flex; align-items: center; gap: 6px; color: var(--ctp-subtext1);
      }
      #${panelId} .bsb-mode-row select,
      #${panelId} .bsb-field select {
        height: 32px; min-width: 132px; border-radius: 10px;
        border: 1px solid color-mix(in srgb, var(--ctp-surface2) 55%, transparent);
        background: color-mix(in srgb, var(--ctp-mantle) 65%, transparent);
        color: var(--ctp-text); padding: 0 10px; font-size: 12px; outline: none; cursor: pointer;
      }
      #${panelId} .bsb-mode-row select:focus {
        border-color: color-mix(in srgb, var(--ctp-mauve) 55%, transparent);
        box-shadow: 0 0 0 3px color-mix(in srgb, var(--ctp-mauve) 18%, transparent);
      }
      #${panelId} .bsb-auto-hint {
        font-size: 11px; color: var(--ctp-overlay1); flex: 1; min-width: 100px;
      }
      #${panelId} .bsb-auto-hint strong { color: var(--ctp-teal); font-weight: 650; }

      /* 通用按钮 */
      #${panelId} .bsb-btn {
        height: 34px; border-radius: 10px;
        border: 1px solid color-mix(in srgb, var(--ctp-surface2) 55%, transparent);
        background: color-mix(in srgb, var(--ctp-surface0) 50%, transparent);
        cursor: pointer; font-size: 12.5px; padding: 0 12px; color: var(--ctp-text);
        font-weight: 550; transition: background .12s, border-color .12s, color .12s, transform .12s;
      }
      #${panelId} .bsb-btn:hover:not(:disabled) {
        border-color: color-mix(in srgb, var(--ctp-lavender) 45%, transparent);
        color: var(--ctp-lavender);
        background: color-mix(in srgb, var(--ctp-surface1) 40%, transparent);
      }
      #${panelId} .bsb-btn:active:not(:disabled) { transform: scale(0.98); }
      #${panelId} .bsb-btn:disabled { opacity: .42; cursor: not-allowed; }
      #${panelId} .bsb-btn.primary {
        background: linear-gradient(135deg,
          color-mix(in srgb, var(--ctp-blue) 90%, transparent),
          color-mix(in srgb, var(--ctp-lavender) 85%, transparent));
        border-color: transparent; color: var(--ctp-crust); font-weight: 700;
        box-shadow: 0 6px 16px color-mix(in srgb, var(--ctp-blue) 25%, transparent);
      }
      #${panelId} .bsb-btn.primary:hover:not(:disabled) {
        filter: brightness(1.06); color: var(--ctp-crust);
      }
      #${panelId} .bsb-btn.accent {
        background: linear-gradient(135deg, var(--ctp-mauve), var(--ctp-pink));
        border-color: transparent; color: var(--ctp-crust); font-weight: 750;
        box-shadow: 0 8px 22px color-mix(in srgb, var(--ctp-mauve) 32%, transparent);
      }
      #${panelId} .bsb-btn.accent:hover:not(:disabled) {
        filter: brightness(1.05); color: var(--ctp-crust);
      }
      #${panelId} .bsb-btn.danger {
        color: var(--ctp-red);
        border-color: color-mix(in srgb, var(--ctp-red) 38%, transparent);
        background: color-mix(in srgb, var(--ctp-red) 12%, transparent);
      }
      #${panelId} .bsb-btn.ghost {
        background: transparent;
        border-color: color-mix(in srgb, var(--ctp-surface1) 50%, transparent);
      }
      #${panelId} .bsb-toolbar,
      #${panelId} .bsb-actions {
        display: flex; flex-wrap: wrap; gap: 6px; align-items: center;
      }
      #${panelId} .bsb-actions {
        display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 6px; flex-shrink: 0;
      }
      #${panelId} .bsb-toolbar button,
      #${panelId} .bsb-actions button {
        height: 34px; border-radius: 10px;
        border: 1px solid color-mix(in srgb, var(--ctp-surface2) 55%, transparent);
        background: color-mix(in srgb, var(--ctp-surface0) 50%, transparent);
        cursor: pointer; font-size: 12px; padding: 0 10px; color: var(--ctp-text);
      }
      #${panelId} .bsb-toolbar button.primary,
      #${panelId} .bsb-actions button.primary {
        background: color-mix(in srgb, var(--ctp-blue) 80%, transparent);
        border-color: transparent; color: var(--ctp-crust); font-weight: 650;
      }
      #${panelId} .bsb-toolbar button.danger {
        color: var(--ctp-red);
        border-color: color-mix(in srgb, var(--ctp-red) 40%, transparent);
        background: color-mix(in srgb, var(--ctp-red) 10%, transparent);
      }
      #${panelId} .bsb-toolbar button:disabled,
      #${panelId} .bsb-actions button:disabled { opacity: .45; cursor: not-allowed; }

      #${panelId} .bsb-opts {
        display: flex; flex-wrap: wrap; gap: 10px; align-items: center; color: var(--ctp-subtext1);
      }
      #${panelId} .bsb-opts label { display: inline-flex; align-items: center; gap: 5px; font-size: 11.5px; }
      #${panelId} .bsb-opts input[type="number"] {
        width: 58px; height: 28px;
        border: 1px solid color-mix(in srgb, var(--ctp-surface2) 60%, transparent);
        border-radius: 8px; padding: 0 6px; font-size: 12px; color: var(--ctp-text);
        background: color-mix(in srgb, var(--ctp-mantle) 55%, transparent); outline: none;
      }
      #${panelId} .bsb-opts input[type="checkbox"] { accent-color: var(--ctp-mauve); }

`;
}
