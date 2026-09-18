# P4 / P4.5 Userscript 真实接管

## 当前 Gate

正式构建只有一个发布文件：

| 命令 | 产物 | 用途 |
| --- | --- | --- |
| `pnpm build` | `dist/userscript/loop-bilibili-flow.user.js` | **唯一正式发布文件** |
| `pnpm build:pure-userscript` | `dist/lab/subbatch.pure.user.js` | 迁移实验，只验证 `apps + packages` 可独立打包 |

- Golden Reference：`legacy/Bili-SubBatch-v6.0.2.user.js`，只读并做 SHA-256 校验。
- 临时完整行为主体：`compat/maintained-runtime.js`。
- 正式产物当前仍由「新架构 bundle + 临时 compat body」组成，以保证成熟功能不回退。
- `compat/maintained-runtime.js` 不是目标架构；其唯一目标是被逐块迁空并最终删除。

## 已冻结边界

```text
schemas     core     bilibili     runtime
   \         |         |          /
    └─────────┴─────────┴─────────┘
                 |
           apps/userscript
```

四个 shared package 彼此不直接依赖；应用层负责组合。

已接管并可依赖的 canonical API：

- `core.prompt / transcript / preprocess / aiSession / mermaid / subtitleExport`
- `bilibili.route / bilibili.video / bilibili.subtitle`
- `runtime.userscript / runtime.spa / runtime.shortcut`
- Runtime Ports：Storage / Network / Clipboard / Style / Shortcut / Page
- App 当前内部边界：`app.video / app.acquisition / app.navigation / app.activation`

Shortcut 的浏览器事件处理已经从 Core 移到 Runtime；Core 只保留产品 command catalog。

## 已真实迁出的 acquisition slice

`video view + subtitle track discovery + subtitle body network I/O` 已接管：

```text
compat cache/persistence
        |
        v
app.acquisition
   |            \
   v             v
bilibili      runtime.network
video/subtitle
```

compat 已删除本地 `formatSubtitleUrl / pickTrack / runtimeVideoView /
runtimeSubtitleTracks / preferredTrackIndex / isChargeExclusiveBlocked`，
并且 view/track/body 的普通网络请求不再直接调用 `requestJsonFast`。

## 仍由 compat body 承载

- WBI key/sign、AI 字幕地址补全、dm_view fallback 与合集扫描 orchestration
- Studio DOM / CSS UI
- 浏览器内 PRE / POST Worker Pool 与模型请求编排
- Mermaid / Markdown 第三方渲染加载
- Knowledge IndexedDB 与 Thread Tree UI
- 播放器联动、Selection Toolbar

## 接管标准

一个能力只有走完下面全部步骤才算迁移完成：

```text
Golden / differential test
          ↓
提取 pure/domain API
          ↓
App 接管真实调用点
          ↓
完整产品测试
          ↓
删除 compat 中旧实现
```

仅复制函数、仅增加 package、仅加 API wrapper 都不算真正接管。

## 不可破坏的兼容契约

1. PromptStage 固定为 `preprocess | postprocess | knowledge`。
2. Shortcut ID 保持 v6 持久化值。
3. GM storage key / builtin prompt id 见 `packages/schemas/src/persistence.ts`。
4. 在对应产品行为真正迁出前，不得提前删除 compat 中该能力。
5. 新代码不得反向依赖 `compat/maintained-runtime.js`。

完整架构见 `docs/architecture.md`。
