# Architecture

## 目标

正式产品只有一个入口和一个发布文件：

```text
apps/userscript
      |
      v
pnpm build
      |
      v
dist/userscript/loop-bilibili-flow.user.js
```

`compat/maintained-runtime.js` 只是迁移期间暂存的旧产品主体，不属于目标架构。

## 分层

```text
                           ┌───────────────────┐
                           │ apps/userscript   │
                           │ Application Shell │
                           └─────────┬─────────┘
                                     │ compose
                  ┌──────────────────┼──────────────────┐
                  │                  │                  │
                  v                  v                  v
          ┌──────────────┐   ┌──────────────┐   ┌──────────────┐
          │     core     │   │   bilibili   │   │   runtime    │
          │ pure domain  │   │ B站 domain   │   │ browser port │
          └──────────────┘   └──────────────┘   └──────────────┘
                  ^                  ^                  ^
                  │                  │                  │
                  └──────────────────┼──────────────────┘
                                     │ contracts
                              ┌──────┴──────┐
                              │   schemas   │
                              │ persistence│
                              └─────────────┘
```

当前为了最大限度降低耦合，四个 package 彼此不直接 import。真正需要组合时，由 `apps/userscript` 完成。

## 模块职责

### schemas — FROZEN CONTRACT

只定义跨版本必须稳定的数据：

- PromptStage
- LLM / Prompt / Content / Transcript / Artifact / Job DTO
- v6 storage keys
- builtin prompt IDs
- shortcut command IDs
- persistence schema versions

它不负责业务逻辑，不访问 DOM，不访问 GM API。

### core — FROZEN PURE API

输入普通数据，输出普通数据；不得知道浏览器。

Canonical API：

```text
core
├─ aiSession.*
├─ command.shortcuts
├─ subtitleExport.*
├─ folio.*
├─ knowledge.*
├─ library.group.*
├─ library.meta.*
├─ mermaid.*
├─ preprocess.*
├─ prompt.*
└─ transcript.*
```

优先冻结的 v1 API：

```text
core.prompt.render()

core.transcript.toCues()
core.transcript.toSrt()
core.transcript.toTxt()
core.transcript.toAiText()
core.transcript.clock()

core.preprocess.splitCues()
core.preprocess.stitchChunks()
core.preprocess.cacheKey()

core.subtitleExport.buildPath()
core.subtitleExport.indexPath()
core.subtitleExport.normalizeItem()
core.subtitleExport.upsertItem()
core.subtitleExport.renderIndex()
core.subtitleExport.describe()

core.aiSession.cacheKey()
core.aiSession.hasCache()
core.aiSession.buildCache()
core.aiSession.partitionRuns()
core.aiSession.shouldSkipPrepare()

core.mermaid.sanitizeMarkdown()
core.mermaid.resolveRepair()
core.mermaid.replaceBlock()
```

`library.meta.*` 仍属于 INTERNAL：迁移期间可以继续收口，不承诺所有方法名长期不变。

### bilibili — FROZEN DOMAIN API

只负责 Bilibili 特有识别规则，不负责网络请求、DOM UI 或存储。

```text
bilibili.route
├─ detect()
├─ bvidFrom()
├─ videoKey()
├─ playingHint()
├─ resolveVideo()
├─ videoChanged()
├─ isCarrierShell()
└─ hasCarrierIdentity()

bilibili.video
├─ runtimeView()
├─ pageMeta()
└─ isChargeBlocked()

bilibili.subtitle
├─ normalizeUrl()
├─ normalizeTracks()
├─ runtimeTracks()
├─ trackEndpoints()
├─ pickTrack()
└─ preferredIndex()
```

其中以下作为 v1 稳定边界：

```text
detect
bvidFrom
playingHint
resolveVideo
videoChanged
```

### runtime — FROZEN PLATFORM API

只负责浏览器 / Userscript 环境能力。

Runtime Ports：

