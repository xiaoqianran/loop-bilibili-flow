# P9: Single-bundle workbench takeover

## Production route

The official `dist/userscript/loop-bilibili-flow.user.js` is built by Vite from
`apps/userscript/src/main.ts`. The composition root mounts the full Bilibili
workbench from `apps/userscript/src/workbench/runtime.ts` on Bilibili hosts.

The release no longer reads or appends `compat/maintained-runtime.js`.
The experimental `dist/lab/subbatch.pure.user.js` remains API-only, without
the Bilibili workbench, for composition testing.

## Boundaries and limitations

- The historical userscript metadata identity, version, settings keys,
  IndexedDB stores, and Knowledge database name remain unchanged.
- The remaining full-workbench source is a large legacy-derived module.
  Its migration into small, typed and lint-clean UI / Controller / Runtime
  modules is **not** complete. Strict typechecking now passes with **0 diagnostics**
  after the 2026-11-15 strict-boundary follow-up (359 at its start). Subtitle/cache
  results, Knowledge records, generic controller calls, nullable DOM references,
  indexed lookups and async request lifecycles have explicit contracts or guards.
  The workbench now receives normal ESLint coverage; its unchanged 1525 diagnostic
  ceiling is a separate historical debt audit, not a substitute for strict
  typechecking. Streaming scroll state, AI-session hydration and Mermaid
  presentation are extracted into tested modules.
- Static tests, Golden checks, bundle verification, and browser smoke with
  simulated Tampermonkey `GM_*` APIs are not a replacement for testing an
  actual installed Tampermonkey update with saved user data.
- Before declaring full migration complete, test install/update, subtitle
  capture, AI PRE/POST, Studio, Knowledge, cache recovery, navigation,
  keyboard shortcuts, export, and YouTube isolation in Tampermonkey.

The unmodified historical `legacy/Bili-SubBatch-v6.0.2.user.js` remains
a golden behavior reference.

## Typed subtitle reader extraction (2026-11-15)

This follow-up is a bounded architecture slice, **not completion of the P0–P3
cleanup or full workbench migration**. Existing uncommitted scan, runtime,
tests and generated-product changes were retained; the official product is
regenerated through the normal build.

- `ui/workspaces/transcript-controller.ts` now owns the mounted reader view:
  empty/error/wait states, track options, case-insensitive text-node highlights,
  cue rows and original indices, counts, active-cue classes and scroll-follow
  policy. It receives typed item/state/ports and does not import the workbench.
- Runtime retains current-item resolution, video event wiring, track acquisition,
  cancellation, caching and refresh orchestration. Track indices are converted
  from select strings to integers; seek inputs and acquisition identity are
  narrowed before use. Reader metadata now has explicit field types.
- New DOM-fixture tests compare populated and empty rendering against functions
  extracted from the frozen legacy script. They also cover no matches, missing
  mount slots, markup-looking subtitle text, timestamps, track preferences,
  active cue changes, scroll cooldown, force-follow, hidden workspaces, disabled
  follow and reduced motion. The existing binary-search tests retain the
  0.2-second tail tolerance. Fixtures do not validate real browser layout.
- Strict diagnostics decreased from the measured 379 to 359. No suppression,
  `any` widening, lint exclusion or diagnostic-ceiling change was introduced.
  `pnpm typecheck` still fails; its chained project check therefore does not run
  through that command. Lint's unchanged 1525 ceiling is only a debt audit.

Historical validation immediately after the subtitle-reader extraction (before
the strict-boundary follow-up below): `pnpm lint` passes (ESLint, boundary checks and
the debt audit); `pnpm test` passes 76 files / 410 tests, including 10 new reader
tests and the existing Golden suites; `pnpm build` and its `verify:dist` pass.
The official single-bundle output SHA-256 is
`7590bddccf6631dbc4594c4dd9f02193c071c16452165787f34a5a9e387b8313`.
`pnpm typecheck` exits with 359 diagnostics, all in the residual workbench;
the extracted reader and its tests introduce no strict diagnostics.
`git diff --check` passes. Code Review Graph was incrementally refreshed after the extraction on PC1:
222 files, 2,861 nodes and 25,995 edges (2026-11-15). It reports
workbench/runtime/video coupling; graph risk metrics are not browser E2E evidence.

At that checkpoint, remaining work included nullable UI lifecycle handling,
scan/cache payload contracts, AI-session hydration, Knowledge/Studio rendering,
DOM and indexed-access narrowing, and the residual workbench lint exclusion.
The strict-boundary follow-up below resolves the diagnostics; further module
decomposition and removal of the lint exclusion remain architecture work.
Actual Tampermonkey install/update with saved data remains untested in this
follow-up. In particular, validate subtitle rendering/search/track switching,
seek and playback following (including user scroll and reduced motion), refresh,
SPA video/part changes, then AI PRE/POST, Studio, Knowledge, cache recovery,
shortcuts, export and YouTube isolation before declaring migration complete.

## Strict workbench boundaries (2026-11-15)

Continued from the 359-diagnostic checkpoint above. All pre-existing uncommitted
changes were retained. No reset, checkout, clean, commit or push was performed.

- Strict diagnostics are **359 → 0**. `pnpm typecheck` now completes both the
  whole-tree strict check and its chained project check. No `any` widening,
  TypeScript suppression, increased diagnostic ceiling or lint exclusion was
  introduced. The existing workbench ESLint exclusion remains unchanged.
- Network and cached subtitle results share an explicit status/payload contract;
  library items admit the actual nullable cue state and numeric/string video IDs.
  Generic core group helpers and Application planning, ordering, Knowledge and
  PRE controllers retain their input types through direct canonical calls.
