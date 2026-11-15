# Content-Flow / SubBatch

Bilibili / YouTube Userscript。**[点击安装 / 更新油猴脚本（Tampermonkey）](https://raw.githubusercontent.com/xiaoqianran/loop-bilibili-flow/main/dist/userscript/loop-bilibili-flow.user.js)**。正式安装文件只有一个：

```text
dist/userscript/loop-bilibili-flow.user.js
```

**版本检查：** GitHub 正式构建与 Greasy Fork 站内发布并不自动同步。如果 Greasy Fork 仍显示旧版，请使用上方 GitHub 直链在 Tampermonkey 更新，并确认已安装版本为 **v6.10.9**；更新后刷新 YouTube 视频页，未展开面板时可按 `Ctrl+B` 召唤。

v6.10.9 修复全 Mermaid 学习图谱的节点文字不可见（Mermaid 12 SVG 标签配置与安全净化兼容）；恢复后处理 Markdown / HTML 阅读页的字号调节和标题层级，修复重复章节 ID 的目录跳转，并使对话回复区域随 S/M/L 面板宽度自动伸展。

v6.10.8 修复 HTML 阅读页正文被挤进左侧窄列的问题：无目录时正文居中，目录按阅读区域实际宽度切换为侧栏或抽屉，模型生成的内联布局样式会被移除。

v6.10.7 将 Markdown、HTML 净化、公式、代码高亮和 Mermaid 图表库，以及公式字体直接内置到安装文件。渲染不再依赖运行时访问 CDN；YouTube 的 Trusted Types 适配仅作用于工作台和内置图表库，不安装页面全局默认策略。

## 架构

```text
schemas     core     bilibili     runtime
   \         |         |          /
    \        |         |         /
     └────────┴─────────┴────────┘
                  |
            apps/userscript
                  |
                build
                  |
                  v
    loop-bilibili-flow.user.js
```

- `packages/schemas`：持久化与跨边界数据契约。
- `packages/core`：纯业务逻辑。
- `packages/bilibili`：Bilibili route / player identity 规则。
- `packages/runtime`：浏览器运行时端口与 Userscript adapter。
- `apps/userscript`：唯一应用组合层。
- `apps/userscript/src/workbench/runtime.ts`：完整工作台由此统一打包；其剩余单体代码仍待拆分成强类型 UI / Controllers。
- `legacy/Bili-SubBatch-v6.0.2.user.js`：只读 Golden Reference，不参与日常开发。

## 开发

```bash
pnpm install
pnpm typecheck
pnpm lint
pnpm test
pnpm build
```

`pnpm verify:rendering` 使用本机 Chrome 验证断网渲染，覆盖普通页面和强制 Trusted Types 的页面；需要先安装 Chrome。
`pnpm verify:folio` 使用本机 Chrome 验证 HTML 阅读页在不同面板宽度下的正文布局、目录跳转及缩放行为，截图保存在 `dist/qa/`。

`pnpm build` 只生成正式产物：

```text
dist/userscript/loop-bilibili-flow.user.js
```

实验迁移验证可使用：

```bash
pnpm build:pure-userscript
```

它生成 `dist/lab/subbatch.pure.user.js`，只用于检查 `apps + packages` 是否可独立打包，不是发布文件。

## 规则

1. `schemas / core / bilibili / runtime` 彼此不直接依赖。
2. 只有 `apps/userscript` 负责组合模块与浏览器环境。
3. `core / schemas` 禁止 DOM、GM API、浏览器存储。
4. 新功能按真实压力加入；不提前创建空 package / stub port。
5. 迁移剩余工作台模块时，先用 Golden / differential test 锁行为，再移走单体中的相应职责。

详见 `docs/architecture.md`。
