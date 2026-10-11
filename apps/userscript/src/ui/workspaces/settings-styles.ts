/** CSS extracted without reordering original rules. */
export function renderSettingsStyles(panelId: string): string {
  return `
      /* 设置页 */
      #${panelId} .bsb-settings {
        overflow: auto; flex: 1; min-height: 0;
        display: flex; flex-direction: column; gap: 12px;
        padding-right: 2px;
      }
      #${panelId} .bsb-card {
        border-radius: 14px; padding: 12px 14px;
        border: 1px solid color-mix(in srgb, var(--ctp-surface1) 45%, transparent);
        background: color-mix(in srgb, var(--ctp-mantle) 45%, transparent);
      }
      #${panelId} .bsb-card h3 {
        margin: 0 0 10px; font-size: 12px; font-weight: 700;
        color: var(--ctp-subtext1); letter-spacing: 0.04em; text-transform: uppercase;
      }
      #${panelId} .bsb-ai-config label,
      #${panelId} .bsb-field label {
        display: flex; flex-direction: column; gap: 4px;
        font-size: 11.5px; color: var(--ctp-subtext1); margin-bottom: 8px;
      }
      #${panelId} .bsb-ai-config input,
      #${panelId} .bsb-ai-config textarea,
      #${panelId} .bsb-field input {
        width: 100%; border-radius: 10px;
        border: 1px solid color-mix(in srgb, var(--ctp-surface2) 55%, transparent);
        background: color-mix(in srgb, var(--ctp-base) 60%, transparent);
        color: var(--ctp-text); padding: 8px 10px; font-size: 12.5px; font-family: inherit;
        outline: none;
      }
      #${panelId} .bsb-ai-config input:focus,
      #${panelId} .bsb-ai-config textarea:focus {
        border-color: color-mix(in srgb, var(--ctp-mauve) 50%, transparent);
        box-shadow: 0 0 0 3px color-mix(in srgb, var(--ctp-mauve) 16%, transparent);
      }
      #${panelId} .bsb-ai-config textarea {
        min-height: 88px; resize: vertical; line-height: 1.45;
      }
      #${panelId} .bsb-ai-config .row2 {
        display: grid; grid-template-columns: 1fr 1fr; gap: 8px;
      }
      #${panelId} .bsb-ai-cfg-actions {
        display: flex; gap: 8px; flex-wrap: wrap; margin-top: 4px;
      }
      #${panelId} .bsb-ai-config-head {
        display: flex; align-items: flex-start; justify-content: space-between; gap: 10px;
        margin-bottom: 10px;
      }
      #${panelId} .bsb-ai-config-head p {
        margin: 0; color: var(--ctp-subtext0); font-size: 11px; line-height: 1.5;
      }
      #${panelId} .bsb-ai-profiles { display: flex; flex-direction: column; gap: 10px; }
      #${panelId} .bsb-ai-profile {
        padding: 11px; border-radius: 12px;
        border: 1px solid color-mix(in srgb, var(--ctp-surface2) 48%, transparent);
        background: color-mix(in srgb, var(--ctp-base) 32%, transparent);
      }
      #${panelId} .bsb-ai-profile.disabled { opacity: .62; }
      #${panelId} .bsb-ai-profile-title {
        display: flex; align-items: center; gap: 8px; margin-bottom: 9px;
      }
      #${panelId} .bsb-ai-profile-title input[type="checkbox"] { width: auto; flex: 0 0 auto; }
      #${panelId} .bsb-ai-profile-title input[type="text"] { flex: 1 1 auto; min-width: 0; font-weight: 700; }
      #${panelId} .bsb-ai-profile-tools { display: inline-flex; gap: 5px; flex: 0 0 auto; }
      #${panelId} .bsb-ai-profile-tools button {
        height: 28px; padding: 0 8px; border-radius: 8px; font-size: 10.5px;
      }
      #${panelId} .bsb-ai-profile-summary {
        color: var(--ctp-overlay1); font-size: 10.5px; margin: -2px 0 8px;
        overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
      }
      #${panelId} .bsb-prompt-profiles { display: flex; flex-direction: column; gap: 10px; }
      #${panelId} .bsb-prompt-card {
        padding: 11px; border-radius: 12px;
        border: 1px solid color-mix(in srgb, var(--ctp-surface2) 48%, transparent);
        background: color-mix(in srgb, var(--ctp-base) 32%, transparent);
      }
      #${panelId} .bsb-prompt-card.active {
        border-color: color-mix(in srgb, var(--ctp-green) 56%, transparent);
        box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--ctp-green) 18%, transparent);
      }
      #${panelId} .bsb-prompt-card-title {
        display: flex; align-items: center; gap: 8px; margin-bottom: 9px;
      }
      #${panelId} .bsb-prompt-card-title input[type="text"] { flex: 1 1 auto; min-width: 0; font-weight: 700; }
      #${panelId} .bsb-prompt-tools { display: inline-flex; gap: 5px; flex: 0 0 auto; }
      #${panelId} .bsb-prompt-tools button {
        height: 28px; padding: 0 8px; border-radius: 8px; font-size: 10.5px;
      }
      #${panelId} .bsb-prompt-card textarea[data-prompt-field="systemPrompt"] { min-height: 250px; font-family: ui-monospace, SFMono-Regular, Consolas, monospace; font-size: 11.5px; }
      #${panelId} .bsb-prompt-card textarea[data-prompt-field="userPromptTemplate"] { min-height: 190px; font-family: ui-monospace, SFMono-Regular, Consolas, monospace; font-size: 11.5px; }
      #${panelId} .bsb-prompt-vars {
        margin-top: -3px; color: var(--ctp-overlay1); font-size: 10.5px; line-height: 1.5;
      }
      #${panelId} .bsb-prompt-vars code { color: var(--ctp-blue); }
      #${panelId} .bsb-prompt-profile-note {
        margin-top: -3px; color: var(--ctp-overlay1); font-size: 10.5px; line-height: 1.5;
      }
      #${panelId} .bsb-prompt-architecture {
        margin-top: 10px; padding: 9px 10px; border-radius: 10px;
        border: 1px solid color-mix(in srgb, var(--ctp-surface2) 45%, transparent);
        background: color-mix(in srgb, var(--ctp-mantle) 38%, transparent);
      }
      #${panelId} .bsb-prompt-architecture summary {
        cursor: pointer; color: var(--ctp-blue); font-weight: 700; font-size: 11.5px;
      }
      #${panelId} .bsb-prompt-architecture-grid {
        display: grid; gap: 7px; margin-top: 9px;
      }
      #${panelId} .bsb-prompt-architecture-grid > div {
        display: grid; grid-template-columns: minmax(112px, .34fr) 1fr; gap: 8px;
        padding: 7px 8px; border-radius: 8px;
        background: color-mix(in srgb, var(--ctp-base) 44%, transparent);
        font-size: 10.5px; line-height: 1.45;
      }
      #${panelId} .bsb-prompt-architecture-grid strong { color: var(--ctp-text); }
      #${panelId} .bsb-prompt-architecture-grid span { color: var(--ctp-subtext0); }


      /* v5.5 设置：Prompt / LLM + Master–Detail */
      #${panelId} .bsb-settings {
        overflow: hidden;
        gap: 10px;
        padding-right: 0;
      }
      #${panelId} .bsb-ai-pipeline {
        display: flex; align-items: center; gap: 6px; min-width: 0; flex-wrap: wrap;
      }
      #${panelId} .bsb-pipeline-stage {
        display: inline-flex; align-items: center; gap: 5px; min-width: 0;
        padding: 3px 6px; border: 1px solid var(--ctp-surface0); border-radius: 8px;
        background: color-mix(in srgb, var(--ctp-mantle) 84%, transparent);
      }
      #${panelId} .bsb-pipeline-stage > span { color: var(--ctp-subtext0); font-size: 10.5px; white-space: nowrap; }
      #${panelId} .bsb-pipeline-stage select { max-width: 180px; min-width: 90px; }
      #${panelId} .bsb-pipeline-toggle { display:inline-flex; align-items:center; gap:4px; font-size:10.5px; color:var(--ctp-text); white-space:nowrap; }
      #${panelId} .bsb-pipeline-arrow { color: var(--ctp-overlay1); font-weight: 800; }
      #${panelId} .bsb-config-stage-badge {
        flex: 0 0 auto; font-size: 9px; line-height: 1; padding: 4px 5px; border-radius: 5px;
        color: var(--ctp-subtext1); background: var(--ctp-surface0); text-transform: uppercase;
      }
      #${panelId} .bsb-config-stage-badge.preprocess { color: var(--ctp-green); }
      #${panelId} .bsb-config-stage-badge.postprocess { color: var(--ctp-blue); }
      #${panelId} .bsb-prompt-stage-tabs {
        display:flex; gap:4px; flex:0 0 auto; padding:6px; border:1px solid var(--ctp-surface0);
        border-radius:10px; background:color-mix(in srgb,var(--ctp-mantle) 84%,transparent);
      }
      #${panelId} .bsb-prompt-stage-tabs button {
        flex:1 1 0; border:0; border-radius:7px; padding:7px 10px; cursor:pointer;
        color:var(--ctp-subtext0); background:transparent; font-size:11px; font-weight:750;
      }
      #${panelId} .bsb-prompt-stage-tabs button.active {
        color:var(--ctp-text); background:var(--ctp-surface0); box-shadow:inset 0 0 0 1px var(--ctp-surface1);
      }
      #${panelId} .bsb-prompt-stage-tabs button[data-prompt-stage-tab="preprocess"].active { color:var(--ctp-green); }
      #${panelId} .bsb-prompt-stage-tabs button[data-prompt-stage-tab="postprocess"].active { color:var(--ctp-blue); }
      #${panelId} .bsb-prompt-stage-tabs button[data-prompt-stage-tab="knowledge"].active { color:var(--ctp-mauve); }
      #${panelId} .bsb-prompt-stage-context {
        display:flex; align-items:center; justify-content:space-between; gap:8px; padding:1px 2px 0;
        color:var(--ctp-overlay1); font-size:9.5px; line-height:1.4;
      }
      #${panelId} [data-prompt-create-stage][hidden] { display:none !important; }
      #${panelId} .bsb-preprocess-note {
        margin: 8px 0 0; padding: 8px 10px; border-radius: 8px; border: 1px solid var(--ctp-surface0);
        color: var(--ctp-subtext0); background: var(--ctp-mantle); font-size: 10.5px; line-height: 1.55;
      }

`;
}
