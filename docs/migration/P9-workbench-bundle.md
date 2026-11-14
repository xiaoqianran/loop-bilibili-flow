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
  modules is **not** complete. It is intentionally excluded from ESLint and
  uses `@ts-nocheck` pending the next extraction phase.
- Static tests, Golden checks, bundle verification, and browser smoke with
  simulated Tampermonkey `GM_*` APIs are not a replacement for testing an
  actual installed Tampermonkey update with saved user data.
- Before declaring full migration complete, test install/update, subtitle
  capture, AI PRE/POST, Studio, Knowledge, cache recovery, navigation,
  keyboard shortcuts, export, and YouTube isolation in Tampermonkey.

The unmodified historical `legacy/Bili-SubBatch-v6.0.2.user.js` remains
a golden behavior reference.

## Browser smoke evidence (2026-11-14)

On https://www.bilibili.com/video/BV1nWxW6NE9E/ the compiled official
userscript was injected through Playwright with temporary Tampermonkey GM API
mocks. The new bootstrap created and expanded the SubBatch panel without an
injection-related page error. Its resource library recognized the video and
showed 2,796 Chinese subtitle cues with language, TXT and SRT controls.

The Bilibili player identified eight subtitle tracks. The player WBI API
returned usable subtitle URLs; the fetched Chinese JSON contained 2,798
raw cues. The difference between the raw body and the UI needs a dedicated
normalization/deduplication review.

This is a smoke test in a browser also running installed userscript extensions,
not a clean-profile Tampermonkey upgrade/E2E test. No live AI or Knowledge
request was exercised.
