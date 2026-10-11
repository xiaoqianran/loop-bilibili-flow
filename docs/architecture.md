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
             ┌───────────────────────┼───────────────────────┐
             │                       │                       │
             v                       v                       v
      ┌──────────────┐       ┌──────────────┐       ┌──────────────┐
      │     core     │       │  providers   │       │   runtime    │
      │ pure domain  │       │ app adapters │       │ browser port │
      └──────────────┘       └───────┬──────┘       └──────────────┘
                                     │
                         ┌───────────┴───────────┐
                         v                       v
                 ┌──────────────┐       ┌──────────────┐
                 │   bilibili   │       │   youtube    │
                 │ B站 domain   │       │ YouTube domain│
                 └──────────────┘       └──────────────┘
                                     │
                               contracts
                                     │
                              ┌──────┴──────┐
                              │   schemas   │
                              │ persistence│
                              └─────────────┘
```

当前共享 package 彼此不直接 import；平台规则集中在 `packages/bilibili` / `packages/youtube`，真正需要组合时由 `apps/userscript/providers` 完成。

## 模块职责

### schemas — FROZEN CONTRACT

只定义跨版本必须稳定的数据：

- PromptStage
- LLM / Prompt / Content / ContentRef / Transcript / Artifact / Job DTO
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
core.transcript.toEvidenceText()
core.transcript.toAiText()   # legacy Bilibili-shaped wrapper
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
├─ url()
├─ runtimeView()
├─ pageMeta()
└─ isChargeBlocked()

bilibili.subtitle
├─ normalizeUrl()
├─ normalizeTracks()
├─ runtimeTracks()
├─ playerUrl()
├─ dmUrl()
├─ aiStatUrl()
├─ pickTrack()
└─ preferredIndex()

bilibili.wbi
├─ navUrl()
├─ videoDetailUrl()
├─ playerUrl()
├─ keyFromUrl()
└─ sign()
```

其中以下作为 v1 稳定边界：

```text
detect
bvidFrom
playingHint
resolveVideo
videoChanged
```

### youtube — FROZEN DOMAIN API

只负责 YouTube 特有的 URL / playerResponse / caption 纯规则，不负责网络请求、DOM UI 或存储。

```text
youtube.route
├─ extractVideoRef()
├─ matchesYoutubeUrl()
└─ videoWatchUrl()

youtube.player
├─ resolveCurrentVideo()
├─ runtimePlayerResponse()
├─ playerResponseFromHtml()
├─ captionTracks()
├─ pickCaptionTrack()
├─ captionJson3Url()
└─ parseJson3Transcript()
```

SPA 身份规则：URL 中的 videoId 是 canonical identity；`ytInitialPlayerResponse` 只有在其 `videoDetails.videoId` 与当前 URL 完全一致时才可复用，避免 SPA 导航后的 stale state。

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

平台发现先经过 Provider Registry。跨平台身份统一使用 `schemas.ContentRef`：

```text
ContentRef
├─ source
├─ sourceId
├─ segmentId?
└─ url?
```

当前 Provider：

```text
providers
├─ types.ts
├─ registry.ts
├─ transcript.ts
├─ bilibili.ts
├─ bilibili-acquisition.ts
├─ bilibili-transcript.ts
├─ youtube.ts
└─ youtube-transcript.ts
```

当前已注册 Bilibili 与 YouTube 两个 Provider。平台扩展通过新增 adapter 注册，不在通用 resolver 中增加平台条件分支。Bilibili 旧 acquisition API 仅保留兼容 re-export；YouTube 从第一天只走新 Provider/TranscriptSource 路径。

```text
app
├─ content.resolve()       provider-neutral
├─ transcript.acquire()    provider-neutral
├─ video.resolve()         Bilibili compatibility view
├─ acquisition             Bilibili compatibility re-export
│  ├─ signWbi()
│  ├─ fetchVideoView()
│  ├─ fetchVideoDetail()
│  ├─ fetchSubtitleTracks()
│  ├─ collectSubtitleTracks()
│  ├─ resolveSubtitleUrl()
│  └─ fetchSubtitleBody()
├─ navigation.observe()
└─ activation.start()
```

WBI 的边界固定为：

