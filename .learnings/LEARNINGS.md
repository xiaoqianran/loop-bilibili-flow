# Learnings

Corrections, insights, and knowledge gaps captured during development.

**Categories**: correction | insight | knowledge_gap | best_practice

---

## [LRN-20260815-005] best_practice

**Logged**: 2026-08-15T03:55:00Z
**Priority**: high
**Status**: resolved
**Area**: tests

### Summary
`exactOptionalPropertyTypes` + `noUncheckedIndexedAccess` 会让 attach* 泛型把测试字面量钉死，CI typecheck 在测试里爆。

### Details
`attachSelectionGroupMeta<T extends LibraryGroupItem>(items: T[]): T[]` 从 `{ bvid, title }` 推断 T 后，返回值没有 `groupType`。可选字段赋 `string | undefined` 也会在 exactOptional 下报 TS2375。Userscript Gate 先跑 typecheck，所以这些错误会让全部检查失败。

### Suggested Action
1. 构造可选字段时省略 undefined，不要写 `taskId: cached.taskId`。
2. 测试里显式 `attachXxx<LibraryGroupItem>(...)`，下标用 `?.` 或 `requireItem`。
3. 修完 typecheck 后立刻跑 `pnpm lint`：未使用 import 会在下一步挂掉。

### Metadata
- Source: error
- Related Files: packages/core/src/ai-session.ts, tests/golden/subtitle-export.test.ts, tsconfig.typecheck.json
- Tags: typecheck, exactOptionalPropertyTypes, ci
- Pattern-Key: harden.exact_optional_types
- Recurrence-Count: 1
- First-Seen: 2026-08-15
- Last-Seen: 2026-08-15

### Resolution
- **Resolved**: 2026-08-15T03:55:00Z
- **Notes**: plannedAiRunFromCache 省略 undefined；测试加 LibraryGroupItem 泛参与 requireItem。本地 typecheck/lint/test/build 已过。

---

## [LRN-20260815-004] insight

**Logged**: 2026-08-15T03:29:00Z
**Priority**: high
**Status**: resolved
**Area**: frontend

### Summary
后处理缓存是整份会话；doAiAnalyze 只要不全量恢复就会把所有模型重跑。

### Details
code-review-graph：ai-send / scheduleAutoAnalyze → doAiAnalyze → 为每个 task×model 建空 run → 全部 runAiProfile。缓存只在 automatic 且整包可用时短路。改一个模型的 maxTokens/换 LLM 后点运行，其它已有结果也被丢掉。

### Suggested Action
按 taskId+profileId+prompt+model+inputHash 分区；只生成 miss，命中的 draft 回填。

### Metadata
- Source: user_feedback
- Related Files: packages/core/src/ai-session.ts, loop-bilibili.js
- Tags: cache, multi-model, doAiAnalyze

### Resolution
- **Resolved**: 2026-08-15T03:29:00Z
- **Notes**: partitionPlannedAiRuns；运行只跑 generateIds。

---

## [LRN-20260815-003] insight

**Logged**: 2026-08-15T02:22:00Z
**Priority**: high
**Status**: resolved
**Area**: frontend

### Summary
B 站连播会先换 player cid/BV，URL 和 __INITIAL_STATE__ 经常还停在上一集。

### Details
`currentRouteVideoRef` 只读 `location.href` 的 BV/`p`。合集或选集自动下一集时，播放器已经换源，history 可能几秒不更新，甚至一直不改。结果字幕仍是旧集。

### Suggested Action
身份解析以 player.getManifest/cid 为准；URL 只做回退。导航比较要用 playingVideoChanged，并监听 video loadstart。

### Metadata
- Source: user_feedback
- Related Files: packages/bilibili/src/route/playing.ts, apps/userscript/src/main.ts
- Tags: spa, autoplay, subtitles

### Resolution
- **Resolved**: 2026-08-15T02:22:00Z
- **Notes**: 新增 resolvePlayingVideoRef / extractPlayingVideoHint；主体薄桥 + 800ms 对齐。

---

## [LRN-20260815-002] correction

**Logged**: 2026-08-15T00:50:00Z
**Priority**: high
**Status**: pending
**Area**: frontend

### Summary
不要把产品逻辑写进 `loop-bilibili.js` 当唯一实现，也不要手改 `dist/userscript/subbatch.user.js`。规则进 `packages/*` + `apps/userscript`，再 `pnpm build:userscript`。

### Details
用户纠正：上次把会话缓存直接堆进 `loop-bilibili.js`。正式产物是构建出来的 `dist/userscript/subbatch.user.js`。维护版主体只允许 `coreCall`/`coreFn` 薄桥；`verify-dist` 要求主体与 `loop-bilibili.js` 逐字节一致，所以挂钩必须留在主体，但规则不能再双写。

### Suggested Action
新能力先写 packages/core（或对应 package），从 `apps/userscript/src/main.ts` 导出，主体只做 IO/state 适配，然后构建油猴脚本。

### Metadata
- Source: user_feedback
- Related Files: packages/core/src/ai-session.ts, apps/userscript/src/main.ts, scripts/build-userscript.ts
- Tags: architecture, userscript, monorepo
- See Also: LRN-20260815-001

---

## [LRN-20260815-001] correction

**Logged**: 2026-08-15T00:34:00Z
**Priority**: high
**Status**: resolved
**Area**: frontend

### Summary
刷新/回到视频不得重新用字幕跑后处理；只有手动重新生成或 Mermaid 重绘才覆盖缓存。

### Details
自动分析在每次刷新时都会 `doAiAnalyze({ automatic: true })`，后处理结果只活在内存里。Mermaid 重绘只改 `run.raw`，不写 IndexedDB，回来又是坏图。

### Suggested Action
按视频路由缓存整份后处理会话；自动路径只恢复；手动重新生成 / 重做预处理 / Mermaid 重绘覆盖缓存。

### Metadata
- Source: user_feedback
- Related Files: packages/core/src/ai-session.ts, apps/userscript/src/main.ts
- Tags: cache, mermaid, auto-analyze

### Resolution
- **Resolved**: 2026-08-15T00:50:00Z
- **Notes**: 规则在 packages/core/src/ai-session.ts；主体只桥接 IndexedDB/state；构建产出 dist/userscript/subbatch.user.js。

---

