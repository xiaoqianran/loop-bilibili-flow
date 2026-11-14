# P6：AI / Studio / Knowledge / Transcript 分层接管

## 问题与本轮实改（2026-11-14）

旧系统的核心问题不是 package 数量不够，而是 **compat 仍控制实际的请求、状态与浏览器副作用**。此前 P5 的 Runtime 对 POST 防重发修复没有覆盖 compat 内独立的 `requestChatCompletion`，它仍可能先发 page fetch，失败后再发 GM POST。本轮以实际业务调用链为迁移单元。

### 现在的运行调用链

```text
兼容 Studio / PRE / POST / Knowledge UI
      |
      +-- requestChatCompletion() -- app.ai.request() -- runtime.network
      |                                |                    |
      |                                +-- core.ai.*        +-- page/GM（POST 只发送一次）
      +-- runPreprocessWorkerPool() -- app.ai.runPool()
      +-- Studio Store / chat messages -- app.studio.*
      +-- applyAiWorkbenchStageUi() -- ui.studioController.applyWorkbenchStageUi()
      +-- knowledgeStoreRequest() -- app.knowledge.createRepository()
                                         |
                                         +-- runtime.knowledgeDb
      +-- app.transcript.acquireDetailed() -- Provider Registry
```

正式构建与旧 `appFn` API 兼容；本轮改动直接进入主路径，不是只新增空类/空 API。

## 业务所有权和不变契约

| 模块 | 现在归属 | 保持不变 |
| --- | --- | --- |
| AI POST / SSE / Abort / PRE 并发 Worker Pool | `apps/userscript/src/app/ai-controller.ts` | `requestChatCompletion` 回调协议、`runtime.abortController`、旧 UI 入口 |
| Studio 对话的序列化 / 恢复 / 请求消息构造 | `apps/userscript/src/app/studio-controller.ts` | `bili-subbatch-studio-chat-v1`、消息字段、历史存储上限 |
| Studio 工作区标签显示/隐藏、ARIA 属性 | `apps/userscript/src/ui/workspaces/studio-controller.ts` | DOM data-role 和 CSS class |
| Knowledge IndexedDB 事务及版本变更 | `packages/runtime/src/knowledge-db.ts` + `app/knowledge-repository.ts` | DB `bili-subbatch-knowledge-v1`、version=1、anchors/nodes |
| 平台字幕错误分类 | `apps/userscript/src/providers/transcript.ts` | 原 `acquire()` 返回值和异常传播保持兼容；新增 `acquireDetailed()` |

## 重要修复

1. **杜绝 AI 生产主路径的跨传输自动重发**：跨域直接 GM，站内 page fetch；POST 不会在错误后自动改走另一通道。若用户服务器需要 exactly-once，应另外支持幂等键。
2. **Studio 同一问题重复加入提示词**：历史记录原先包含刚插入的用户消息，后面又追加一次。现在剔除当前用户消息与运行中回答，并只插入一次当前问题。
3. **Studio 旧异步结果污染新请求**：清空或重启后，旧请求完成不能再覆盖新的运行状态；中止后的部分结果不会误标记为 done。
4. **Knowledge 删除中间失败**：不再依赖不完整的内存节点列表逐个删除，而是在同一 `readwrite` 事务内通过 `anchorId` 索引删除子节点与锚点。
5. **YouTube 字幕抓取失败被吞掉**：网络路径失败、DOM 也无法恢复时保留原始错误，`acquireDetailed` 可区分限流、鉴权、取消及网络错误。

## 当前仍在 compat 的内容（还不能宣称完整迁出）

- Studio 大型 DOM 事件绑定、可视化渲染、键盘/鼠标交互与 Panel 状态仍在 compat。只有 **工作台阶段 UI** 和 **聊天持久化状态变换** 已真正迁出。
- PRE/POST 流程中具体任务规划、缓存读取、Prompt 渲染、进度提示和模型列表编排仍由 compat 驱动；共享 Worker Pool 与底层 AI POST 已接管。
- Knowledge 的树型 UI、回答预览、锚点选择及 UI 缓存仍由 compat 管理；IndexedDB I/O 与级联删除已接管。
- 旧 `requestChatViaPageFetch` / `requestChatViaGm` 代码为缺少新应用入口时的兼容回退，正式构建走 `app.ai.request`。它们应在最终 compat 退出时删除，避免维护两套请求实现。
- `acquireDetailed` 目前提供诊断接口；需要将具体错误映射到 Studio 的可重试/不可重试 UI 才能形成端到端故障体验。

## 后续建议（以实际依赖关系排序）

1. 迁移 **AI Batch Coordinator**：任务计划、PRE→POST 流程、缓存快照、单任务重试，变成可测试状态机；保留 UI Adapter，不直接把 DOM 移到 Core。
2. 迁移 **Studio Interaction Controller**：独立处理事件委派、输入、发送、停止、阶段切换和菜单命令。最终删除 compat 中旧事件绑定，实现单一控制流。
3. 迁移 **Knowledge Controller**：管理 Anchor/Node 状态变化，补齐 IDB 升级与多标签同时访问测试，不改变 v1 Schema 直至迁移验证充分。
4. **Provider 诊断接入 UI**：错误状态可追踪、可安全重试、可恢复；保留无字幕与风控失败的区别。
5. 之后才考虑删除 compat 旧代码。每迁一片先锁行为、运行 Test/Build，再删除旧代码。

此轮仅做源码、单元/Golden 与构建检查，不做真实浏览器回归；对页面 DOM 变化、第三方 CORS 与 GM 行为的兼容性尚不能通过本轮验证证明。
