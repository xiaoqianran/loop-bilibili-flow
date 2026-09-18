# Content-Flow / SubBatch

Bilibili Userscript。正式安装文件只有一个：

```text
dist/userscript/loop-bilibili-flow.user.js
```

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
- `compat/maintained-runtime.js`：**临时迁移债务**，仅用于尚未迁入模块的完整产品行为；最终必须删除。
- `legacy/Bili-SubBatch-v6.0.2.user.js`：只读 Golden Reference，不参与日常开发。

## 开发

```bash
pnpm install
pnpm typecheck
pnpm lint
pnpm test
pnpm build
```

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
5. 每迁移一个 compat 能力，先用 Golden / differential test 锁行为，再删除 compat 中对应实现。

详见 `docs/architecture.md`。
