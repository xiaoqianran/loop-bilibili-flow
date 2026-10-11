/** Preserves legacy CSS cascade sequence. */
export function renderFolioStyles(panelId: string): string {
  return `
      /* ── HTML Folio：后处理阅读页（模型只产语义，壳负责版式） ── */
      #${panelId} .bsb-ai-md:has([data-role="html-folio"]) {
        padding-left: 0;
        padding-right: 0;
      }
      #${panelId} .bsb-ai-md:has([data-role="html-folio"]) .bsb-ai-content {
        max-width: none;
        width: 100%;
        margin: 0;
      }
      #${panelId} .bsb-folio-shell {
        position: relative;
        display: grid; grid-template-columns: 16.25rem minmax(0, 1fr);
        align-items: start;
        gap: 0; min-height: 0;
        background: var(--ctp-base);
      }
      #${panelId} .bsb-folio-toc {
        position: sticky; top: 0; align-self: start; z-index: 3;
        display: flex; flex-direction: column; gap: 12px;
        height: var(--folio-toc-h, 100%);
        max-height: var(--folio-toc-h, 100%);
        overflow: hidden;
        padding: 16px 10px 18px 12px;
        background: color-mix(in srgb, var(--ctp-mantle) 92%, var(--ctp-base));
        border-right: 1px solid color-mix(in srgb, var(--ctp-surface0) 88%, transparent);
        box-shadow: inset -1px 0 0 color-mix(in srgb, var(--ctp-lavender) 6%, transparent);
      }
      #${panelId} .bsb-folio-toc-head { flex: 0 0 auto; padding: 2px 6px 0 4px; }
      #${panelId} .bsb-folio-toc-kicker {
        display: block; margin: 0 0 4px;
        font-family: Inter, ui-sans-serif, system-ui, sans-serif;
        font-size: 10px; font-weight: 800; letter-spacing: .16em; text-transform: uppercase;
        color: var(--ctp-lavender);
      }
      #${panelId} .bsb-folio-toc-title {
        display: block; margin: 0; font-size: 14px; font-weight: 750; letter-spacing: -.02em;
        color: var(--ctp-text);
      }
      #${panelId} .bsb-folio-toc-meta {
        display: block; margin: 5px 0 0; font-style: normal;
        font-size: 11px; color: var(--ctp-overlay1);
      }
      #${panelId} .bsb-folio-toc-progress {
        display: block; height: 3px; margin: 10px 0 0; border-radius: 99px; overflow: hidden;
        background: color-mix(in srgb, var(--ctp-surface0) 80%, transparent);
      }
      #${panelId} .bsb-folio-toc-progress > i {
        display: block; height: 100%; width: 0%; border-radius: inherit;
        background: linear-gradient(90deg, var(--ctp-lavender), var(--ctp-sapphire));
        transition: width .18s ease;
      }
      #${panelId} .bsb-folio-toc-nav {
        flex: 1 1 auto; min-height: 0; overflow-x: hidden; overflow-y: auto;
        padding: 2px 2px 8px 0; scrollbar-width: thin;
      }
      #${panelId} .bsb-folio-toc-item { position: relative; margin: 0 0 2px; }
      #${panelId} .bsb-folio-toc-row { display: flex; align-items: stretch; gap: 2px; }
      #${panelId} .bsb-folio-toc-twist {
        flex: 0 0 18px; width: 18px; margin: 2px 0; padding: 0; border: 0;
        background: transparent; color: var(--ctp-overlay0); cursor: pointer; border-radius: 6px;
      }
      #${panelId} .bsb-folio-toc-twist:hover { color: var(--ctp-text); background: var(--ctp-surface0); }
      #${panelId} .bsb-folio-toc-twist::before {
        content: ""; display: block; width: 0; height: 0; margin: 0 auto;
        border-left: 5px solid currentColor;
        border-top: 3.5px solid transparent; border-bottom: 3.5px solid transparent;
        transform: rotate(0deg); transition: transform .16s ease;
      }
      #${panelId} .bsb-folio-toc-item.is-open > .bsb-folio-toc-row .bsb-folio-toc-twist::before {
        transform: rotate(90deg);
      }
      #${panelId} .bsb-folio-toc-item:not(.has-kids) .bsb-folio-toc-twist { visibility: hidden; }
      #${panelId} .bsb-folio-toc-link {
        flex: 1 1 auto; display: flex; align-items: flex-start; gap: 8px;
        min-width: 0; margin: 0; padding: 6px 8px 6px 6px;
        border: 0; border-radius: 9px; background: transparent;
        color: var(--ctp-subtext0); text-decoration: none; text-align: left;
        font-family: Inter, ui-sans-serif, system-ui, sans-serif;
        font-size: 12.5px; font-weight: 650; line-height: 1.35; cursor: pointer;
      }
      #${panelId} .bsb-folio-toc-link:hover {
        color: var(--ctp-text);
        background: color-mix(in srgb, var(--ctp-surface0) 72%, transparent);
      }
      #${panelId} .bsb-folio-toc-link.is-current {
        color: var(--ctp-text);
        background: color-mix(in srgb, var(--ctp-lavender) 16%, var(--ctp-surface0));
        box-shadow: inset 2px 0 0 var(--ctp-lavender);
      }
      #${panelId} .bsb-folio-toc-index {
        flex: 0 0 1.35rem; width: 1.35rem; height: 1.35rem; margin-top: 1px;
        display: inline-flex; align-items: center; justify-content: center;
        border-radius: 6px; font-size: 9px; font-weight: 800; letter-spacing: .02em;
        color: var(--ctp-lavender);
        background: color-mix(in srgb, var(--ctp-lavender) 14%, var(--ctp-surface0));
      }
      #${panelId} .bsb-folio-toc-link.is-current .bsb-folio-toc-index {
        color: var(--ctp-base); background: var(--ctp-lavender);
      }
      #${panelId} .bsb-folio-toc-label {
        min-width: 0; overflow: hidden; display: -webkit-box;
        -webkit-line-clamp: 2; -webkit-box-orient: vertical;
      }
      #${panelId} .bsb-folio-toc-kids {
        display: none; position: relative; margin: 1px 0 6px 27px;
        padding: 2px 0 2px 10px;
      }
      #${panelId} .bsb-folio-toc-kids::before {
        content: ""; position: absolute; left: 0; top: 4px; bottom: 4px; width: 1px;
        background: color-mix(in srgb, var(--ctp-overlay0) 28%, transparent);
      }
      #${panelId} .bsb-folio-toc-item.is-open > .bsb-folio-toc-kids { display: block; }
      #${panelId} .bsb-folio-toc-kids .bsb-folio-toc-link {
        padding: 4px 8px 4px 6px; font-size: 12px; font-weight: 500; color: var(--ctp-overlay1);
      }
      #${panelId} .bsb-folio-toc-dot {
        flex: 0 0 6px; width: 6px; height: 6px; margin: 6px 2px 0 0; border-radius: 50%;
        background: color-mix(in srgb, var(--ctp-overlay0) 55%, transparent);
      }
      #${panelId} .bsb-folio-toc-kids .bsb-folio-toc-link.is-current {
        color: var(--ctp-text);
        box-shadow: inset 2px 0 0 var(--ctp-sapphire);
        background: color-mix(in srgb, var(--ctp-sapphire) 12%, var(--ctp-surface0));
      }
      #${panelId} .bsb-folio-toc-kids .bsb-folio-toc-link.is-current .bsb-folio-toc-dot {
        background: var(--ctp-sapphire);
      }
      #${panelId} .bsb-folio-toc-fab, #${panelId} .bsb-folio-toc-scrim { display: none; }
      #${panelId} .bsb-folio h2.folio-flash, #${panelId} .bsb-folio h3.folio-flash {
        animation: bsb-folio-flash .9s ease;
      }
      @keyframes bsb-folio-flash {
        from { background: color-mix(in srgb, var(--ctp-lavender) 22%, transparent); }
        to { background: transparent; }
      }
      #${panelId} .bsb-folio-frame { min-width: 0; padding: 28px 28px 64px; }
      #${panelId} .bsb-folio {
        max-width: 40rem; margin: 0 auto;
        color: var(--ctp-text);
        font-family: "Iowan Old Style", "Palatino Linotype", Palatino, "Songti SC", "Source Han Serif SC", "Noto Serif SC", Georgia, serif;
        font-size: 14px; line-height: 1.72; letter-spacing: .005em;
      }
      #${panelId} .bsb-folio header { margin: 0 0 2.2em; }
      #${panelId} .bsb-folio .kicker {
        margin: 0 0 .7em; font-family: Inter, ui-sans-serif, system-ui, sans-serif;
        font-size: 14px; font-weight: 700; letter-spacing: .16em; text-transform: uppercase;
        color: var(--ctp-overlay0);
      }
      #${panelId} .bsb-folio h1 {
        margin: 0 0 .55em; font-size: 14px; font-weight: 650; line-height: 1.22;
        letter-spacing: -.02em; color: var(--ctp-text);
      }
      #${panelId} .bsb-folio .lede {
        margin: 0; font-size: 14px; line-height: 1.65; color: var(--ctp-subtext0);
      }
      #${panelId} .bsb-folio section { margin: 0 0 2.1em; }
      #${panelId} .bsb-folio h2 {
        margin: 0 0 .7em; padding-top: .2em; scroll-margin-top: 18px;
        font-size: 14px; font-weight: 650; letter-spacing: -.015em;
      }
      #${panelId} .bsb-folio h3 {
        margin: 1.2em 0 .45em; scroll-margin-top: 18px;
        font-size: 14px; font-weight: 650; color: var(--ctp-subtext1);
      }
      #${panelId} .bsb-folio p { margin: 0 0 .9em; }
      #${panelId} .bsb-folio ul, #${panelId} .bsb-folio ol { margin: 0 0 1em; padding-left: 1.25em; }
      #${panelId} .bsb-folio li { margin: .28em 0; }
      #${panelId} .bsb-folio ol.steps {
        list-style: none; padding: 0; counter-reset: folio-step;
      }
      #${panelId} .bsb-folio ol.steps li {
        position: relative; padding: .15em 0 .55em 2.1em;
        border-left: 1px solid color-mix(in srgb, var(--ctp-surface1) 70%, transparent);
        margin: 0 0 0 .45em;
      }
      #${panelId} .bsb-folio ol.steps li::before {
        counter-increment: folio-step; content: counter(folio-step);
        position: absolute; left: -.72em; top: .15em;
        width: 1.35em; height: 1.35em; border-radius: 50%;
        display: flex; align-items: center; justify-content: center;
        font-family: Inter, ui-sans-serif, system-ui, sans-serif;
        font-size: .68em; font-weight: 750;
        color: var(--ctp-base); background: var(--ctp-lavender);
      }
      #${panelId} .bsb-folio aside.callout,
      #${panelId} .bsb-folio aside[data-kind] {
        margin: 1.1em 0 1.25em; padding: .75em 1em .75em 1.05em;
        border-left: 2px solid var(--ctp-lavender);
        background: color-mix(in srgb, var(--ctp-surface0) 42%, transparent);
        border-radius: 0 10px 10px 0;
        font-size: .96em;
      }
      #${panelId} .bsb-folio aside[data-kind="key"] { border-left-color: var(--ctp-yellow); }
      #${panelId} .bsb-folio aside[data-kind="warn"] { border-left-color: var(--ctp-peach); }
      #${panelId} .bsb-folio aside[data-kind="note"] { border-left-color: var(--ctp-sapphire); }
      #${panelId} .bsb-folio aside.callout p:last-child,
      #${panelId} .bsb-folio aside[data-kind] p:last-child { margin-bottom: 0; }
      #${panelId} .bsb-folio figure.quote, #${panelId} .bsb-folio blockquote {
        margin: 1.15em 0 1.3em; padding: 0 0 0 1em;
        border-left: 2px solid color-mix(in srgb, var(--ctp-overlay0) 45%, transparent);
        color: var(--ctp-subtext1); font-style: italic;
      }
      #${panelId} .bsb-folio .meta {
        font-family: Inter, ui-sans-serif, system-ui, sans-serif;
        font-size: .78em; color: var(--ctp-overlay1); letter-spacing: .02em;
      }
      #${panelId} .bsb-folio table {
        width: 100%; border-collapse: collapse; margin: 0 0 1.2em;
        font-size: .92em; font-family: Inter, ui-sans-serif, system-ui, sans-serif;
      }
      #${panelId} .bsb-folio th, #${panelId} .bsb-folio td {
        text-align: left; padding: .45em .55em;
        border-bottom: 1px solid color-mix(in srgb, var(--ctp-surface1) 55%, transparent);
      }
      #${panelId} .bsb-folio th { color: var(--ctp-subtext0); font-weight: 650; }
      #${panelId} .bsb-folio code, #${panelId} .bsb-folio pre {
        font-family: "JetBrains Mono", "Fira Code", ui-monospace, monospace;
      }
      #${panelId} .bsb-folio :not(pre) > code {
        font-size: .86em; padding: .08em .35em; border-radius: 5px;
        background: color-mix(in srgb, var(--ctp-surface0) 70%, transparent);
      }
      #${panelId} .bsb-folio pre {
        margin: 0 0 1.2em; padding: 12px 14px; border-radius: 10px; overflow: auto;
        background: var(--ctp-crust); font-size: .84em; line-height: 1.55;
      }
      #${panelId} .bsb-folio mark {
        background: color-mix(in srgb, var(--ctp-yellow) 38%, transparent);
        color: inherit; padding: 0 .12em; border-radius: 3px;
      }
      #${panelId} .bsb-folio hr {
        border: 0; height: 1px; margin: 1.8em 0;
        background: color-mix(in srgb, var(--ctp-surface1) 70%, transparent);
      }
      @media (max-width: 820px) {
        #${panelId} .bsb-folio-shell { grid-template-columns: 1fr; }
        #${panelId} .bsb-folio-toc {
          position: absolute; left: 0; top: 0; bottom: 0; width: min(18.5rem, 88vw);
          height: auto; max-height: none;
          transform: translateX(-104%); transition: transform .2s ease;
          box-shadow: none; border-right: 1px solid var(--ctp-surface0);
        }
        #${panelId} .bsb-folio-shell.is-toc-open .bsb-folio-toc {
          transform: none;
          box-shadow: 16px 0 40px rgba(0,0,0,.28);
        }
        #${panelId} .bsb-folio-toc-fab {
          display: inline-flex; align-items: center; gap: 6px;
          position: absolute; top: 10px; left: 10px; z-index: 4;
          height: 30px; padding: 0 10px 0 8px; border-radius: 999px;
          border: 1px solid color-mix(in srgb, var(--ctp-surface1) 70%, transparent);
          background: color-mix(in srgb, var(--ctp-mantle) 88%, transparent);
          color: var(--ctp-text); font-size: 12px; font-weight: 700; cursor: pointer;
          backdrop-filter: blur(10px);
        }
        #${panelId} .bsb-folio-toc-scrim {
          display: none; position: absolute; inset: 0; z-index: 2;
          background: color-mix(in srgb, var(--ctp-crust) 42%, transparent);
        }
        #${panelId} .bsb-folio-shell.is-toc-open .bsb-folio-toc-scrim { display: block; }
        #${panelId} .bsb-folio-frame { padding: 48px 16px 48px; }
      }

`;
}
