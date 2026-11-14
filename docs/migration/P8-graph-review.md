# 全仓图审查与控制器接管

2026-11-14 使用 code-review-graph 2.4.0 建立全仓图：163 文件、2177 节点、20227 边。检查 architecture、正式 compat 的 doAiAnalyze 与 knowledgeAsk 调用图，再对照实际源码；图包含 legacy，所以查询使用正式文件 qualified_name 消歧。静态图不证明浏览器行为。

## 实施

- Batch Coordinator 实际接管任务×模型展开、可运行 Prompt 筛选、配置校验、缓存分区入口和 POST 结果汇总；修复 allSettled 吞掉失败导致批次标为 done。
- PRE Pool 等待所有已派发 worker 结束后再抛错误，避免失败批次收尾后还有 worker 修改状态。
- Studio Interaction Controller 接管发送/清空/复制/导出与命令点击，移除 compat 对应分支；监听器随输入事件一起解绑。
- Knowledge Controller 接管生成→状态转换→保存→通知→清理顺序、锚点选择、删除后的列表转换。删除当前锚点先取消回答，迟到结果通过 exists 检查避免复活已删除数据。

## 边界与剩余范围

正式 compat 提供 DOM、现有配置表单、缓存存储和传输适配回调。批次整个 prepare 流程、缓存恢复 UI、PRE 分块重试、Studio 聊天提示构造/命令业务和 Knowledge 树渲染仍在 compat；本次不能宣称 compat 已清空或三个 Controller 全面迁移完成。全仓图的架构耦合告警是结构指标，不能直接当作缺陷。没有执行浏览器回归。
