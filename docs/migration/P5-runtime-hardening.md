# P5：运行时安全与导航收敛

## 本轮已经落地（2026-11-14）

- `apps/userscript/src/userscript-host.ts`：跨传输回退仅限 GET / HEAD / OPTIONS。非幂等请求在 page fetch 失败后不再交给 GM 重发。跨域 POST 如必须走 GM，应在发起前显式指定 `transport: "privileged"`。
- `packages/runtime/src/types.ts`：网络请求契约增加 `transport: "auto" | "page" | "privileged"`，不改变 `fallback` 的已有 GET 行为。
- `apps/userscript/src/app/navigation.ts`：History hook 由 `runtime.spa.observe` 共享管理，按 URL 和当前内容引用/CID 对常规轮询去重；媒体事件及 Provider 导航事件仍可主动要求刷新。
- 兼容入口 `app.installNavigationLifecycle`、`app.startUserscriptLifecycle` 和正式 `compat` 拼接保留，不在本轮迁移 Studio。
- 测试覆盖：跨传输 POST 防重发、GET 回退、显式 GM POST、page-only 策略、CID 变化、多个导航订阅者安全注销。

## 网络规则

| 触发方式 | GET/HEAD/OPTIONS | POST/其他方法 |
| --- | --- | --- |
| `transport: "page"` | 仅 page fetch，不回退 | 仅 page fetch，不回退 |
| `transport: "privileged"` | 直接 GM，一次发送 | 直接 GM，一次发送 |
| `transport: "auto"`（默认）+ `fallback` | 可根据 fallback 切换一次传输 | 不允许自动切换传输 |

特例：B 站 AI 字幕 CDN 在非 `page` 模式下仍直接走 GM，避免浏览器 CORS 的已知失败。

**注意**：此策略只能防止本客户端在网络错误后主动跨传输重复发送，不能提供服务端 exactly-once 语义。真正需要自动重试 POST 时，应另行支持服务端幂等键。

## 尚未迁出 compat 的职责

| 现状 | 推荐的下一接管层 | 首先补充的验证 |
| --- | --- | --- |
| AI Worker Pool / 模型请求 / SSE 处理 | `apps/userscript/app` 新 AI Controller，调用 `core.aiSession` 和 `runtime.network` | 中途终止、断网、缓存复用、多模型并行 |
| Knowledge IndexedDB / Thread Tree | `runtime` 的持久化端口 + 应用 Knowledge Controller | 旧数据读取、数据迁移、回滚 |
| Studio DOM 事件/视图状态 | `apps/userscript/ui` Controller / state 层 | 真实浏览器点击与路由切换 |
| Youtube 字幕回退错误 | Provider 结构化诊断结果，不直接改旧 `acquire(): null` 契约 | 无字幕、429、网络错误、DOM 回退失败 |
| Media/Selection Toolbar | 专门 Controller 与 Runtime Port | 播放器切换、取消订阅、跨平台 |

### 迁移准入与退出

每一项能力按以下顺序执行：

1. 记录旧 compat 行为和数据格式，先补 Golden / differential test。
2. 将纯逻辑放入 `packages/core`，平台特定纯规则放入 `packages/bilibili` 或 `packages/youtube`。
3. 浏览器侧副作用放入 Host/Runtime，业务编排放入 App；不要在 Core 加 DOM 或 GM API。
4. 对迁移后的能力进行真实 Bilibili / YouTube 回归，再删除 compat 中对应实现。
5. 完整运行 `pnpm typecheck`、`pnpm lint`、`pnpm test`、`pnpm build` 和 `pnpm build:pure-userscript`。

**不要**在完整 Studio Controller 接管前删除 `compat/maintained-runtime.js` 或修改冻结的 v6 存储键。