- DOM selectors, selection text nodes, optional attributes, regex captures,
  map/array lookups, script URLs and error values are narrowed before use.
  UI resize callbacks tolerate absent UI state. Mermaid has typed job metadata,
  an IntersectionObserver lifecycle and a render queue that returns each result
  while recovering from a preceding render failure.
- `app/ai-session-hydration.ts` validates nested cached session records and
  model/source arrays, restores idle PRE state with bounded settings, and applies
  cached output without overwriting current credentials, normalized prompt/task
  snapshots or the new session identity. Removed AI runs cannot dispatch requests;
  subtitle responses finishing after cancellation cannot publish their state.
- Eight added behavioral regressions cover malformed and detached session input,
  credential/identity preservation, idle PRE recovery, cancellation during fetch,
  removed-run dispatch and Mermaid queue ordering/failure recovery. Golden owner
  checks now recognize the typed canonical calls and generic function signature;
  the existing behavioral and frozen-legacy comparisons still run.

Validation at the strict-boundary checkpoint: `pnpm lint`, `pnpm test` (**78 files / 418 tests, zero failures**),
`pnpm build` (including `verify:dist`), `pnpm typecheck`, the separately invoked
`pnpm typecheck:projects`, and `git diff --check` all pass. The unchanged diagnostic
ceiling audit reports **0 / 1525**. The regenerated official single-bundle output
is 980,581 bytes with SHA-256
`6bb7dc7cc752065bc9500444266fe3dfdbafb01cd08782e3c53d2589622153ca`.

Code Review Graph impact analysis covered the workbench entry and shared
AI/session/state/acquisition contracts. The initial graph identified `main.ts`
as the workbench importer and 44 impacted files for the shared changes; unresolved
call sites mean these results are guidance, not exhaustive runtime coverage.
The local CLI incremental refresh completed: **225 files / 2,890 nodes / 26,287
edges** (2026-11-15).

At that checkpoint, P9 still needed further responsibility splitting and normal
ESLint coverage. Actual installed Tampermonkey install/update
with saved user data remains **untested**. The prior mocked-GM browser smoke does
not establish E2E coverage for subtitle capture/seek/follow, SPA parts, AI PRE/POST,
Studio, Knowledge, cache recovery, shortcuts, export or YouTube isolation.

## Presentation boundary and ESLint closure (2026-11-15)

All legitimate changes present at `12a7e55`'s working tree were preserved and
included in this follow-up. No reset, checkout or clean was used.

- `ui/workspaces/mermaid-presentation.ts` owns SVG dimensions, diagram cards,
  accessible controls, zoom bounds/labels, fit scrolling, and fullscreen DOM
  moves/restoration. It accepts typed panel-lookup and animation-frame ports,
  and shares the typed Mermaid element/job contract with the runtime. It has
  no dependency on workbench state, AI transport, settings or persistence.
  Runtime retains render queue ownership, lazy scheduling, AI repair and cache
  writes. Fullscreen keeps the same card/SVG nodes and event handlers.
- Removed `runtime.ts` from ESLint global ignores. The initial explicit lint
  run found **115 errors**. Named type-only imports, optional catch bindings,
  const declarations and removal of unused private compatibility helpers resolve
  them under the existing rules. Panel initialization side effects are retained.
  Cue deduplication now keeps comparison metadata beside each cue rather than
  adding/removing a temporary field. Removed unused follow-reason arguments.
  No new suppression, rule relaxation, `any`, `nocheck`, or audit-ceiling
  increase was introduced.
- Seven new regressions compare SVG sizing with the frozen legacy function and
  exercise zoom limits, fit scroll/labels, accessible controls, retained SVG
  identity, fullscreen placeholders, repeated opens, backdrop clicks and absent
  DOM slots. Golden ownership checks explicitly register the moved functions
  and the retired unused helpers. These fixtures do not validate browser layout.

This is a bounded extraction: `runtime.ts` still has **10,438 lines**. Panel
construction, Knowledge/Studio rendering, AI/scan orchestration and event wiring
remain coupled through mount-local state and closures. Moving these wholesale
without installed-browser coverage would risk lifecycle and persistence behavior;
further decomposition remains architectural debt. Strict typing and normal lint
coverage are complete, while full P9 product acceptance remains open.

Browser assessment on PC1: the existing-profile `playwright-extension` MCP
initialization timed out. `chrome-devtools:list_pages` was discovered and its
schema inspected, but automatic approval rejected execution because the approval
policy is `never`. A read-only local process inspection was also access denied.
No actual installed Tampermonkey session or saved data was inspected or changed,
and no fresh compiled-script browser smoke was completed. The earlier mocked-GM
smoke remains the only browser evidence; it is **not installed Tampermonkey E2E**.
Install/update with saved data and the feature acceptance list above remain
unverified.

Final checks pass: `pnpm typecheck` (whole-tree strict check and project check),
`pnpm lint` (including the runtime, boundary verification and **0 / 1525** debt
audit), `pnpm test` (**79 files / 425 tests**), `pnpm build` with `verify:dist`,
and `git diff --check`. The regenerated official userscript is **980,289 bytes**,
SHA-256 `ed065abf478bfe5b49b3e8c8b9f2e9757881132f88f99cd0b4980665abdbca80`.

`code-review-graph update --brief` and `status` completed through the local CLI:
**227 files / 2,911 nodes / 26,533 edges**. The changed-file analysis reports
39 affected flows, 375 graph test gaps and risk 0.85. These heuristic counts
include unresolved/indirect coverage and are not a browser acceptance result.
The caller query confirmed fullscreen entry through `handleMermaidTool`; that
handler now calls the presentation controller through the same action path.

Publication: after an initial sandbox-only Git index.lock permission denial, the authenticated PC1 AgentDock execution channel staged the verified changes and performed the authorized Git commit and push to origin/main. The final commit ID and remote status are verified in the delivery report.