```text
bilibili.wbi        纯 Bilibili 签名规则
      ↑
apps/userscript     组合 core.md5 + WBI key 获取 + fallback orchestration
      ↑
runtime.network     只负责 HTTP I/O
```

这些名称当前可以继续调整，直到 compat runtime 清零。

## Provider 边界

Provider 只负责把平台身份规范化为通用内容引用；Core 不知道 BV、YouTube videoId 或站点路由。

```text
Bilibili page/runtime
        |
        v
Bilibili Provider
        |
        v
ContentRef {
  source: "bilibili",
  sourceId: "BV...",
  segmentId: "P2"
}
        |
        v
app.content.resolve()
```

当前兼容调用 `app.video.resolve()` 仍返回旧 Bilibili-native shape，但其内部已经委托给 `app.content.resolve()`。新跨平台代码只依赖 `ContentRef`。

Provider Registry 保持简单：

```text
URL/page runtime
      |
      v
providerRegistry
      |
      +-- matches()
      +-- resolveCurrent()
      +-- activationState()
      +-- navigationEvents()
      |
      v
ResolvedContent / ready|defer
```

平台特有的延迟激活规则与 SPA 事件名都属于 Provider。Bilibili 可声明 carrier activation；YouTube 声明 `yt-navigate-finish`。应用层只做统一事件 wiring，不出现 `if youtube` / `if bilibili`。

字幕获取是独立 capability，不塞进 ContentProvider：

```text
ResolvedContent
      |
      v
TranscriptSourceRegistry
      |
      +-- BilibiliTranscriptSource
      +-- YouTubeTranscriptSource
      |
      v
AcquiredTranscript {
  ref,
  segments: TranscriptSegment[],
  language?,
  origin?,
  metadata
}
```

YouTubeTranscriptSource 主路径读取 caption track JSON3；若网络路径不可用，则回退到当前页面 Transcript panel，并兼容 classic renderer 与 view-model renderer。以后新增平台仍遵循同一规则：新增 Provider / TranscriptSource，不修改 `current-content.ts` / `current-transcript.ts` 的平台分支。

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
        /      |       \
       v       v        v
    core   providers   runtime
             |
        ┌────┴────┐
        v         v
    bilibili   youtube
```

App 决定“什么时候做什么”，Core 决定通用处理规则，Bilibili / YouTube 决定各自平台规则，Runtime 决定“如何访问外部世界”。

### 3. 典型内容识别

```text
Browser page
    |
    v
app.content.resolve()
    |
    v
ProviderRegistry
    |
    ├── BilibiliProvider
    │      └─ bilibili.route.*
    |
    └── YouTubeProvider
           └─ youtube.resolveCurrentVideo()
    |
    v
ContentRef { source, sourceId, segmentId }
```

`app.video.resolve()` 仅保留给旧 Bilibili compat 调用。

### 4. 典型字幕获取与处理

```text
app.content.resolve()
      |
      v
ResolvedContent
      |
      v
app.transcript.acquire()
      |
      v
TranscriptSourceRegistry
      |
      ├─ BilibiliTranscriptSource
      │    └─ WBI / player v2 / dm fallback
      |
      └─ YouTubeTranscriptSource
           ├─ matching playerResponse
           ├─ watch HTML -> caption track -> JSON3
           └─ Transcript panel DOM fallback
      |
      v
TranscriptSegment[]
      |
      v
core.transcript.toEvidenceText()
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
apps/userscript -> youtube
apps/userscript -> runtime

apps/userscript/providers/types|registry       -> schemas / local provider types only
apps/userscript/providers/transcript           -> schemas + runtime port types
apps/userscript/providers/bilibili             -> bilibili + provider contract
apps/userscript/providers/bilibili-acquisition -> bilibili + core + runtime ports
apps/userscript/providers/bilibili-transcript  -> bilibili + schemas + provider acquisition
apps/userscript/providers/youtube              -> youtube + provider contract
apps/userscript/providers/youtube-transcript   -> youtube + schemas + runtime port
```

禁止：

```text
core      -> runtime
core      -> bilibili
core      -> youtube
runtime   -> core
bilibili  -> core
youtube   -> core

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
  youtube route / player / caption pure rules
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
