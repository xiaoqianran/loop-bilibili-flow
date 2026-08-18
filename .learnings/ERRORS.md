# Errors

Command failures and integration errors.

---

## [ERR-20260815-001] pnpm typecheck / GitHub Userscript Gate

**Logged**: 2026-08-15T03:55:00Z
**Priority**: high
**Status**: resolved
**Area**: infra

### Summary
origin/main 6.9.6 推送后 GitHub “All checks have failed”。Userscript Gate 死在 typecheck。

### Error
```
packages/core/src/ai-session.ts(292,3): error TS2375: PlannedAiRun exactOptionalPropertyTypes (taskId string | undefined)
tests/golden/extracted-core.test.ts(263,12): error TS2532: outline[0] possibly undefined
tests/golden/subtitle-export.test.ts: attach* 推断字面量后缺少 groupType / parentFolder
```

### Context
- Command: `pnpm typecheck`（CI 第一步）
- tsconfig 开了 exactOptionalPropertyTypes + noUncheckedIndexedAccess
- typecheck 不过就不会跑 lint/test/build

### Suggested Fix
省略 undefined 可选键；测试显式 `LibraryGroupItem`；下标可选链。修完再跑完整 gate：typecheck → lint → test → build:userscript → build:pure-userscript。

### Metadata
- Reproducible: yes
- Related Files: packages/core/src/ai-session.ts, tests/golden/subtitle-export.test.ts, tests/golden/extracted-core.test.ts
- See Also: LRN-20260815-005

### Resolution
- **Resolved**: 2026-08-15T03:55:00Z
- **Notes**: 本地五门 CI 命令已通过，准备推 6.9.7。

---

