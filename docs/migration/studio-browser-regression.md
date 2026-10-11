# Studio browser regression (P3 baseline)

Target: Bilibili video page with installed Full userscript v6.9.17. The floating `CC` button is the visible entry when the panel is closed; `.bsb-sidebar` being `display:none` before opening is expected, not a startup failure.

Verified on 2026-10-11 using PC1 Chrome DevTools against a real Bilibili video page:

| Scenario | Observed result |
| --- | --- |
| Click floating `CC` | root receives `open`; sidebar becomes grid; `aria-hidden=false` |
| Switch AI → subtitles → knowledge → settings → AI | each matching `data-view-panel` becomes active; panel stays visible |
| Choose S width | sidebar measured about 497 CSS px |
| Choose L width | sidebar measured about 1055 CSS px |
| Dock | sidebar hides and root receives `docked` |
| Click dock tab | `dock-expanded`; sidebar visible, `aria-hidden=false` |
| Collapse and reopen from CC | dock collapse/expansion state and visibility update correctly |

Important limitations: these were DOM-state and computed-style checks, **not** pixel-diff screenshots or a newly installed-script verification. Pointer-based drag, eight resize handles, keyboard shortcuts, persistence across reload and a fresh browser installation remain unverified by this session. The existing Vitest `panel-interaction` and geometry tests cover pure calculation, not real pointer dispatch.

## Repeatable acceptance sequence

1. On a Bilibili video page with the freshly built Full userscript installed, locate the floating `CC` launcher. Click it and confirm `.bsb-sidebar` is visible and `aria-hidden=false`.
2. Select the AI, subtitles, knowledge and settings navigation entries. Check only the selected `[data-view-panel]` is active.
3. Select S, M and L; ensure the sidebar changes width without escaping the viewport.
4. Drag the header (outside buttons) and resize via each of the eight handles. Ensure viewport bounds/minimum sizes are respected.
5. Dock left and right, expand from the edge tab, collapse, and reopen from the launcher; check state persistence after page refresh.
6. Inspect Console errors and run `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm build:userscript`, and `pnpm build:pure-userscript` before merging more workspace extractions.

Maintain CSS cascade order during migration: shell base → shared workspace layout → workspace-specific CSS → late overrides. Do not move stateful workspace event handlers until the corresponding DOM and behavior contract is tested.
