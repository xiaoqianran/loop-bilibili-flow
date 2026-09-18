# Naming Architecture

## Rule

模块承担领域上下文，函数只表达动作。

```text
不要：
sanitizeMermaidTimestampCitationsInMarkdown()

要：
core.mermaid.sanitizeMarkdown()
```

## Canonical API

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

bilibili
├─ route.*
├─ video.*
└─ subtitle.*

runtime
├─ userscript.*
├─ spa.*
└─ shortcut.*

app
├─ video.*
├─ acquisition.*
├─ navigation.*
└─ activation.*
```

典型调用：

```ts
core.aiSession.cacheKey(routeKey);
core.mermaid.sanitizeMarkdown(markdown);
core.subtitleExport.buildPath(item, "srt");
core.preprocess.stitchChunks(chunks, outputs);
runtime.shortcut.shouldIgnore(event);

bilibili.route.detect(href);
bilibili.route.resolveVideo(input);
bilibili.video.runtimeView(pageWindow, bvid);
bilibili.subtitle.runtimeTracks(pageWindow, meta);
bilibili.subtitle.pickTrack(tracks);

runtime.spa.observe(options, onNavigate);
runtime.shortcut.register(bindings);

app.video.resolve(href, pageWindow);
app.acquisition.fetchVideoView(runtime.network, bvid);
app.acquisition.fetchSubtitleTracks(runtime.network, meta);
app.navigation.observe(options);
app.activation.start(options);
```

## Compatibility

旧 flat API 暂时保留，只用于：

- `compat/maintained-runtime.js` 临时兼容主体；
- Golden / differential tests；
- 尚未迁移的旧调用方。

新代码不要继续引入：

```text
shouldRestoreAutomaticAiSession
sanitizeMermaidTimestampCitationsInMarkdown
buildSubtitleExportRelativePath
installSpaNavigateAdapter
startUserscriptLifecycle
```

迁移原则：

```text
旧长名
  ↓ compatibility alias
分类对象
  ↓
短动作名
```

不要用无意义缩写。短名必须依赖清晰的模块上下文，而不是牺牲语义。
