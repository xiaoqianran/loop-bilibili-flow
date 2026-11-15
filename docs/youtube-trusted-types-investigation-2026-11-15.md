# YouTube 工作台实机故障复盘（2026-11-15）

## 复现环境与证据

- PC1 Chrome，课程页：https://www.youtube.com/watch?v=NfnWJUyUJYU&list=PLkt2uSq6rBVctENoVBg1TpCC7OQi31AlC
- 原标签页 Bilibili 有 `#bili-subbatch-panel`，YouTube 无该节点。
- 检查时 Greasy Fork 站内版本 6.10.3，GitHub 主分支为 6.10.5，发布渠道不同步。
- 在测试标签页运行 v6.10.5 构建（最小 Tampermonkey API 模拟），`ensurePanel()` 抛出：`TypeError: This document requires 'TrustedHTML' assignment`。
- 仅作为诊断，在测试页临时配置默认 Trusted Types 策略后，同一构建成功挂载面板并获取 568 条字幕。

## 正式修复

- `apps/userscript/src/runtime/trusted-html.ts` 创建仅供 SubBatch 使用的 `bili-subbatch-workbench` policy，不改动 YouTube 全局默认 policy。
- 包装工作台 `runtime.ts` 中 55 处和字幕阅读器 `transcript-controller.ts` 中 1 处 `innerHTML` 写入，既有转义和清洗不变。
- 增加 Trusted Types helper 单元测试与扫描应用层 DOM 写入的回归测试。
- 版本更新至 v6.10.6。

## PC1 实机复测

- 新 YouTube 测试标签页，不配置任何全局默认 policy，执行 v6.10.6 正式构建，面板成功挂载。
- 自动读取 568 条字幕；点击 00:17 时间戳，播放器从约 399.69 秒跳至 17 秒。
- 面板可展开；设置、字幕、知识、AI 工作区切换成功。
- 类型检查、lint、全部 428 个测试及正式构建通过。

## 验证边界

实机运行使用调试注入及最小 Tampermonkey API 模拟，不等同于已安装 Tampermonkey 的完整升级验收。GitHub 推送不会自动更新 Greasy Fork 站内版本；如仍安装旧版，应通过 GitHub 正式用户脚本地址更新后刷新课程页。
