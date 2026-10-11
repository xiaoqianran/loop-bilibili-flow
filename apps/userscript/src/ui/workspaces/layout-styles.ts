/** Shared workspace viewport layout, kept before Compat workspace-specific rules. */
export function renderWorkspaceLayoutStyles(panelId: string): string {
  return `
      #${panelId} .bsb-body {
        padding: 0;
        overflow: hidden;
        display: flex;
        flex-direction: column;
        min-height: 0;
        flex: 1;
      }
      #${panelId} .bsb-view {
        display: none;
        flex-direction: column;
        gap: 10px;
        padding: 12px 14px 10px;
        min-height: 0;
        flex: 1 1 0;
        overflow: hidden;
      }
      #${panelId} .bsb-view.active { display: flex; }
      /* AI 页：画布吃掉剩余高度（给绝对定位阅读器当基准） */
      #${panelId} .bsb-view[data-view-panel="ai"] {
        gap: 8px;
      }
      #${panelId} .bsb-view[data-view-panel="ai"] .bsb-ai-canvas-wrap {
        flex: 1 1 0;
        min-height: 260px;
      }

  `;
}
