/** Legacy-preserving workspace CSS; original cascade order retained. */
export function renderAiStyles(panelId: string): string {
  return `
      /* ── AI 工作区（主画布） ── */
      #${panelId} .bsb-ai-hero {
        display: flex; align-items: flex-start; justify-content: space-between;
        gap: 12px; flex-shrink: 0;
      }
      #${panelId} .bsb-ai-hero h2 {
        margin: 0; font-size: 16px; font-weight: 750; color: var(--ctp-text);
        letter-spacing: -0.01em;
      }
      #${panelId} .bsb-ai-hero p {
        margin: 4px 0 0; font-size: 11.5px; color: var(--ctp-subtext0); line-height: 1.4;
      }
      #${panelId} .bsb-ai-hero-actions {
        display: flex; gap: 6px; flex-shrink: 0; align-items: center;
      }
      #${panelId} .bsb-ai-hero-actions .bsb-btn.accent {
        height: 40px; padding: 0 16px; font-size: 13px; border-radius: 12px;
      }
      #${panelId} .bsb-chips {
        display: flex; flex-wrap: wrap; gap: 6px; flex-shrink: 0;
      }
      #${panelId} .bsb-chip {
        display: inline-flex; align-items: center; gap: 5px;
        height: 26px; padding: 0 10px; border-radius: 999px; font-size: 11px; font-weight: 600;
        color: var(--ctp-subtext1);
        background: color-mix(in srgb, var(--ctp-surface0) 55%, transparent);
        border: 1px solid color-mix(in srgb, var(--ctp-surface1) 45%, transparent);
      }
      #${panelId} .bsb-chip em {
        font-style: normal; color: var(--ctp-lavender); font-weight: 700;
      }
      #${panelId} .bsb-chip.ok { color: var(--ctp-green); border-color: color-mix(in srgb, var(--ctp-green) 30%, transparent); }
      #${panelId} .bsb-chip.warn { color: var(--ctp-peach); }
      #${panelId} .bsb-ai-result-tabs {
        display: flex; gap: 6px; overflow-x: auto; flex-shrink: 0;
        padding: 1px 0 4px; scrollbar-width: thin;
      }
      #${panelId} .bsb-ai-result-tab {
        display: inline-flex; align-items: center; gap: 7px; flex: 0 0 auto;
        min-width: 108px; max-width: 220px; height: 32px; padding: 0 10px;
        border-radius: 10px; cursor: pointer; text-align: left;
        border: 1px solid color-mix(in srgb, var(--ctp-surface2) 45%, transparent);
        background: color-mix(in srgb, var(--ctp-surface0) 38%, transparent);
        color: var(--ctp-subtext0); font-size: 11px; font-weight: 650;
      }
      #${panelId} .bsb-ai-result-tab:hover {
        color: var(--ctp-text); border-color: color-mix(in srgb, var(--ctp-lavender) 38%, transparent);
      }
      #${panelId} .bsb-ai-result-tab.active {
        color: var(--ctp-text); border-color: color-mix(in srgb, var(--ctp-mauve) 58%, transparent);
        background: color-mix(in srgb, var(--ctp-mauve) 14%, var(--ctp-surface0));
      }
      #${panelId} .bsb-ai-result-tab .dot {
        width: 7px; height: 7px; border-radius: 50%; flex: 0 0 auto;
        background: var(--ctp-overlay0);
      }
      #${panelId} .bsb-ai-result-tab.running .dot { background: var(--ctp-green); animation: bsb-pulse 1.1s ease-in-out infinite; }
      #${panelId} .bsb-ai-result-tab.done .dot { background: var(--ctp-teal); }
      #${panelId} .bsb-ai-result-tab.error .dot { background: var(--ctp-red); }
      #${panelId} .bsb-ai-result-tab.stopped .dot { background: var(--ctp-peach); }
      #${panelId} .bsb-ai-result-tab .txt { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
      #${panelId} .bsb-ai-result-unit {
        display: inline-flex; align-items: stretch; min-width: 0; flex: 0 0 auto;
      }
      #${panelId} .bsb-ai-result-unit .bsb-ai-result-tab {
        border-top-right-radius: 0; border-bottom-right-radius: 0;
      }
      #${panelId} .bsb-ai-result-retry {
        width: 27px; padding: 0; margin-left: -1px; border-radius: 0 9px 9px 0;
        border: 1px solid color-mix(in srgb, var(--ctp-surface2) 55%, transparent);
        background: color-mix(in srgb, var(--ctp-surface0) 42%, transparent);
        color: var(--ctp-overlay1); cursor: pointer; font-size: 15px; line-height: 1;
      }
      #${panelId} .bsb-ai-result-unit.active .bsb-ai-result-retry,
      #${panelId} .bsb-ai-result-retry:hover {
        color: var(--ctp-lavender);
        border-color: color-mix(in srgb, var(--ctp-lavender) 45%, transparent);
        background: color-mix(in srgb, var(--ctp-lavender) 12%, transparent);
      }
      #${panelId} .bsb-ai-result-empty { color: var(--ctp-overlay1); font-size: 11px; padding: 7px 2px; }

      #${panelId} .bsb-ai-canvas-wrap {
        /* 关键：绝对填充，保证内部一定有固定高度可滚动 */
        flex: 1 1 auto;
        min-height: 280px;
        position: relative;
        border-radius: 16px;
        overflow: hidden;
        border: 1px solid color-mix(in srgb, var(--ctp-surface1) 45%, transparent);
        background:
          radial-gradient(120% 80% at 100% 0%,
            color-mix(in srgb, var(--ctp-mauve) 10%, transparent), transparent 55%),
          color-mix(in srgb, var(--ctp-crust) 62%, transparent);
        box-shadow: inset 0 1px 0 color-mix(in srgb, var(--ctp-overlay2) 10%, transparent);
      }
      #${panelId} .bsb-ai-canvas-bar {
        position: absolute; top: 0; left: 0; right: 0; height: 40px;
        z-index: 2;
        display: flex; align-items: center; justify-content: space-between; gap: 8px;
        padding: 0 12px;
        border-bottom: 1px solid color-mix(in srgb, var(--ctp-surface0) 70%, transparent);
        background: color-mix(in srgb, var(--ctp-mantle) 82%, transparent);
        backdrop-filter: blur(10px);
        -webkit-backdrop-filter: blur(10px);
        font-size: 11px; color: var(--ctp-overlay1); font-weight: 600;
        letter-spacing: 0.04em; text-transform: uppercase;
      }
      #${panelId} .bsb-ai-canvas-bar .bsb-bar-left {
        display: inline-flex; align-items: center; gap: 8px; min-width: 0;
      }
      #${panelId} .bsb-live-dot {
        width: 7px; height: 7px; border-radius: 50%;
        background: var(--ctp-overlay0); flex-shrink: 0;
      }
      #${panelId} .bsb-ai-stream.streaming .bsb-live-dot {
        background: var(--ctp-green);
        box-shadow: 0 0 0 3px color-mix(in srgb, var(--ctp-green) 25%, transparent);
        animation: bsb-pulse 1.1s ease-in-out infinite;
      }
      #${panelId} .bsb-ai-canvas-bar .bsb-bar-actions {
        display: inline-flex; gap: 4px; align-items: center; flex-shrink: 0;
      }
      #${panelId} .bsb-ai-canvas-bar .bsb-mini {
        height: 24px; padding: 0 8px; border-radius: 7px; font-size: 10px;
        letter-spacing: 0; text-transform: none; font-weight: 650;
        border: 1px solid color-mix(in srgb, var(--ctp-surface2) 50%, transparent);
        background: color-mix(in srgb, var(--ctp-surface0) 40%, transparent);
        color: var(--ctp-subtext0); cursor: pointer;
      }
      #${panelId} .bsb-ai-canvas-bar .bsb-mini:hover {
        color: var(--ctp-lavender); border-color: color-mix(in srgb, var(--ctp-lavender) 40%, transparent);
      }
      #${panelId} .bsb-ai-canvas-bar .bsb-mini.on {
        color: var(--ctp-teal);
        border-color: color-mix(in srgb, var(--ctp-teal) 40%, transparent);
        background: color-mix(in srgb, var(--ctp-teal) 12%, transparent);
      }
      #${panelId} .bsb-ai-stream {
        position: absolute;
        top: 40px; left: 0; right: 0; bottom: 0;
        overflow: hidden;
      }
      #${panelId} .bsb-ai-stream .bsb-ai-raw { display: none !important; }
      #${panelId} .bsb-studio-dock {
        display: none; position: absolute; left: 0; right: 0; bottom: 0; z-index: 3;
        padding: 8px 10px 10px;
        border-top: 1px solid color-mix(in srgb, var(--ctp-surface0) 75%, transparent);
        background: color-mix(in srgb, var(--ctp-mantle) 92%, transparent);
      }
      #${panelId} .bsb-ai-canvas-wrap.is-studio .bsb-studio-dock { display: block; }
      #${panelId} .bsb-ai-canvas-wrap.is-studio .bsb-ai-stream { bottom: 88px; }
      #${panelId} .bsb-ai-canvas-wrap.is-studio .bsb-jump-latest { display: none; }
      #${panelId} .bsb-ai-canvas-wrap.is-studio .bsb-ai-content {
        max-width: none;
        margin: 0;
        width: 100%;
      }
      #${panelId} .bsb-studio-composer {
        display: grid; grid-template-columns: minmax(0,1fr) auto; gap: 8px; align-items: end;
      }
      #${panelId} .bsb-studio-composer textarea {
        width: 100%; min-height: 40px; max-height: 120px; resize: none;
        padding: 9px 11px; border-radius: 12px; line-height: 1.45;
        border: 1px solid color-mix(in srgb, var(--ctp-surface1) 70%, transparent);
        background: color-mix(in srgb, var(--ctp-base) 70%, transparent);
        color: var(--ctp-text); font: inherit; font-size: 14px;
      }
      #${panelId} .bsb-studio-composer textarea:focus {
        outline: 0; border-color: color-mix(in srgb, var(--ctp-lavender) 50%, transparent);
      }
      #${panelId} .bsb-studio-composer .bsb-btn { height: 40px; padding: 0 14px; border-radius: 12px; }
      #${panelId} .bsb-studio-slash {
        position: absolute; left: 10px; right: 78px; bottom: calc(100% - 6px);
        max-height: 220px; overflow: auto; padding: 6px;
        border-radius: 12px;
        border: 1px solid color-mix(in srgb, var(--ctp-surface1) 60%, transparent);
        background: color-mix(in srgb, var(--ctp-base) 96%, transparent);
        box-shadow: 0 12px 32px color-mix(in srgb, var(--ctp-crust) 45%, transparent);
      }
      #${panelId} .bsb-studio-slash[hidden] { display: none !important; }
      #${panelId} .bsb-studio-slash button {
        display: grid; grid-template-columns: 5.5rem minmax(0,1fr); gap: 8px; align-items: center;
        width: 100%; text-align: left; padding: 7px 8px; border: 0; border-radius: 8px;
        background: transparent; color: var(--ctp-text); cursor: pointer; font: inherit;
      }
      #${panelId} .bsb-studio-slash button.active,
      #${panelId} .bsb-studio-slash button:hover {
        background: color-mix(in srgb, var(--ctp-lavender) 12%, var(--ctp-surface0));
      }
      #${panelId} .bsb-studio-slash code {
        font-size: 11.5px; font-weight: 750; color: var(--ctp-lavender);
      }
      #${panelId} .bsb-studio-slash span { font-size: 11px; color: var(--ctp-overlay1); }
      #${panelId} .bsb-studio-thread {
        display: flex; flex-direction: column; gap: 16px;
        padding: 8px 2px 20px; width: 100%;
      }
      #${panelId} .bsb-studio-msg.user {
        align-self: flex-end;
        display: flex; flex-direction: column; align-items: flex-end;
        width: fit-content; max-width: min(78%, 32rem);
      }
      #${panelId} .bsb-studio-msg.user .bsb-studio-bubble {
        padding: 9px 12px; border-radius: 14px 14px 4px 14px;
        background: color-mix(in srgb, var(--ctp-lavender) 16%, var(--ctp-surface0));
        color: var(--ctp-text); font-size: 14px; line-height: 1.55; white-space: pre-wrap;
      }
      #${panelId} .bsb-studio-msg.user .bsb-studio-role { text-align: right; }
      #${panelId} .bsb-studio-msg.assistant {
        align-self: center; width: min(100%, 40em);
      }
      #${panelId} .bsb-studio-msg.assistant .bsb-studio-answer,
      #${panelId} .bsb-studio-msg.assistant .bsb-preprocess-block-body,
      #${panelId} .bsb-studio-msg.assistant .bsb-knowledge-card-body {
        font-size: var(--bsb-knowledge-font); line-height: 1.7; color: var(--ctp-text);
      }
      #${panelId} .bsb-studio-msg.system {
        align-self: center; max-width: 28rem; text-align: center;
        font-size: 14px; color: var(--ctp-overlay1); line-height: 1.5;
      }
      #${panelId} .bsb-studio-role {
        display: block; margin-bottom: 4px; font-size: 11px; font-weight: 750;
        letter-spacing: .08em; text-transform: uppercase; color: var(--ctp-overlay0);
      }

      /*
       * 唯一滚动层：绝对定位铺满画布，height 明确，overflow-y: scroll
       * （flex 链常导致“看起来能滚其实高度在变、滚动无效”）
       */
      #${panelId} .bsb-ai-md {
        position: absolute;
        inset: 0;
        overflow-y: scroll !important;
        overflow-x: hidden !important;
        padding: 32px 28px 88px;
        box-sizing: border-box;
        font-size: var(--bsb-note-font);
        line-height: 1.9;
        letter-spacing: 0.03em;
        color: var(--ctp-text);
        scroll-behavior: auto;
        overscroll-behavior: contain;
        overflow-anchor: none; /* 禁止浏览器滚动锚定与 stick 互抢 */
        -webkit-overflow-scrolling: touch;
        touch-action: pan-y;
        font-family: "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei UI",
          "Microsoft YaHei", "Noto Sans SC", "Source Han Sans SC", system-ui, sans-serif;
      }
      #${panelId} .bsb-ai-content {
        max-width: 40em;
        margin: 0 auto;
        min-height: min-content;
        overflow-anchor: none;
      }
      #${panelId} .bsb-ai-stream-body {
        margin: 0;
        padding: 0;
        border: none;
        background: transparent;
        white-space: pre-wrap;
        word-break: break-word;
        overflow-wrap: anywhere;
        font-size: 14px;
        line-height: 2.15;
        letter-spacing: 0.04em;
        color: var(--ctp-text);
        font-family: inherit;
        display: block;
        overflow-anchor: none;
      }
      #${panelId} .bsb-ai-caret {
        display: inline-block;
        width: 0.5em; height: 1.1em;
        margin-left: 3px;
        vertical-align: text-bottom;
        background: var(--ctp-lavender);
        border-radius: 1px;
        animation: bsb-caret 1s step-end infinite;
      }
      @keyframes bsb-caret {
        0%, 100% { opacity: 1; }
        50% { opacity: 0; }
      }
      #${panelId} .bsb-ai-anchor {
        height: 24px; width: 100%; pointer-events: none; flex-shrink: 0;
      }
      /* 浮层：不在底部时跳到最新（ChatGPT 风格） */
      #${panelId} .bsb-jump-latest {
        position: absolute;
        right: 14px; bottom: 14px;
        z-index: 5;
        display: none;
        align-items: center; gap: 6px;
        height: 36px; padding: 0 14px;
        border-radius: 999px;
        border: 1px solid color-mix(in srgb, var(--ctp-lavender) 40%, transparent);
        background: color-mix(in srgb, var(--ctp-mantle) 88%, transparent);
        color: var(--ctp-lavender);
        font-size: 12px; font-weight: 700;
        cursor: pointer;
        box-shadow: 0 8px 24px color-mix(in srgb, var(--ctp-crust) 45%, transparent);
        backdrop-filter: blur(12px);
        -webkit-backdrop-filter: blur(12px);
        pointer-events: auto;
      }
      #${panelId} .bsb-jump-latest.show { display: inline-flex; }
      #${panelId} .bsb-jump-latest:hover {
        color: var(--ctp-crust);
        background: color-mix(in srgb, var(--ctp-lavender) 88%, transparent);
      }

      /* Markdown 阅读优化：更大间距、更松段落 */
      #${panelId} .bsb-ai-md h1,
      #${panelId} .bsb-ai-md h2,
      #${panelId} .bsb-ai-md h3,
      #${panelId} .bsb-ai-md h4 {
        color: var(--ctp-lavender);
        font-weight: 700;
        letter-spacing: 0.01em;
        line-height: 1.35;
      }
      #${panelId} .bsb-ai-md h1 {
        font-size: 14px; margin: 1.6em 0 0.8em;
        padding-bottom: 0.4em;
        border-bottom: 1px solid color-mix(in srgb, var(--ctp-surface1) 50%, transparent);
      }
      #${panelId} .bsb-ai-md h1:first-child { margin-top: 0.15em; }
      #${panelId} .bsb-ai-md h2 {
        font-size: 14px; margin: 1.55em 0 0.7em; color: var(--ctp-mauve);
      }
      #${panelId} .bsb-ai-md h3 {
        font-size: 14px; margin: 1.4em 0 0.6em; color: var(--ctp-sapphire);
      }
      #${panelId} .bsb-ai-md p {
        margin: 1.15em 0;
        line-height: 1.95;
      }
      #${panelId} .bsb-ai-md ul,
      #${panelId} .bsb-ai-md ol {
        margin: 1.1em 0;
        padding-left: 1.7em;
      }
      #${panelId} .bsb-ai-md li {
        margin: 0.65em 0;
        line-height: 1.95;
        padding-left: 0.25em;
      }
      #${panelId} .bsb-ai-md li > p { margin: 0.35em 0; }
      #${panelId} .bsb-ai-md a { color: var(--ctp-blue); text-decoration: none; }
      #${panelId} .bsb-ai-md a:hover { text-decoration: underline; }
      #${panelId} .bsb-ai-md strong { color: var(--ctp-rosewater); font-weight: 700; }
      #${panelId} .bsb-ai-md em { color: var(--ctp-subtext1); }
      #${panelId} .bsb-ai-md blockquote {
        margin: 1.1em 0;
        padding: 0.75em 1.1em;
        border-left: 3px solid var(--ctp-mauve);
        color: var(--ctp-subtext0);
        background: color-mix(in srgb, var(--ctp-surface0) 28%, transparent);
        border-radius: 0 12px 12px 0;
        line-height: 1.85;
      }
      #${panelId} .bsb-ai-md table {
        border-collapse: separate; border-spacing: 0;
        width: 100%; margin: 1.1em 0; font-size: 13.5px;
        overflow: hidden; border-radius: 12px;
        border: 1px solid color-mix(in srgb, var(--ctp-surface1) 55%, transparent);
      }
      #${panelId} .bsb-ai-md th, #${panelId} .bsb-ai-md td {
        border-bottom: 1px solid color-mix(in srgb, var(--ctp-surface1) 45%, transparent);
        padding: 10px 12px;
        line-height: 1.55;
      }
      #${panelId} .bsb-ai-md tr:last-child td { border-bottom: none; }
      #${panelId} .bsb-ai-md th {
        background: color-mix(in srgb, var(--ctp-surface0) 55%, transparent);
        color: var(--ctp-subtext1); font-weight: 650;
      }
      #${panelId} .bsb-ai-md pre {
        margin: 1.1em 0; padding: 14px 16px; border-radius: 14px;
        overflow: auto; max-height: 420px;
        background: var(--ctp-crust);
        border: 1px solid color-mix(in srgb, var(--ctp-surface1) 40%, transparent);
        line-height: 1.55;
      }
      #${panelId} .bsb-ai-md code {
        font-family: "JetBrains Mono", "Fira Code", ui-monospace, monospace;
        font-size: 0.9em;
      }
      #${panelId} .bsb-ai-md :not(pre) > code {
        background: color-mix(in srgb, var(--ctp-surface0) 60%, transparent);
        padding: 0.15em 0.4em; border-radius: 6px; color: var(--ctp-peach);
      }
      #${panelId} .bsb-ai-md .hljs { background: transparent; color: var(--ctp-text); }
      #${panelId} .bsb-ai-md .mermaid {
        margin: 1.25em 0;
        min-height: 86px;
        text-align: left;
      }
      #${panelId} .bsb-mermaid-error {
        overflow: hidden;
        border: 1px solid color-mix(in srgb, var(--ctp-red) 42%, var(--ctp-surface1));
        border-radius: 12px;
        background: color-mix(in srgb, var(--ctp-mantle) 78%, transparent);
      }
      #${panelId} .bsb-mermaid-error.is-setup {
        border-color: color-mix(in srgb, var(--ctp-lavender) 42%, var(--ctp-surface1));
      }
      #${panelId} .bsb-mermaid-error-head {
        min-height: 42px;
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 10px;
        padding: 7px 10px 7px 13px;
        color: var(--ctp-peach);
        border-bottom: 1px solid color-mix(in srgb, var(--ctp-red) 24%, transparent);
      }
      #${panelId} .bsb-mermaid-error.is-setup .bsb-mermaid-error-head {
        color: var(--ctp-lavender);
        border-bottom-color: color-mix(in srgb, var(--ctp-lavender) 22%, transparent);
      }
      #${panelId} .bsb-mermaid-setup {
        display: grid; gap: 10px; padding: 12px 13px 14px;
      }
      #${panelId} .bsb-mermaid-setup-copy {
        margin: 0; color: var(--ctp-subtext0); font-size: 14px; line-height: 1.55;
      }
      #${panelId} .bsb-mermaid-setup-path {
        display: flex; flex-wrap: wrap; gap: 6px; align-items: center;
        color: var(--ctp-overlay1); font-size: 12px;
      }
      #${panelId} .bsb-mermaid-setup-path b {
        display: inline-flex; align-items: center; height: 22px; padding: 0 8px;
        border-radius: 999px; font-weight: 700; color: var(--ctp-text);
        background: color-mix(in srgb, var(--ctp-lavender) 14%, var(--ctp-surface0));
      }
      #${panelId} .bsb-mermaid-setup-row {
        display: flex; flex-wrap: wrap; gap: 8px; align-items: end;
      }
      #${panelId} .bsb-mermaid-setup-row label,
      #${panelId} .bsb-mermaid-setup-grid label {
        display: grid; gap: 4px; min-width: 0; color: var(--ctp-overlay1); font-size: 12px;
      }
      #${panelId} .bsb-mermaid-setup-row select,
      #${panelId} .bsb-mermaid-setup-grid input {
        height: 34px; min-width: 12rem; padding: 0 10px; border-radius: 9px;
        border: 1px solid color-mix(in srgb, var(--ctp-surface1) 70%, transparent);
        background: color-mix(in srgb, var(--ctp-base) 70%, transparent);
        color: var(--ctp-text); font: inherit; font-size: 14px;
      }
      #${panelId} .bsb-mermaid-setup-grid {
        display: grid; gap: 8px;
        grid-template-columns: repeat(auto-fit, minmax(11rem, 1fr));
      }
      #${panelId} .bsb-mermaid-setup-actions { display: flex; flex-wrap: wrap; gap: 8px; }
      #${panelId} .bsb-mermaid-error details { padding: 9px 12px 12px; }
      #${panelId} .bsb-mermaid-error summary { cursor: pointer; color: var(--ctp-overlay1); }
      #${panelId} .bsb-mermaid-error pre { margin: 10px 0 0; max-height: 280px; overflow: auto; }
      #${panelId} .bsb-llm-field-focus {
        padding: 8px; margin: -8px; border-radius: 10px;
        outline: 2px solid color-mix(in srgb, var(--ctp-lavender) 55%, transparent);
        background: color-mix(in srgb, var(--ctp-lavender) 10%, transparent);
      }
      #${panelId} .bsb-mermaid-card {
        position: relative;
        display: grid;
        grid-template-rows: auto minmax(0, 1fr);
        min-width: 0;
        overflow: hidden;
        border-radius: 15px;
        border: 1px solid color-mix(in srgb, var(--ctp-blue) 30%, var(--ctp-surface1));
        background: var(--ctp-mantle);
        box-shadow: 0 12px 30px color-mix(in srgb, var(--ctp-crust) 45%, transparent);
        content-visibility: visible;
        contain: layout paint style;
      }
      #${panelId} .bsb-mermaid-toolbar {
        position: sticky;
        top: 0;
        z-index: 3;
        min-height: 40px;
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 8px;
        padding: 6px 8px 6px 11px;
        border-bottom: 1px solid color-mix(in srgb, var(--ctp-blue) 22%, transparent);
        background: color-mix(in srgb, var(--ctp-mantle) 96%, transparent);
        color: var(--ctp-subtext1);
        backdrop-filter: blur(10px);
        -webkit-backdrop-filter: blur(10px);
      }
      #${panelId} .bsb-mermaid-title {
        min-width: 0;
        display: inline-flex;
        align-items: center;
        gap: 7px;
        color: var(--ctp-text);
        font-size: 11px;
        font-weight: 700;
        letter-spacing: .03em;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }
      #${panelId} .bsb-mermaid-title::before {
        content: "◇";
        color: #89b4fa;
      }
      #${panelId} .bsb-mermaid-card .bsb-mermaid-title {
        font-variant-numeric: tabular-nums;
      }
      #${panelId} .bsb-mermaid-tools {
        flex: 0 0 auto;
        display: inline-flex;
        align-items: center;
        gap: 3px;
      }
      #${panelId} .bsb-mermaid-tool {
        appearance: none;
        min-width: 29px;
        height: 28px;
        padding: 0 7px;
        border: 1px solid transparent;
        border-radius: 7px;
        background: transparent;
        color: #a6adc8;
        font: 650 11px/1 system-ui, sans-serif;
        cursor: pointer;
      }
      #${panelId} .bsb-mermaid-tool:hover,
      #${panelId} .bsb-mermaid-tool:focus-visible {
        color: #f5e0dc;
        background: #313244;
        border-color: #45475a;
        outline: none;
      }
      #${panelId} .bsb-mermaid-scale {
        min-width: 42px;
        color: #89b4fa;
        text-align: center;
        font: 700 10px/1 ui-monospace, monospace;
        font-variant-numeric: tabular-nums;
      }
      #${panelId} .bsb-mermaid-viewport {
        position: relative;
        min-height: 220px;
        max-height: min(68vh, 720px);
        overflow: auto;
        overscroll-behavior: contain;
        scrollbar-width: thin;
        padding: 18px;
        background:
          linear-gradient(rgba(69, 71, 90, .18) 1px, transparent 1px),
          linear-gradient(90deg, rgba(69, 71, 90, .18) 1px, transparent 1px),
          #181825;
        background-size: 24px 24px;
      }
      #${panelId} .bsb-mermaid-stage {
        width: var(--bsb-mermaid-width, 760px);
        min-width: 1px;
        margin: 0 auto;
        transform-origin: top left;
      }
      #${panelId} .bsb-mermaid-svg {
        display: block;
        width: 100% !important;
        height: auto !important;
        max-width: none !important;
        overflow: visible;
        shape-rendering: geometricPrecision;
        text-rendering: geometricPrecision;
      }
      #${panelId} .bsb-mermaid-svg text,
      #${panelId} .bsb-mermaid-svg .label,
      #${panelId} .bsb-mermaid-svg .nodeLabel,
      #${panelId} .bsb-mermaid-svg .edgeLabel {
        font-family: Inter, "PingFang SC", "Microsoft YaHei", system-ui, sans-serif !important;
        -webkit-font-smoothing: antialiased;
      }
      #${panelId} .bsb-mermaid-hint {
        position: absolute;
        right: 10px;
        bottom: 8px;
        z-index: 2;
        pointer-events: none;
        padding: 3px 7px;
        border-radius: 6px;
        background: rgba(17, 17, 27, .78);
        color: #7f849c;
        font-size: 9px;
      }
      #${panelId} .bsb-mermaid-modal {
        position: fixed;
        inset: 0;
        z-index: 2147483647;
        pointer-events: auto;
        display: grid;
        place-items: stretch;
        padding: 18px;
        background: rgba(10, 10, 16, .88);
        backdrop-filter: blur(10px);
        -webkit-backdrop-filter: blur(10px);
      }
      #${panelId} .bsb-mermaid-modal .bsb-mermaid-card {
        width: 100%;
        height: 100%;
        max-width: none;
        border-radius: 14px;
        box-shadow: 0 25px 90px rgba(0, 0, 0, .55);
      }
      #${panelId} .bsb-mermaid-modal .bsb-mermaid-viewport {
        max-height: none;
        min-height: 0;
      }
      #${panelId} .bsb-mermaid-card[data-fit="fit"] .bsb-mermaid-stage {
        margin-inline: auto;
      }
      @media (max-width: 560px) {
        #${panelId} .bsb-mermaid-viewport { padding: 12px; min-height: 190px; }
        #${panelId} .bsb-mermaid-title { display: none; }
        #${panelId} .bsb-mermaid-modal { padding: 0; }
        #${panelId} .bsb-mermaid-modal .bsb-mermaid-card { border-radius: 0; }
      }
      /* KaTeX 数学公式（深色面板） */
      #${panelId} .bsb-ai-md .katex {
        color: var(--ctp-text);
        font-size: 1.12em;
      }
      #${panelId} .bsb-ai-md .bsb-katex-inline {
        display: inline;
        padding: 0 0.1em;
      }
      #${panelId} .bsb-ai-md .bsb-katex-display {
        display: block;
        margin: 1.2em 0;
        padding: 14px 12px;
        overflow-x: auto;
        overflow-y: hidden;
        text-align: center;
        border-radius: 12px;
        background: color-mix(in srgb, var(--ctp-mantle) 55%, transparent);
        border: 1px solid color-mix(in srgb, var(--ctp-surface0) 45%, transparent);
      }
      #${panelId} .bsb-ai-md .bsb-katex-display .katex-display {
        margin: 0;
      }
      #${panelId} .bsb-ai-md .katex-error {
        color: var(--ctp-red) !important;
      }
      #${panelId} .bsb-ai-md .bsb-math-fallback {
        color: var(--ctp-peach);
        white-space: pre-wrap;
        font-family: "JetBrains Mono", ui-monospace, monospace;
        font-size: 0.92em;
      }
      #${panelId} .bsb-ai-md pre.bsb-math-fallback {
        margin: 1em 0;
        padding: 12px 14px;
        border-radius: 12px;
        background: color-mix(in srgb, var(--ctp-mantle) 55%, transparent);
        border: 1px solid color-mix(in srgb, var(--ctp-peach) 28%, transparent);
      }
      #${panelId} .bsb-ai-md .bsb-code-lang {
        display: block; font-size: 10px; color: var(--ctp-overlay1);
        margin-bottom: 10px; text-transform: lowercase; letter-spacing: 0.06em;
      }
      #${panelId} .bsb-ai-md hr {
        border: none; height: 1px; margin: 1.6em 0;
        background: color-mix(in srgb, var(--ctp-surface1) 55%, transparent);
      }
      /* 阅读与渲染优化 */
      #${panelId}.ai-busy .bsb-sidebar,
      #${panelId} .bsb-sidebar.dragging,
      #${panelId} .bsb-sidebar.resizing {
        backdrop-filter: none;
        -webkit-backdrop-filter: none;
      }
      #${panelId} .bsb-ai-mode-row {
        display: flex; align-items: center; gap: 8px; flex-wrap: wrap;
        margin: 0 0 10px;
      }
      #${panelId} .bsb-ai-mode-row label {
        display: inline-flex; align-items: center; gap: 7px;
        color: var(--ctp-subtext0); font-size: 11px;
      }
      #${panelId} .bsb-ai-mode-row select {
        min-width: 108px; border-radius: 9px; padding: 6px 9px;
        border: 1px solid color-mix(in srgb, var(--ctp-surface2) 55%, transparent);
        background: var(--ctp-mantle); color: var(--ctp-text); outline: none;
      }
      #${panelId} .bsb-ai-content {
        overflow-anchor: none;
        text-rendering: optimizeLegibility;
      }
      #${panelId} .bsb-ai-content > :not(.bsb-toc) {
        content-visibility: auto;
        contain-intrinsic-size: auto 160px;
      }
      #${panelId} .bsb-ai-md p,
      #${panelId} .bsb-ai-md li { text-wrap: pretty; }
      #${panelId} .bsb-time-link {
        appearance: none; display: inline-flex; align-items: center;
        margin: 0 .14em; padding: .12em .46em; border-radius: 999px;
        border: 1px solid color-mix(in srgb, var(--ctp-blue) 35%, transparent);
        background: color-mix(in srgb, var(--ctp-blue) 12%, transparent);
        color: var(--ctp-blue); font: 600 .78em/1.5 ui-monospace, monospace;
        cursor: pointer; vertical-align: .08em;
      }
      #${panelId} .bsb-time-link:hover,
      #${panelId} .bsb-time-link:focus-visible {
        background: color-mix(in srgb, var(--ctp-blue) 22%, transparent);
        outline: 2px solid color-mix(in srgb, var(--ctp-blue) 32%, transparent);
      }
      #${panelId} .bsb-toc {
        margin: 0 0 1.35em; padding: 10px 12px; border-radius: 12px;
        border: 1px solid color-mix(in srgb, var(--ctp-surface1) 55%, transparent);
        background: color-mix(in srgb, var(--ctp-mantle) 55%, transparent);
        content-visibility: visible;
      }
      #${panelId} .bsb-toc summary {
        cursor: pointer; color: var(--ctp-lavender); font-weight: 700;
      }
      #${panelId} .bsb-toc nav { display: grid; gap: 5px; margin-top: 9px; }
      #${panelId} .bsb-toc button {
        appearance: none; border: 0; background: transparent; color: var(--ctp-subtext1);
        text-align: left; cursor: pointer; padding: 3px 5px; border-radius: 6px;
        overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
      }
      #${panelId} .bsb-toc button[data-level="3"] { padding-left: 20px; }
      #${panelId} .bsb-toc button:hover { color: var(--ctp-text); background: var(--ctp-surface0); }
      #${panelId} .mermaid[data-bsb-state="pending"]::before {
        content: "图表将在进入视区时渲染"; color: var(--ctp-overlay1); font-size: 11px;
      }
      @media (max-width: 560px) {
        #${panelId}.open:not(.docked) .bsb-sidebar {
          left: 0 !important; top: 0 !important; width: 100vw !important; height: 100dvh !important;
          border-radius: 0;
        }
        #${panelId} .bsb-ai-hero { align-items: flex-start; }
      }
      @media (prefers-reduced-motion: reduce) {
        #${panelId} *, #${panelId} *::before, #${panelId} *::after {
          animation-duration: .001ms !important; animation-iteration-count: 1 !important;
          transition-duration: .001ms !important; scroll-behavior: auto !important;
        }
      }

`;
}