```text
runtime
├─ storage
│  ├─ get
│  ├─ set
│  └─ remove
├─ network
│  ├─ request
│  └─ json
├─ clipboard.writeText
├─ style.add
├─ shortcuts.register
└─ page
   ├─ href
   ├─ window
   └─ onNavigate
```

Runtime utilities：

```text
runtime.userscript.create()
runtime.spa.observe()

runtime.shortcut
├─ chordFromEvent()
├─ display()
├─ hasStrongModifier()
├─ isEditableTarget()
├─ shouldIgnore()
└─ register()
```

没有真实实现的能力不进入 Runtime。Local Hub 等真正开始接入时再新增 Port。

### apps/userscript — INTERNAL

应用层负责 orchestration，不作为稳定库 API。

```text
app
├─ video.resolve()
├─ acquisition
│  ├─ fetchVideoView()
│  ├─ fetchSubtitleTracks()
│  └─ fetchSubtitleBody()
├─ navigation.observe()
└─ activation.start()
```

这些名称当前可以继续调整，直到 compat runtime 清零。

## 模块如何对接

### 1. 浏览器输入

```text
GM_* / DOM / fetch / unsafeWindow
              |
              v
      userscript-host.ts
              |
              v
         Runtime Ports
```

只有 Host 可以直接接触 GM API。

### 2. 应用编排

```text
runtime.page / runtime.network
              |
              v
             app
        /      |      \
       v       v       v
    core   bilibili   runtime
```

App 决定“什么时候做什么”，Core / Bilibili 决定“规则是什么”，Runtime 决定“如何访问外部世界”。

### 3. 典型视频识别

```text
Browser page
    |
    v
app.video.resolve()
    |
    ├── bilibili.route.detect(href)
    ├── bilibili.route.playingHint(page)
    └── bilibili.route.resolveVideo(...)
             |
             v
       CurrentVideoRef
```

### 4. 典型字幕获取与处理

```text
Bilibili page/runtime
      |
      ├─ bilibili.video.runtimeView()
      └─ bilibili.subtitle.runtimeTracks()
      |
      v
compat cache (temporary)
      |
    cache miss
      v
app.acquisition
      |
      ├─ bilibili.video/subtitle rules
      └─ runtime.network
      |
      v
subtitle body
      |
      v
core.transcript.toCues()
      |
      v
core.preprocess.splitCues()
      |
      v
LLM request through runtime.network
      |
      v
core.preprocess.stitchChunks()
```

## 依赖规则

允许：

```text
apps/userscript -> schemas
apps/userscript -> core
apps/userscript -> bilibili
apps/userscript -> runtime
```

禁止：

```text
core      -> runtime
core      -> bilibili
runtime   -> core
bilibili  -> core

packages/* -> compat
packages/* -> GM_*
core       -> DOM
schemas    -> DOM
```

`pnpm lint` 会通过 `scripts/verify-boundaries.ts` 强制检查这些规则。

## API 稳定级别

```text
FROZEN
  schemas contracts
  core canonical grouped API（上文 v1 子集）
  bilibili.route v1
  bilibili.video / bilibili.subtitle acquisition rules
  runtime ports + runtime.shortcut/spa/userscript

INTERNAL
  apps/userscript/app/*
  core.library.meta 的细粒度 helper
  Host 实现细节

TEMPORARY
  compat/maintained-runtime.js
  flat compatibility aliases
  dist/lab/subbatch.pure.user.js
```

规则：新代码只能依赖 FROZEN / INTERNAL canonical API，不得新增对 TEMPORARY 层的依赖。

## Compat 退出路径

```text
现在
apps/packages  ███████████
compat         ███████████████████████

迁移
apps/packages  █████████████████████
compat         ███████████

最终
apps/packages  ███████████████████████████████
compat         0
```

迁移一个能力的标准流程：

```text
Golden test
   ↓
抽 pure/domain API
   ↓
App 接管真实调用
   ↓
产品测试
   ↓
删除 compat 对应实现
```

只有完成最后一步才算真正迁移。
