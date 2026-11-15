import { toTrustedHTML } from "../runtime/trusted-html";
import type { WorkbenchSubtitleResult } from "../runtime/workbench-state";
import type * as CoreModule from "@subbatch/core";
import type { SubBatchMonorepo } from "../main";
import type { createRepository as createKnowledgeRepository } from "../app/knowledge-repository";
import type { createController as createKnowledgeController } from "../app/knowledge-controller";
import type { BatchTask } from "../app/ai-batch-coordinator";
import type { StudioMessage } from "../app/studio-controller";
import type { AiSessionCachePayload } from "@subbatch/core";
import type { createCoordinator as createAiBatchCoordinator } from "../app/ai-batch-coordinator";
import { buildMermaidCard, getMermaidScale, setMermaidScale, fitMermaidToViewport, createMermaidFullscreen } from "../ui/workspaces/mermaid-presentation";
import type { MermaidElement } from "../ui/workspaces/mermaid-presentation";
import { normalizeCachedSessionInput, applyRestoredRunOutput, restorePreprocessRun } from "../app/ai-session-hydration";
import { resolveAiScrollState } from "../ui/workspaces/ai-scroll-state";
import { marked, DOMPurify, katex, hljs, mermaid, installRenderingStyles } from "../runtime/rendering-libs";
import { renderTranscriptReading, transcriptReadingText, transcriptTimestampPattern, transcriptTimestamps } from "../ui/workspaces/transcript-reading";
// Full-feature workbench. Bundled by the composition root; no standalone compatibility script.
/**
 * v6.10.8 — HTML 阅读页按阅读区域宽度布局，无目录时正文占满空间，移除模型内联布局样式。
 * v6.10.7 — 内置 Markdown、净化、公式、高亮和图表依赖，移除运行时 CDN 加载。
 * v6.10.6 — YouTube Trusted Types 隔离适配：修复面板与字幕 HTML 写入。
 * v6.10.5 — YouTube 全工作台入口、字幕与时间跳转适配。
 * v6.10.4 — Video Carrier 抽象：festival/blackboard 仅在检测到真实 BV / active player 后启动完整工作台；修正 live-player helper bridge。
 * v6.9.15 — 支持 B 站 /festival/* 专题页：复用 BV 路由与现有字幕链路，不引入专题页专用抓取分支。
 * v6.9.14 — 工作台可见文字默认统一 14px。
 * v6.9.13 — 单独安装 loop-bilibili-flow 时补齐 core 回退，避免字幕库渲染崩溃；打开页面先点开中文字幕。
 * v6.9.12 — 用户提问色条改到右侧；框选/知识问答发送后不再自动滚到底。
 * v6.9.11 — 知识库对话（提问 / 回答卡片 / 对话页）正文字号固定 14px，不再跟笔记 A± 走。
 * v6.9.10 — HTML 阅读页：目录高亮不再 scrollIntoView 抢正文滚动；侧栏高度锁在可视区，可独立下滑。
 * v6.9.9 — Mermaid 重绘：从设置回填被缓存抹掉的 API Key；失败卡可就地填 Key 或跳到 设置 → LLM。
 * v6.9.8 — 对话提问条靠右；问答用预处理同款 Markdown 卡片；默认正文字号 14px。
 * v6.9.7 — HTML 阅读页目录改成语雀/飞书式分层大纲：层级、当前定位、滚动跟随。
 * v6.9.6 — 后处理按模型复用缓存：只生成身份变化的版本，其余命中缓存。规则在 packages/core。
 * v6.9.5 — 连播切集认播放器身份：URL 未变时按 player/cid 换字幕。规则在 packages/bilibili。
 * v6.9.4 — 后处理会话缓存：刷新只恢复；手动重新生成与 Mermaid 重绘覆盖。规则在 packages/core。
 * v6.9.3 — 流程后处理 LLM 改为有序队列：编号 + 拖拽排序，运行顺序与队列一致。
 * v6.9.2 — 流程抽屉与工作台对齐：预处理 / 对话 / 后处理。
 * v6.9.1 — 对话增加字幕上下文压缩与旧轮记忆压缩；超长不再只砍开头。
 * v6.9.0 — AI 工作台新增「对话」阶段（预处理与后处理之间）：对着当前字幕多轮提问，支持 / 命令。
 * v6.8.1 — 重写 HTML 阅读页内置 Prompt：只提取对理解这一期真正有用的内容，去掉排版清单。
 * v6.8.0 — 后处理新增『HTML 阅读页』：模型只产出语义 HTML，本地用 Folio 壳自动渲染并可导出独立页面。
 * v6.6.7 — 字幕库任务条：抓取/扫描可暂停继续；左侧主操作与阅读区导出分层，去掉堆叠按钮。
 * v6.6.6 — 合集扫描展开单元内多分P：带「第一单元」等章节的合集不再只抓每个单元的 P1。
 * v6.6.5 — Catppuccin 主题切换：设置 → 外观可选 Latte / Frappé / Macchiato / Mocha（默认 Mocha），本地持久化。
 * v6.6.4 — 设置 → Prompt / LLM 列表支持拖拽排序；顺序持久化，新建仍默认追加到底部。
 * v6.6.3 — 恢复后台自动 pipeline：标签页即使在后台/未打开面板，点进视频也会自动抓字幕并送 AI；自动分析不再强行展开面板。
 * v6.6.2 — 个人主页不属于合集的散视频统一归入「视频」文件夹（UP/视频/…）。
 * v6.6.1 — 个人主页扫描后拉取该 UP 全部合集（名称+短地址），按 BV 把成员视频迁入 合集 文件夹（路径 UP/合集名/…）。
 * v6.6.0 — 个人主页嵌套文件夹：顶层 = UP 名；其下单视频 / 视频选集 / 合集分层；下载路径同步为 loop-bilibili-subbatch/UP/…。
 * v6.5.1 — 自动抓取后联动采集模式下拉：多分P 切「视频选集」，ugc 合集切「合集」，减少手动点选。
 * v6.5.0 — 架构收敛：字幕导出/选集合集分组/index 规则仅存在 packages/core；产品体只做 monorepo bridge + IO，消除双轨实现。
 * v6.4.1 — 合集与视频选集一样在字幕库自动建文件夹：扫描/打开合集内视频识别 ugc_season 并分组；自动模式扫合集页拉全列表。
 * v6.4.0 — index.md 视频选集/单视频改为「作者 + www.bilibili.com/video/BV + 标题」，与合集「作者 + 短地址 + 名称」对齐。
 * v6.2.1 — 修复：下载后缀 -txt、选集未成文件夹、index.md 叠成 (1)(2)、合集下载未知UP；字幕面板与下载共用文件夹标签；GM_download overwrite。
 * v6.2.0 — 字幕库文件夹：视频选集按「UP+视频名」、合集按「UP+合集名」分组；支持全部展开/收起与文件夹全选勾选。合集 index.md 存 UP+短地址+合集名（按合集地址更新名称，不存 BV）。
 * v6.1.9 — 字幕批量下载落到 Downloads/loop-bilibili-subbatch/<视频名>/P{n}{分P名}.{ext}；根目录 index.md 维护 BV → 视频名映射，同 BV 更新名称。
 * v6.0.2 — 快捷键微调：主召唤/隐藏默认键改为 Ctrl+B；旧版仍使用默认 Ctrl+Alt+B 的配置自动迁移，用户自定义键位保持不变。
 * v6.0.1 — 全局快捷键 / Quick Summon：新增可编辑快捷键中心；支持快捷召唤/隐藏、AI 处理字幕直达、后处理上次模型直达、悬浮/靠边切换；召唤布局与默认内容可配置，并检测 Chrome / Bilibili 常见冲突。
 * v6.0.0 — Knowledge Drill-down：AI 处理字幕可选区创建 Anchor；右侧 Knowledge Rail 支持独立树状追问、Breadcrumb、建议追问与流式回答；Anchor/Thread 通过独立 IndexedDB 永久保存，并新增 Knowledge Workspace 检索与恢复。
 * v5.10.2 — AI 处理字幕阅读视图重构：规范化稿按语义段落渲染为知识卡片，提取真实时间范围、主题上下文与识别存疑提示；原始字幕仍保留证据流文本视图。
 * v5.10.1 — 流程表单 UI 精修：原生下拉统一为自绘选择器外观；数字参数改为 −/＋ Stepper；预处理开关与模型多选改为统一 Studio 控件；保留原生可访问性与键盘操作。
 * v5.10.0 — Studio Shell UI/UX 重构：顶层横向标签改为左侧 Workspace Rail；主画布、上下文工具条、设置与资源库统一信息层级；状态栏改为非侵入式浮动状态；为 v6 Knowledge Workspace 预留稳定界面骨架。
 * v5.9.3 — AI 工作台恢复「预处理 / 后处理」一级阶段；预处理直接查看原始字幕与 AI 处理字幕，后处理专门承载 Mermaid 等 POST 产物及模型版本。
 * v5.9.2 — 设置 → Prompt 拆成独立“预处理 / 后处理”工作区：列表、搜索、新建与编辑按阶段隔离；编辑器不再暴露阶段下拉框。
 * v5.9.1 — 微调 PRE 默认全局并发：3 → 6；失败重试仍默认 2，其他 Chunk Engine 参数与行为不变。
 * v5.9.0 — PRE Chunk Engine：预处理模型/全局并发可控；按视频时间优先、字符硬限制智能切块；支持可调 overlap、失败重试、全局 Worker Pool 与基于真实时间戳的确定性拼接去重，面向 2h+ 长视频。
 * v5.8.1 — 修复 B 站 SPA/合集内切视频时 AI 输入不换源：当前 BV+P 成为自动分析唯一输入；路由变化立即清空旧预处理稿/结果；自动抓取不再要求 ctx.type===video。内置 PRE 统一将任意语言字幕转换为简体中文。
 * v5.8.0 — AI Workbench：主界面不再暴露 Pipeline 参数；输入/产物/模型三级信息重新分层。后处理支持多个产物任务，每个 POST Prompt 独立选择一个或多个 LLM；结果先按产物、再按模型切换。预处理稿移入“查看输入”抽屉，处理方案移入独立抽屉。
 * v5.7.0 — AI Pipeline：原始字幕 → 可关闭的字幕规范化预处理 → 后处理；PRE/POST Prompt 分阶段管理，预处理模型可独立选择，结果按视频缓存并可查看/强制重跑，后处理重生成复用预处理稿。
 * v5.6.0 — 字幕库重构为视频资源库 Master–Detail：采集抽屉、搜索/状态筛选、左侧唯一视频列表、右侧字幕工作区；扫描按 BV+P 增量合并，避免视频列表与字幕列表上下重复堆叠。
 * v5.5.0 — 设置页重构为 Prompt / LLM 双标签 Master–Detail：左侧搜索与配置列表，右侧仅编辑当前项；切换条目前自动保存，适合大量提示词与模型配置。
 * v5.4.0 — AI 任务层重构为透明提示词库：仅内置“全 Mermaid 学习图谱”；System/User 提示词完整可见、可编辑、可新增/复制/删除；移除旧深度/精炼/学习/行动模式。
 * v5.3.3 — Mermaid 图禁止时间戳：提示词约束 + 本地代码块清洗 + 修复链路清洗，正文引用不受影响。
 * v5.3.2 — 面板宽度小/中/大三档；高度默认约 90vh，支持独立手动调整。
 * v5.3.1 — 新增当前模型独立重新生成与全部重新生成；失败模型可单独重试，已完成模型与其结果不受影响。
 * v5.3.0 — 重构字幕提示词为固定证据协议、模式模块、结构化来源、模型附加要求与质量检查。
 * v5.2.4 — 修复发送前覆盖未保存模型配置、旧 4096 默认值迁移、严格识别流式截断；Mermaid 修复上限改为 32768。
 * v5.2.3 — 新建 AI 配置的默认 Max tokens 调整为 65536。
 * v5.2.2 — 彻底移除全局按钮总闸：扫描、批处理与 AI 使用独立操作令牌；主操作按钮始终可点击，可排队或重新开始。
 * v5.2.1 — 修复合集扫描覆盖当前字幕；扫描/批处理与 AI 生成使用独立忙状态，避免字幕按钮长期灰化。
 * v5.2.0 — 阅读优先布局：紧凑 AI 控制栏、正文扩容与全窗口专注模式。
 * v5.1.1 — Mermaid 修复按模型隔离：只检查目标模型状态，并锁定其配置与笔记源码，避免跨标签串写。
 * v5.1.0 — 多模型配置与并发分析：一次字幕输入同时运行多个模型，并可切换查看独立结果。
 * v2.0.3 — 新增「全 Mermaid 学习图谱」模式：多图拆解知识、流程、因果、学习路径与自测。
 * v2.0.1 — Mermaid 高对比可读渲染：原始宽度、缩放工具栏与全屏查看。
 * v2.0 — 四级缓存与 stale-while-revalidate；当前字幕全文检索、时间跳转、播放同步高亮。
 * v1.1 — 当前视频自动抓字幕：页面直读优先、内存缓存、WBI 完整链路回退。
 * v1.0 — 安全 Markdown、时间戳证据、按需渲染、追加式流输出、低功耗 UI。
 * v0.8 — Peer AI-userscript practices: page fetch stream first,
 * GM stream fallback (no timeout), stick-bottom scroll, GM storage.
 * See PEER_AI_PRACTICES.md.
 */

import { readSessionCache, writeSessionCache } from "../runtime/session-cache";
import { createPersistentCache } from "../runtime/persistent-cache";
import { createWorkbenchState } from "../runtime/workbench-state";
import { callApp, resolveAppMethod } from "../runtime/app-bridge";
import type { AppMethodPath, AppMethodArgs, AppMethodResult } from "../runtime/app-bridge";

import type { BilibiliVideoView, SubtitleTrack, SubtitleMeta } from "@subbatch/bilibili";
import { parseUserSeasonPage } from "../app/library-scan-controller";
import type { CollectionArchive } from "../app/library-scan-controller";
import type { KnowledgeAnchor } from "../ui/workspaces/knowledge-navigation-controller";
import type { BatchModel } from "../app/ai-batch-coordinator";
import type { ChatCompletionOptions } from "../app/ai-controller";
import type { AiProfile, PromptProfile, SubtitleCue, LibraryGroupItem, LibraryRenderNode, FolioOutlineNode } from "@subbatch/core";
import type { ScanContext } from "../app/scan-context";
type SubtitleFetchResult = WorkbenchSubtitleResult;

interface WorkbenchPanelElement extends HTMLElement {
  _bsbKnowledgeLayoutBound?: boolean;
  _bsbSetOpen?: (open: boolean) => void;
  _bsbSetDock?: (side: "left" | "right" | null) => void;
  _bsbToggleDockExpanded?: (force?: boolean) => void;
}
type CoreApi = typeof CoreModule;
type CoreMethod = {
  [K in keyof CoreApi]: CoreApi[K] extends (...args: never[]) => unknown ? K : never
}[keyof CoreApi];
import type { WorkbenchKnowledgeNode, WorkbenchLibraryItem, WorkbenchAiRun, WorkbenchAiRuntime, WorkbenchPostTask, WorkbenchUi } from "../runtime/workbench-state";

import type { KnowledgeEvidence, KnowledgeAnswerNode } from "../ui/workspaces/knowledge-answer-view";
import type { KnowledgeReaderAnchor } from "../ui/workspaces/knowledge-reader-controller";
export function mountWorkbench(SubBatch: { SubBatchMonorepo: typeof SubBatchMonorepo }) {
  "use strict";
  const { closeMermaidFullscreen, openMermaidFullscreen } = createMermaidFullscreen({
    root: () => document.getElementById(PANEL_ID),
    requestFrame: callback => requestAnimationFrame(callback),
  });

  function errorMessage(value: unknown): string {
    if (value && typeof value === "object" && "message" in value && value.message) return String(value.message);
    return String(value);
  }

  function isAbortError(value: unknown): boolean {
    return !!value && typeof value === "object" && "name" in value && value.name === "AbortError";
  }
  function isMermaidSetupError(value: unknown): boolean {
    return !!value && typeof value === "object" && "mermaidSetup" in value && value.mermaidSetup === true;
  }

  /**
   * P4.5 monorepo bridge: production bootstrap exposes `var SubBatch`.
   * Production core and Application capabilities must be supplied by the
   * bundled SubBatch.SubBatchMonorepo. Do not substitute fake business rules.
   */

  const SCRIPT_VERSION =
    (typeof GM_info !== "undefined" && GM_info?.script?.version) || "6.10.8";
  const PANEL_ID = "bili-subbatch-panel";
  const UI_STORE_KEY = "bili-subbatch-ui-v2";
  /** Catppuccin flavors — official palette https://catppuccin.com/palette/ */
  const DEFAULT_CTP_FLAVOR = "mocha";
  const CTP_FLAVOR_IDS = Object.freeze(["latte", "frappe", "macchiato", "mocha"] as const);
  const CTP_FLAVORS = Object.freeze([
    Object.freeze({ id: "mocha", label: "Mocha", hint: "默认深色", emoji: "🌿" }),
    Object.freeze({ id: "macchiato", label: "Macchiato", hint: "中等深色", emoji: "🌺" }),
    Object.freeze({ id: "frappe", label: "Frappé", hint: "柔和深色", emoji: "🪴" }),
    Object.freeze({ id: "latte", label: "Latte", hint: "浅色日间", emoji: "🌻" }),
  ]);
  const CTP_PALETTES = Object.freeze({
    latte: Object.freeze({
      rosewater: "#dc8a78", flamingo: "#dd7878", pink: "#ea76cb", mauve: "#8839ef",
      red: "#d20f39", maroon: "#e64553", peach: "#fe640b", yellow: "#df8e1d",
      green: "#40a02b", teal: "#179299", sky: "#04a5e5", sapphire: "#209fb5",
      blue: "#1e66f5", lavender: "#7287fd", text: "#4c4f69", subtext1: "#5c5f77",
      subtext0: "#6c6f85", overlay2: "#7c7f93", overlay1: "#8c8fa1", overlay0: "#9ca0b0",
      surface2: "#acb0be", surface1: "#bcc0cc", surface0: "#ccd0da",
      base: "#eff1f5", mantle: "#e6e9ef", crust: "#dce0e8",
    }),
    frappe: Object.freeze({
      rosewater: "#f2d5cf", flamingo: "#eebebe", pink: "#f4b8e4", mauve: "#ca9ee6",
      red: "#e78284", maroon: "#ea999c", peach: "#ef9f76", yellow: "#e5c890",
      green: "#a6d189", teal: "#81c8be", sky: "#99d1db", sapphire: "#85c1dc",
      blue: "#8caaee", lavender: "#babbf1", text: "#c6d0f5", subtext1: "#b5bfe2",
      subtext0: "#a5adce", overlay2: "#949cbb", overlay1: "#838ba7", overlay0: "#737994",
      surface2: "#626880", surface1: "#51576d", surface0: "#414559",
      base: "#303446", mantle: "#292c3c", crust: "#232634",
    }),
    macchiato: Object.freeze({
      rosewater: "#f4dbd6", flamingo: "#f0c6c6", pink: "#f5bde6", mauve: "#c6a0f6",
      red: "#ed8796", maroon: "#ee99a0", peach: "#f5a97f", yellow: "#eed49f",
      green: "#a6da95", teal: "#8bd5ca", sky: "#91d7e3", sapphire: "#7dc4e4",
      blue: "#8aadf4", lavender: "#b7bdf8", text: "#cad3f5", subtext1: "#b8c0e0",
      subtext0: "#a5adcb", overlay2: "#939ab7", overlay1: "#8087a2", overlay0: "#6e738d",
      surface2: "#5b6078", surface1: "#494d64", surface0: "#363a4f",
      base: "#24273a", mantle: "#1e2030", crust: "#181926",
    }),
    mocha: Object.freeze({
      rosewater: "#f5e0dc", flamingo: "#f2cdcd", pink: "#f5c2e7", mauve: "#cba6f7",
      red: "#f38ba8", maroon: "#eba0ac", peach: "#fab387", yellow: "#f9e2af",
      green: "#a6e3a1", teal: "#94e2d5", sky: "#89dceb", sapphire: "#74c7ec",
      blue: "#89b4fa", lavender: "#b4befe", text: "#cdd6f4", subtext1: "#bac2de",
      subtext0: "#a6adc8", overlay2: "#9399b2", overlay1: "#7f849c", overlay0: "#6c7086",
      surface2: "#585b70", surface1: "#45475a", surface0: "#313244",
      base: "#1e1e2e", mantle: "#181825", crust: "#11111b",
    }),
  });
  function normalizeCtpFlavor(value: unknown): (typeof CTP_FLAVOR_IDS)[number] {
    const id = String(value || "").trim().toLowerCase();
    return CTP_FLAVOR_IDS.find((flavor) => flavor === id) || DEFAULT_CTP_FLAVOR;
  }
  function getCtpPalette(flavor = DEFAULT_CTP_FLAVOR) {
    return CTP_PALETTES[normalizeCtpFlavor(flavor)] || CTP_PALETTES[DEFAULT_CTP_FLAVOR];
  }
  function buildCtpFlavorCss(panelId: string) {
    return CTP_FLAVOR_IDS.map((id) => {
      const palette = CTP_PALETTES[id];
      const vars = Object.entries(palette)
        .map(([key, hex]) => `--ctp-${key}: ${hex};`)
        .join("\n        ");
      if (id === DEFAULT_CTP_FLAVOR) {
        return `#${panelId},\n      #${panelId}[data-ctp-flavor="${id}"] {\n        ${vars}\n      }`;
      }
      return `#${panelId}[data-ctp-flavor="${id}"] {\n        ${vars}\n      }`;
    }).join("\n\n      ");
  }
  /** v2：默认 stream=true，避免非流式长推理被中间层 10s 掐断 (client_gone) */
  const AI_STORE_KEY = "bili-subbatch-ai-v2"; // legacy single-profile key
  const AI_PROFILES_STORE_KEY = "bili-subbatch-ai-profiles-v1";
  const AI_PROFILES_SCHEMA_VERSION = 4;
  const PROMPT_STORE_KEY = "bili-subbatch-prompts-v1";
  const PROMPT_SCHEMA_VERSION = 9;
  const DEFAULT_PROMPT_ID = "builtin-mermaid-learning-map";
  const DEFAULT_PREPROCESS_PROMPT_ID = "builtin-subtitle-normalizer";
  const DEFAULT_KNOWLEDGE_PROMPT_ID = "builtin-knowledge-drilldown";
  const DEFAULT_HTML_FOLIO_PROMPT_ID = "builtin-html-reading-folio";
  const STUDIO_CHAT_STORE_KEY = "bili-subbatch-studio-chat-v1";
  const STUDIO_MODEL_STORE_KEY = "bili-subbatch-studio-model-v1";
  const STUDIO_CHAT_KEEP_RECENT = 8;
  const STUDIO_CHAT_MEMORY_CHARS = 2400;
  const STUDIO_SLASH_COMMANDS = Object.freeze([
    Object.freeze({ id: "clear", aliases: ["clear", "清空", "new", "新建"], hint: "清空当前对话" }),
    Object.freeze({ id: "stop", aliases: ["stop", "停止"], hint: "停止生成" }),
    Object.freeze({ id: "copy", aliases: ["copy", "复制"], hint: "复制上一条回答" }),
    Object.freeze({ id: "export", aliases: ["export", "导出"], hint: "导出对话为 Markdown" }),
    Object.freeze({ id: "compress", aliases: ["compress", "压缩"], hint: "立刻压缩旧对话记忆" }),
    Object.freeze({ id: "memory", aliases: ["memory", "记忆"], hint: "查看当前压缩记忆" }),
    Object.freeze({ id: "raw", aliases: ["raw", "原文"], hint: "改用原始字幕当上下文" }),
    Object.freeze({ id: "norm", aliases: ["norm", "规范化"], hint: "改用规范化稿当上下文" }),
    Object.freeze({ id: "help", aliases: ["help", "帮助"], hint: "列出可用命令" }),
  ]);
  const PREPROCESS_ENABLED_STORE_KEY = "bili-subbatch-preprocess-enabled-v1";
  const PREPROCESS_MODEL_STORE_KEY = "bili-subbatch-preprocess-model-v1";
  const PREPROCESS_CONCURRENCY_STORE_KEY = "bili-subbatch-preprocess-concurrency-v1";
  const PREPROCESS_TARGET_MINUTES_STORE_KEY = "bili-subbatch-preprocess-target-minutes-v1";
  const PREPROCESS_OVERLAP_SECONDS_STORE_KEY = "bili-subbatch-preprocess-overlap-seconds-v1";
  const PREPROCESS_MAX_CHARS_STORE_KEY = "bili-subbatch-preprocess-max-chars-v1";
  const PREPROCESS_RETRIES_STORE_KEY = "bili-subbatch-preprocess-retries-v1";
  const POST_TASKS_STORE_KEY = "bili-subbatch-post-tasks-v1";
  const POST_TASKS_SCHEMA_VERSION = 2;
  const KNOWLEDGE_MODEL_STORE_KEY = "bili-subbatch-knowledge-model-v1";
  const SHORTCUT_STORE_KEY = "bili-subbatch-shortcuts-v1";
  const SHORTCUT_SCHEMA_VERSION = 2;
  const SHORTCUT_COMMANDS = Object.freeze([
    Object.freeze({ id: "toggle-panel", label: "召唤 / 隐藏面板", hint: "打开时按你的召唤布局与默认内容进入；再次按下收起。", defaultChord: "Ctrl+KeyB" }),
    Object.freeze({ id: "open-processed", label: "AI 处理字幕", hint: "直接打开 AI 工作台 → 预处理 → AI 处理字幕。", defaultChord: "Ctrl+Alt+Digit1" }),
    Object.freeze({ id: "open-postprocess", label: "后处理结果", hint: "直接打开 AI 工作台 → 后处理，并恢复当前/上次产物与模型。", defaultChord: "Ctrl+Alt+Digit2" }),
    Object.freeze({ id: "toggle-dock", label: "悬浮 / 靠边", hint: "在悬浮模式和你偏好的贴边方向之间切换。", defaultChord: "Ctrl+Alt+KeyD" }),
  ]);
  const KNOWLEDGE_ANCHOR_STORE = "anchors";
  const KNOWLEDGE_NODE_STORE = "nodes";
  const KNOWLEDGE_SELECTION_MIN = 2;
  const KNOWLEDGE_SELECTION_MAX = 1200;
  const PREPROCESS_CACHE_TTL_MS = 30 * 24 * 60 * 60_000;
  const PREPROCESS_DEFAULT_CONCURRENCY = 6;
  const PREPROCESS_DEFAULT_TARGET_MINUTES = 8;
  const PREPROCESS_DEFAULT_OVERLAP_SECONDS = 30;
  const PREPROCESS_DEFAULT_MAX_CHARS = 24000;
  const PREPROCESS_DEFAULT_RETRIES = 2;
  const AUTO_CAPTURE_STORE_KEY = "bili-subbatch-auto-capture-v1";
  const AUTO_ANALYZE_STORE_KEY = "bili-subbatch-auto-analyze-v1";
  const TRANSCRIPT_FOLLOW_STORE_KEY = "bili-subbatch-transcript-follow-v2";
  const PLAYER_SUBTITLE_STORE_KEY = "bili-subbatch-player-subtitle-v2";
  const PLAYER_SUBTITLE_SELECTORS = Object.freeze({
    button: ".bpx-player-ctrl-subtitle",
    panel: ".bpx-player-ctrl-subtitle-box",
    item: ".bpx-player-ctrl-subtitle-language-item[data-lan]",
    active: ".bpx-player-ctrl-subtitle-language-item.bpx-state-active",
    close: ".bpx-player-ctrl-subtitle-close-switch",
  });
  const CACHE_DB_NAME = "bili-subbatch-cache-v2";
  const CACHE_DB_VERSION = 1;
  const CACHE_STORE_NAME = "records";
  const CACHE_CHANNEL_NAME = "bili-subbatch-cache-v2";
  const CACHE_SESSION_PREFIX = "bsb:v2:";
  const MEMORY_CACHE_LIMIT = 32;
  const VIEW_CACHE_TTL_MS = 30 * 60_000;
  /** Browser Downloads root folder for batch subtitle exports. */
  const SUBTITLE_EXPORT_ROOT = "loop-bilibili-subbatch";
  const SUBTITLE_EXPORT_INDEX_NAME = "index.md";
  const SUBTITLE_EXPORT_INDEX_STORE_KEY = "bili-subbatch-export-index-v1";
  const TRACK_CACHE_TTL_MS = 10 * 60_000;
  const SUBTITLE_CACHE_TTL_MS = 30 * 24 * 60 * 60_000;
  const SUBTITLE_REVALIDATE_MS = 12 * 60 * 60_000;
  const AUTO_CAPTURE_DELAY_MS = 420;
  const AUTO_ANALYZE_DELAY_MS = 180;
  const pageWindow = typeof unsafeWindow !== "undefined" ? unsafeWindow : window;
  const MAX_SUBTITLE_CHARS = 160000;
  const STREAM_PAINT_INTERVAL_MS = 48;
  const RENDER_BATCH_SIZE = 24;
  const NOTE_FONT_MIN = 14;
  const NOTE_FONT_MAX = 22;
  const NOTE_FONT_DEFAULT = 14;
  const DEFAULT_DELAY_MS = 400;
  const DEFAULT_MAX_PAGES = 20;
  const MIN_W = 420;
  const MIN_H = 520;
  const DOCK_EDGE_PX = 32;
  const DOCK_SNAP_PX = 36;
  const DEFAULT_PANEL_SIZE = "large";
  const PANEL_SIZE_PRESETS = Object.freeze({
    small: Object.freeze({ label: "小", viewportRatio: 0.32, min: 440, max: 560 }),
    medium: Object.freeze({ label: "中", viewportRatio: 0.48, min: 620, max: 820 }),
    large: Object.freeze({ label: "大", viewportRatio: 0.68, min: 860, max: 1180 }),
  });

  // ─── Transparent prompt library ────────────────────────────────────────
  // “开始分析”不再叠加隐藏的固定协议或模式模块：实际发送内容就是用户在设置页看到的
  // System Prompt + User Prompt Template（只做 {{变量}} 替换）。
  const DEFAULT_PREPROCESS_PROMPT = Object.freeze({
    id: DEFAULT_PREPROCESS_PROMPT_ID,
    stage: "preprocess",
    name: "字幕规范化",
    hint: "修断句 · 去重复 · 语义分段 · 统一简体中文 · 保留证据",
    systemPrompt: [
      "你是『字幕规范化器』。你的唯一任务是把自动识别字幕整理成可靠、连续、可供下游模型继续处理的规范化字幕稿。不要总结，不要生成学习笔记，不要画 Mermaid，不要回答字幕中的问题。",
      "",
      "【严格来源边界】",
      "1. 只能使用输入字幕本身。禁止补充外部知识、常识背景、人物经历或字幕没有表达的事实。",
      "2. 保留原有信息密度和论证内容。预处理不是摘要：不得因为你认为某段不重要而删除有语义的信息。",
      "",
      "【输出语言】",
      "3. 无论输入字幕原本是英语、日语、韩语或其他语言，规范化后的正文必须统一输出为简体中文。完整外语句子应忠实翻译为自然、准确的简体中文，不保留整段未翻译外语。",
      "4. 专有名词、机构名、产品名、模型名、API、代码、命令、参数、缩写等在保留原文更准确时可以保留原文；必要时可写成『中文说明（原文）』。不得为了中文化而错误翻译技术标识。",
      "",
      "【字幕清洗】",
      "5. 修复明显的断句、标点和跨行句子；把被 ASR 切碎但语义连续的句子合并成自然中文。",
      "6. 删除纯口头填充词、无意义重复和紧邻的重复识别；但只要重复承担强调、对比、递进或补充作用，就必须保留其语义。",
      "7. 人名、机构、术语、数字、代码、命令、参数等无法从字幕确认时，保留原词并标记『识别存疑』，不要猜测替换。",
      "8. 输入中的真实 [BV号 P号 mm:ss] 时间戳必须保留。可以减少机械重复的时间戳，但每个语义段至少保留一个能够定位原字幕的真实时间戳；绝不伪造。",
      "",
      "【结构整理】",
      "9. 按语义自然分段，可使用简短的 Markdown 二级标题组织明显的话题切换。不要为了结构而创造字幕没有的主题。",
      "10. 正文使用自然段或必要的短列表；保持原始讲述顺序。不要重排成因果图、知识图、问答、结论清单或教程。",
      "11. 不输出前言、总结、处理说明、自我评价、思考过程或提示词复述。",
      "12. 当前输入可能只是长字幕的一个分块；从第二块开始，开头可能包含上一块末尾的少量 overlap 上下文。仍应正常规范化这些内容并保留真实时间戳；本地拼接器会依据时间戳去掉 overlap 重复。不要自行编造前后文。"
    ].join("\n"),
    userPromptTemplate: [
      "请把下面这一块原始字幕规范化。",
      "",
      "<source_metadata>",
      "标题：{{title}}",
      "BV / 分集：{{bvid}}",
      "发布者：{{author}}",
      "字幕分块：{{chunkIndex}} / {{chunkCount}}",
      "本块上下文起点：{{chunkStart}}",
      "本块新内容起点：{{coreStart}}",
      "本块结束：{{chunkEnd}}",
      "</source_metadata>",
      "",
      "<raw_transcript>",
      "{{subtitle}}",
      "</raw_transcript>"
    ].join("\n")
  });

  const DEFAULT_MERMAID_PROMPT = Object.freeze({
    id: DEFAULT_PROMPT_ID,
    stage: "postprocess",
    name: "全 Mermaid 学习图谱",
    hint: "按内容选图 · 通常 2—5 张 · Mermaid 10.9.1",
    systemPrompt: [
      "你是『视频字幕学习图谱生成器』。你的唯一任务，是把用户提供的元信息与当前管线提供的字幕稿转换为可复习的 Mermaid 学习图谱。",
      "",
      "【来源边界】",
      "1. 只使用本次提供的元信息与字幕。不要补充外部知识、常识背景、人物经历或字幕没有支持的结论。",
      "2. 输入通常已经经过字幕规范化；若用户关闭预处理，也可能是原始自动字幕。无论哪种情况都不得改变原意。人名、机构、数字、命令、参数、代码或术语无法确认时，在节点文字中标记『识别存疑』，不要猜测替换。",
      "2a. 所有最终可见标题与 Mermaid 节点文字统一使用简体中文。若输入仍是英语、日语或其他语言，先忠实理解并转换为简体中文；专有名词、模型名、API、代码、命令、参数和缩写可保留必要原文。",
      "3. 输入中的 [BV号 P号 mm:ss] 只用于定位证据。最终 Mermaid 节点、边、子图标题以及 Markdown 标题中都不要输出 BV/P/时间戳引用，也不要伪造时间戳。",
      "",
      "【输出目标】",
      "4. 用少量、用途明确的图重建字幕中的知识关系，不按字幕顺序逐句复述。图的数量服从内容，不为凑数生成空洞图。",
      "5. 通常输出 2—5 张图。内容足够时优先包含一张知识总览；其余只从流程或论证链、因果或依赖、对比或决策、学习路径、自测关系中选择字幕真正支持的类型。",
      "6. 每张图保持单一主题，建议 8—18 个节点。优先保留核心概念、关键关系、步骤、条件、边界、例子、风险和结论；删除口头填充、重复和无信息增量内容。",
      "7. 学习路径或自测图中的问题必须能直接由本次字幕回答，不得引入字幕外知识。",
      "",
      "【严格输出格式】",
      "8. 只允许一个 Markdown 一级标题。其后每张图使用一个 Markdown 二级标题和一个独立的 ```mermaid``` 代码块。",
      "9. 除一级/二级标题与 Mermaid 代码块外，不要输出普通段落、列表、表格、引用、解释、前言、总结、提示词复述或思考过程。",
      "10. 只使用 Mermaid 10.9.1 的 flowchart TD 或 flowchart LR。禁止 mindmap、timeline、xychart、architecture-beta、click、classDef、style、init 与实验语法。",
      "11. 每个 Mermaid 代码块必须独立完整。节点 ID 只使用 ASCII 字母和数字；可见文字放进双引号标签，例如 A1[\"核心概念\"]。标签内部避免英文双引号、反引号和花括号，只在必要时使用 <br/>。",
      "12. 输出前静默检查每个代码块的括号、引号、箭头、节点 ID 与连接关系，确保 Mermaid 10.9.1 可以解析。",
    ].join("\n"),
    userPromptTemplate: [
      "请严格按照 System Prompt，把下面的当前字幕稿转换为最终的全 Mermaid 学习图谱。",
      "",
      "<source_metadata>",
      "标题：{{title}}",
      "BV / 分集：{{bvid}}",
      "发布者：{{author}}",
      "</source_metadata>",
      "",
      "<transcript>",
      "{{subtitle}}",
      "</transcript>",
    ].join("\n"),
  });

  const DEFAULT_HTML_FOLIO_PROMPT = Object.freeze({
    id: DEFAULT_HTML_FOLIO_PROMPT_ID,
    stage: "postprocess",
    name: "HTML 阅读页",
    hint: "看懂这一期 · 少而准 · 自动渲染",
    systemPrompt: [
      "把本期字幕整理成一份「看完能懂」的阅读页。只根据字幕，不补课外知识。",
      "",
      "先问自己：读者看完这一页，应该比只听视频多明白什么？只写那个增量。",
      "按需要取舍，不要凑章节：",
      "- 这一期在解决什么问题（一句话）",
      "- 讲者的核心判断或方法，以及它凭什么成立",
      "- 关键步骤、前提、边界、反例、容易做错的地方",
      "- 字幕里真实出现过的例子、数字、命令、术语",
      "- 看完该记住的，最多 3 条",
      "删口头禅、重复和按时间线复述。不确定的词标「识别存疑」，不要猜。简体中文；术语可留原文。不要写 BV、分P、时间戳。",
      "",
      "只输出一个 ```html 代码块，里面恰好一个 <article class=\"bsb-folio\">。",
      "header：一行 kicker + 一个 h1 + 一段 lede（lede 写「看完能明白什么」，不要空套话）。",
      "每个大节一个 h2；大节里若有 2 个以上可单独跳转的要点，再用 h3 拆开，让左侧目录能分层。不要为空标题硬拆。",
      "标签够用即可：p ul ol li strong mark code pre aside table。",
      "关键结论用 <aside data-kind=\"key\">，提醒用 note，风险用 warn。步骤用 <ol class=\"steps\">。",
      "不要 style、script、完整网页、Mermaid、前言后记或思考过程。",
    ].join("\n"),
    userPromptTemplate: [
      "把下面字幕整理成阅读页。只写对理解这一期真正有用的内容。",
      "",
      "<source>",
      "{{title}} · {{bvid}} · {{author}}",
      "</source>",
      "",
      "<transcript>",
      "{{subtitle}}",
      "</transcript>",
    ].join("\n"),
  });

  const DEFAULT_KNOWLEDGE_PROMPT = Object.freeze({
    id: DEFAULT_KNOWLEDGE_PROMPT_ID,
    stage: "knowledge",
    name: "局部知识追问",
    hint: "锚点附近字幕 + 当前分支上下文 → 聚焦解释与建议追问",
    systemPrompt: [
      "你是『局部知识钻取助手』。用户正在阅读一段已经规范化的视频字幕，并从其中选中了一个知识锚点。你的任务是围绕当前锚点和当前问题进行聚焦解释，而不是重新总结整段视频。",
      "",
      "【上下文使用】",
      "1. 优先使用提供的字幕局部上下文解释讲者当前讨论的含义，并明确区分『字幕中明确表达』与『为了回答问题而补充的通用知识』。",
      "2. 允许补充可靠的通用知识，因为用户的追问可能超出字幕；但不要伪造视频中没有说过的内容，不要把补充知识冒充成讲者原话。",
      "3. 只沿当前追问分支使用祖先上下文，不引入同一锚点其他分支的讨论。",
      "4. 默认使用简体中文。模型名、API、代码、公式、命令和国际通用术语在保留原文更准确时可保留原文。",
      "",
      "【回答风格】",
      "5. 先直接回答当前问题，再解释关键机制、必要条件、边界或对比。避免百科式漫无边际扩写。",
      "6. 可使用短标题、列表、公式和必要的代码；不要输出思考过程。",
      "7. 回答末尾必须输出一个 <suggestions> 块，包含 2—4 个真正有递进价值的下一步问题，每行一个以 '- ' 开头的问题。不要在正文中解释这个块。",
      "8. 建议问题应从当前答案自然向下一层钻取，不要重复当前问题，也不要只是换一种说法。",
      "",
      "【阅读强调】",
      "9. 可以使用 ==关键短语== 标记真正值得用户记住的内容。系统会把 ==...== 渲染为视觉高亮。",
      "10. 高亮必须克制：每个自然段通常 0—2 处；优先高亮核心概念、关键结论、因果节点、关键数字、重要边界；一处高亮尽量是一个短语，而不是整段文字；禁止连续高亮多个句子；禁止为了视觉效果随意高亮普通描述。",
      "11. **...** 只表示普通加粗；==...== 表示更高一级的『核心记忆点』。",
      "12. 不要在代码、公式、Markdown 标题中使用 ==...==；不要嵌套写成 ==**文字**==。",
    ].join("\n"),
    userPromptTemplate: [
      "<source>",
      "标题：{{title}}",
      "BV / 分集：{{bvid}}",
      "发布者：{{author}}",
      "</source>",
      "",
      "<anchor>",
      "{{anchorText}}",
      "</anchor>",
      "",
      "<local_source_context>",
      "{{sourceContext}}",
      "</local_source_context>",
      "",
      "<ancestor_branch>",
      "{{ancestorPath}}",
      "</ancestor_branch>",
      "",
      "<current_question>",
      "{{question}}",
      "</current_question>",
    ].join("\n"),
  });

  /** OpenAI 兼容默认值（密钥优先存入 userscript 隔离存储） */
  const AI_DEFAULTS = {
    baseUrl: "",
    // Never ship secrets in-repo; user fills in Settings (GM/local storage only)
    apiKey: "",
    model: "openai/gpt-oss-120b",
    temperature: 0.4,
    maxTokens: 65536,
    /**
     * 必须默认 true：非流式要等整包，长请求常被扩展/代理 ~10s 空闲断开
     * 网关日志表现为 client_gone / context canceled。
     * 流式会先推 reasoning，已兼容 content+reasoning 字段。
     */
    stream: true,
  };

  const UA =
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 " +
    "(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

  function loadAutoCaptureSetting() {
    const raw = storageGet(AUTO_CAPTURE_STORE_KEY, true);
    return raw !== false && raw !== 0 && raw !== "0" && raw !== "false" && raw !== "off";
  }

  function saveAutoCaptureSetting(enabled: boolean) {
    storageSet(AUTO_CAPTURE_STORE_KEY, enabled ? "true" : "false");
  }

  /** 默认开启：当前视频字幕抓取成功后，自动执行与“开始分析”按钮相同的流程。 */
  function loadAutoAnalyzeSetting() {
    const raw = storageGet(AUTO_ANALYZE_STORE_KEY, true);
    return raw !== false && raw !== 0 && raw !== "0" && raw !== "false" && raw !== "off";
  }

  function saveAutoAnalyzeSetting(enabled: boolean) {
    storageSet(AUTO_ANALYZE_STORE_KEY, enabled ? "true" : "false");
  }

  function loadPreprocessEnabledSetting() {
    const raw = storageGet(PREPROCESS_ENABLED_STORE_KEY, true);
    return raw !== false && raw !== 0 && raw !== "0" && raw !== "false" && raw !== "off";
  }

  function savePreprocessEnabledSetting(enabled: boolean) {
    storageSet(PREPROCESS_ENABLED_STORE_KEY, enabled ? "true" : "false");
  }

  function loadBoundedNumberSetting(key: string, fallback: number, min: number, max: number, integer = true) {
    const raw = Number(storageGet(key, fallback));
    const value = Number.isFinite(raw) ? raw : fallback;
    const bounded = Math.min(max, Math.max(min, value));
    return integer ? Math.round(bounded) : bounded;
  }

  function saveBoundedNumberSetting(key: string, value: string | number, fallback: number, min: number, max: number, integer = true) {
    const raw = Number(value);
    const normalized = Number.isFinite(raw) ? Math.min(max, Math.max(min, raw)) : fallback;
    const finalValue = integer ? Math.round(normalized) : normalized;
    storageSet(key, String(finalValue));
    return finalValue;
  }

  function loadTranscriptFollowSetting() {
    const raw = storageGet(TRANSCRIPT_FOLLOW_STORE_KEY, true);
    return raw !== false && raw !== 0 && raw !== "0" && raw !== "false" && raw !== "off";
  }

  function loadPlayerSubtitleSetting() {
    const raw = storageGet(PLAYER_SUBTITLE_STORE_KEY, true);
    return raw !== false && raw !== 0 && raw !== "0" && raw !== "false" && raw !== "off";
  }

  function lruGet<T>(map: Map<string, T>, key: string): T | null {
    if (!map.has(key)) return null;
    const value = map.get(key);
    if (value === undefined) return null;
    map.delete(key);
    map.set(key, value);
    return value;
  }

  function lruSet<T>(map: Map<string, T>, key: string, value: T, max = MEMORY_CACHE_LIMIT): T {
    if (map.has(key)) map.delete(key);
    map.set(key, value);
    while (map.size > max) {
      const oldestKey = map.keys().next().value;
      if (oldestKey === undefined) break;
      map.delete(oldestKey);
    }
    return value;
  }

  const TYPE_LABEL: Record<string,string> = {
    video: "单个视频",
    selection: "视频选集",
    user: "个人主页",
    favorite: "收藏夹",
    collection: "合集",
    search: "搜索页",
    unknown: "未知页面",
  };

  /** 可手动切换的模式（auto 走识别；其余强制类型） */
  const MODE_OPTIONS = [
    "auto",
    "video",
    "selection",
    "user",
    "favorite",
    "collection",
    "search",
  ];

  // Stable content fingerprints use the canonical browser-safe core MD5.

  // ─── pure helpers (offline harness extracts // #region pure-logic) ─────
  // #region pure-logic
  /**
   * 在 marked 之前抽出数学公式，避免 `_` `^` `\` 被 Markdown 拆坏。
   * 支持：$$ $$ / \[ \] / \( \) / $ $ / ```math|latex|tex
   * 代码块内公式不抽取；纯数字 $12.5 不当作公式。
   * @returns {{ md: string, maths: Array<{tex:string, display:boolean}> }}
   */
  function prepareMarkdownMath(md: string) {
    const maths = [];
    let s = String(md || "");

    // ```math / latex / tex → 独立公式
    s = s.replace(/```(?:math|latex|tex)\s*\n([\s\S]*?)```/gi, (_, tex) => {
      const i = maths.length;
      maths.push({ tex: String(tex).trim(), display: true });
      return `\n\n@@BSBMATH${i}@@\n\n`;
    });

    // 保护其余 fenced / inline code
    const codes: string[] = [];
    s = s.replace(/```[\s\S]*?```/g, (m) => {
      const i = codes.length;
      codes.push(m);
      return `@@BSBCODE${i}@@`;
    });
    s = s.replace(/`[^`\n]+`/g, (m) => {
      const i = codes.length;
      codes.push(m);
      return `@@BSBCODE${i}@@`;
    });

    // 独立公式 $$...$$
    s = s.replace(/\$\$([\s\S]+?)\$\$/g, (_, tex) => {
      const i = maths.length;
      maths.push({ tex: String(tex).trim(), display: true });
      return `\n\n@@BSBMATH${i}@@\n\n`;
    });
    // \[...\]
    s = s.replace(/\\\[([\s\S]+?)\\\]/g, (_, tex) => {
      const i = maths.length;
      maths.push({ tex: String(tex).trim(), display: true });
      return `\n\n@@BSBMATH${i}@@\n\n`;
    });
    // \(...\)
    s = s.replace(/\\\(([\s\S]+?)\\\)/g, (_, tex) => {
      const i = maths.length;
      maths.push({ tex: String(tex).trim(), display: false });
      return `@@BSBMATH${i}@@`;
    });
    // 行内 $...$：手动扫描，避免“价格 $12.5，后文 $x^2$”跨段误配。
    // 无效起始符只消耗自身，让后一个 $ 仍可作为真正公式的起点。
    {
      const input = s;
      let out = "";
      let cursor = 0;
      const escapedAt = (idx: number) => {
        let slashes = 0;
        for (let j = idx - 1; j >= 0 && input[j] === "\\"; j--) slashes += 1;
        return slashes % 2 === 1;
      };
      while (cursor < input.length) {
        let open = input.indexOf("$", cursor);
        while (open >= 0 && escapedAt(open)) open = input.indexOf("$", open + 1);
        if (open < 0) {
          out += input.slice(cursor);
          break;
        }
        out += input.slice(cursor, open);
        let close = input.indexOf("$", open + 1);
        while (close >= 0 && escapedAt(close)) close = input.indexOf("$", close + 1);
        if (close < 0) {
          out += input.slice(open);
          break;
        }
        const raw = input.slice(open + 1, close);
        const t = raw.trim();
        const hasBoundarySpace = raw !== t;
        const pureNumber = /^[\d,]+(?:\.\d+)?$/.test(t);
        const mathSignal = /[A-Za-z\\_^{}=+*/<>|]|[α-ωΑ-Ω]/.test(t);
        const valid = !!t && !hasBoundarySpace && !pureNumber && mathSignal;
        if (!valid) {
          out += "$";
          cursor = open + 1;
          continue;
        }
        const i = maths.length;
        maths.push({ tex: t, display: false });
        out += `@@BSBMATH${i}@@`;
        cursor = close + 1;
      }
      s = out;
    }

    s = s.replace(/@@BSBCODE(\d+)@@/g, (_, id) => {
      const i = Number(id);
      return codes[i] != null ? codes[i] : "";
    });

    return { md: s, maths };
  }

  /**
   * 把 @@BSBMATHn@@ 换成 KaTeX HTML（或 fallback）。
   * renderToString(tex, display) 可选；失败则转义原文。
   */
  function replaceMathPlaceholders(html: string, maths: readonly {tex:string;display:boolean}[], renderToString:(tex:string,display:boolean)=>string|null) {
    return String(html || "").replace(/@@BSBMATH(\d+)@@/g, (full, id) => {
      const m = maths[Number(id)];
      if (!m) return full;
      if (typeof renderToString === "function") {
        try {
          const out = renderToString(m.tex, !!m.display);
          if (out != null && out !== "") return out;
        } catch  {
          /* fall through */
        }
      }
      const esc = String(m.tex)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;");
      return m.display
        ? `<pre class="bsb-math-fallback">${esc}</pre>`
        : `<code class="bsb-math-fallback">${esc}</code>`;
    });
  }

  // #endregion pure-logic

  // ─── HTTP ───────────────────────────────────────────────────────────────
  function httpJson(url: string, extraHeaders: Record<string,string> = {}): Promise<unknown> {
    return new Promise((resolve, reject) => {
      if (typeof GM_xmlhttpRequest !== "function") {
        reject(new Error("缺少 GM_xmlhttpRequest 跨域能力")); return;
      }
      GM_xmlhttpRequest({
        method: "GET",
        url,
        anonymous: false,
        timeout: 30000,
        headers: Object.assign(
          {
            Accept: "application/json, text/plain, */*",
            Referer: "https://www.bilibili.com/",
            Origin: "https://www.bilibili.com",
            "User-Agent": UA,
          },
          extraHeaders || {},
        ),
        onload(res) {
          if (res.status < 200 || res.status >= 300) {
            reject(
              new Error(
                `HTTP ${res.status} for ${url}: ${(res.responseText || "").slice(0, 200)}`,
              ),
            );
            return;
          }
          try {
            resolve(JSON.parse(res.responseText));
          } catch  {
            reject(
              new Error(
                `invalid JSON from ${url}: ${(res.responseText || "").slice(0, 200)}`,
              ),
            );
          }
        },
        onerror() {
          reject(new Error(`network error for ${url}`));
        },
        ontimeout() {
          reject(new Error(`timeout for ${url}`));
        },
      });
    });
  }

  /**
   * 当前视频快速链路：页面 fetch 优先，避免每次请求跨 userscript bridge。
   * CORS、登录态或 CSP 不允许时再回退 GM_xmlhttpRequest。
   */

  // ─── util ───────────────────────────────────────────────────────────────
  function extractBvid(text: string) {
    try {
      const pure =
        typeof SubBatch !== "undefined"
          ? SubBatch?.SubBatchMonorepo?.bilibili?.extractBvid
          : null;
      if (typeof pure === "function") return pure(text);
    } catch  {
      /* monorepo unavailable — local fallback */
    }
    if (!text) return "";
    text = String(text).trim();
    if (!text) return "";
    if (/^BV(?!id$)[A-Za-z0-9]+$/i.test(text)) return "BV" + text.slice(2);
    const m = text.match(/BV(?!id\b)[A-Za-z0-9]+/i);
    return m ? "BV" + m[0].slice(2) : "";
  }

  function resolveCid(view: BilibiliVideoView, page = 1) {
    const pages = view.pages || [];
    if (Array.isArray(pages) && pages.length && page >= 1 && page <= pages.length) {
      const cid = pages[page - 1]?.cid;
      return cid != null ? Number(cid) : null;
    }
    if (view.cid == null) return null;
    const n = Number(view.cid);
    return Number.isFinite(n) ? n : null;
  }

  function dedupeCues(cues: SubtitleCue[]): SubtitleCue[] {
    const out: Array<{ cue: SubtitleCue; normalized: string }> = [];
    for (const cue of cues || []) {
      const content = String(cue?.content || "").replace(/\s+/g, " ").trim();
      if (!content) continue;
      const normalized = content.toLocaleLowerCase();
      const previous = out[out.length - 1];
      if (previous && previous.normalized === normalized) {
        const previousTo = Number(previous.cue.to_sec ?? coreCall("parseSeconds", previous.cue.to));
        const currentFrom = Number(cue.from_sec ?? coreCall("parseSeconds", cue.from));
        if (currentFrom - previousTo <= 1.25) {
          const nextTo = Math.max(
            previousTo,
            Number(cue.to_sec ?? coreCall("parseSeconds", cue.to)),
          );
          previous.cue.to_sec = nextTo;
          previous.cue.to = `${nextTo.toFixed(2)}s`;
          continue;
        }
      }
      out.push({ cue: { ...cue, content }, normalized });
    }
    return out.map(entry => entry.cue);
  }

  function stripHtml(s: string|undefined) {
    return String(s || "")
      .replace(/<[^>]+>/g, "")
      .replace(/&nbsp;/g, " ")
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/\s+/g, " ")
      .trim();
  }

  /**
   * ─── Subtitle export / library groups (architecture v6.5) ───────────────
   * Single source of truth: packages/core (SubBatch.SubBatchMonorepo.core).
   * This file only does IO (GM_download / storage / DOM) and thin bridges.
   * Do NOT re-implement path/index/group rules here — edit pure core instead.
   */
  function subbatchCore() {
    try {
      return typeof SubBatch !== "undefined" ? SubBatch?.SubBatchMonorepo?.core || null : null;
    } catch  {
      return null;
    }
  }

  function coreFn<K extends CoreMethod>(name: K): CoreApi[K] | null {
    const api = subbatchCore();
    const fn = api && api[name];
    return typeof fn === "function" ? fn : null;
  }

  // The bundled provider is the only Bilibili implementation.
  // Every used capability is a statically checked function reference.
  const bili = SubBatch.SubBatchMonorepo.bilibili;
  const BILI_FUNCTIONS = {
    "video.isChargeBlocked": bili.video.isChargeBlocked,
    "video.runtimeView": bili.video.runtimeView,
    "video.pageMeta": bili.video.pageMeta,
    "subtitle.preferredIndex": bili.subtitle.preferredIndex,
    "subtitle.runtimeTracks": bili.subtitle.runtimeTracks,
    "subtitle.normalizeUrl": bili.subtitle.normalizeUrl,
    "subtitle.pickTrack": bili.subtitle.pickTrack,
    "extractPlayingVideoHint": bili.extractPlayingVideoHint,
    "resolvePlayingVideoRef": bili.resolvePlayingVideoRef,
    "playingVideoChanged": bili.playingVideoChanged,
  } as const;
  type BiliMethod = keyof typeof BILI_FUNCTIONS;

  function bilibiliFn<P extends BiliMethod>(path: P): (typeof BILI_FUNCTIONS)[P] {
    return BILI_FUNCTIONS[path];
  }

  function bilibiliCall<P extends BiliMethod>(
    path: P, ...args: Parameters<(typeof BILI_FUNCTIONS)[P]>
  ): ReturnType<(typeof BILI_FUNCTIONS)[P]> {
    return Reflect.apply(bilibiliFn(path), undefined, args) as ReturnType<(typeof BILI_FUNCTIONS)[P]>;
  }

  function appFn(path: string) {
    return resolveAppMethod(SubBatch?.SubBatchMonorepo?.app, path);
  }

  function appCall<P extends AppMethodPath>(path: P, ...args: AppMethodArgs<P>): AppMethodResult<P> {
    return callApp(SubBatch?.SubBatchMonorepo?.app, path, ...args);
  }

  function runtimeNetwork() {
    const network = SubBatch.SubBatchMonorepo.runtime.network;
    if (!network) throw new Error("[bili-subbatch] missing network adapter");
    return network;
  }

  function coreCall<K extends CoreMethod>(
    name: K, ...args: Parameters<CoreApi[K]>
  ): ReturnType<CoreApi[K]> {
    const fn = coreFn(name);
    if (!fn) throw new Error("[bili-subbatch] monorepo core API missing: " + name);
    return Reflect.apply(fn, undefined, args) as ReturnType<CoreApi[K]>;
  }

  function safeFilename(name: string) {
    return coreCall("safePathSegment", name, 120);
  }

  function buildCollectionShortUrl(mid: string, seasonId: string) {
    return coreCall("buildCollectionShortUrl", mid, seasonId);
  }

  function buildSubtitleExportRelativePath(item: Parameters<CoreApi["buildSubtitleExportRelativePath"]>[0], ext: Parameters<CoreApi["buildSubtitleExportRelativePath"]>[1]) {
    return coreCall("buildSubtitleExportRelativePath", item, ext);
  }

  function buildSubtitleExportIndexPath() {
    const fn = coreFn("buildSubtitleExportIndexPath");
    if (fn) return fn();
    return `${SUBTITLE_EXPORT_ROOT}/${SUBTITLE_EXPORT_INDEX_NAME}`;
  }

  function loadExportIndexMap() {
    try {
      const raw = storageGet(SUBTITLE_EXPORT_INDEX_STORE_KEY, "");
      if (!raw) return {};
      const parsed = typeof raw === "string" ? JSON.parse(raw) : raw;
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
      return parsed;
    } catch  {
      return {};
    }
  }

  function saveExportIndexMap(map: Record<string,unknown>) {
    try {
      storageSet(SUBTITLE_EXPORT_INDEX_STORE_KEY, JSON.stringify(map || {}));
    } catch  { /* ignore quota */ }
    return map || {};
  }

  function upsertIndexForExportItem(map: Parameters<CoreApi["upsertIndexForExportItem"]>[0], item: Parameters<CoreApi["upsertIndexForExportItem"]>[1]) {
    return coreCall("upsertIndexForExportItem", map, item);
  }

  function renderExportIndexMd(map: Parameters<CoreApi["renderExportIndexMd"]>[0]) {
    return coreCall("renderExportIndexMd", map);
  }

  function attachSelectionGroupMeta<T extends LibraryGroupItem>(items: T[], meta: Parameters<CoreApi["attachSelectionGroupMeta"]>[1] = {}) {
    return SubBatch.SubBatchMonorepo.core.attachSelectionGroupMeta(items, meta);
  }

  function attachCollectionGroupMeta<T extends LibraryGroupItem>(items: T[], meta: Parameters<CoreApi["attachCollectionGroupMeta"]>[1] = {}, ctx: Parameters<CoreApi["attachCollectionGroupMeta"]>[2] = {}) {
    return SubBatch.SubBatchMonorepo.core.attachCollectionGroupMeta(items, meta, { mid: ctx.mid || "", season_id: ctx.season_id || "", collectionTitleHint: ctx.collectionTitleHint || "", authorHint: ctx.authorHint || "", parentFolder: "" });
  }

  function attachUserSpaceGroupMeta<T extends LibraryGroupItem>(items: T[], meta: Parameters<CoreApi["attachUserSpaceGroupMeta"]>[1] = {}) {
    return SubBatch.SubBatchMonorepo.core.attachUserSpaceGroupMeta(items, meta);
  }

  function applySpaceCollectionMembership<T extends LibraryGroupItem>(items: T[], collections: Parameters<CoreApi["applySpaceCollectionMembership"]>[1]) {
    return SubBatch.SubBatchMonorepo.core.applySpaceCollectionMembership(items, collections);
  }

  function countSpaceCollectionMatches(items: Parameters<CoreApi["countSpaceCollectionMatches"]>[0], collections: Parameters<CoreApi["countSpaceCollectionMatches"]>[1]) {
    return coreCall("countSpaceCollectionMatches", items, collections);
  }

  function attachSpaceLooseVideosMeta<T extends LibraryGroupItem>(items: T[]) {
    return SubBatch.SubBatchMonorepo.core.attachSpaceLooseVideosMeta(items);
  }

  function setGroupSelection(items: Parameters<CoreApi["setGroupSelection"]>[0], groupKey: Parameters<CoreApi["setGroupSelection"]>[1], selected: Parameters<CoreApi["setGroupSelection"]>[2]) {
    return coreCall("setGroupSelection", items, groupKey, selected);
  }

  function normalizeExportItem(item: Parameters<CoreApi["normalizeExportItem"]>[0], peers: Parameters<CoreApi["normalizeExportItem"]>[1] = []) {
    const combined = [...(peers || []), ...(state.items || [])];
    return coreCall("normalizeExportItem", item, combined);
  }

  function resolveLibraryGroupKey(item: Parameters<CoreApi["resolveLibraryGroupKey"]>[0]) {
    return coreCall("resolveLibraryGroupKey", item);
  }

  function buildLibraryRenderNodes(entries: Parameters<CoreApi["buildLibraryRenderNodes"]>[0], collapsedMap: Parameters<CoreApi["buildLibraryRenderNodes"]>[1]) {
    return coreCall("buildLibraryRenderNodes", entries, collapsedMap || {});
  }

  function applyUgcSeasonToItems<T extends LibraryGroupItem>(items: T[], view: Parameters<CoreApi["applyUgcSeasonToItems"]>[1]) {
    return SubBatch.SubBatchMonorepo.core.applyUgcSeasonToItems(items, view);
  }

  function buildGroupMetaPatches(normalized: Parameters<CoreApi["buildGroupMetaPatches"]>[0]) {
    return coreCall("buildGroupMetaPatches", normalized);
  }

  function applyGroupMetaPatchToItems<T extends LibraryGroupItem>(
    items: T[], patch: Parameters<CoreApi["applyGroupMetaPatchToItems"]>[1],
  ): T[] {
    return SubBatch.SubBatchMonorepo.core.applyGroupMetaPatchToItems(items, patch);
  }

  function mergeGroupFields<T extends LibraryGroupItem>(target: T, source: Parameters<CoreApi["mergeGroupFields"]>[1]) {
    return SubBatch.SubBatchMonorepo.core.mergeGroupFields(target, source);
  }

  function suggestCaptureMode(item: Parameters<CoreApi["suggestCaptureMode"]>[0]) {
    return coreCall("suggestCaptureMode", item);
  }

  /**
   * 自动抓取后联动采集模式下拉：多分P → 视频选集，ugc 合集 → 合集。
   * 不覆盖用户显式选择的 单个视频 / 个人主页 / 收藏夹 / 搜索。
   */
  function syncCaptureModeFromItem(item: WorkbenchLibraryItem|null, { silent = true } = {}) {
    const locked = new Set(["video", "user", "favorite", "search"]);
    if (locked.has(state.mode)) return state.mode;

    let next = "auto";
    try {
      next = suggestCaptureMode(item) || "auto";
    } catch  {
      const pageCount = Array.isArray(item?.pages) ? item.pages.length : 0;
      if (item?.groupType === "collection" || item?.collectionSid) next = "collection";
      else if (item?.groupType === "selection" || pageCount > 1) next = "selection";
    }

    // 单集普通视频：若仍停在 选集/合集，收回 auto，避免扫错范围。
    if (next === "auto" && state.mode !== "selection" && state.mode !== "collection") {
      return state.mode;
    }
    if (next === state.mode) return state.mode;

    state.mode = next;
    const root = document.getElementById(PANEL_ID);
    const modeSel = root?.querySelector<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>('[data-role="mode"]');
    if (modeSel) modeSel.value = next;
    try {
      refreshContextUI();
    } catch  { /* panel may not exist yet */ }
    if (!silent) {
      setStatus(`采集模式已自动切换为「${TYPE_LABEL[next] || next}」`, "ok");
    }
    return next;
  }

  /** IO only — blob download with optional overwrite (GM_download). */
  function downloadText(filename: string, text: BlobPart, { overwrite = false } = {}) {
    const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const name = String(filename || "download.txt").replace(/\\/g, "/").replace(/\/{2,}/g, "/");

    const revokeLater = () => {
      setTimeout(() => {
        try { URL.revokeObjectURL(url); } catch  { /* noop */ }
      }, 60_000);
    };

    const anchorFallback = () => {
      const a = document.createElement("a");
      a.href = url;
      a.download = name;
      a.style.display = "none";
      document.body.appendChild(a);
      a.click();
      setTimeout(() => {
        try { URL.revokeObjectURL(url); } catch  { /* noop */ }
        a.remove();
      }, 1500);
    };

    if (typeof GM_download === "function") {
      try {
        const opts: Parameters<NonNullable<typeof GM_download>>[0] = {
          url,
          name,
          saveAs: false,
          onload: revokeLater,
          onerror: anchorFallback,
          ontimeout: anchorFallback,
        };
        if (overwrite) opts.conflictAction = "overwrite";
        GM_download(opts);
        return;
      } catch  {
        /* fall through */
      }
    }
    anchorFallback();
  }

  /**
   * Batch-export: pure core builds paths + index; this function only downloads.
   * Group-meta patches returned by pure are applied to state (no inline rule logic).
   */
  async function downloadSubtitleExportBatch(pool: WorkbenchLibraryItem[], ext: string,
    convert: (data: SubtitleCue[]) => string) {
    let indexMap = loadExportIndexMap();
    const peerPool = [...pool, ...(state.items || [])];
    let nextItems = state.items;
    for (let i = 0; i < pool.length; i++) {
      const it = normalizeExportItem(pool[i], peerPool);
      const patch = buildGroupMetaPatches(it);
      if (patch) nextItems = applyGroupMetaPatchToItems(nextItems, patch);
      indexMap = upsertIndexForExportItem(indexMap, it);
      const sourceCues = pool[i]?.data;
      downloadText(buildSubtitleExportRelativePath(it, ext),
        convert(Array.isArray(sourceCues) ? sourceCues : []), { overwrite: true });
      if (pool.length > 1) await sleep(220);
    }
    state.items = nextItems;
    saveExportIndexMap(indexMap);
    const indexMd = renderExportIndexMd(indexMap);
    if (indexMd) {
      await sleep(pool.length ? 260 : 0);
      downloadText(buildSubtitleExportIndexPath(), indexMd, { overwrite: true });
    }
    renderList({ renderTranscript: false });
    return { count: pool.length, indexEntries: Object.keys(indexMap).length };
  }

  function sleep(ms: number|undefined) {
    return new Promise((r) => setTimeout(r, ms));
  }

  // ─── page context detection ─────────────────────────────────────────────
  /**
   * 自动识别。约定：
   * - 视频页默认 type=video（单个视频），不因多分P自动变 selection
   * - /list + sid → collection；/list/ml → favorite
   * - 合集列表页（space lists / collectiondetail）→ collection
   * - 返回字段可被「手动模式」复用（mid/sid/bvid…）
   */
  function detectContext(href: string): ScanContext {
    const yt = SubBatch.SubBatchMonorepo.youtube.extractVideoRef(href);
    if (yt) return { type: "video", bvid: yt.videoId, page: 1, source: "youtube" };
    try {
      const pure =
        typeof SubBatch !== "undefined"
          ? SubBatch?.SubBatchMonorepo?.bilibili?.detectContext
          : null;
      if (typeof pure === "function") {
        try {
          const url = new URL(href || location.href);
          // DOM half stays local (extractPageHints); pure core owns URL routing.
          return pure(href || location.href, extractPageHints(url));
        } catch  {
          return pure(String(href || ""), {});
        }
      }
    } catch  {
      /* monorepo unavailable — local fallback */
    }
    let u;
    try {
      u = new URL(href || location.href);
    } catch  {
      return { type: "unknown", source: "auto" };
    }
    const host = u.hostname.toLowerCase();
    const path = u.pathname;
    const hints = extractPageHints(u);

    // search
    if (/^search\.bilibili\.com$/i.test(host)) {
      if (/^\/(all|video)\/?$/i.test(path)) {
        const keyword =
          (u.searchParams.get("keyword") || "").trim() || hints.keyword;
        if (keyword) {
          const allowed = new Set([
            "totalrank",
            "click",
            "pubdate",
            "dm",
            "stow",
            "scores",
          ]);
          const order = (u.searchParams.get("order") || "totalrank")
            .trim()
            .toLowerCase();
          const page = Math.max(
            1,
            parseInt(u.searchParams.get("page") || "1", 10) || 1,
          );
          return {
            type: "search",
            source: "auto",
            keyword,
            order: allowed.has(order) ? order : "totalrank",
            page,
          };
        }
      }
      return { type: "unknown", source: "auto" };
    }

    // space
    if (/^space\.bilibili\.com$/i.test(host)) {
      let m = path.match(/^\/(\d+)\/lists\/(\d+)\/?$/i);
      if (m) {
        return {
          type: "collection",
          source: "auto",
          mid: m[1],
          season_id: m[2],
        };
      }
      m = path.match(/^\/(\d+)\/channel\/collectiondetail\/?$/i);
      if (m) {
        const sid =
          u.searchParams.get("sid") ||
          u.searchParams.get("season_id") ||
          hints.season_id;
        if (sid && /^\d+$/.test(sid)) {
          return {
            type: "collection",
            source: "auto",
            mid: m[1],
            season_id: String(sid),
          };
        }
      }
      // series / seasons 列表入口
      m = path.match(/^\/(\d+)\/channel\/seriesdetail\/?$/i);
      if (m) {
        const sid =
          u.searchParams.get("sid") ||
          u.searchParams.get("season_id") ||
          hints.season_id;
        if (sid && /^\d+$/.test(sid)) {
          return {
            type: "collection",
            source: "auto",
            mid: m[1],
            season_id: String(sid),
          };
        }
      }
      const fid = (u.searchParams.get("fid") || hints.media_id || "").trim();
      if (fid && /^\d+$/.test(fid) && /\/favlist\/?$/i.test(path)) {
        return { type: "favorite", source: "auto", media_id: fid };
      }
      m = path.match(/^\/(\d+)/);
      if (m) {
        const segs = path.split("/").filter(Boolean);
        const mid = m[1];
        if (
          segs.length === 1 ||
          (segs.length === 2 && /^(video|upload|dynamic|favlist)?$/i.test(segs[1] || "")) ||
          (segs.length === 3 && segs[1] === "upload" && segs[2] === "video")
        ) {
          // favlist without fid still unknown for fav; treat as user
          if (segs[1] && /^favlist$/i.test(segs[1]) && !fid) {
            return { type: "user", source: "auto", mid, note: "favlist_no_fid" };
          }
          return { type: "user", source: "auto", mid };
        }
        // other space tabs: still expose mid for manual switch
        return {
          type: "user",
          source: "auto",
          mid,
          note: "space_tab",
          bvid: hints.bvid || undefined,
        };
      }
      return { type: "unknown", source: "auto", ...pickHintIds(hints) };
    }

    // www.bilibili.com
    if (/^(www\.)?bilibili\.com$/i.test(host)) {
      let m = path.match(/^\/medialist\/(?:detail|play)\/ml(\d+)\/?$/i);
      if (m) return { type: "favorite", source: "auto", media_id: m[1] };

      // /list/ml{id} 收藏夹播放/详情
      m = path.match(/^\/list\/ml(\d+)\/?/i);
      if (m) return { type: "favorite", source: "auto", media_id: m[1] };

      // /list/{mid}?sid= 合集播放页（常见误判为单视频）
      m = path.match(/^\/list\/(\d+)\/?/i);
      if (m) {
        const mid = m[1];
        const sid =
          u.searchParams.get("sid") ||
          u.searchParams.get("season_id") ||
          hints.season_id;
        const bvid =
          extractBvid(href) ||
          extractBvid(u.searchParams.get("bvid") || "") ||
          hints.bvid;
        if (sid && /^\d+$/.test(String(sid))) {
          return {
            type: "collection",
            source: "auto",
            mid,
            season_id: String(sid),
            bvid: bvid || undefined,
            page: Math.max(1, parseInt(u.searchParams.get("p") || "1", 10) || 1),
          };
        }
        // 无 sid 时：若有 BV 默认单视频，但带 mid 便于手动切合集
        if (bvid) {
          return {
            type: "video",
            source: "auto",
            bvid,
            mid,
            page: Math.max(1, parseInt(u.searchParams.get("p") || "1", 10) || 1),
            note: "list_without_sid",
          };
        }
        return { type: "user", source: "auto", mid, note: "list_mid_only" };
      }

      m = path.match(/^\/(?:fav|list)\/(?:ml)?(\d+)\/?$/i);
      if (m && !path.startsWith("/list/")) {
        return { type: "favorite", source: "auto", media_id: m[1] };
      }
      if (/^\/favlist\/?$/i.test(path)) {
        const fid = (u.searchParams.get("fid") || hints.media_id || "").trim();
        if (fid && /^\d+$/.test(fid)) {
          return { type: "favorite", source: "auto", media_id: fid };
        }
      }

      // 普通视频页：默认「单个视频」（不自动变选集）
      const bvid =
        extractBvid(path) || extractBvid(href) || hints.bvid;
      if (bvid && (/\/video\//i.test(path) || hints.fromVideoPath)) {
        const p = Math.max(1, parseInt(u.searchParams.get("p") || "1", 10) || 1);
        const ctx: ScanContext = {
          type: "video",
          source: "auto",
          bvid,
          page: p,
        };
        // 若页内能挖到合集信息，挂上供手动切换
        if (hints.mid && hints.season_id) {
          ctx.mid = hints.mid;
          ctx.season_id = hints.season_id;
          ctx.note = "video_has_ugc_season";
        }
        return ctx;
      }

      // 其它 list 形态
      if (/\/list\//i.test(path)) {
        const bvid2 =
          extractBvid(href) ||
          extractBvid(u.searchParams.get("bvid") || "") ||
          hints.bvid;
        if (bvid2) {
          return {
            type: "video",
            source: "auto",
            bvid: bvid2,
            page: Math.max(1, parseInt(u.searchParams.get("p") || "1", 10) || 1),
            mid: hints.mid || undefined,
            season_id: hints.season_id || undefined,
            note: "list_fallback_video",
          };
        }
      }
    }

    // DOM 兜底
    if (hints.bvid) {
      return {
        type: "video",
        source: "auto",
        bvid: hints.bvid,
        page: 1,
        mid: hints.mid || undefined,
        season_id: hints.season_id || undefined,
        note: "dom_bvid",
      };
    }
    return { type: "unknown", source: "auto", ...pickHintIds(hints) };
  }

  function pickHintIds(hints: Partial<ScanContext>): Partial<ScanContext> {
    const o: Partial<ScanContext> = {};
    if (hints.mid) o.mid = hints.mid;
    if (hints.season_id) o.season_id = hints.season_id;
    if (hints.media_id) o.media_id = hints.media_id;
    if (hints.bvid) o.bvid = hints.bvid;
    if (hints.keyword) o.keyword = hints.keyword;
    return o;
  }

  /** 从 URL / 页面链接尽量挖 mid、season_id、media_id、bvid */
  function extractPageHints(u?: URL) {
    const hints = {
      bvid: "",
      mid: "",
      season_id: "",
      media_id: "",
      keyword: "",
      fromVideoPath: false,
    };
    try {
      if (!u) u = new URL(location.href);
    } catch  {
      return hints;
    }
    hints.bvid =
      extractBvid(u.searchParams.get("bvid") || "") ||
      extractBvid(u.pathname) ||
      "";
    hints.keyword = (u.searchParams.get("keyword") || "").trim();
    const sid =
      u.searchParams.get("sid") ||
      u.searchParams.get("season_id") ||
      u.searchParams.get("business_id") ||
      "";
    if (sid && /^\d+$/.test(String(sid))) hints.season_id = String(sid);
    const fid = u.searchParams.get("fid") || "";
    if (fid && /^\d+$/.test(fid)) hints.media_id = fid;
    if (/\/video\//i.test(u.pathname)) hints.fromVideoPath = true;

    // path mid
    let m = u.pathname.match(/space\.bilibili\.com\/(\d+)/i);
    if (!m) m = String(location.href).match(/space\.bilibili\.com\/(\d+)/i);
    if (m?.[1]) hints.mid = m[1];
    m = u.pathname.match(/^\/list\/(\d+)/i);
    if (m?.[1]) hints.mid = m[1];
    m = u.pathname.match(/^\/(\d+)(?:\/|$)/);
    if (m?.[1] && /space\.bilibili\.com/i.test(u.hostname)) hints.mid = m[1];

    // DOM: 合集 / 列表链接
    try {
      const anchors = document.querySelectorAll<HTMLAnchorElement>(
        'a[href*="lists/"], a[href*="collectiondetail"], a[href*="season_id"], a[href*="sid="], a[href*="/list/"]',
      );
      for (const a of anchors) {
        const href = a.getAttribute("href") || a.href || "";
        const lm = href.match(/\/(\d+)\/lists\/(\d+)/);
        if (lm?.[1] && lm[2]) {
          if (!hints.mid) hints.mid = lm[1];
          if (!hints.season_id) hints.season_id = lm[2];
          break;
        }
        try {
          const au = new URL(href, location.origin);
          const sm =
            au.searchParams.get("sid") || au.searchParams.get("season_id");
          if (sm && /^\d+$/.test(sm)) {
            if (!hints.season_id) hints.season_id = sm;
            const mm = au.pathname.match(/\/(\d+)/);
            if (mm?.[1] && !hints.mid) hints.mid = mm[1];
          }
          const listMid = au.pathname.match(/\/list\/(\d+)/i);
          if (listMid?.[1] && !hints.mid) hints.mid = listMid[1];
        } catch  {
          /* ignore */
        }
      }
      if (!hints.bvid) {
        const b = extractBvid(
          document.querySelector<HTMLMetaElement>('meta[itemprop="url"]')?.content || "",
        );
        if (b) hints.bvid = b;
      }
      if (!hints.bvid) {
        const og = document.querySelector<HTMLMetaElement>('meta[property="og:url"]')?.content;
        if (og) hints.bvid = extractBvid(og);
      }
    } catch  {
      /* ignore */
    }
    if (!hints.bvid) {
      const extractPlaying = bilibiliFn("extractPlayingVideoHint");
      const playing = typeof extractPlaying === "function" ? extractPlaying(pageWindow) : null;
      const playingBvid = extractBvid(playing?.bvid || "");
      if (playingBvid) hints.bvid = playingBvid;
    }
    return hints;
  }

  /**
   * 根据模式选择器 + 自动识别 得到最终扫描上下文。
   * mode=auto → 用 autoCtx；manual → 强制 type，参数从 auto/hints 填。
   */
  function resolveContext() {
    const root = document.getElementById(PANEL_ID);
    const modeSel = root?.querySelector<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>('[data-role="mode"]');
    const mode = (modeSel?.value || state.mode || "auto").trim();
    state.mode = MODE_OPTIONS.includes(mode) ? mode : "auto";

    const auto = detectContext(location.href);
    state.autoCtx = auto;

    if (state.mode === "auto") {
      return { ...auto, source: "auto" };
    }

    const type = state.mode;
    const hints = extractPageHints();
    const base = { ...auto, ...pickHintIds(hints), type, source: "manual" };

    if (type === "video" || type === "selection") {
      base.bvid =
        auto.bvid ||
        hints.bvid ||
        extractBvid(location.href) ||
        "";
      base.page =
        auto.page ||
        Math.max(
          1,
          parseInt(new URL(location.href).searchParams.get("p") || "1", 10) || 1,
        );
    }
    if (type === "user") {
      base.mid = auto.mid || hints.mid || "";
    }
    if (type === "collection") {
      base.mid = auto.mid || hints.mid || "";
      base.season_id = auto.season_id || hints.season_id || "";
    }
    if (type === "favorite") {
      base.media_id = auto.media_id || hints.media_id || "";
    }
    if (type === "search") {
      base.keyword = auto.keyword || hints.keyword || "";
      base.order = auto.order || "totalrank";
      base.page = auto.page || 1;
    }
    return base;
  }

  function formatCtxBits(ctx: ScanContext) {
    const bits = [];
    if (ctx.bvid) bits.push(ctx.bvid);
    if (ctx.mid) bits.push(`mid=${ctx.mid}`);
    if (ctx.season_id) bits.push(`season=${ctx.season_id}`);
    if (ctx.media_id) bits.push(`fid=${ctx.media_id}`);
    if (ctx.keyword) bits.push(`「${ctx.keyword}」`);
    if (ctx.order && ctx.type === "search") bits.push(`order=${ctx.order}`);
    if (ctx.page && (ctx.type === "video" || ctx.type === "selection")) {
      bits.push(`p=${ctx.page}`);
    }
    if (ctx.note === "video_has_ugc_season") bits.push("页内含合集信息");
    if (ctx.note === "list_without_sid") bits.push("list页无sid");
    return bits.join(" · ") || location.href.slice(0, 80);
  }

  // ─── subtitle fetch (client.py) ─────────────────────────────────────────
  function currentPageNumber() {
    try {
      return Math.max(1, parseInt(new URL(location.href).searchParams.get("p") || "1", 10) || 1);
    } catch  {
      return 1;
    }
  }

  function routeVideoKey(bvid: string|undefined, page: number) {
    if (isYoutubePage()) return "youtube/" + String(bvid || "") + "/main";
    try {
      const pure =
        typeof SubBatch !== "undefined"
          ? SubBatch?.SubBatchMonorepo?.bilibili?.routeVideoKey
          : null;
      if (typeof pure === "function") return pure(bvid, page);
    } catch  {
      /* monorepo unavailable — local fallback */
    }
    return `${String(bvid || "").toUpperCase()}:P${Math.max(1, Number(page) || 1)}`;
  }

  /**
   * 当前播放器视频身份。不要依赖 ctx.type === "video"：B 站合集 /list、收藏夹播放等
   * 页面同样可能承载一个真实的 BV。AI 自动链路只认 BV+P 这个身份键。
   * 连播时 URL / __INITIAL_STATE__ 会落后于 player，优先走 monorepo 播放器身份。
   */
  function isYoutubePage() {
    return SubBatch.SubBatchMonorepo.youtube.matchesYoutubeUrl(location.href);
  }

  function currentRouteVideoRef() {
    if (isYoutubePage()) {
      const resolved = appCall("content.resolve", location.href, pageWindow);
      if (!resolved || resolved.ref.source !== "youtube") return null;
      const bvid = resolved.ref.sourceId;
      return { bvid, page: 1, key: routeVideoKey(bvid, 1), ctx: detectContext(location.href) };
    }
    const resolved = appCall("video.resolve", location.href, pageWindow);
    if (resolved) return resolved;
    const ctx = detectContext(location.href);
    const resolvePlaying = bilibiliFn("resolvePlayingVideoRef");
    const extractPlaying = bilibiliFn("extractPlayingVideoHint");
    const playing = typeof extractPlaying === "function" ? extractPlaying(pageWindow) : null;
    if (typeof resolvePlaying === "function") {
      const ref = resolvePlaying({
        href: location.href,
        urlBvid: ctx?.bvid || extractBvid(location.href),
        urlPage: ctx?.page || currentPageNumber(),
        playing,
      });
      if (ref) return { ...ref, ctx };
    }
    const bvid = String(ctx?.bvid || extractBvid(location.href) || "").trim();
    if (!bvid) return null;
    const page = Math.max(1, Number(ctx?.page || currentPageNumber()) || 1);
    return { bvid, page, key: routeVideoKey(bvid, page), ctx };
  }

  function currentRouteVideoKey() {
    return currentRouteVideoRef()?.key || "";
  }

  const persistentCache = createPersistentCache({
    databaseName: CACHE_DB_NAME,
    databaseVersion: CACHE_DB_VERSION,
    storeName: CACHE_STORE_NAME,
    channelName: CACHE_CHANNEL_NAME,
    indexedDb: () => globalThis.indexedDB,
    broadcastChannel: () => globalThis.BroadcastChannel,
    onSubtitleChanged: (key) => state.fastSubtitleCache.delete(key),
  });

  async function fetchVideoViewFast(bvid: string, signal?: AbortSignal, { forceNetwork = false } = {}) {
    const key = String(bvid || "").toUpperCase();

    if (!forceNetwork) {
      const runtime = bilibiliCall("video.runtimeView", pageWindow, key);
      if (runtime) {
        lruSet(state.fastViewCache, key, runtime);
        writeSessionCache(() => sessionStorage, CACHE_SESSION_PREFIX, "view", key, runtime);
        return { value: runtime, cacheLevel: "L0 页面态" };
      }
      const memory = lruGet(state.fastViewCache, key);
      if (memory) return { value: memory, cacheLevel: "L1 内存" };
      const session = readSessionCache<BilibiliVideoView>(() => sessionStorage, CACHE_SESSION_PREFIX, "view", key, VIEW_CACHE_TTL_MS);
      if (session) {
        lruSet(state.fastViewCache, key, session);
        return { value: session, cacheLevel: "L2 会话" };
      }
    }

    const value = await appCall(
      "acquisition.fetchVideoView",
      runtimeNetwork(),
      bvid,
      signal,
    );
    lruSet(state.fastViewCache, key, value);
    writeSessionCache(() => sessionStorage, CACHE_SESSION_PREFIX, "view", key, value);
    return { value, cacheLevel: "NET 视频详情" };
  }

  async function fetchSubtitleTracksFast(meta: SubtitleMeta, signal: AbortSignal|undefined, { forceNetwork = false } = {}): Promise<{tracks:SubtitleTrack[];cacheLevel:string}> {
    const cacheKey = `${meta.bvid}:${meta.cid}`;
    if (!forceNetwork) {
      const runtime = bilibiliCall("subtitle.runtimeTracks", pageWindow, meta);
      if (runtime) {
        lruSet(state.fastTrackCache, cacheKey, runtime);
        writeSessionCache(() => sessionStorage, CACHE_SESSION_PREFIX, "tracks", cacheKey, runtime);
        return { tracks: runtime, cacheLevel: "L0 播放器态" };
      }
      const memory = lruGet(state.fastTrackCache, cacheKey);
      if (memory) return { tracks: memory, cacheLevel: "L1 内存" };
      const session = readSessionCache<SubtitleTrack[]>(() => sessionStorage, CACHE_SESSION_PREFIX, "tracks", cacheKey, TRACK_CACHE_TTL_MS);
      if (session) {
        lruSet(state.fastTrackCache, cacheKey, session);
        return { tracks: session, cacheLevel: "L2 会话" };
      }
    }

    const tracks = await appCall(
      "acquisition.fetchSubtitleTracks",
      runtimeNetwork(),
      meta,
      signal,
    );
    lruSet(state.fastTrackCache, cacheKey, tracks);
    writeSessionCache(() => sessionStorage, CACHE_SESSION_PREFIX, "tracks", cacheKey, tracks);
    return { tracks, cacheLevel: "NET 字幕轨道" };
  }

  async function fetchTrackBodyFast(base: SubtitleMeta, tracks: SubtitleTrack[], trackIndex: number, signal: AbortSignal|undefined, { forceNetwork = false } = {}): Promise<SubtitleFetchResult> {
    const track = tracks[trackIndex];
    if (!track) throw new Error("字幕轨道不存在");
    const langKey = String(track.lan || trackIndex || "default");
    const cacheKey = `${base.bvid}:${base.cid}:${langKey}`;

    if (!forceNetwork) {
      const memory = lruGet(state.fastTrackBodyCache, cacheKey);
      if (memory) return { ...memory, source: "L1 内存字幕", cacheLevel: "L1 内存" };
      const persistent = await persistentCache.read<SubtitleFetchResult>(`subtitle-track:${cacheKey}`);
      if (persistent?.value) {
        const result = { ...persistent.value, cacheStale: Date.now() - persistent.updatedAt > SUBTITLE_REVALIDATE_MS };
        lruSet(state.fastTrackBodyCache, cacheKey, result);
        return { ...result, source: "L3 持久字幕", cacheLevel: "L3 IndexedDB" };
      }
    }

    const lan = String(track.lan || "");
    let url = bilibiliCall("subtitle.normalizeUrl", track.subtitle_url || "");
    if (!url && lan.startsWith("ai-") && base.aid) {
      const resolved = await appCall("acquisition.resolveSubtitleUrl",
        runtimeNetwork(), track, { aid: base.aid, cid: base.cid }, "", signal);
      url = resolved.url;
    }
    if (!url) return { ...base, status: "empty", lan, tracks, activeTrackIndex: trackIndex, source: "NET 无地址" };

    const body = await appCall(
      "acquisition.fetchSubtitleBody",
      runtimeNetwork(),
      url,
      signal,
    );
    if (!body.length) {
      return { ...base, status: "empty", lan, tracks, activeTrackIndex: trackIndex, source: "NET 空字幕" };
    }
    const cues = dedupeCues(coreCall("toCues", body));
    const result: SubtitleFetchResult = {
      ...base,
      status: "ok",
      cue_count: cues.length,
      lan,
      lan_doc: String(track.lan_doc || lan),
      data: cues,
      tracks,
      activeTrackIndex: trackIndex,
      source: "NET 直读",
      cacheLevel: "NET",
      cacheStale: false,
    };
    lruSet(state.fastTrackBodyCache, cacheKey, result);
    persistentCache.write(`subtitle-track:${cacheKey}`, result, SUBTITLE_CACHE_TTL_MS).catch(() => {});
    return result;
  }

  async function fetchYoutubeSubtitle(bvid: string, signal?: AbortSignal): Promise<SubtitleFetchResult> {
    const resolved = appCall("content.resolve", location.href, pageWindow);
    if (!resolved || resolved.ref.source !== "youtube" || resolved.ref.sourceId !== bvid) {
      return { bvid, page: 1, status: "error", error: "YouTube video changed" };
    }
    const result = await appCall("transcript.acquireDetailed", location.href, pageWindow, runtimeNetwork(), signal);
    if (result.status !== "ok") return { bvid, page: 1, status: result.status === "unavailable" ? "empty" : "error", error: result.status === "error" ? result.message : "No captions" };
    const cues = coreCall("toCues", result.transcript.segments.map(segment => ({ from: segment.start, to: segment.end ?? segment.start, content: segment.text })));
    const native = resolved.native as { title?: string; author?: string };
    return { bvid, page: 1, status: "ok", data: cues, cue_count: cues.length,
      title: native.title || document.title.replace(/ - YouTube$/i, ""), author: native.author || "",
      lan: result.transcript.language || "", lan_doc: result.transcript.language || "",
      source: result.transcript.origin || "youtube", cacheLevel: "YouTube Provider" };
  }

  async function fetchCurrentSubtitleFast(bvid: string, page = 1, signal: AbortSignal, { forceNetwork = false } = {}): Promise<SubtitleFetchResult> {
    if (isYoutubePage()) return fetchYoutubeSubtitle(bvid, signal);
    bvid = extractBvid(bvid) || String(bvid || "").trim();
    if (!bvid) throw new Error("empty bvid");

    const viewHit = await fetchVideoViewFast(bvid, signal, { forceNetwork });
    const view = viewHit.value;
    if (bilibiliCall("video.isChargeBlocked", view)) {
      return { bvid, status: "empty", error: "charge_exclusive_blocked", source: viewHit.cacheLevel };
    }

    const base = bilibiliCall("video.pageMeta", view, bvid, page);
    const { cid } = base;
    if (!cid) return { ...base, status: "error", error: "no cid", source: viewHit.cacheLevel };

    const preferredKey = `${base.bvid}:${cid}`;
    if (!forceNetwork) {
      const memory = lruGet(state.fastSubtitleCache, preferredKey);
      if (memory) return { ...memory, source: "L1 内存字幕", cacheLevel: "L1 内存" };
      const persistent = await persistentCache.read<SubtitleFetchResult>(`subtitle:${preferredKey}`);
      if (persistent?.value) {
        const result = {
          ...persistent.value,
          source: "L3 持久字幕",
          cacheLevel: "L3 IndexedDB",
          cacheStale: Date.now() - persistent.updatedAt > SUBTITLE_REVALIDATE_MS,
        };
        lruSet(state.fastSubtitleCache, preferredKey, result);
        return result;
      }
    }

    const trackHit = await fetchSubtitleTracksFast({ ...base, cid }, signal, { forceNetwork });
    const tracks = trackHit.tracks;
    if (!tracks.length) return { ...base, status: "empty", tracks: [], source: trackHit.cacheLevel };
    const activeTrackIndex = bilibiliCall("subtitle.preferredIndex", tracks);
    const result = await fetchTrackBodyFast({ ...base, cid }, tracks, activeTrackIndex, signal, { forceNetwork });
    const finalResult = {
      ...result,
      cachePath: `${viewHit.cacheLevel} → ${trackHit.cacheLevel} → ${result.cacheLevel || result.source}`,
    };
    if (finalResult.status === "ok") {
      lruSet(state.fastSubtitleCache, preferredKey, finalResult);
      persistentCache.write(`subtitle:${preferredKey}`, finalResult, SUBTITLE_CACHE_TTL_MS).catch(() => {});
    }
    return finalResult;
  }

  async function fetchSubtitle(bvid: string, page = 1): Promise<SubtitleFetchResult> {
    if (isYoutubePage()) return fetchYoutubeSubtitle(bvid);
    bvid = extractBvid(bvid) || String(bvid || "").trim();
    if (!bvid) return { bvid: "", status: "error", error: "empty bvid" };

    let detail;
    try {
      detail = await appCall("acquisition.fetchVideoDetail", runtimeNetwork(), bvid);
    } catch (e) {
      return { bvid, status: "error", error: `view/detail: ${errorMessage(e)}` };
    }
    if (detail.code !== 0) {
      return {
        bvid,
        status: "error",
        error: `view/detail code=${detail.code} ${detail.message || ""}`,
      };
    }

    const view = (detail.data && detail.data.View) || {};
    if (bilibiliCall("video.isChargeBlocked", view)) {
      return { bvid, status: "empty", error: "charge_exclusive_blocked" };
    }

    const aid = Number(view.aid) || null;
    const cid = resolveCid(view, page);
    const title = String(view.title || "");
    const author = String((view.owner && view.owner.name) || "");
    const pages = Array.isArray(view.pages) ? view.pages : [];
    const base = { bvid, aid, cid, title, author, pages, page };

    if (cid == null) return { ...base, status: "error", error: "no cid" };

    const { subs, source: src0 } = await appCall(
      "acquisition.collectSubtitleTracks",
      runtimeNetwork(),
      { aid, cid, bvid },
    );
    if (!subs.length) return { ...base, status: "empty" };

    const track = bilibiliCall("subtitle.pickTrack", subs);
    if (!track) return { ...base, status: "empty" };

    const lan = String(track.lan || "");
    const { url, source } = await appCall(
      "acquisition.resolveSubtitleUrl",
      runtimeNetwork(),
      track,
      { aid, cid },
      src0,
    );
    if (!url) return { ...base, status: "empty", lan };

    let body;
    try {
      body = await appCall("acquisition.fetchSubtitleBody", runtimeNetwork(), url);
    } catch (e) {
      return {
        ...base,
        status: "error",
        lan,
        error: `subtitle body: ${errorMessage(e)}`,
      };
    }

    if (!Array.isArray(body) || !body.length) {
      return { ...base, status: "empty", lan };
    }

    const cues = coreCall("toCues", body);
    return {
      ...base,
      status: "ok",
      cue_count: cues.length,
      lan,
      data: cues,
      source,
    };
  }

  // ─── list sources ───────────────────────────────────────────────────────
  /** @returns {Promise<{items: Array, hasMore: boolean, meta?: object}>} */
  async function httpBilibiliList(url: string, headers: Record<string,string>) {
    return appCall("scan.parseListResponse", await httpJson(url, headers));
  }

  async function fetchListPage(ctx: ScanContext, page: number, pageSize: number) {
    if (ctx.type === "user") {
      const q = await appCall(
        "acquisition.signWbi",
        runtimeNetwork(),
        {
          mid: ctx.mid,
          pn: page,
          ps: pageSize,
          tid: 0,
          keyword: "",
          order: "pubdate",
          web_location: 1550101,
          order_avoided: true,
        },
      );
      const result = await httpBilibiliList(
        `https://api.bilibili.com/x/space/wbi/arc/search?${q}`,
        { Referer: `https://space.bilibili.com/${ctx.mid}`, Origin: "https://space.bilibili.com" },
      );
      if (result.code !== 0) {
        throw new Error(result.message || `user list code=${result.code}`);
      }
      const vlist = (result.data && result.data.list && result.data.list.vlist) || [];
      const pageInfo = (result.data && result.data.page) || {};
      const items = vlist.map((v) => ({
        bvid: v.bvid,
        aid: v.aid,
        title: v.title || "",
        author: v.author || "",
        page: 1,
      }));
      const hasMore =
        pageInfo.pn && pageInfo.ps && pageInfo.count != null
          ? pageInfo.pn * pageInfo.ps < pageInfo.count
          : vlist.length >= pageSize;
      return { items, hasMore, meta: { count: pageInfo.count } };
    }

    if (ctx.type === "favorite") {
      const result = await httpBilibiliList(
        `https://api.bilibili.com/x/v3/fav/resource/list?media_id=${ctx.media_id}&pn=${page}&ps=${Math.min(pageSize, 20)}&platform=web&t=${Date.now()}`,
        { Referer: "https://space.bilibili.com/", Origin: "https://www.bilibili.com" },
      );
      if (result.code !== 0) {
        throw new Error(result.message || `fav list code=${result.code}`);
      }
      const medias = (result.data && result.data.medias) || [];
      const items = medias
        .filter((v) => v && (v.type === 2 || v.bvid || v.bv_id)) // type 2 = video
        .map((v) => ({
          bvid: v.bvid || v.bv_id || "",
          aid: v.id || v.aid || 0,
          title: v.title || "",
          author: (v.upper && v.upper.name) || v.author || "",
          page: 1,
        }))
        .filter((v) => v.bvid);
      return {
        items,
        hasMore: result.data && result.data.has_more === true,
        meta: { title: (result.data && result.data.info && result.data.info.title) || "" },
      };
    }

    if (ctx.type === "collection") {
      const result = await httpBilibiliList(
        `https://api.bilibili.com/x/polymer/web-space/seasons_archives_list?mid=${ctx.mid}&season_id=${ctx.season_id}&sort_reverse=false&page_num=${page}&page_size=${pageSize}&web_location=333.1387`,
        {
          Referer: `https://space.bilibili.com/${ctx.mid}/channel/collectiondetail?sid=${ctx.season_id}`,
          Origin: "https://space.bilibili.com",
        },
      );
      if (result.code !== 0) {
        throw new Error(result.message || `collection code=${result.code}`);
      }
      const archives = (result.data && result.data.archives) || [];
      const pageInfo = (result.data && result.data.page) || {};
      const metaBlock = (result.data && result.data.meta) || {};
      const author =
        metaBlock.upper?.name
        || metaBlock.author
        || metaBlock.name_upper
        || archives.find((v) => v?.author || v?.owner?.name)?.author
        || archives.find((v) => v?.owner?.name)?.owner?.name
        || "";
      const items = archives.map((v) => ({
        bvid: v.bvid,
        aid: v.aid,
        title: v.title || "",
        author: v.author || v.owner?.name || author || "",
        page: 1,
      }));
      let hasMore = false;
      if (pageInfo.total != null) {
        hasMore = page * pageSize < pageInfo.total;
      } else {
        hasMore = archives.length >= pageSize;
      }
      return {
        items,
        hasMore,
        meta: {
          total: pageInfo.total,
          name: metaBlock.name || metaBlock.title || "",
          author,
          mid: ctx.mid,
          season_id: ctx.season_id,
        },
      };
    }

    if (ctx.type === "search") {
      const q = await appCall(
        "acquisition.signWbi",
        runtimeNetwork(),
        {
          search_type: "video",
          keyword: ctx.keyword,
          order: ctx.order || "totalrank",
          page,
          page_size: 42,
        },
      );
      const result = await httpBilibiliList(
        `https://api.bilibili.com/x/web-interface/wbi/search/type?${q}`,
        { Referer: "https://search.bilibili.com/", Origin: "https://search.bilibili.com" },
      );
      if (result.code !== 0) {
        throw new Error(result.message || `search code=${result.code}`);
      }
      const rows = (result.data && result.data.result) || [];
      const items = rows
        .map((v) => ({
          bvid: v.bvid || extractBvid(v.arcurl || ""),
          aid: v.aid || v.id || 0,
          title: stripHtml(v.title) || "未知标题",
          author: stripHtml(v.author || v.up_name) || "",
          page: 1,
        }))
        .filter((v) => v.bvid);
      const numPages = (result.data && result.data.numPages) || 0;
      const hasMore = numPages ? page < numPages : items.length >= 42;
      return {
        items,
        hasMore,
        meta: {
          numResults: (result.data && result.data.numResults) || 0,
          keyword: ctx.keyword,
        },
      };
    }

    throw new Error(`unsupported list type: ${ctx.type}`);
  }

  async function loadAllListItems(ctx: ScanContext, { maxPages, pageSize, onProgress, delayMs, shouldCancel }: { maxPages: number; pageSize: number; onProgress?: (message: string) => void; delayMs?: number; shouldCancel?: () => boolean }) {
    return appCall("libraryScan.collectPages", { maxPages, pageSize, ...(delayMs === undefined ? {} : { delayMs }) }, {
      fetchPage: (page, size) => fetchListPage(ctx, page, size),
      waitIfPaused: () => waitIfJobPaused(),
      cancelled: () => typeof shouldCancel === "function" && shouldCancel(),
      ...(onProgress ? { progress: onProgress } : {}),
      sleep,
    });
  }

  /**
   * 个人主页：拉取该 UP 的全部 合集（名称 + season_id → 短地址 + 成员 BV）。
   * 列表接口可能只带 recent archives，total 更大时再拉 seasons_archives_list 补全。
   */
  async function loadUserSpaceSeasons(mid: unknown, {
    maxPages = 30,
    pageSize = 20,
    onProgress,
    delayMs = 280,
    shouldCancel,
    maxSeasonArchivePages = 40,
  }: { maxPages?: number; pageSize?: number; onProgress?: (message: string) => void; delayMs?: number; shouldCancel?: () => boolean; maxSeasonArchivePages?: number } = {}) {
    return appCall("libraryScan.collectUserSeasons",
      mid, { maxPages, pageSize, delayMs, maxSeasonArchivePages }, {
        fetchPage: async (midStr, page, size) => parseUserSeasonPage(await httpJson(
          "https://api.bilibili.com/x/polymer/web-space/seasons_series_list"
          + "?mid=" + encodeURIComponent(midStr)
          + "&page_num=" + page + "&page_size=" + size
          + "&web_location=333.1387",
          { Referer: "https://space.bilibili.com/" + midStr, Origin: "https://space.bilibili.com" },
        )),
        loadMembers: async (midStr, sid, archivePages, ms, progress) => {
          const full = await loadAllListItems(
            { type: "collection", mid: midStr, season_id: sid },
            {
              maxPages: archivePages, pageSize: 30, delayMs: ms,
              onProgress: progress, ...(shouldCancel ? { shouldCancel } : {}),
            },
          );
          return full.items.map((item) => item.bvid).filter(Boolean);
        },
        shortUrl: buildCollectionShortUrl,
        ...(onProgress ? { progress: onProgress } : {}),
        cancelled: () => typeof shouldCancel === "function" && shouldCancel(),
        sleep,
        warn: (sid, error) => console.warn(
          "[bili-subbatch] loadUserSpaceSeasons archives", sid, errorMessage(error),
        ),
      });
  }

  /**
   * 合集 archives 接口按 BV 只给一条（默认 P1）。
   * 带章节的合集（「第一单元 / 1.1、1.2…」）每个单元本身是多分P稿，
   * 必须再读 view.pages 才能扫到展开后的全部课时。
   */
  async function expandCollectionArchivesWithParts(items: readonly CollectionArchive[]|null|undefined, {
    onProgress,
    shouldCancel,
    delayMs = 160,
  }: { onProgress?: (message: string) => void; shouldCancel?: () => boolean; delayMs?: number } = {}) {
    return appCall("libraryScan.expandCollectionParts", items, { delayMs }, {
      cancelled: () => typeof shouldCancel === "function" && shouldCancel(),
      waitIfPaused: () => waitIfJobPaused(),
      extractBvid,
      progress: (index, total, bvid) => {
        setLibraryJob({ kind: "scan", index, total, label: "展开分P " + bvid });
        if (onProgress) onProgress("展开合集分P " + index + "/" + total + "（" + bvid + "）…");
      },
      fetchView: async (bvid) => {
        const view = (await fetchVideoViewFast(bvid))?.value;
        if (!view) return {};
        const aid = Number(view.aid);
        return {
          ...(view.title !== undefined ? { title: view.title } : {}),
          ...(view.owner ? { owner: view.owner } : {}),
          ...(view.pages ? { pages: view.pages } : {}),
          ...(Number.isFinite(aid) ? { aid } : {}),
        };
      },
      onFailure: (bvid, error) => console.warn(
        "[bili-subbatch] expand collection parts", bvid, errorMessage(error),
      ),
      sleep,
    });
  }

  async function loadVideoAsItems(bvid: string, expandAllParts: boolean) {
    // page=1 仅用于拿 View/pages 元信息；字幕在批量阶段再按 page 拉
    const r = await fetchSubtitle(bvid, 1);
    if (r.status === "error" && !r.pages?.length && !r.title) {
      throw new Error(r.error || "无法获取视频信息");
    }
    const pages = r.pages || [];
    if (expandAllParts && pages.length > 1) {
      const videoTitle = r.title || bvid;
      const author = r.author || "";
      const rawItems = pages.map((p, i: number) => ({
        bvid: r.bvid || bvid,
        aid: r.aid ?? null,
        title: `${videoTitle} - P${i + 1}【${p.part || ""}】`,
        author,
        page: i + 1,
        part: p.part || "",
      }));
      return {
        items: attachSelectionGroupMeta(rawItems, { author, title: videoTitle }),
        meta: { title: videoTitle, author, multip: true },
        pages,
      };
    }
    if (expandAllParts && pages.length <= 1) {
      return {
        items: [
          {
            bvid: r.bvid || bvid,
            aid: r.aid ?? null,
            title: r.title || bvid,
            author: r.author || "",
            page: 1,
          },
        ],
        meta: {
          title: r.title || "",
          author: r.author || "",
          multip: false,
          hint: "该稿只有 1P，已按单视频处理",
        },
        pages,
      };
    }
    return {
      items: [
        {
          bvid: r.bvid || bvid,
          aid: r.aid ?? null,
          title: r.title || bvid,
          author: r.author || "",
          page: 1,
        },
      ],
      meta: { title: r.title || "", author: r.author || "", multip: pages.length > 1 },
      pages,
    };
  }

  // ─── state ──────────────────────────────────────────────────────────────
  const state = createWorkbenchState({
    delayMs: DEFAULT_DELAY_MS,
    maxPages: DEFAULT_MAX_PAGES,
    preprocessEnabled: loadPreprocessEnabledSetting(),
    preprocessModelId: String(storageGet(PREPROCESS_MODEL_STORE_KEY, "") || ""),
    preprocessConcurrency: loadBoundedNumberSetting(PREPROCESS_CONCURRENCY_STORE_KEY, PREPROCESS_DEFAULT_CONCURRENCY, 1, 8),
    preprocessTargetMinutes: loadBoundedNumberSetting(PREPROCESS_TARGET_MINUTES_STORE_KEY, PREPROCESS_DEFAULT_TARGET_MINUTES, 2, 30),
    preprocessOverlapSeconds: loadBoundedNumberSetting(PREPROCESS_OVERLAP_SECONDS_STORE_KEY, PREPROCESS_DEFAULT_OVERLAP_SECONDS, 0, 120),
    preprocessMaxChars: loadBoundedNumberSetting(PREPROCESS_MAX_CHARS_STORE_KEY, PREPROCESS_DEFAULT_MAX_CHARS, 8000, 60000),
    preprocessRetries: loadBoundedNumberSetting(PREPROCESS_RETRIES_STORE_KEY, PREPROCESS_DEFAULT_RETRIES, 0, 4),
    studioModelId: String(storageGet(STUDIO_MODEL_STORE_KEY, "") || ""),
    autoCaptureEnabled: loadAutoCaptureSetting(),
    autoAnalyzeEnabled: loadAutoAnalyzeSetting(),
    transcriptAutoFollow: loadTranscriptFollowSetting(),
    autoEnablePlayerSubtitle: loadPlayerSubtitleSetting(),
    knowledgeModelId: String(storageGet(KNOWLEDGE_MODEL_STORE_KEY, "") || ""),
    shortcutConfig: loadShortcutSettings(),
  });

  // ─── UI geometry persistence ────────────────────────────────────────────
  function panelGeometry() {
    const api = typeof SubBatch !== "undefined" ? SubBatch?.SubBatchMonorepo?.ui?.panelGeometry : null;
    if (!api) throw new Error("[bili-subbatch] panel geometry API missing");
    return api;
  }

  function panelState() {
    const api = typeof SubBatch !== "undefined" ? SubBatch?.SubBatchMonorepo?.ui?.panelState : null;
    if (!api) throw new Error("[bili-subbatch] panel state API missing");
    return api;
  }

  function isPanelSizePreset(value: unknown): value is keyof typeof PANEL_SIZE_PRESETS {
    return panelGeometry().isPanelSizePreset(value);
  }

  function panelPresetWidth(name: string, viewportWidth = window.innerWidth) {
    return panelGeometry().panelPresetWidth(name, viewportWidth);
  }

  function highPanelHeight(viewportHeight = window.innerHeight) {
    return panelGeometry().highPanelHeight(viewportHeight);
  }

  function panelSizeClassFromWidth(width: number, viewportWidth = window.innerWidth) {
    return panelGeometry().panelSizeClassFromWidth(width, viewportWidth);
  }

  function panelPersistenceOptions() {
    return {
      viewportWidth: window.innerWidth,
      viewportHeight: window.innerHeight,
      defaultSizePreset: DEFAULT_PANEL_SIZE,
      defaultFlavor: DEFAULT_CTP_FLAVOR,
      noteFontDefault: NOTE_FONT_DEFAULT,
      noteFontMin: NOTE_FONT_MIN,
      noteFontMax: NOTE_FONT_MAX,
      minWidth: MIN_W,
      minHeight: MIN_H,
      currentSizePreset: String(state.ui?.sizePreset || ""),
      presetWidth: panelPresetWidth,
      highHeight: highPanelHeight,
      isPreset: isPanelSizePreset,
      normalizeFlavor: normalizeCtpFlavor,
    };
  }

  function clampKnowledgeRailW(value: number, panelWidth = state.ui?.w || 520) {
    return SubBatch.SubBatchMonorepo.ui.panelPersistence.clampKnowledgeRailWidth(value, panelWidth);
  }

  function clampKnowledgeNavW(value: number, panelWidth = state.ui?.w || 520) {
    return SubBatch.SubBatchMonorepo.ui.panelPersistence.clampKnowledgeNavWidth(
      value, panelWidth, String(state.ui?.sizePreset || ""),
    );
  }

  function applyKnowledgeLayoutVars(root = document.getElementById(PANEL_ID)) {
    if (!root || !state.ui) return;
    const railW = clampKnowledgeRailW(state.ui.knowledgeRailW, state.ui.w);
    const size = String(state.ui.sizePreset || "");
    const navDefault = size === "small" ? 240 : size === "medium" ? 240 : 280;
    const navW = clampKnowledgeNavW(state.ui.knowledgeNavW ?? navDefault, state.ui.w);
    state.ui.knowledgeNavW = navW;
    root.style.setProperty("--bsb-knowledge-rail-w", `${railW}px`);
    root.style.setProperty("--bsb-knowledge-nav-w", `${navW}px`);
    root.dataset.panelView = state.ui.view || "ai";
  }

  function normalizeNoteFont(value: number|undefined, savedDefault: number) {
    return SubBatch.SubBatchMonorepo.ui.panelPersistence.normalizeNoteFont(
      value, savedDefault, panelPersistenceOptions(),
    );
  }

  function loadUiGeom() {
    try {
      return SubBatch.SubBatchMonorepo.ui.panelPersistence.loadUiGeometry(
        localStorage.getItem(UI_STORE_KEY), panelPersistenceOptions(),
      );
    } catch  {
      return SubBatch.SubBatchMonorepo.ui.panelPersistence.defaultUiGeometry(panelPersistenceOptions());
    }
  }

  function saveUiGeom() {
    if (!state.ui) return;
    try {
      localStorage.setItem(UI_STORE_KEY, SubBatch.SubBatchMonorepo.ui.panelPersistence.serializeUiGeometry(
        state.ui, panelPersistenceOptions(),
      ));
    } catch  {
      /* private mode / storage quota */
    }
  }

  function clampUiToViewport(ui: WorkbenchUi) {
    Object.assign(ui, panelGeometry().clampPanelRect(ui, window.innerWidth, window.innerHeight));
    return ui;
  }

  // ─── UI (Catppuccin floating panel · multi-flavor) ─────────────────────
  function injectStyles() {
    // Tokens: Latte / Frappé / Macchiato / Mocha — https://catppuccin.com/palette/
    GM_addStyle?.(`
      ${buildCtpFlavorCss(PANEL_ID)}

      ${SubBatch.SubBatchMonorepo.ui.panelStyles.renderShellStyles(PANEL_ID, MIN_W, MIN_H, DOCK_EDGE_PX)}
      ${SubBatch.SubBatchMonorepo.ui.workspaceLayoutStyles.renderWorkspaceLayoutStyles(PANEL_ID)}
      ${SubBatch.SubBatchMonorepo.ui.workspaceControlsStyles.renderWorkspaceControlsStyles(PANEL_ID)}
      ${SubBatch.SubBatchMonorepo.ui.subsStyles.renderSubsStyles(PANEL_ID)}
      ${SubBatch.SubBatchMonorepo.ui.folioStyles.renderFolioStyles(PANEL_ID)}
      ${SubBatch.SubBatchMonorepo.ui.aiStyles.renderAiStyles(PANEL_ID)}
      ${SubBatch.SubBatchMonorepo.ui.settingsStyles.renderSettingsStyles(PANEL_ID)}
      ${SubBatch.SubBatchMonorepo.ui.readingStyles.renderReadingStyles(PANEL_ID)}
      ${SubBatch.SubBatchMonorepo.ui.knowledgeDrilldownStyles.renderKnowledgeDrilldownStyles(PANEL_ID)}
      ${SubBatch.SubBatchMonorepo.ui.knowledgeWorkspaceStyles.renderKnowledgeWorkspaceStyles(PANEL_ID)}
      ${SubBatch.SubBatchMonorepo.ui.workspaceOverrides.renderWorkspaceOverrides(PANEL_ID)}
      ${SubBatch.SubBatchMonorepo.ui.lateStudioStyles.renderLateStudioStyles(PANEL_ID)}
    `);
  }

  function applyPanelGeometry() {
    const root = document.getElementById(PANEL_ID);
    if (!root || !state.ui) return;
    const sidebar = root.querySelector<HTMLElement>(".bsb-sidebar");
    if (!sidebar) return;
    const ui = clampUiToViewport(state.ui);
    const panelSizeClass = isPanelSizePreset(ui.sizePreset)
      ? ui.sizePreset
      : panelSizeClassFromWidth(ui.w);
    root.setAttribute("data-panel-size", panelSizeClass);
    root.style.setProperty("--bsb-note-font", `${normalizeNoteFont(ui.noteFont, NOTE_FONT_DEFAULT)}px`);
    root.querySelectorAll<HTMLElement>('[data-act="panel-size"]').forEach((button) => {
      const active = isPanelSizePreset(ui.sizePreset) && button.dataset.size === ui.sizePreset;
      button.classList.toggle("active", active);
      button.setAttribute("aria-pressed", active ? "true" : "false");
    });

    root.classList.toggle("open", !!state.open);
    root.classList.toggle("ai-focus", !!state.aiFocus);
    root.classList.toggle("docked", !!ui.dock);
    root.querySelectorAll<HTMLElement>('[data-act="ai-focus"]').forEach((button) => {
      button.setAttribute("aria-pressed", state.aiFocus ? "true" : "false");
      button.title = state.aiFocus
        ? "退出专注阅读（Esc）"
        : "铺满窗口，只保留模型标签与正文";
    });
    root.classList.toggle("dock-expanded", !!(ui.dock && ui.dockExpanded));
    if (ui.dock) root.setAttribute("data-dock", ui.dock);
    else root.removeAttribute("data-dock");

    if (ui.dock && !ui.dockExpanded) {
      // 贴边收起：主面板不占位
      sidebar.style.left = "";
      sidebar.style.top = "";
      sidebar.style.width = "";
      sidebar.style.height = "";
    } else {
      // 悬浮 或 贴边展开
      if (ui.dock === "right") {
        sidebar.style.left = Math.max(0, window.innerWidth - ui.w - 8) + "px";
        sidebar.style.top = Math.max(8, Math.min(ui.y, window.innerHeight - ui.h - 8)) + "px";
      } else if (ui.dock === "left") {
        sidebar.style.left = "8px";
        sidebar.style.top = Math.max(8, Math.min(ui.y, window.innerHeight - ui.h - 8)) + "px";
      } else {
        sidebar.style.left = ui.x + "px";
        sidebar.style.top = ui.y + "px";
      }
      sidebar.style.width = ui.w + "px";
      sidebar.style.height = ui.h + "px";
      sidebar.style.right = "auto";
      sidebar.style.bottom = "auto";
    }

    sidebar.setAttribute(
      "aria-hidden",
      state.open && (!ui.dock || ui.dockExpanded) ? "false" : "true",
    );
    const fab = root.querySelector<HTMLElement>(".bsb-fab");
    if (fab) fab.setAttribute("aria-expanded", state.open || !!ui.dock ? "true" : "false");
    applyKnowledgeLayoutVars(root);
  }

  function bindPanelChrome(root: WorkbenchPanelElement) {
    const ui = state.ui = loadUiGeom();
    applyCtpFlavor(ui.ctpFlavor, { silent: true, persist: false });

    function setOpen(open: boolean) {
      const next = panelState().setPanelOpen({ ...ui, open: state.open, aiFocus: state.aiFocus }, open);
      state.open = next.open;
      state.aiFocus = next.aiFocus;
      ui.dock = next.dock;
      ui.dockExpanded = next.dockExpanded;
      if (open) {
        refreshContextUI();
      } else {
        closeMermaidFullscreen();
      }
      applyPanelGeometry();
      saveUiGeom();
    }

    function setDock(side: "left" | "right" | null) {
      // side: 'left' | 'right' | null
      const next = panelState().setPanelDock({ ...ui, open: state.open, aiFocus: state.aiFocus }, side, window.innerWidth);
      Object.assign(ui, { dock: next.dock, dockExpanded: next.dockExpanded, x: next.x });
      state.open = next.open;
      state.aiFocus = next.aiFocus;
      if (side) {
        closeMermaidFullscreen();
      }
      applyPanelGeometry();
      saveUiGeom();
      setStatus(
        side
          ? `已贴边收起（${side === "right" ? "右" : "左"}侧）· 点标签展开`
          : "已取消贴边 · 悬浮模式",
      );
    }

    function toggleDockExpanded(force?: boolean) {
      if (!ui.dock) return;
      const next = panelState().expandPanelDock({ ...ui, open: state.open, aiFocus: state.aiFocus }, force);
      ui.dockExpanded = next.dockExpanded;
      state.open = next.open;
      applyPanelGeometry();
      if (ui.dockExpanded) refreshContextUI();
    }

    const chromeController = typeof SubBatch !== "undefined"
      ? SubBatch?.SubBatchMonorepo?.ui?.panelChrome?.bindPanelChromeControls
      : null;
    if (typeof chromeController !== "function") throw new Error("[bili-subbatch] missing panel chrome controller");
    chromeController({
      root,
      state: () => ({ open: state.open, dock: ui.dock, dockExpanded: ui.dockExpanded }),
      setOpen,
      setDock,
      expandDock: toggleDockExpanded,
      preferredDockSide: () => panelState().preferredDockSide(ui, window.innerWidth),
      selectSize: (next: string) => {
        if (!isPanelSizePreset(next)) return;
        const oldWidth = ui.w;
        const oldRight = ui.x + oldWidth;
        const anchorRight = ui.dock === "right" || (!ui.dock && ui.x + oldWidth / 2 >= window.innerWidth / 2);
        ui.sizePreset = next;
        ui.w = panelPresetWidth(next);
        if (anchorRight && !ui.dock) ui.x = oldRight - ui.w;
        clampUiToViewport(ui);
        applyPanelGeometry();
        saveUiGeom();
        setStatus(`面板宽度：${PANEL_SIZE_PRESETS[next].label} · ${Math.round(ui.w)}px；高度保持${ui.heightMode === "custom" ? "自定义" : "约 90% 视口"}`);
      },
    });
    const pointerController = typeof SubBatch !== "undefined"
      ? SubBatch?.SubBatchMonorepo?.ui?.panelPointer?.bindPanelPointerController
      : null;
    if (typeof pointerController !== "function") throw new Error("[bili-subbatch] missing panel pointer controller");
    pointerController({
      root,
      getState: () => ui,
      update: (patch) => Object.assign(ui, patch),
      setOpen: (open: boolean) => { state.open = open; },
      setDock,
      render: applyPanelGeometry,
      persist: saveUiGeom,
      viewport: () => ({ width: window.innerWidth, height: window.innerHeight }),
      snapThreshold: DOCK_SNAP_PX,
    });
    window.addEventListener("resize", () => {
      if (!ui) return;
      clampUiToViewport(ui);
      applyPanelGeometry();
    });

    // 若上次是 dock，启动时只显示贴边标签
    if (ui.dock) {
      state.open = true;
      ui.dockExpanded = false;
    }
    applyPanelGeometry();
    // 恢复工作区（AI / 字幕 / 设置）
    try {
      setWorkspace(ui.view || "ai", { silent: true });
    } catch  {
      /* ensurePanel may not be fully wired yet */
    }

    // expose for external refresh
    root._bsbSetOpen = setOpen;
    root._bsbSetDock = setDock;
    root._bsbToggleDockExpanded = toggleDockExpanded;
  }

  function ensurePanel(): WorkbenchPanelElement {
    let root = document.getElementById(PANEL_ID) as WorkbenchPanelElement | null;
    if (root) return root;
    injectStyles();
    root = document.createElement("div") as WorkbenchPanelElement;
    root.id = PANEL_ID;
    root.setAttribute("data-ctp-flavor", normalizeCtpFlavor(state.ui?.ctpFlavor || DEFAULT_CTP_FLAVOR));
    root.innerHTML = toTrustedHTML(`
      ${SubBatch.SubBatchMonorepo.ui.panelMarkup.renderPanelHeader(SCRIPT_VERSION)}
        <div class="bsb-body">
          <!-- AI 主画布 -->
          ${SubBatch.SubBatchMonorepo.ui.workspaceMarkup.renderAiWorkspace()}

          <!-- 字幕资源库 -->
          ${SubBatch.SubBatchMonorepo.ui.workspaceMarkup.renderSubsWorkspace(DEFAULT_MAX_PAGES, DEFAULT_DELAY_MS)}

          <!-- Knowledge Workspace · Navigator | Reader（仅本 view active 时可见） -->
          ${SubBatch.SubBatchMonorepo.ui.workspaceMarkup.renderKnowledgeWorkspaceMarkup()}

          <!-- 设置 · v5.5 Master–Detail -->
          ${SubBatch.SubBatchMonorepo.ui.workspaceMarkup.renderSettingsWorkspace()}
        </div>
        <div class="bsb-statusbar">
          <span class="bsb-status-dot" data-role="status-dot"></span>
          <div class="bsb-status" data-role="status" role="status" aria-live="polite">就绪 · AI 工作台</div>
        </div>
      </aside>
      <div class="bsb-selection-toolbar" data-role="knowledge-selection-toolbar" hidden>
        <span class="bsb-selection-toolbar-text" data-role="knowledge-selection-text"></span>
        <div class="bsb-selection-toolbar-actions">
          <button type="button" data-knowledge-selection-act="explain">✦ 解释</button>
          <button type="button" data-knowledge-selection-act="deep">↳ 深入</button>
          <button type="button" data-knowledge-selection-act="question">? 提问</button>
          <button type="button" data-knowledge-selection-act="save">☆ 收藏</button>
        </div>
      </div>
      <button type="button" class="bsb-fab" title="SubBatch 工作台" aria-expanded="false">CC</button>
    `);
    document.documentElement.appendChild(root);
    bindPanelChrome(root);
    bindKnowledgeLayoutInteractions(root);
    applyKnowledgeLayoutVars(root);

    SubBatch.SubBatchMonorepo.ui.settingsInteraction.bind(root, {
      selectWorkspace: (view) => setWorkspace(view),
      maxPages: (value: number) => { state.maxPages = value; },
      delayMs: (value: number) => { state.delayMs = value; },
      autoCapture: (enabled: boolean) => {
        state.autoCaptureEnabled = enabled;
        saveAutoCaptureSetting(enabled);
        if (enabled) {
          setStatus("已开启：打开视频自动抓字幕");
          scheduleAutoCapture("setting-enabled", 0);
        } else {
          state.autoCaptureAbortController?.abort();
          clearTimeout(state.autoCaptureTimer);
          setStatus("已关闭自动抓取；仍可手动扫描", "ok");
        }
      },
      autoAnalyze: (enabled: boolean) => {
        state.autoAnalyzeEnabled = enabled;
        saveAutoAnalyzeSetting(enabled);
        clearTimeout(state.autoAnalyzeTimer);
        state.autoAnalyzePendingKey = "";
        if (enabled) {
          state.autoAnalyzeKey = "";
          const item = currentTranscriptItem();
          if (item?.subStatus === "ok" && item.data?.length) {
            scheduleAutoAnalyze(item, routeVideoKey(item.bvid, item.page || 1), "setting-enabled", 0);
          } else {
            setStatus("已开启：抓到字幕后自动开始分析");
          }
        } else {
          setStatus("已关闭自动分析；仍可点击“开始分析”", "ok");
        }
      },
      playerSubtitle: (enabled: boolean) => {
        state.autoEnablePlayerSubtitle = enabled;
        storageSet(PLAYER_SUBTITLE_STORE_KEY, enabled ? "true" : "false");
        if (enabled) enablePlayerSubtitle(currentTranscriptItem()).catch(() => {});
      },
      mode: (value: string) => {
        state.mode = value;
        refreshContextUI();
        setStatus(value === "auto"
          ? "已切回自动识别（默认偏单个视频）"
          : "已手动指定：" + (TYPE_LABEL[value] || value));
      },
      promptSelect: (activeId) => {
        savePromptProfilesFromForm({ activeId });
        updatePromptUi(root, getActivePromptProfile());
        setStatus(activeId ? "提示词：" + (getActivePromptProfile()?.name || "未命名") : "当前没有提示词", activeId ? "ok" : "err");
      },
      preprocessEnabled: (enabled: boolean) => {
        state.preprocessEnabled = enabled;
        savePreprocessEnabledSetting(enabled);
        refreshPromptSelector(root);
        refreshPreprocessModelSelector(root);
        setStatus(enabled ? "字幕预处理已开启" : "字幕预处理已关闭：后处理将直接使用原始字幕", "ok");
      },
      preprocessPrompt: (id: string|undefined) => {
        savePromptProfilesFromForm({ activeId: state.activePromptId });
        savePromptProfiles(state.promptProfiles, state.activePromptId, id);
        setStatus("预处理 Prompt：" + (getActivePreprocessPromptProfile()?.name || "未命名"), "ok");
      },
      preprocessModel: (id: string) => {
        state.preprocessModelId = id;
        storageSet(PREPROCESS_MODEL_STORE_KEY, id);
        const cfg = getPreprocessModelConfig();
        setStatus("预处理模型：" + (cfg?.name || cfg?.model || "未选择"), cfg ? "ok" : "err");
      },
      promptSearch: (value: string) => {
        state.promptSearch = value;
        renderPromptList(root);
      },
      aiSearch: (value: string) => {
        state.aiSearch = value;
        renderAiList(root);
      },
      knowledgeSearch: (value: string) => {
        state.knowledgeSearch = value;
        renderKnowledgeWorkspace().catch(() => {});
      },
    }, {
      maxPages: DEFAULT_MAX_PAGES,
      delayMs: DEFAULT_DELAY_MS,
      autoCapture: !!state.autoCaptureEnabled,
      autoAnalyze: !!state.autoAnalyzeEnabled,
      playerSubtitle: !!state.autoEnablePlayerSubtitle,
      preprocessEnabled: !!state.preprocessEnabled,
    });
    SubBatch.SubBatchMonorepo.ui.reorderInteraction.bind(root, {
      reorderConfig: commitConfigListReorder,
      reorderFlow: commitFlowModelReorder,
    });
    SubBatch.SubBatchMonorepo.ui.studioInteractionController.bind(root, {
      getIndex: () => state.studioSlashIndex,
      setIndex: (index: number) => { state.studioSlashIndex = index; },
      renderMenu: renderStudioSlashMenu,
      hideMenu: hideStudioSlashMenu,
      runCommand: runStudioSlash,
      send: sendStudioChat,
      clear: studioClearChat,
      copy: studioCopyLast,
      exportChat: studioExportChat,
      onError: (error) => setStatus(`对话失败：${errorMessage(error)}`, "err"),
    });
    root.addEventListener("mouseup", (e) => {
      const target = e.target instanceof Element ? e.target :
        e.target instanceof Text ? e.target.parentElement : null;
      if (!target) return;
      if (target.closest<HTMLElement>('[data-role="knowledge-selection-toolbar"], [data-role="knowledge-rail"]')) return;
      setTimeout(captureKnowledgeSelection, 0);
    });

    SubBatch.SubBatchMonorepo.ui.resourceInteraction.bind(root, {
      followEnabled: () => !!state.transcriptAutoFollow,
      selectGroup: (key, checked) => {
        setGroupSelection(state.items, key, checked);
        renderList({ renderTranscript: false });
      },
      selectItem: (index: string|number, checked: boolean) => {
        const item = state.items[Number(index)];
        if (item) item.selected = checked;
        renderList({ renderTranscript: false });
      },
      toggleFolder: (key: string|number) => {
        if (!state.libraryFolderCollapsed) state.libraryFolderCollapsed = {};
        state.libraryFolderCollapsed[key] = !state.libraryFolderCollapsed[key];
        renderList({ renderTranscript: false });
      },
      openItem: (index: string|number) => {
        const item = state.items[Number(index)];
        if (item) selectTranscriptItem(item);
      },
      searchLibrary: (query: string) => {
        state.libraryQuery = query;
        renderList({ renderTranscript: false });
      },
      filterLibrary: (filter: string) => {
        state.libraryFilter = filter;
        renderList({ renderTranscript: false });
      },
      searchTranscript: (query: string) => {
        state.transcriptQuery = query;
        renderTranscriptPanel();
      },
      switchTrack: (index) => {
        switchTranscriptTrack(index).catch((error) => {
          if (!isAbortError(error)) setStatus('切换字幕失败: ' + (errorMessage(error)), "err");
        });
      },
      setFollow: (enabled: boolean) => {
        state.transcriptAutoFollow = enabled;
        storageSet(TRANSCRIPT_FOLLOW_STORE_KEY, enabled ? "true" : "false");
        if (enabled) updateTranscriptActiveCue(currentVideoTime(), true);
      },
      seekTranscript: seekTranscriptTime,
      recordUserScroll: () => { state.transcriptUserScrollUntil = Date.now() + 3500; },
    });

    SubBatch.SubBatchMonorepo.ui.settingsInteraction.bindFlowChanges(root, {
      shortcutPreference: (key: string, value, checked: boolean) => {
        if (key === "enabled") state.shortcutConfig.enabled = checked;
        else if (key === "summonLayout" || key === "summonTarget" || key === "preferredDock") state.shortcutConfig[key] = value;
        saveShortcutSettings();
        renderShortcutSettings(root);
        setStatus(key === "enabled"
          ? `快捷键已${state.shortcutConfig.enabled ? "开启" : "关闭"}`
          : "快捷召唤偏好已保存", "ok");
      },
      knowledgeModel: (value: string) => {
        state.knowledgeModelId = value;
        storageSet(KNOWLEDGE_MODEL_STORE_KEY, value);
      },
      preprocessEnabled: (value: boolean) => {
        state.preprocessEnabled = value;
        savePreprocessEnabledSetting(value);
        renderAiFlowDrawer();
        refreshAiChips();
      },
      preprocessPrompt: (value: string|undefined) => {
        savePromptProfiles(state.promptProfiles, state.activePromptId, value);
        renderAiFlowDrawer();
      },
      preprocessModel: (value: string) => {
        state.preprocessModelId = value;
        storageSet(PREPROCESS_MODEL_STORE_KEY, value);
        renderAiFlowDrawer();
      },
      preprocessConcurrency: (raw: string|number) => {
        state.preprocessConcurrency = saveBoundedNumberSetting(PREPROCESS_CONCURRENCY_STORE_KEY, raw, PREPROCESS_DEFAULT_CONCURRENCY, 1, 8);
      },
      preprocessTargetMinutes: (raw: string|number) => {
        state.preprocessTargetMinutes = saveBoundedNumberSetting(PREPROCESS_TARGET_MINUTES_STORE_KEY, raw, PREPROCESS_DEFAULT_TARGET_MINUTES, 2, 30);
      },
      preprocessOverlapSeconds: (raw: string|number) => {
        state.preprocessOverlapSeconds = saveBoundedNumberSetting(PREPROCESS_OVERLAP_SECONDS_STORE_KEY, raw, PREPROCESS_DEFAULT_OVERLAP_SECONDS, 0, 120);
      },
      preprocessMaxChars: (raw: string|number) => {
        state.preprocessMaxChars = saveBoundedNumberSetting(PREPROCESS_MAX_CHARS_STORE_KEY, raw, PREPROCESS_DEFAULT_MAX_CHARS, 8000, 60000);
      },
      preprocessRetries: (raw: string|number) => {
        state.preprocessRetries = saveBoundedNumberSetting(PREPROCESS_RETRIES_STORE_KEY, raw, PREPROCESS_DEFAULT_RETRIES, 0, 4);
      },
      studioModel: (value: string) => {
        state.studioModelId = value;
        storageSet(STUDIO_MODEL_STORE_KEY, value);
        renderAiFlowDrawer();
      },
      studioContext: (value: string) => {
        state.studioContextPref = value === "raw" || value === "processed" ? value : "auto";
        persistStudioChat();
        if (currentAiWorkbenchStage() === "chat") renderStudioCanvas();
      },
      taskPrompt: (taskId: string, promptId: string) => {
        const tasks = currentPostTasks().map((task) => ({ ...task, modelIds: [...(task.modelIds || [])] }));
        const task = tasks.find((item) => item.id === taskId);
        if (!task) return;
        task.promptId = promptId;
        savePostTasks(tasks);
      },
    });

    root.addEventListener("click", (e) => {
      const target = e.target instanceof Element ? e.target :
        e.target instanceof Text ? e.target.parentElement : null;
      if (!target) return;
      const knowledgeSelectionAction = target.closest<HTMLElement>("[data-knowledge-selection-act]");
      if (knowledgeSelectionAction) {
        e.preventDefault();
        const action = knowledgeSelectionAction.dataset.knowledgeSelectionAct;
        Promise.resolve((async () => {
          const anchor = await ensureKnowledgeAnchorFromSelection({ starred: action === "save" });
          if (!anchor) return;
          if (action === "save") { setStatus(`已收藏知识锚点：${anchor.selectedText}`, "ok"); return; }
          if (action === "question") {
            await renderKnowledgeRail();
            ensurePanel().querySelector<HTMLElement>('[data-role="knowledge-rail"] [data-role="knowledge-question"]')?.focus();
            return;
          }
          const question = action === "deep"
            ? `请深入解释「${anchor.selectedText}」，重点说明它在当前字幕语境中的机制、为什么重要、常见误解以及与相邻概念的关系。`
            : `什么是「${anchor.selectedText}」？请结合当前字幕说明它在这里的具体含义和作用。`;
          await knowledgeAsk(anchor.id, null, question);
        })()).catch((error) => setStatus(`Knowledge 操作失败：${errorMessage(error)}`, "err"));
        return;
      }
      const knowledgeMark = target.closest<HTMLElement>("[data-knowledge-anchor-id]");
      if (knowledgeMark) {
        e.preventDefault();
        openKnowledgeAnchor(knowledgeMark.dataset.knowledgeAnchorId || "").catch((error) => setStatus(`打开知识锚点失败：${errorMessage(error)}`, "err"));
        return;
      }
      if (target.closest<HTMLElement>("[data-knowledge-close]")) { e.preventDefault(); closeKnowledgeRail(); return; }
      if (target.closest<HTMLElement>("[data-knowledge-stop]")) { e.preventDefault(); abortKnowledgeRequest(); return; }
      const handledKnowledgeReader = SubBatch.SubBatchMonorepo.ui.knowledgeReader.dispatchReaderClick(target, {
        starAnchor: () => {
          const anchor = knowledgeAnchorById(state.knowledgeActiveAnchorId);
          if (!anchor) return;
          const updated = { ...anchor, starred: !anchor.starred, updatedAt: Date.now() };
          knowledgePutAnchor(updated).then(async () => {
            if (state.ui?.view === "knowledge") return renderKnowledgeWorkspace();
            await Promise.all([renderKnowledgeRail(), decorateKnowledgeAnchors()]);
          }).catch((error) => setStatus("收藏失败：" + (errorMessage(error)), "err"));
        },
        starNode: () => {
          const node = knowledgeNodeById(state.knowledgeActiveNodeId);
          if (!node) return;
          const updated = { ...node, starred: !node.starred, updatedAt: Date.now() };
          knowledgePutNode(updated).then(() => {
            if (state.ui?.view === "knowledge") return renderKnowledgeWorkspace();
            return renderKnowledgeRail();
          }).catch((error) => setStatus("收藏失败：" + (errorMessage(error)), "err"));
        },
        deleteAnchor: () => {
          const anchor = knowledgeAnchorById(state.knowledgeActiveAnchorId);
          if (!anchor || !confirm("删除知识锚点「" + anchor.selectedText + "」及其全部追问？")) return;
          knowledgeDeleteAnchor(anchor.id).then(() => renderKnowledgeWorkspace())
            .then(() => decorateKnowledgeAnchors())
            .catch((error) => setStatus("删除失败：" + (errorMessage(error)), "err"));
        },
        toggleMore: () => {
          const menu = target.closest<HTMLElement>(".bsb-knowledge-more")?.querySelector<HTMLElement>('[data-role="knowledge-more-menu"]');
          if (menu) menu.hidden = !menu.hidden;
        },
      });
      if (handledKnowledgeReader) { e.preventDefault(); return; }
      const handledKnowledgeNavigation = SubBatch.SubBatchMonorepo.ui.knowledgeTreeRenderer.dispatchNavigationClick(target, {
        backList: () => {
          state.knowledgeActiveAnchorId = "";
          state.knowledgeActiveNodeId = "";
          renderKnowledgeWorkspace().catch(() => {});
        },
        toggleTree: () => {
          state.knowledgeTreeOpen = !state.knowledgeTreeOpen;
          renderKnowledgeRail().catch(() => {});
        },
        openWorkspace: () => {
          setWorkspace("knowledge");
          renderKnowledgeWorkspace().catch(() => {});
        },
        newRoot: () => {
          state.knowledgeActiveNodeId = "";
          renderKnowledgeRail().then(() => ensurePanel().querySelector<HTMLElement>('[data-role="knowledge-question"]')?.focus()).catch(() => {});
        },
        selectAnchor: (id: string) => {
          state.knowledgeActiveAnchorId = id;
          state.knowledgeActiveNodeId = "";
          renderKnowledgeWorkspace().catch(() => {});
        },
        selectNode: (id: string) => {
          state.knowledgeActiveNodeId = id;
          if (state.ui?.view === "knowledge") renderKnowledgeWorkspace().catch(() => {});
          else renderKnowledgeRail().catch(() => {});
        },
        askSuggestion: (question) => {
          knowledgeAsk(state.knowledgeActiveAnchorId, state.knowledgeActiveNodeId || null, question)
            .catch((error) => setStatus("Knowledge 追问失败：" + (errorMessage(error)), "err"));
        },
      });
      if (handledKnowledgeNavigation) { e.preventDefault(); return; }
      if (target.closest<HTMLElement>("[data-knowledge-evidence-toggle]")) {
        e.preventDefault();
        if (state.ui) {
          state.ui.knowledgeContextOpen = !state.ui.knowledgeContextOpen;
          saveUiGeom();
        }
        if (state.ui?.view === "knowledge") renderKnowledgeWorkspace().catch(() => {});
        else if (state.knowledgeRailOpen) renderKnowledgeRail().catch(() => {});
        return;
      }
      if (!target.closest<HTMLElement>(".bsb-knowledge-more")) {
        root.querySelectorAll<HTMLElement>('[data-role="knowledge-more-menu"]').forEach((menu) => { menu.hidden = true; });
      }
      const knowledgeQuick = target.closest<HTMLElement>("[data-knowledge-quick]");
      if (knowledgeQuick) {
        e.preventDefault();
        const anchor = knowledgeAnchorById(state.knowledgeActiveAnchorId);
        if (anchor) knowledgeAsk(anchor.id, null, `什么是「${anchor.selectedText}」？请结合当前字幕说明它在这里的具体含义和作用。`).catch((error) => setStatus(`Knowledge 追问失败：${errorMessage(error)}`, "err"));
        return;
      }
      const knowledgeSend = target.closest<HTMLElement>("[data-knowledge-send]");
      if (knowledgeSend) {
        e.preventDefault();
        const shell = knowledgeSend.closest(".bsb-knowledge-composer, .bsb-knowledge-reader, .bsb-knowledge-rail-body") || root;
        const input = shell.querySelector<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>('[data-role="knowledge-question"]');
        const q = String(input?.value || "").trim();
        if (q) {
          knowledgeAsk(state.knowledgeActiveAnchorId, state.knowledgeActiveNodeId || null, q)
            .then(() => { if (input) input.value = ""; })
            .catch((error) => setStatus(`Knowledge 追问失败：${errorMessage(error)}`, "err"));
        }
        return;
      }
      if (target.closest<HTMLElement>("[data-knowledge-seek]")) {
        e.preventDefault();
        const anchor = knowledgeAnchorById(state.knowledgeActiveAnchorId);
        if (anchor) {
          setWorkspace("ai");
          state.aiInputView = "processed";
          setAiWorkbenchStage("preprocess").then(() => {
            if (anchor.timeStart != null) seekToVideoTimestamp(anchor.timeStart, anchor.bvid || "", anchor.page || 1);
            openKnowledgeAnchor(anchor.id).catch(() => {});
          });
        }
        return;
      }
      const flowStep = target.closest<HTMLElement>("[data-flow-step]");
      if (flowStep) {
        e.preventDefault();
        const shell = flowStep.closest(".bsb-flow-stepper");
        const input = shell?.querySelector<HTMLInputElement>('input[type="number"]');
        if (!input || input.disabled) return;
        const direction = Number(flowStep.dataset.flowStep || 0);
        const step = Math.max(0.000001, Number(input.step) || 1);
        const min = input.min === "" ? -Infinity : Number(input.min);
        const max = input.max === "" ? Infinity : Number(input.max);
        const current = Number(input.value);
        const base = Number.isFinite(current) ? current : 0;
        const next = Math.min(max, Math.max(min, base + direction * step));
        input.value = String(next);
        input.dispatchEvent(new Event("change", { bubbles: true }));
        return;
      }
      const drawerBackdrop = target.closest<HTMLElement>('[data-role="ai-drawer-backdrop"]');
      if (drawerBackdrop) { e.preventDefault(); setAiDrawer(""); return; }
      const drawerAction = target.closest<HTMLElement>('[data-role="ai-flow-drawer"] button[data-act], [data-role="ai-input-drawer"] button[data-act]');
      if (drawerAction) {
        e.preventDefault();
        Promise.resolve(onAction(drawerAction.dataset.act || null)).catch((error) => setStatus(`操作失败: ${errorMessage(error)}`, "err"));
        return;
      }
      const inputView = target.closest<HTMLElement>("[data-input-view]");
      if (inputView) { e.preventDefault(); state.aiInputView = String(inputView.dataset.inputView || "raw"); renderAiInputDrawer(); return; }
      const aiStageTab = target.closest<HTMLElement>("[data-ai-stage]");
      if (aiStageTab) { e.preventDefault(); setAiWorkbenchStage(aiStageTab.dataset.aiStage || "").catch((error) => setStatus(`切换 AI 阶段失败: ${errorMessage(error)}`, "err")); return; }
      const preprocessView = target.closest<HTMLElement>("[data-ai-preprocess-view]");
      if (preprocessView) { e.preventDefault(); state.aiInputView = String(preprocessView.dataset.aiPreprocessView || "raw"); renderPreprocessCanvas().catch((error) => setStatus(`打开字幕失败: ${errorMessage(error)}`, "err")); return; }
      const outputTask = target.closest<HTMLElement>("[data-ai-output-task]");
      if (outputTask) { e.preventDefault(); selectAiOutputTask(outputTask.dataset.aiOutputTask || "").catch((error) => setStatus(`切换产物失败: ${errorMessage(error)}`, "err")); return; }
      const taskRemove = target.closest<HTMLElement>("[data-flow-task-remove]");
      if (taskRemove) {
        e.preventDefault();
        const id = String(taskRemove.dataset.flowTaskRemove || "");
        savePostTasks(currentPostTasks().filter((t) => t.id !== id));
        renderAiFlowDrawer();
        return;
      }
      const modelAdd = target.closest<HTMLElement>("[data-flow-task-model-add]");
      if (modelAdd) {
        e.preventDefault();
        const card = modelAdd.closest<HTMLElement>("[data-flow-task-id]");
        const taskId = String(card?.dataset.flowTaskId || "");
        const modelId = String(modelAdd.dataset.flowTaskModelAdd || "");
        const tasks = currentPostTasks().map((t) => ({ ...t, modelIds: [...(t.modelIds || [])] }));
        const task = tasks.find((t) => t.id === taskId);
        if (task && modelId && !task.modelIds.includes(modelId)) {
          task.modelIds.push(modelId);
          savePostTasks(tasks);
          renderAiFlowDrawer();
        }
        return;
      }
      const modelRemove = target.closest<HTMLElement>("[data-flow-task-model-remove]");
      if (modelRemove) {
        e.preventDefault();
        e.stopPropagation();
        const card = modelRemove.closest<HTMLElement>("[data-flow-task-id]");
        const taskId = String(card?.dataset.flowTaskId || "");
        const modelId = String(modelRemove.dataset.flowTaskModelRemove || "");
        const tasks = currentPostTasks().map((t) => ({ ...t, modelIds: [...(t.modelIds || [])] }));
        const task = tasks.find((t) => t.id === taskId);
        if (task && modelId) {
          task.modelIds = task.modelIds.filter((id) => id !== modelId);
          savePostTasks(tasks);
          renderAiFlowDrawer();
        }
        return;
      }
      const editorAction = target.closest<HTMLElement>('[data-role="prompt-editor"] button[data-act], [data-role="ai-editor"] button[data-act]');
      if (editorAction) {
        e.preventDefault();
        Promise.resolve(onAction(editorAction.dataset.act || null)).catch((error) => {
          setStatus(`设置操作失败: ${errorMessage(error)}`, "err");
        });
        return;
      }
      const shortcutRecord = target.closest<HTMLElement>("[data-shortcut-record]");
      if (shortcutRecord) {
        e.preventDefault();
        const id = String(shortcutRecord.dataset.shortcutRecord || "");
        if (!SHORTCUT_COMMANDS.some((command) => command.id === id)) return;
        state.shortcutRecordingId = id;
        renderShortcutSettings(root);
        root.querySelector<HTMLElement>(`[data-shortcut-record="${CSS.escape(id)}"]`)?.focus();
        setStatus("快捷键录制中 · 按 Esc 取消，Backspace / Delete 清除");
        return;
      }
      const shortcutReset = target.closest<HTMLElement>("[data-shortcut-reset]");
      if (shortcutReset) {
        e.preventDefault();
        const id = String(shortcutReset.dataset.shortcutReset || "");
        const command = SHORTCUT_COMMANDS.find((item) => item.id === id);
        if (!command) return;
        state.shortcutRecordingId = "";
        state.shortcutConfig.bindings[id] = command.defaultChord;
        saveShortcutSettings();
        renderShortcutSettings(root);
        setStatus(`已恢复：${command.label} · ${shortcutDisplayChord(command.defaultChord)}`, "ok");
        return;
      }
      const shortcutResetAll = target.closest<HTMLElement>("[data-shortcut-reset-all]");
      if (shortcutResetAll) {
        e.preventDefault();
        const preserved = {
          enabled: state.shortcutConfig.enabled,
          summonLayout: state.shortcutConfig.summonLayout,
          summonTarget: state.shortcutConfig.summonTarget,
          preferredDock: state.shortcutConfig.preferredDock,
        };
        state.shortcutConfig = { ...shortcutDefaults(), ...preserved, bindings: shortcutDefaults().bindings };
        state.shortcutRecordingId = "";
        saveShortcutSettings();
        renderShortcutSettings(root);
        setStatus("已恢复默认快捷键", "ok");
        return;
      }
      const settingsTab = target.closest<HTMLElement>("[data-settings-tab]");
      if (settingsTab) {
        e.preventDefault();
        try { savePromptProfilesFromForm({ activeId: state.activePromptId }); } catch  { /* noop */ }
        try { saveAiProfilesFromForm(); } catch  { /* noop */ }
        setSettingsTab(settingsTab.dataset.settingsTab || "");
        return;
      }
      const flavorPick = target.closest<HTMLElement>("[data-ctp-flavor-pick]");
      if (flavorPick) {
        e.preventDefault();
        applyCtpFlavor(flavorPick.dataset.ctpFlavorPick);
        return;
      }
      const promptStageTab = target.closest<HTMLElement>("[data-prompt-stage-tab]");
      if (promptStageTab) {
        e.preventDefault();
        try { savePromptProfilesFromForm({ activeId: state.activePromptId }); } catch  { /* noop */ }
        setPromptStageTab(promptStageTab.dataset.promptStageTab || "");
        return;
      }
      const promptListItem = target.closest<HTMLElement>("[data-prompt-list-id]");
      if (promptListItem) {
        // 拖拽手柄本身仍可点选该行；真正重排由 drag/drop 负责。
        e.preventDefault();
        savePromptProfilesFromForm({ activeId: state.activePromptId });
        state.promptEditorId = String(promptListItem.dataset.promptListId || "");
        fillPromptConfigForm(root);
        return;
      }
      const aiListItem = target.closest<HTMLElement>("[data-ai-list-id]");
      if (aiListItem) {
        e.preventDefault();
        saveAiProfilesFromForm();
        state.aiEditorId = String(aiListItem.dataset.aiListId || "");
        fillAiConfigForm(root);
        return;
      }
      const promptTool = target.closest<HTMLElement>("[data-prompt-act]");
      if (promptTool) {
        e.preventDefault();
        handlePromptProfileAction(promptTool);
        return;
      }
      const profileTool = target.closest<HTMLElement>("[data-ai-profile-act]");
      if (profileTool) {
        e.preventDefault();
        handleAiProfileAction(profileTool);
        return;
      }
      const preprocessTab = target.closest<HTMLElement>("[data-ai-preprocess-tab]");
      if (preprocessTab) {
        e.preventDefault();
        selectPreprocessResult().catch((error) => setStatus(`打开预处理稿失败: ${errorMessage(error)}`, "err"));
        return;
      }
      const retryTab = target.closest<HTMLElement>("[data-ai-retry-id]");
      if (retryTab) {
        e.preventDefault();
        const runId = retryTab.dataset.aiRetryId;
        selectAiRun(runId || "")
          .then(() => regenerateActiveAiRun())
          .catch((error) => setStatus(`重新生成失败: ${errorMessage(error)}`, "err"));
        return;
      }
      const resultTab = target.closest<HTMLElement>("[data-ai-result-id]");
      if (resultTab) {
        e.preventDefault();
        selectAiRun(resultTab.dataset.aiResultId || "").catch((error) => {
          setStatus(`切换结果失败: ${errorMessage(error)}`, "err");
        });
        return;
      }
      const mermaidTool = target.closest<HTMLButtonElement>("[data-mmd-act]");
      if (mermaidTool) {
        e.preventDefault();
        handleMermaidTool(mermaidTool);
        return;
      }
      const ts = target.closest<HTMLElement>(".bsb-time-link");
      if (!ts) return;
      e.preventDefault();
      seekToVideoTimestamp(
        Number(ts.dataset.seconds),
        ts.dataset.bvid || "",
        Number(ts.dataset.page) || 1,
      );
    });
    root.addEventListener("wheel", (e) => {
      const target = e.target instanceof Element ? e.target :
        e.target instanceof Text ? e.target.parentElement : null;
      if (!target) return;
      const viewport = target.closest<HTMLElement>(".bsb-mermaid-viewport");
      if (!viewport || !e.ctrlKey) return;
      const card = viewport.closest<HTMLElement>(".bsb-mermaid-card");
      if (!card) return;
      e.preventDefault();
      setMermaidScale(card, getMermaidScale(card) + (e.deltaY < 0 ? 0.12 : -0.12));
    }, { passive: false });
    root.addEventListener("keydown", (e) => {
      const target = e.target instanceof Element ? e.target :
        e.target instanceof Text ? e.target.parentElement : null;
      if (!target) return;
      const input = target.closest<HTMLInputElement | HTMLTextAreaElement>('[data-role="knowledge-question"]');
      if (!input || e.key !== "Enter" || !(e.ctrlKey || e.metaKey)) return;
      e.preventDefault();
      const q = String(input.value || "").trim();
      if (q) knowledgeAsk(state.knowledgeActiveAnchorId, state.knowledgeActiveNodeId || null, q).catch((error) => setStatus(`Knowledge 追问失败：${errorMessage(error)}`, "err"));
    });
    window.addEventListener("keydown", (e) => {
      if (e.key !== "Escape") return;
      hideKnowledgeSelectionToolbar();
      if (state.knowledgeRailOpen) { closeKnowledgeRail(); return; }
      if (state.aiDrawer) { setAiDrawer(""); return; }
      const hadMermaidModal = !!root.querySelector<MermaidElement>(".bsb-mermaid-modal");
      if (hadMermaidModal) {
        closeMermaidFullscreen();
        return;
      }
      if (state.aiFocus) {
        state.aiFocus = false;
        applyPanelGeometry();
        setStatus("已退出专注阅读");
      }
    });

    root.querySelectorAll<HTMLButtonElement>("button[data-act]").forEach((btn) => {
      const act = btn.getAttribute("data-act");
      if (act === "dock" || act === "collapse") return;
      btn.addEventListener("click", () => onAction(act));
    });

    fillPromptConfigForm(root);
    setPromptStageTab(state.ui?.promptStage || "preprocess", { silent: true, preserveEditor: true });
    fillAiConfigForm(root);
    renderShortcutSettings(root);
    refreshShortcutHints();
    loadPostTasks();
    renderAiFlowDrawer();
    renderAiInputDrawer();
    refreshPreprocessModelSelector(root);
    setSettingsTab(state.ui?.settingsTab || "prompt", { silent: true });
    const captureDrawer = root.querySelector<HTMLElement>('[data-role="capture-drawer"]');
    if (captureDrawer) captureDrawer.hidden = !state.captureDrawerOpen;
    renderAiResultTabs();
    setAiWorkbenchStage(state.ui?.aiStage || "preprocess", { silent: true }).catch(() => {});
    bindAiScrollBehavior(root);
    setWorkspace((state.ui && state.ui.view) || "ai", { silent: true });
    refreshAiChips();
    return root;
  }

  function setWorkspace(view: string, opts: { silent?: boolean } = {}) {
    const v = ["ai", "subs", "knowledge", "settings"].includes(view) ? view : "ai";
    const root = ensurePanel();
    if (state.ui) state.ui.view = v;
    root.dataset.panelView = v;
    applyKnowledgeLayoutVars(root);
    const workspaceTitle = root.querySelector<HTMLElement>('[data-role="workspace-title"]');
    if (workspaceTitle) workspaceTitle.textContent = v === "subs" ? "字幕库" : v === "knowledge" ? "知识库" : v === "settings" ? "设置" : "AI 工作台";
    root.querySelectorAll<HTMLElement>(".bsb-nav [data-view]").forEach((b) => {
      b.classList.toggle("active", b.getAttribute("data-view") === v);
    });
    root.querySelectorAll<HTMLElement>("[data-view-panel]").forEach((p) => {
      p.classList.toggle("active", p.getAttribute("data-view-panel") === v);
    });
    if (v === "ai") setAiWorkbenchStage(state.ui?.aiStage || "preprocess", { silent: true }).catch(() => {});
    if (v === "knowledge") renderKnowledgeWorkspace().catch((error) => setStatus(`知识库加载失败: ${errorMessage(error)}`, "err"));
    if (!opts?.silent) {
      saveUiGeom();
      if (v === "ai") refreshAiChips();
      if (v === "subs") {
        renderTranscriptPanel();
        bindTranscriptVideoEvents();
      }
      if (v === "settings") {
        setPromptStageTab(state.ui?.promptStage || "preprocess", { silent: true, preserveEditor: true });
        fillPromptConfigForm(root);
        fillAiConfigForm(root);
        setSettingsTab(state.ui?.settingsTab || "prompt", { silent: true });
      }
    }
  }

  function setSettingsTab(tab: string, opts: { silent?: boolean } = {}) {
    const root = ensurePanel();
    const next = ["prompt", "llm", "shortcuts", "appearance"].includes(tab) ? tab : "prompt";
    if (next !== "shortcuts" && state.shortcutRecordingId) state.shortcutRecordingId = "";
    if (state.ui) state.ui.settingsTab = next;
    root.querySelectorAll<HTMLElement>("[data-settings-tab]").forEach((button) => {
      const active = button.dataset.settingsTab === next;
      button.classList.toggle("active", active);
      button.setAttribute("aria-selected", active ? "true" : "false");
    });
    root.querySelectorAll<HTMLElement>("[data-settings-pane]").forEach((pane) => {
      pane.classList.toggle("active", pane.dataset.settingsPane === next);
    });
    if (next === "shortcuts") renderShortcutSettings(root);
    if (next === "appearance") renderAppearanceSettings(root);
    if (!opts?.silent) saveUiGeom();
  }

  function mermaidThemeVariablesForFlavor(flavor = state.ui?.ctpFlavor) {
    const id = normalizeCtpFlavor(flavor);
    const t = getCtpPalette(id);
    return {
      darkMode: id !== "latte",
      background: t.mantle,
      primaryColor: t.surface0,
      primaryTextColor: t.rosewater,
      primaryBorderColor: t.blue,
      secondaryColor: t.surface1,
      secondaryTextColor: t.text,
      secondaryBorderColor: t.green,
      tertiaryColor: t.base,
      tertiaryTextColor: t.text,
      tertiaryBorderColor: t.mauve,
      lineColor: t.subtext1,
      textColor: t.text,
      mainBkg: t.surface0,
      nodeBorder: t.blue,
      clusterBkg: t.base,
      clusterBorder: t.surface2,
      edgeLabelBackground: t.mantle,
      actorBkg: t.surface0,
      actorBorder: t.blue,
      actorTextColor: t.rosewater,
      signalColor: t.subtext1,
      signalTextColor: t.text,
      labelBoxBkgColor: t.surface0,
      labelBoxBorderColor: t.blue,
      labelTextColor: t.rosewater,
      loopTextColor: t.text,
      noteBkgColor: t.surface1,
      noteBorderColor: t.yellow,
      noteTextColor: t.rosewater,
      fontSize: "16px",
    };
  }

  function mermaidThemeCssForFlavor(flavor = state.ui?.ctpFlavor) {
    const t = getCtpPalette(flavor);
    return `
          .nodeLabel, .edgeLabel, .label, text { font-size: 16px !important; }
          .edgeLabel rect { fill: ${t.mantle} !important; opacity: .96 !important; }
          .flowchart-link { stroke-width: 2px !important; }
          .marker { fill: ${t.subtext1} !important; stroke: ${t.subtext1} !important; }
          .cluster rect { rx: 10px; ry: 10px; }
        `;
  }

  function refreshMermaidTheme() {
    if (typeof mermaid === "undefined" || !state.renderLibs?.mermaid) return;
    try {
      mermaid.initialize({
        startOnLoad: false,
        theme: "base",
        securityLevel: "strict",
        fontFamily: 'Inter, "PingFang SC", "Microsoft YaHei", system-ui, sans-serif',
        suppressErrorRendering: true,
        deterministicIds: false,
        themeVariables: mermaidThemeVariablesForFlavor(),
        themeCSS: mermaidThemeCssForFlavor(),
      });
    } catch (error) {
      console.warn("[bili-subbatch] mermaid theme refresh", error);
    }
  }

  function applyCtpFlavor(flavor: unknown, { silent = false, persist = true } = {}) {
    const next = normalizeCtpFlavor(flavor);
    if (state.ui) state.ui.ctpFlavor = next;
    const root = document.getElementById(PANEL_ID) || ensurePanel();
    root.setAttribute("data-ctp-flavor", next);
    root.style.colorScheme = next === "latte" ? "light" : "dark";
    refreshMermaidTheme();
    if (persist) saveUiGeom();
    if (document.getElementById(PANEL_ID)?.querySelector<HTMLElement>('[data-settings-pane="appearance"].active')) {
      renderAppearanceSettings(root);
    }
    if (!silent) {
      const meta = CTP_FLAVORS.find((f) => f.id === next);
      setStatus(`主题已切换：Catppuccin ${meta?.label || next}${next === DEFAULT_CTP_FLAVOR ? "（默认）" : ""}`, "ok");
    }
    return next;
  }

  function renderAppearanceSettings(root: HTMLElement) {
    const host = root?.querySelector?.('[data-role="appearance-settings"]');
    if (!host) return;
    const current = normalizeCtpFlavor(state.ui?.ctpFlavor || DEFAULT_CTP_FLAVOR);
    host.innerHTML = toTrustedHTML(`
      <div class="bsb-appearance-head">
        <strong>Catppuccin 主题</strong>
        <span>在 Latte / Frappé / Macchiato / Mocha 间切换。默认 Mocha，选择会保存在本机。</span>
      </div>
      <div class="bsb-theme-grid" role="listbox" aria-label="Catppuccin 风格">
        ${CTP_FLAVORS.map((flavor) => {
          const p = getCtpPalette(flavor.id);
          const selected = flavor.id === current;
          return `<button type="button" class="bsb-theme-card${selected ? " selected" : ""}" data-ctp-flavor-pick="${escapeAttr(flavor.id)}" role="option" aria-selected="${selected ? "true" : "false"}" title="切换到 ${escapeAttr(flavor.label)}">
            <span class="bsb-theme-preview" style="--p0:${p.base};--p1:${p.mantle};--p2:${p.surface0};--a0:${p.lavender};--a1:${p.mauve};--a2:${p.green};--tx:${p.text}">
              <i></i><i></i><i></i>
            </span>
            <span class="bsb-theme-meta">
              <strong>${flavor.emoji} ${escapeHtml(flavor.label)}</strong>
              <small>${escapeHtml(flavor.hint)}${flavor.id === DEFAULT_CTP_FLAVOR ? " · 默认" : ""}</small>
            </span>
          </button>`;
        }).join("")}
      </div>
    `);
  }

  function panelIsVisiblyOpen() {
    return !!(state.open && state.ui && (!state.ui.dock || state.ui.dockExpanded));
  }

  function applyShortcutSummonLayout(layout = state.shortcutConfig?.summonLayout || "remember") {
    const root = ensurePanel();
    const mode = ["remember", "floating", "right", "left"].includes(layout) ? layout : "remember";
    if (mode === "floating") {
      root._bsbSetDock?.(null);
      root._bsbSetOpen?.(true);
      return;
    }
    if (mode === "right" || mode === "left") {
      root._bsbSetDock?.(mode);
      root._bsbSetOpen?.(true);
      return;
    }
    root._bsbSetOpen?.(true);
  }

  async function openShortcutTarget(target = "remember") {
    const next = ["remember", "processed", "postprocess"].includes(target) ? target : "remember";
    if (next === "remember") return;
    setWorkspace("ai");
    if (next === "processed") {
      state.aiInputView = "processed";
      await setAiWorkbenchStage("preprocess");
      setStatus("快捷打开：AI 处理字幕", "ok");
      return;
    }
    await setAiWorkbenchStage("postprocess");
    setStatus("快捷打开：后处理结果", "ok");
  }

  async function executeShortcutCommand(commandId: string) {
    const root = ensurePanel();
    const config = state.shortcutConfig || loadShortcutSettings();
    if (commandId === "toggle-panel") {
      if (panelIsVisiblyOpen()) {
        if (state.ui?.dock) root._bsbToggleDockExpanded?.(false);
        else root._bsbSetOpen?.(false);
        return;
      }
      applyShortcutSummonLayout(config.summonLayout);
      await openShortcutTarget(config.summonTarget);
      return;
    }
    if (commandId === "open-processed") {
      applyShortcutSummonLayout(config.summonLayout);
      await openShortcutTarget("processed");
      return;
    }
    if (commandId === "open-postprocess") {
      applyShortcutSummonLayout(config.summonLayout);
      await openShortcutTarget("postprocess");
      return;
    }
    if (commandId === "toggle-dock") {
      if (state.ui?.dock) {
        root._bsbSetDock?.(null);
        root._bsbSetOpen?.(true);
        setStatus("快捷切换：悬浮模式", "ok");
      } else {
        const side = config.preferredDock === "left" ? "left" : "right";
        root._bsbSetDock?.(side);
        root._bsbSetOpen?.(true);
        setStatus(`快捷切换：${side === "right" ? "右" : "左"}侧靠边`, "ok");
      }
    }
  }

  let shortcutKeyHandlerBound = false;
  function bindGlobalShortcuts() {
    if (shortcutKeyHandlerBound) return;
    shortcutKeyHandlerBound = true;
    document.addEventListener("keydown", (event) => {
      if (state.shortcutRecordingId) {
        event.preventDefault();
        event.stopImmediatePropagation();
        const commandId = state.shortcutRecordingId;
        if (event.key === "Escape") {
          state.shortcutRecordingId = "";
          renderShortcutSettings();
          setStatus("已取消快捷键录制");
          return;
        }
        if ((event.key === "Backspace" || event.key === "Delete") && !event.ctrlKey && !event.altKey && !event.metaKey && !event.shiftKey) {
          state.shortcutConfig.bindings[commandId] = "";
          state.shortcutRecordingId = "";
          saveShortcutSettings();
          renderShortcutSettings();
          setStatus("已清除快捷键", "ok");
          return;
        }
        if (event.getModifierState?.("AltGraph")) {
          setStatus("AltGr 属于输入法修饰键，请换一个组合", "err");
          return;
        }
        const chord = shortcutChordFromEvent(event);
        if (!chord) return;
        if (!shortcutHasStrongModifier(chord)) {
          setStatus("为避免和 Bilibili 播放器冲突，请至少使用 Ctrl / Alt / Meta 之一", "err");
          return;
        }
        const conflict = shortcutConflictInfo(chord, commandId);
        if (conflict.level === "error") {
          setStatus(`快捷键冲突：${conflict.text}`, "err");
          return;
        }
        state.shortcutConfig.bindings[commandId] = chord;
        state.shortcutRecordingId = "";
        saveShortcutSettings();
        renderShortcutSettings();
        setStatus(conflict.level === "warn" ? `已绑定 ${shortcutDisplayChord(chord)} · ${conflict.text}` : `已绑定 ${shortcutDisplayChord(chord)}`, conflict.level === "warn" ? "" : "ok");
        return;
      }

      const config = state.shortcutConfig || loadShortcutSettings();
      if (!config.enabled || event.repeat || event.isComposing || event.getModifierState?.("AltGraph")) return;
      if (shortcutEditableTarget(event.target)) return;
      const chord = shortcutChordFromEvent(event);
      if (!chord) return;
      const command = SHORTCUT_COMMANDS.find((item) => config.bindings?.[item.id] && config.bindings[item.id] === chord);
      if (!command) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      Promise.resolve(executeShortcutCommand(command.id)).catch((error) => setStatus(`快捷键执行失败：${errorMessage(error)}`, "err"));
    }, true);
  }

  function setPromptStageTab(stage: string, opts: { silent?: boolean; preserveEditor?: boolean } = {}) {
    const root = ensurePanel();
    const next = stage === "postprocess" ? "postprocess" : stage === "knowledge" ? "knowledge" : "preprocess";
    if (state.ui) state.ui.promptStage = next;
    if (!opts?.preserveEditor) {
      const prompts = state.promptProfiles?.length ? state.promptProfiles : loadPromptProfiles().prompts;
      const preferredId = next === "preprocess" ? state.activePrePromptId : next === "knowledge" ? state.activeKnowledgePromptId : state.activePromptId;
      state.promptEditorId = prompts.find((p: { stage: string; id: string; }) => p.stage === next && p.id === preferredId)?.id
        || prompts.find((p: { stage: string; }) => p.stage === next)?.id || "";
      state.promptSearch = "";
    }
    root.querySelectorAll<HTMLElement>("[data-prompt-stage-tab]").forEach((button) => {
      const active = button.dataset.promptStageTab === next;
      button.classList.toggle("active", active);
      button.setAttribute("aria-selected", active ? "true" : "false");
    });
    root.querySelectorAll<HTMLElement>("[data-prompt-create-stage]").forEach((button) => {
      button.hidden = button.dataset.promptCreateStage !== next;
    });
    const search = root.querySelector<HTMLInputElement>('[data-role="prompt-search"]');
    if (search) {
      search.placeholder = next === "preprocess" ? "搜索预处理 Prompt…" : next === "knowledge" ? "搜索 Knowledge Prompt…" : "搜索后处理 Prompt…";
      if (search.value !== state.promptSearch) search.value = state.promptSearch;
    }
    const context = root.querySelector<HTMLElement>('[data-role="prompt-stage-context"]');
    if (context) {
      context.innerHTML = toTrustedHTML(next === "preprocess"
        ? '<span>预处理 · 原始字幕 → 规范化简体中文字幕稿</span><span>PRE</span>'
        : next === "knowledge"
          ? '<span>Knowledge · 字幕锚点 → 独立追问树</span><span>DRILL</span>'
          : '<span>后处理 · 规范化字幕稿 → Mermaid / 笔记 / 自测等产物</span><span>POST</span>');
    }
    fillPromptConfigForm(root);
    if (!opts?.silent) saveUiGeom();
  }

  function refreshAiChips() {
    const root = document.getElementById(PANEL_ID);
    if (!root) return;
    const sel = state.items.filter((it) => it.selected).length;
    const ok = state.items.filter((it) => it.selected && it.subStatus === "ok").length;
    const elSel = root.querySelector<HTMLElement>('[data-role="chip-sel"]');
    const elOk = root.querySelector<HTMLElement>('[data-role="chip-ok"]');
    const elModel = root.querySelector<HTMLElement>('[data-role="chip-model"]');
    if (elSel) elSel.textContent = String(sel);
    if (elOk) elOk.textContent = String(ok);
    if (elModel) {
      const tasks = currentPostTasks().filter((t) => t.enabled !== false);
      const runCount = tasks.reduce((n, t) => n + (t.modelIds || []).length, 0);
      elModel.textContent = `${tasks.length} 产物 · ${runCount} runs`;
    }
    const inputLabel = root.querySelector<HTMLElement>('[data-role="ai-input-label"]');
    if (inputLabel) {
      const ready = !!state.aiSessionInput;
      const mode = state.preprocessEnabled ? (state.aiSessionInput?.vars?.processedSubtitle ? "已规范化" : "预处理开启") : "原始字幕";
      inputLabel.textContent = `输入 · ${sel} 视频 · ${ready ? mode : "待运行"}`;
    }
    const flowSummary = root.querySelector<HTMLElement>('[data-role="flow-summary"]');
    if (flowSummary) {
      const tasks = currentPostTasks().filter((t) => t.enabled !== false);
      const runs = tasks.reduce((n, t) => n + (t.modelIds || []).length, 0);
      flowSummary.textContent = `${tasks.length} 个产物 · ${runs} 个版本`;
    }
    renderAiResultTabs();
    applyAiWorkbenchStageUi();
    if (currentAiWorkbenchStage() === "preprocess") {
      const status = root.querySelector<HTMLElement>('[data-role="ai-preprocess-status"]');
      if (status) {
        const raw = currentInputPreviewText("raw");
        const processed = currentInputPreviewText("processed");
        status.textContent = !raw ? "当前视频暂无字幕" : processed ? "AI 字幕已就绪" : state.preprocessEnabled ? "原始字幕已就绪" : "预处理已关闭";
      }
    }
  }

  function setStatus(text: string|null, cls?: string) {
    const el = document.querySelector(`#${PANEL_ID} [data-role="status"]`);
    if (!el) return;
    el.textContent = text;
    el.classList.remove("ok", "err");
    if (cls) el.classList.add(cls);
    const dot = document.querySelector(`#${PANEL_ID} [data-role="status-dot"]`);
    if (dot) {
      dot.classList.remove("ok", "err", "busy");
      if (cls === "ok") dot.classList.add("ok");
      else if (cls === "err") dot.classList.add("err");
      else if (state.busy || state.aiBusy) dot.classList.add("busy");
    }
    const meta = document.querySelector(`#${PANEL_ID} [data-role="ai-canvas-meta"]`);
    if (meta && (state.ui?.view === "ai" || !state.ui)) {
      meta.textContent = (text || "").slice(0, 48);
    }
  }

  /**
   * 不再用一个布尔值禁用整个工具栏。
   * 主入口（扫描、全选、全不选、送去 AI）始终可点击；冲突操作由各自函数排队、重启或提示。
   */
  function operationBusy() {
    return !!(state.scanBusy || state.batchBusy);
  }

  function refreshActionDisabledState() {
    const root = document.getElementById(PANEL_ID);
    if (!root) return;

    const mainActions = new Set([
      "scan", "sel-all", "sel-none", "ai-send",
      "cancel", "ai-stop", "dock", "collapse",
      "job-pause", "job-stop",
    ]);
    const batchActions = new Set(["copy", "copy-bvid", "dl-srt", "dl-txt", "dl-ok-only", "fetch-selected"]);

    root.querySelectorAll<HTMLButtonElement>("button[data-act]").forEach((button) => {
      const act = button.getAttribute("data-act") || "";
      if (act === "cancel") {
        button.style.display = operationBusy() ? "" : "none";
        button.disabled = false;
        return;
      }
      if (act === "job-pause" || act === "job-stop") {
        button.disabled = !operationBusy();
        return;
      }
      if (mainActions.has(act)) {
        button.disabled = false;
        return;
      }

      // 只有会读取/改写同一字幕列表的批处理按钮在操作期间临时锁定。
      // 不再把设置、阅读、字幕搜索、模型结果等无关控件一起变灰。
      button.disabled = batchActions.has(act) && operationBusy();
    });
  }

  function syncOperationBusy() {
    state.busy = operationBusy();
    refreshActionDisabledState();
  }

  function setScanBusy(busy: boolean) {
    appCall("libraryJob.setBusy", state, "scan", busy);
    syncOperationBusy();
    updateLibraryJobBar();
  }
  function setBatchBusy(busy: boolean) {
    appCall("libraryJob.setBusy", state, "fetch", busy);
    syncOperationBusy();
    updateLibraryJobBar();
  }
  function setLibraryJob(patch = {}) {
    appCall("libraryJob.setProgress", state, patch);
    updateLibraryJobBar();
  }
  function clearLibraryJob() {
    appCall("libraryJob.clearProgress", state);
    updateLibraryJobBar();
  }
  function updateLibraryJobBar() {
    const root = document.getElementById(PANEL_ID);
    const bar = root?.querySelector<HTMLElement>('[data-role="library-jobbar"]');
    if (!bar) return;
    const job = appCall("libraryJob.view", state);
    bar.hidden = !job.busy;
    bar.classList.toggle("is-on", job.busy);
    bar.classList.toggle("is-paused", job.busy && job.paused);
    const title = bar.querySelector<HTMLElement>('[data-role="job-title"]');
    const meta = bar.querySelector<HTMLElement>('[data-role="job-meta"]');
    const meter = bar.querySelector<HTMLElement>('[data-role="job-meter"]');
    const pauseBtn = bar.querySelector<HTMLElement>('[data-act="job-pause"]');
    if (title) title.textContent = job.title;
    if (meta) meta.textContent = job.meta;
    if (meter) meter.style.width = String(job.percent) + "%";
    if (pauseBtn) {
      pauseBtn.textContent = job.pauseLabel;
      pauseBtn.setAttribute("aria-pressed", job.paused ? "true" : "false");
      pauseBtn.title = job.pauseTitle;
    }
  }
  async function waitIfJobPaused() {
    if (!appCall("libraryJob.isPaused", state)) return;
    updateLibraryJobBar();
    await appCall("libraryJob.waitWhilePaused", state, sleep);
  }
  function toggleLibraryJobPause() {
    const result = appCall("libraryJob.togglePause", state);
    setStatus(result.text, result.css);
    if (result.changed) updateLibraryJobBar();
  }
  function stopLibraryJob() {
    appCall("libraryJob.stop", state);
    setStatus("正在停止扫描/字幕任务…已完成的条目会保留");
    updateLibraryJobBar();
  }

  // 兼容旧调用；新代码不再使用全局 setBusy。

  function flushPendingMainAction() {
    if (operationBusy()) return;
    if (state.pendingRescan) {
      state.pendingRescan = false;
      window.setTimeout(() => doScan(), 0);
      return;
    }
    if (state.pendingAiSend) {
      state.pendingAiSend = false;
      window.setTimeout(() => doAiAnalyze(), 0);
    }
  }

  function stopAiBatchForRestart() {
    if (!state.aiBusy) return;
    // 先使旧 doAiAnalyze 的 finally 失效，避免它稍后清理新会话。
    state.aiSessionSeq += 1;
    state.aiAbort = true;
    abortAllAiRuns();
    state.aiRunOrder.forEach((id) => {
      const run = state.aiRuns.get(id);
      if (!run || !run.busy) return;
      run.busy = false;
      run.status = "stopped";
      run.statusText = "已停止 · 准备重新分析";
      run.finishedAt = Date.now();
    });
    setAiBusy(false);
    state.aiAbort = false;
  }

  function refreshContextUI() {
    const root = ensurePanel();
    const modeSel = root.querySelector<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>('[data-role="mode"]');
    if (modeSel) {
      // 下拉为源：用户手动选择会保留；非法值回退 state.mode
      if (MODE_OPTIONS.includes(modeSel.value)) state.mode = modeSel.value;
      else modeSel.value = state.mode || "auto";
    }

    const auto = detectContext(location.href);
    state.autoCtx = auto;
    const ctx = resolveContext();
    state.ctx = ctx;

    const badge = root.querySelector<HTMLElement>('[data-role="type"]');
    if (badge) badge.textContent =
      (ctx.source === "manual" ? "手动 · " : "自动 · ") +
      (TYPE_LABEL[ctx.type] || ctx.type);
    badge?.classList.toggle("manual", ctx.source === "manual");

    const contextLabel = root.querySelector<HTMLElement>('[data-role="ctx"]');
    if (contextLabel) contextLabel.textContent = formatCtxBits(ctx);

    const hint = root.querySelector<HTMLElement>('[data-role="auto-hint"]');
    if (hint) {
      const autoLabel = TYPE_LABEL[auto.type] || auto.type;
      if (state.mode === "auto") {
        hint.innerHTML = toTrustedHTML(`识别：<strong>${escapeHtml(autoLabel)}</strong>`);
      } else {
        hint.innerHTML = toTrustedHTML(`自动本会是：<strong>${escapeHtml(autoLabel)}</strong>（已手动覆盖）`);
      }
    }
  }

  function renderLibraryCounts(root: HTMLElement) {
    const counts = { all: state.items.length, ok: 0, wait: 0, error: 0, empty: 0 };
    state.items.forEach((item) => { counts[SubBatch.SubBatchMonorepo.ui.libraryController.status(item)] += 1; });
    Object.entries(counts).forEach(([key, value]) => {
      const el = root.querySelector(`[data-library-count="${key}"]`);
      if (el) el.textContent = String(value);
    });
    root.querySelectorAll<HTMLElement>("[data-library-filter]").forEach((button) => {
      button.classList.toggle("active", button.dataset.libraryFilter === state.libraryFilter);
    });
    return counts;
  }

  function libraryItemRowHtml(it: LibraryGroupItem|null|undefined, i: number, { child = false, depth = 0 } = {}): string {
    if (!it) return "";
    const status = SubBatch.SubBatchMonorepo.ui.libraryController.status(it);
    const stClass = status === "ok" ? "st-ok" : status === "empty" ? "st-empty" : status === "error" ? "st-err" : "st-wait";
    const active = routeVideoKey(it.bvid, Number(it.page) || 1) === state.transcriptItemKey;
    const page = Math.max(1, Number(it.page) || 1);
    const displayTitle = it.groupType === "selection" || it.groupType === "collection"
      ? (it.groupType === "selection"
        ? (it.part ? `P${page}${it.part}` : `P${page}`)
        : (it.title || it.bvid || "未命名视频"))
      : (it.title || it.bvid || "未命名视频");
    const bvPart = `${escapeHtml(it.bvid || "")}${page > 1 ? ` · P${page}` : ""}`;
    const author = escapeHtml(it.author || "");
    const source = Array.isArray(it.sources) && it.sources.length ? escapeHtml(it.sources[it.sources.length - 1]) : "";
    const secondary = [author, bvPart, source].filter(Boolean).join(" · ");
    const depthClass = depth >= 2 ? " child child-2" : child || depth > 0 ? " child" : "";
    return `<div class="bsb-resource-item${depthClass}${active ? " active" : ""}" data-transcript-i="${i}" title="${escapeAttr(it.title || it.bvid || "")}">
        <input type="checkbox" data-i="${i}" ${it.selected ? "checked" : ""} aria-label="选择 ${escapeAttr(displayTitle)}">
        <div class="bsb-resource-main">
          <div class="bsb-resource-title">${escapeHtml(displayTitle)}</div>
          <div class="bsb-resource-meta"><span>${secondary}</span><span class="bsb-resource-status ${stClass}">${SubBatch.SubBatchMonorepo.ui.libraryController.statusLabel(it)}</span></div>
        </div>
      </div>`;
  }

  function libraryFolderKindLabel(groupType: string, groupKey: string) {
    if (String(groupKey || "").startsWith("space-videos:")) return "视频";
    if (groupType === "collection") return "合集";
    if (groupType === "selection") return "视频选集";
    if (groupType === "space") return "个人主页";
    if (groupType === "single") return "视频";
    return "文件夹";
  }

  /** Recursive folder/item HTML (supports 个人主页 UP → 选集/合集 nesting). */
  function libraryRenderNodeHtml(node: LibraryRenderNode, depth = 0): string {
    if (node.type === "item") {
      return libraryItemRowHtml(node.entry.item, node.entry.index, {
        child: depth > 0,
        depth,
      });
    }
    const kindLabel = libraryFolderKindLabel(node.groupType, node.groupKey);
    const checked = node.checkState === "all" ? "checked" : "";
    const partial = node.checkState === "partial" ? "1" : "0";
    const chevron = node.collapsed ? "▶" : "▼";
    const depthClass = depth >= 2 ? " child child-2" : depth > 0 ? " child" : "";
    const chunks = [];
    chunks.push(`<div class="bsb-resource-folder${depthClass}" data-group-key="${escapeAttr(node.groupKey)}">
        <button type="button" class="bsb-folder-toggle" data-folder-toggle="${escapeAttr(node.groupKey)}" aria-label="${node.collapsed ? "展开" : "收起"} ${escapeAttr(node.folderLabel)}">${chevron}</button>
        <input type="checkbox" data-group-check="${escapeAttr(node.groupKey)}" data-partial="${partial}" ${checked} aria-label="选择文件夹 ${escapeAttr(node.folderLabel)}">
        <div class="bsb-resource-main">
          <div class="bsb-resource-title">📁 ${escapeHtml(node.folderLabel)}</div>
          <div class="bsb-resource-meta"><span>${kindLabel} · ${node.selectedCount}/${node.total} 已选</span><span>${node.total} 项</span></div>
        </div>
      </div>`);
    if (!node.collapsed) {
      if (Array.isArray(node.nodes) && node.nodes.length) {
        for (const nested of node.nodes) {
          chunks.push(libraryRenderNodeHtml(nested, depth + 1));
        }
      } else {
        for (const child of node.children || []) {
          chunks.push(libraryItemRowHtml(child.item, child.index, {
            child: true,
            depth: depth + 1,
          }));
        }
      }
    }
    return chunks.join("");
  }

  function renderList({ renderTranscript = true } = {}) {
    const root = document.getElementById(PANEL_ID);
    const box = root?.querySelector<HTMLElement>('[data-role="list"]');
    if (!box || !root) return;
    renderLibraryCounts(root);
    const entries = SubBatch.SubBatchMonorepo.ui.libraryController.filteredEntries(state.items, state.libraryQuery, state.libraryFilter);
    const visible = root.querySelector<HTMLElement>('[data-role="library-visible-count"]');
    if (visible) visible.textContent = `${entries.length} / ${state.items.length}`;

    if (!state.items.length) {
      box.innerHTML = toTrustedHTML(`<div class="bsb-empty"><div class="bsb-empty-ico">≡</div><strong>字幕库为空</strong><span>点击「＋ 采集视频」，或直接打开一个视频自动加入。</span></div>`);
      if (renderTranscript) renderTranscriptPanel();
      refreshAiChips();
      return;
    }
    if (!entries.length) {
      box.innerHTML = toTrustedHTML(`<div class="bsb-empty"><strong>没有匹配项</strong><span>调整搜索词或字幕状态筛选。</span></div>`);
      if (renderTranscript) renderTranscriptPanel();
      refreshAiChips();
      return;
    }

    if (!state.libraryFolderCollapsed || typeof state.libraryFolderCollapsed !== "object") {
      state.libraryFolderCollapsed = {};
    }
    let nodes: LibraryRenderNode[] = [];
    try {
      nodes = buildLibraryRenderNodes(entries, state.libraryFolderCollapsed);
    } catch (error) {
      console.warn("[bili-subbatch] library render fallback", error);
    }
    if (!Array.isArray(nodes) || !nodes.length) {
      nodes = entries.map((entry) => ({ type: "item", entry, depth: 0 }));
    }
    box.innerHTML = toTrustedHTML(nodes.map((node) => libraryRenderNodeHtml(node, node.depth || 0)).join(""));
    // 部分选中：父级勾选消失（不显示半选），与「全选才勾上」一致。
    box.querySelectorAll<HTMLInputElement>('input[data-group-check][data-partial="1"]').forEach((el) => {
      el.checked = false;
      el.indeterminate = false;
    });
    refreshAiChips();
    if (renderTranscript) renderTranscriptPanel();
  }

  function waitForPlayerElement(selector: string, timeout = 8000) {
    return new Promise<HTMLElement>((resolve, reject) => {
      const existing = document.querySelector<HTMLElement>(selector);
      if (existing) return resolve(existing);
      const observer = new MutationObserver(() => {
        const element = document.querySelector<HTMLElement>(selector);
        if (!element) return;
        observer.disconnect();
        clearTimeout(timer);
        resolve(element);
      });
      const timer = window.setTimeout(() => {
        observer.disconnect();
        reject(new Error(`等待播放器元素超时: ${selector}`));
      }, timeout);
      observer.observe(document.documentElement, { childList: true, subtree: true });
    });
  }

  async function enablePlayerSubtitle(item: WorkbenchLibraryItem|null) {
    if (isYoutubePage()) return;
    if (!state.autoEnablePlayerSubtitle) return;
    if (state.playerSubtitleOperation) return state.playerSubtitleOperation;
    state.playerSubtitleOperation = (async () => {
      const button = await waitForPlayerElement(PLAYER_SUBTITLE_SELECTORS.button, 9000);
      let panel = document.querySelector<HTMLElement>(PLAYER_SUBTITLE_SELECTORS.panel);
      if (!panel || panel.offsetParent === null) {
        button.click();
        panel = await waitForPlayerElement(PLAYER_SUBTITLE_SELECTORS.panel, 2500);
        await sleep(100);
      }
      const items = Array.from(panel.querySelectorAll<HTMLElement>(PLAYER_SUBTITLE_SELECTORS.item));
      const activeLang = items.find((node) => node.classList.contains("bpx-state-active"));
      const closeOn = panel.querySelector(`${PLAYER_SUBTITLE_SELECTORS.close}.bpx-state-active`);
      if (!activeLang || closeOn) {
        if (!items.length) throw new Error("播放器没有可开启字幕");
        const wanted = String(item?.lan || item?.preferred_language || "");
        const target = (wanted && items.find((node) => node.dataset.lan === wanted))
          || items.find((node) => /^(ai-zh|zh-CN|zh-Hans|zh)$/i.test(node.dataset.lan || ""))
          || items.find((node) => /中文/.test(node.textContent || ""))
          || items[0];
        target?.click();
        await sleep(140);
      }
      if (panel.offsetParent !== null) button.click();
    })().catch((error) => {
      console.debug("[bili-subbatch] player subtitle not enabled", errorMessage(error));
    }).finally(() => {
      state.playerSubtitleOperation = null;
    });
    return state.playerSubtitleOperation;
  }

  function currentTranscriptItem() {
    if (state.transcriptItemKey) {
      const exact = state.items.find(
        (item) => routeVideoKey(item.bvid, item.page || 1) === state.transcriptItemKey,
      );
      // 列表中的同一视频已有完整字幕时，以列表对象为准并同步独立引用。
      if (exact?.subStatus === "ok" && exact.data?.length) {
        state.transcriptItem = exact;
        return exact;
      }
      // 兼容独立字幕引用：即使当前条目暂时不在可见筛选结果中也继续显示。
      if (
        state.transcriptItem &&
        routeVideoKey(state.transcriptItem.bvid, state.transcriptItem.page || 1) ===
          state.transcriptItemKey
      ) {
        return state.transcriptItem;
      }
      return exact || null;
    }
    const first = state.items.find((item) => item.subStatus === "ok" && item.data?.length) || null;
    if (first) state.transcriptItem = first;
    return first;
  }

  function rememberTranscriptItem(item: WorkbenchLibraryItem) {
    if (!item) return null;
    state.transcriptItem = item;
    state.transcriptItemKey = routeVideoKey(item.bvid, item.page || 1);
    return item;
  }

  function selectTranscriptItem(item: WorkbenchLibraryItem, { focusSearch = false } = {}) {
    if (!item) return;
    rememberTranscriptItem(item);
    state.transcriptQuery = "";
    state.transcriptFilteredIndexes = null;
    state.transcriptActiveCueIndex = -1;
    const root = ensurePanel();
    const input = root.querySelector<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>('[data-role="transcript-search"]');
    if (input) input.value = "";
    renderList();
    bindTranscriptVideoEvents();
    updateTranscriptActiveCue(currentVideoTime(), true);
    if (focusSearch) {
      setWorkspace("subs");
      input?.focus();
    }
  }

  function renderTranscriptPanel() {
    const root = document.getElementById(PANEL_ID);
    if (!root) return;
    const rendered = SubBatch.SubBatchMonorepo.ui.transcriptController.renderPanel(
      root, currentTranscriptItem(), state, {
        routeKey: routeVideoKey,
        preferredTrack: (tracks) => bilibiliCall("subtitle.preferredIndex", tracks.map(track => ({ ...track }))),
        parseSeconds: (value) => coreCall("parseSeconds", value),
      },
    );
    if (rendered) updateTranscriptActiveCue(currentVideoTime(), true);
  }

  function currentVideoTime() {
    return Number(document.querySelector("video")?.currentTime || 0);
  }

  function updateTranscriptActiveCue(time: number, force = false) {
    SubBatch.SubBatchMonorepo.ui.transcriptController.updateActiveCue(
      document.getElementById(PANEL_ID), currentTranscriptItem()?.data || [], state, time, force, {
        parseSeconds: (value) => coreCall("parseSeconds", value),
        now: Date.now,
        reducedMotion: () => matchMedia("(prefers-reduced-motion: reduce)").matches,
      },
    );
  }

  function bindTranscriptVideoEvents() {
    state.transcriptVideoAbort?.abort();
    const video = document.querySelector("video");
    if (!video) return;
    const controller = new AbortController();
    state.transcriptVideoAbort = controller;
    const update = () => updateTranscriptActiveCue(video.currentTime);
    video.addEventListener("timeupdate", update, { passive: true, signal: controller.signal });
    video.addEventListener("seeking", update, { passive: true, signal: controller.signal });
    video.addEventListener("loadedmetadata", update, { passive: true, signal: controller.signal });
    update();
  }

  function seekTranscriptTime(seconds: unknown) {
    const item = currentTranscriptItem();
    if (!item || typeof seconds !== "number" || !Number.isFinite(seconds)) return;
    seekToVideoTimestamp(seconds, item.bvid, item.page || 1);
    updateTranscriptActiveCue(seconds, true);
  }

  async function switchTranscriptTrack(index: string|number) {
    const item = currentTranscriptItem();
    const trackIndex = Number(index);
    const track = Number.isInteger(trackIndex) ? item?.tracks?.[trackIndex] : undefined;
    if (!item?.tracks?.length || !track || (typeof item.cid !== "string" && typeof item.cid !== "number")) return;
    state.transcriptSwitchAbort?.abort();
    const controller = new AbortController();
    state.transcriptSwitchAbort = controller;
    setStatus(`正在切换到 ${track.lan_doc || track.lan || "字幕"}…`);
    const base = {
      bvid: item.bvid,
      aid: typeof item.aid === "string" || typeof item.aid === "number" ? item.aid : null,
      cid: item.cid, title: item.title,
      author: item.author, pages: item.pages || [], page: item.page || 1,
    };
    const result = await fetchTrackBodyFast(base, item.tracks, trackIndex, controller.signal);
    if (controller.signal.aborted) return;
    Object.assign(item, result, { selected: item.selected !== false });
    rememberTranscriptItem(item);
    lruSet(state.fastSubtitleCache, `${item.bvid}:${item.cid}`, item);
    persistentCache.write(`subtitle:${item.bvid}:${item.cid}`, item, SUBTITLE_CACHE_TTL_MS).catch(() => {});
    state.transcriptQuery = "";
    const input = ensurePanel().querySelector<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>('[data-role="transcript-search"]');
    if (input) input.value = "";
    renderList();
    setStatus(`已切换 ${item.lan_doc || item.lan} · ${item.cue_count} 条`, "ok");
  }

  async function refreshCurrentTranscript() {
    const item = currentTranscriptItem();
    const ctx = detectContext(location.href);
    const bvid = item?.bvid || ctx.bvid;
    const page = item?.page || ctx.page || 1;
    if (!bvid) return setStatus("当前页面没有可刷新的视频", "err");
    state.autoCaptureKey = "";
    state.autoAnalyzeKey = "";
    state.autoAnalyzePendingKey = "";
    clearTimeout(state.autoAnalyzeTimer);
    state.fastSubtitleCache.delete(`${bvid}:${item?.cid || ""}`);
    await autoCaptureCurrentVideo("manual-refresh", { forceNetwork: true, requestedBvid: bvid, requestedPage: page });
  }

  function escapeHtml(s: unknown) {
    return String(s || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }
  function escapeAttr(s: unknown) {
    return escapeHtml(s).replace(/'/g, "&#39;");
  }

  function selectedItems() {
    return state.items.filter((it) => it.selected);
  }

  async function onAction(act: string|null) {
    if (act === "cancel" || act === "job-stop") {
      stopLibraryJob();
      return;
    }
    if (act === "job-pause") {
      toggleLibraryJobPause();
      return;
    }
    if (act === "ai-stop") {
      if (state.studioBusy) {
        abortStudioRequest();
        setStatus("正在停止对话生成…");
        return;
      }
      state.aiAbort = true;
      abortAllAiRuns();
      setStatus("正在停止 AI Pipeline（预处理 + 后处理）…");
      return;
    }
    if (act === "ai-toggle") {
      toggleAiPanel();
      return;
    }
    if (act === "ai-flow-drawer") {
      setAiDrawer(state.aiDrawer === "flow" ? "" : "flow");
      return;
    }
    if (act === "ai-input-drawer") {
      setAiDrawer(state.aiDrawer === "input" ? "" : "input");
      return;
    }
    if (act === "ai-drawer-close") {
      setAiDrawer("");
      return;
    }
    if (act === "ai-copy-input") {
      const text = transcriptReadingText(currentInputPreviewText(state.aiInputView));
      if (!text) { setStatus("当前没有可复制的输入", "err"); return; }
      if (typeof GM_setClipboard === "function") GM_setClipboard(text); else await navigator.clipboard.writeText(text);
      setStatus(`已复制${state.aiInputView === "processed" ? "AI 处理字幕" : "字幕"}正文`, "ok");
      return;
    }
    if (act === "post-task-add") {
      const prompts = state.promptProfiles?.length ? state.promptProfiles : loadPromptProfiles().prompts;
      const posts = prompts.filter((p: { stage: string; }) => p.stage === "postprocess");
      if (!posts.length) { setStatus("请先在设置 → Prompt 新建一个后处理 Prompt", "err"); return; }
      const tasks = currentPostTasks().map((t) => ({ ...t, modelIds: [...(t.modelIds || [])] }));
      const used = new Set(tasks.map((t) => t.promptId));
      const prompt = posts.find((p: { id: string; }) => !used.has(p.id)) || posts.find((p: { id: string; }) => p.id === state.activePromptId) || posts[0];
      if (!prompt) return;
      const modelIds = (state.aiProfiles?.length ? state.aiProfiles : loadAiProfiles()).filter((p) => p.enabled).map((p) => p.id);
      const task = normalizePostTask({ id: makePostTaskId(), promptId: prompt.id, modelIds, enabled: true, order: tasks.length }, tasks.length);
      tasks.push(task);
      state.aiActiveTaskId = task.id;
      savePostTasks(tasks);
      renderAiFlowDrawer();
      setStatus(`已添加产物：${prompt.name}`, "ok");
      return;
    }
    if (act === "prompt-save") {
      const library = savePromptProfilesFromForm({ activeId: ensurePanel().querySelector<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>('[data-role="prompt-select"]')?.value || state.activePromptId });
      fillPromptConfigForm(ensurePanel());
      const current = library.prompts.find((p: { id: string; }) => p.id === state.promptEditorId);
      setStatus(`已保存 Prompt：${current?.name || getActivePromptProfile()?.name || "未命名"}`, "ok");
      return;
    }
    if (act === "prompt-add" || act === "prompt-add-pre" || act === "prompt-add-knowledge") {
      const library = savePromptProfilesFromForm({ activeId: state.activePromptId });
      const stage = act === "prompt-add-pre" ? "preprocess" : act === "prompt-add-knowledge" ? "knowledge" : "postprocess";
      const next = coreCall("createPromptProfile", {
        id: coreCall("makePromptProfileId"),
        stage,
        name: stage === "preprocess" ? `字幕预处理 ${library.prompts.filter((p: { stage: string; }) => p.stage === "preprocess").length + 1}` : stage === "knowledge" ? `知识追问 ${library.prompts.filter((p: { stage: string; }) => p.stage === "knowledge").length + 1}` : `后处理提示词 ${library.prompts.filter((p: { stage: string; }) => p.stage === "postprocess").length + 1}`,
        hint: stage === "preprocess" ? "字幕预处理" : stage === "knowledge" ? "局部知识追问" : "后处理提示词",
        systemPrompt: "",
        userPromptTemplate: stage === "knowledge" ? "{{question}}" : "{{subtitle}}",
      }, library.prompts.length);
      const prompts = [...library.prompts, next];
      savePromptProfiles(prompts, library.activeId, library.activePreprocessId, library.activeKnowledgeId);
      state.promptEditorId = next.id;
      state.promptSearch = "";
      if (state.ui) state.ui.promptStage = stage;
      setPromptStageTab(stage, { silent: true, preserveEditor: true });
      fillPromptConfigForm(ensurePanel());
      setStatus(`已新增提示词：${next.name}`, "ok");
      return;
    }
    if (act === "prompt-reset") {
      const library = savePromptProfilesFromForm({ activeId: state.activePromptId });
      const pre = coreCall("createPromptProfile", DEFAULT_PREPROCESS_PROMPT, 0);
      const post = coreCall("createPromptProfile", DEFAULT_MERMAID_PROMPT, 1);
      const html = coreCall("createPromptProfile", DEFAULT_HTML_FOLIO_PROMPT, 2);
      const knowledge = coreCall("createPromptProfile", DEFAULT_KNOWLEDGE_PROMPT, 3);
      const prompts = library.prompts.filter((p: { id: string; }) => ![DEFAULT_PREPROCESS_PROMPT_ID, DEFAULT_PROMPT_ID, DEFAULT_HTML_FOLIO_PROMPT_ID, DEFAULT_KNOWLEDGE_PROMPT_ID].includes(p.id));
      prompts.unshift(knowledge);
      prompts.unshift(html);
      prompts.unshift(post);
      prompts.unshift(pre);
      savePromptProfiles(prompts, post.id, pre.id, knowledge.id);
      state.promptEditorId = pre.id;
      state.promptSearch = "";
      if (state.ui) state.ui.promptStage = "preprocess";
      setPromptStageTab("preprocess", { silent: true, preserveEditor: true });
      setStatus("已恢复内置『字幕规范化』『全 Mermaid 学习图谱』『HTML 阅读页』『局部知识追问』；其他自定义提示词保持不变", "ok");
      return;
    }
    if (act === "ai-save") {
      const profiles = saveAiProfilesFromForm();
      fillAiConfigForm(ensurePanel());
      const current = profiles.find((p: { id: string; }) => p.id === state.aiEditorId);
      setStatus(`已保存 LLM：${current?.name || "未命名"} · ${profiles.filter((x) => x.enabled).length}/${profiles.length} 启用`, "ok");
      if (state.autoAnalyzeEnabled) {
        const item = currentTranscriptItem();
        if (item?.subStatus === "ok" && item.data?.length) {
          state.autoAnalyzeKey = "";
          scheduleAutoAnalyze(item, routeVideoKey(item.bvid, item.page || 1), "config-saved", 80);
        }
      }
      return;
    }
    if (act === "ai-reset") {
      const prev = loadAiProfiles();
      const first = prev.find((x) => x.enabled) || prev[0];
      const resetProfile = coreCall("createAiProfile", {
        ...AI_DEFAULTS,
        name: "默认模型",
        apiKey: first?.apiKey || "",
        baseUrl: first?.baseUrl || "",
      }, 0);
      saveAiProfiles([resetProfile]);
      state.aiEditorId = resetProfile.id;
      state.aiSearch = "";
      fillAiConfigForm(ensurePanel());
      setStatus("已恢复为单个默认模型配置（保留首个配置的 Base URL 与 API Key）", "ok");
      return;
    }
    if (act === "ai-profile-add") {
      const profiles = saveAiProfilesFromForm();
      const source = profiles.find((p: { id: string; }) => p.id === state.aiEditorId) || profiles[profiles.length - 1] || coreCall("createAiProfile", AI_DEFAULTS, 0);
      const next = coreCall("createAiProfile", {
        ...source,
        id: coreCall("makeAiProfileId"),
        name: `模型 ${profiles.length + 1}`,
        enabled: true,
      }, profiles.length);
      profiles.push(next);
      saveAiProfiles(profiles);
      state.aiEditorId = next.id;
      state.aiSearch = "";
      fillAiConfigForm(ensurePanel());
      setStatus("已新增 LLM；已沿用当前配置的连接参数，可直接修改", "ok");
      return;
    }
    if (act === "ai-focus") {
      closeMermaidFullscreen();
      state.aiFocus = !state.aiFocus;
      if (state.aiFocus) setWorkspace("ai", { silent: true });
      applyPanelGeometry();
      setStatus(state.aiFocus ? "已进入专注阅读 · 按 Esc 或点「退出专注」恢复" : "已退出专注阅读", "ok");
      return;
    }
    if (act === "ai-reprocess") {
      if (!state.preprocessEnabled) {
        setStatus("预处理当前已关闭；开启后才能重跑预处理", "err");
        return;
      }
      if (state.aiBusy) {
        setStatus("AI Pipeline 正在运行，请先停止当前任务再重跑预处理", "err");
        return;
      }
      state.forcePreprocessOnce = true;
      try { await doAiAnalyze(); } finally { state.forcePreprocessOnce = false; }
      return;
    }
    if (act === "ai-regenerate-current") {
      await regenerateActiveAiRun();
      return;
    }
    if (act === "ai-regenerate-all") {
      await regenerateAllAiRuns();
      return;
    }
    if (act === "ai-send") {
      if (operationBusy()) {
        state.pendingAiSend = true;
        setStatus("扫描或字幕任务仍在运行 · 已排队，结束后自动送入 AI");
        return;
      }
      if (state.aiBusy) {
        const restart = typeof pageWindow.confirm === "function"
          ? pageWindow.confirm("已有 AI 模型仍在生成。是否停止当前批次并用当前勾选内容重新分析？")
          : false;
        if (!restart) {
          setStatus("当前 AI 批次仍在生成；可先停止，或再次点击并确认重新分析");
          return;
        }
        stopAiBatchForRestart();
      }
      await doAiAnalyze();
      return;
    }
    if (act === "ai-stick") {
      if (state.aiStickBottom && !state.aiUserReading) {
        // 关跟随 → 进入阅读锁
        detachAiFollow();
        setStatus("已暂停跟随 · 可自由滚动 · 点「↓ 最新」回到底部");
      } else {
        resumeAiFollow();
        setStatus("跟随最新输出");
      }
      return;
    }
    if (act === "ai-jump") {
      resumeAiFollow();
      setStatus("已跳到最新");
      return;
    }
    if (act === "ai-copy") {
      const text = getActiveAiRun()?.raw || state.aiRaw || "";
      if (!text.trim()) {
        setStatus("没有可复制的内容", "err");
        return;
      }
      clipboardWrite(text);
      setStatus("已复制 AI 输出", "ok");
      return;
    }
    if (act === "ai-export") {
      const run = getActiveAiRun();
      const text = run?.raw || state.aiRaw || "";
      if (!text.trim()) return setStatus("没有可导出的笔记", "err");
      const bvid = (run?.sourceBvids || state.aiSourceBvids)[0] || "bilibili";
      const modelName = run?.config?.name || run?.config?.model || "AI";
      const folio = extractHtmlFolioSource(text);
      if (folio) {
        const title = extractFolioTitle(folio) || `${modelName} 阅读页`;
        downloadText(
          `${safeFilename(`${bvid}_${modelName}_阅读页`)}.html`,
          buildStandaloneFolioHtml(title, folio, state.ui?.ctpFlavor),
          { overwrite: true },
        );
        setStatus(`已导出 ${modelName} 的 HTML 阅读页`, "ok");
        return;
      }
      downloadText(`${safeFilename(`${bvid}_${modelName}_AI笔记`)}.md`, text);
      setStatus(`已导出 ${modelName} 的 Markdown`, "ok");
      return;
    }
    if (act === "ai-font-dec" || act === "ai-font-inc") {
      const delta = act === "ai-font-inc" ? 1 : -1;
      const current = normalizeNoteFont(state.ui?.noteFont, NOTE_FONT_DEFAULT);
      const next = Math.max(NOTE_FONT_MIN, Math.min(NOTE_FONT_MAX, current + delta));
      if (state.ui) state.ui.noteFont = next;
      ensurePanel().style.setProperty("--bsb-note-font", `${next}px`);
      saveUiGeom();
      setStatus(`正文字号 ${next}px`);
      return;
    }
    if (act === "ai-top") {
      scrollAiToTop();
      setStatus("已回到顶部");
      return;
    }
    if (act === "capture-toggle") {
      state.captureDrawerOpen = !state.captureDrawerOpen;
      const drawer = ensurePanel().querySelector<HTMLElement>('[data-role="capture-drawer"]');
      if (drawer) drawer.hidden = !state.captureDrawerOpen;
      if (state.captureDrawerOpen) refreshContextUI();
      return;
    }
    if (act === "open-ai-workspace") {
      setWorkspace("ai");
      refreshAiChips();
      setStatus("已打开 AI 学习图谱工作区 · 使用左侧资源库勾选项作为输入");
      return;
    }
    if (act === "transcript-refresh") {
      await refreshCurrentTranscript();
      return;
    }
    if (act === "clear") {
      state.items = [];
      state.meta = {};
      state.libraryFolderCollapsed = {};
      state.transcriptItemKey = "";
      state.transcriptItem = null;
      state.transcriptQuery = "";
      state.transcriptActiveCueIndex = -1;
      state.libraryQuery = "";
      state.libraryFilter = "all";
      const librarySearch = ensurePanel().querySelector<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>('[data-role="library-search"]');
      if (librarySearch) librarySearch.value = "";
      renderList();
      setStatus("已清空");
      return;
    }
    if (act === "folder-expand-all") {
      state.libraryFolderCollapsed = {};
      renderList({ renderTranscript: false });
      setStatus("已展开全部文件夹", "ok");
      return;
    }
    if (act === "folder-collapse-all") {
      const collapsed: Record<string, boolean> = {};
      state.items.forEach((item) => {
        const key = resolveLibraryGroupKey(item);
        if (key && !key.startsWith("single:")) collapsed[key] = true;
      });
      state.libraryFolderCollapsed = collapsed;
      renderList({ renderTranscript: false });
      setStatus("已收起全部文件夹", "ok");
      return;
    }
    if (act === "sel-all") {
      state.items.forEach((it) => (it.selected = true));
      renderList();
      return;
    }
    if (act === "sel-none") {
      state.items.forEach((it) => (it.selected = false));
      renderList();
      return;
    }
    if (act === "scan") {
      await doScan();
      return;
    }
    if (act === "copy-bvid") {
      const list = selectedItems();
      if (!list.length) {
        setStatus("请先勾选视频", "err");
        return;
      }
      const text = list.map((it) => it.bvid).filter(Boolean).join("\n");
      clipboardWrite(text);
      setStatus(`已复制 ${list.length} 个 BV`, "ok");
      return;
    }
    if (act === "dl-srt" || act === "dl-txt" || act === "copy" || act === "dl-ok-only" || act === "fetch-selected") {
      await doBatch(act);
    }
  }

  function clipboardWrite(text: string) {
    if (typeof GM_setClipboard === "function") GM_setClipboard(text, "text");
    else if (navigator.clipboard) navigator.clipboard.writeText(text);
  }

  // ─── AI config / stream / render ────────────────────────────────────────
  function storageGet(key: string, fallback: string|number|boolean|null) {
    try {
      if (typeof GM_getValue === "function") {
        const v = GM_getValue(key, null);
        if (v != null && v !== "") return v;
      }
    } catch  { /* ignore */ }
    try {
      const legacy = localStorage.getItem(key);
      if (legacy != null) return legacy;
    } catch  { /* ignore */ }
    return fallback;
  }

  function storageSet(key: string, value: unknown) {
    let storedByGm = false;
    try {
      if (typeof GM_setValue === "function") {
        GM_setValue(key, value);
        storedByGm = true;
      }
    } catch  { /* ignore */ }
    // 密钥优先只进入 userscript 隔离存储；仅无 GM API 时才退回页面 localStorage。
    if (!storedByGm) {
      try { localStorage.setItem(key, String(value)); } catch  { /* ignore */ }
    } else {
      try { localStorage.removeItem(key); } catch  { /* migrate legacy */ }
    }
  }

  function shortcutDefaults() {
    return {
      schemaVersion: SHORTCUT_SCHEMA_VERSION,
      enabled: true,
      summonLayout: "remember", // remember | floating | right | left
      summonTarget: "remember", // remember | processed | postprocess
      preferredDock: "right", // right | left
      bindings: Object.fromEntries(SHORTCUT_COMMANDS.map((command) => [command.id, command.defaultChord])),
    };
  }

  function loadShortcutSettings() {
    const defaults = shortcutDefaults();
    try {
      const raw = storageGet(SHORTCUT_STORE_KEY, "");
      if (!raw) return defaults;
      const parsed = typeof raw === "string" ? JSON.parse(raw) : raw;
      if (!parsed || typeof parsed !== "object") return defaults;
      const parsedSchemaVersion = Number(parsed.schemaVersion) || 1;
      const parsedBindings = { ...(parsed.bindings || {}) };
      // v6.0.2: migrate only the old built-in summon default. Explicit custom bindings remain untouched.
      if (parsedSchemaVersion < 2 && parsedBindings["toggle-panel"] === "Ctrl+Alt+KeyB") {
        parsedBindings["toggle-panel"] = "Ctrl+KeyB";
      }
      const bindings: Record<string, string> = { ...defaults.bindings };
      for (const command of SHORTCUT_COMMANDS) {
        if (Object.prototype.hasOwnProperty.call(parsedBindings, command.id)) {
          bindings[command.id] = String(parsedBindings[command.id] || "");
        }
      }
      return {
        schemaVersion: SHORTCUT_SCHEMA_VERSION,
        enabled: parsed.enabled !== false,
        summonLayout: ["remember", "floating", "right", "left"].includes(parsed.summonLayout) ? parsed.summonLayout : defaults.summonLayout,
        summonTarget: ["remember", "processed", "postprocess"].includes(parsed.summonTarget) ? parsed.summonTarget : defaults.summonTarget,
        preferredDock: parsed.preferredDock === "left" ? "left" : "right",
        bindings,
      };
    } catch  {
      return defaults;
    }
  }

  function saveShortcutSettings(config = state.shortcutConfig) {
    const defaults = shortcutDefaults();
    const next = config && typeof config === "object" ? config : defaults;
    next.schemaVersion = SHORTCUT_SCHEMA_VERSION;
    next.enabled = next.enabled !== false;
    next.summonLayout = ["remember", "floating", "right", "left"].includes(next.summonLayout) ? next.summonLayout : defaults.summonLayout;
    next.summonTarget = ["remember", "processed", "postprocess"].includes(next.summonTarget) ? next.summonTarget : defaults.summonTarget;
    next.preferredDock = next.preferredDock === "left" ? "left" : "right";
    next.bindings = { ...defaults.bindings, ...(next.bindings || {}) };
    state.shortcutConfig = next;
    storageSet(SHORTCUT_STORE_KEY, JSON.stringify(next));
    refreshShortcutHints();
    return next;
  }

  function shortcutKeyLabel(code: string) {
    const c = String(code || "");
    if (/^Key[A-Z]$/.test(c)) return c.slice(3);
    if (/^Digit[0-9]$/.test(c)) return c.slice(5);
    if (/^Numpad[0-9]$/.test(c)) return `Num ${c.slice(6)}`;
    const labels: Record<string, string> = {
      Space: "Space", Enter: "Enter", Tab: "Tab", Escape: "Esc", Backspace: "Backspace", Delete: "Delete",
      ArrowUp: "↑", ArrowDown: "↓", ArrowLeft: "←", ArrowRight: "→",
      Minus: "-", Equal: "=", BracketLeft: "[", BracketRight: "]", Semicolon: ";", Quote: "'", Comma: ",", Period: ".", Slash: "/", Backslash: "\\", Backquote: "`",
      Home: "Home", End: "End", PageUp: "PgUp", PageDown: "PgDn", Insert: "Insert",
    };
    if (labels[c]) return labels[c];
    if (/^F\d{1,2}$/.test(c)) return c;
    return c.replace(/^(Arrow|Numpad)/, "") || c;
  }

  function shortcutChordFromEvent(event: KeyboardEvent) {
    const code = String(event?.code || "");
    if (!code || /^(Control|Shift|Alt|Meta)(Left|Right)?$/.test(code)) return "";
    const parts = [];
    if (event.ctrlKey) parts.push("Ctrl");
    if (event.altKey) parts.push("Alt");
    if (event.shiftKey) parts.push("Shift");
    if (event.metaKey) parts.push("Meta");
    parts.push(code);
    return parts.join("+");
  }

  function shortcutDisplayChord(chord: string) {
    const parts = String(chord || "").split("+").filter(Boolean);
    if (!parts.length) return "未绑定";
    return parts.map((part) => ["Ctrl", "Alt", "Shift", "Meta"].includes(part) ? part : shortcutKeyLabel(part)).join(" + ");
  }

  function shortcutHasStrongModifier(chord: string) {
    const parts = new Set(String(chord || "").split("+"));
    return parts.has("Ctrl") || parts.has("Alt") || parts.has("Meta");
  }

  function shortcutConflictInfo(chord: string, commandId = "") {
    const value = String(chord || "");
    if (!value) return { level: "off", text: "未绑定" };
    const duplicate = SHORTCUT_COMMANDS.find((command) => command.id !== commandId && state.shortcutConfig?.bindings?.[command.id] === value);
    if (duplicate) return { level: "error", text: `与“${duplicate.label}”重复` };
    const chrome = new Set([
      "Ctrl+KeyN", "Ctrl+Shift+KeyN", "Ctrl+KeyT", "Ctrl+Shift+KeyT", "Ctrl+KeyW", "Ctrl+Shift+KeyW",
      "Ctrl+KeyL", "Ctrl+KeyK", "Ctrl+KeyE", "Ctrl+KeyF", "Ctrl+KeyG", "Ctrl+Shift+KeyG", "Ctrl+KeyR", "Ctrl+KeyP", "Ctrl+KeyS", "Ctrl+KeyD",
      "Ctrl+KeyH", "Ctrl+KeyJ", "Ctrl+KeyU", "Ctrl+Shift+KeyJ", "Ctrl+Shift+KeyB", "Ctrl+Shift+KeyO", "Ctrl+Shift+Delete", "Ctrl+Tab", "Ctrl+Shift+Tab",
      "Alt+KeyD", "Alt+ArrowLeft", "Alt+ArrowRight", "Alt+Home", "Shift+Escape", "F11", "F12", "Alt+Shift+KeyI",
      ...Array.from({ length: 9 }, (_, i) => `Ctrl+Digit${i + 1}`),
    ]);
    if (chrome.has(value)) return { level: "warn", text: "Chrome 常用快捷键，页面可能收不到" };
    const parts = new Set(value.split("+"));
    const code = value.split("+").at(-1) || "";
    const biliCodes = new Set(["Space", "KeyK", "KeyJ", "KeyL", "KeyW", "KeyT", "KeyF", "KeyP", "KeyI", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "KeyM", "Minus", "Equal", "Digit0", "KeyQ", "KeyE", "KeyD", "KeyC", "KeyG", "KeyH", "KeyB", "Enter"]);
    if (!parts.has("Ctrl") && !parts.has("Alt") && !parts.has("Meta") && (biliCodes.has(code) || value === "Shift+KeyS")) {
      return { level: "warn", text: "Bilibili 播放器常用键，容易冲突" };
    }
    if (!shortcutHasStrongModifier(value)) return { level: "warn", text: "建议至少使用 Ctrl / Alt / Meta 之一" };
    return { level: "ok", text: "推荐组合" };
  }

  function shortcutEditableTarget(target: EventTarget|null) {
    if (!(target instanceof Element)) return false;
    return !!target.closest('input, textarea, select, [contenteditable="true"], [contenteditable="plaintext-only"]');
  }

  function refreshShortcutHints() {
    const root = document.getElementById(PANEL_ID);
    if (!root) return;
    const toggle = state.shortcutConfig?.bindings?.["toggle-panel"] || "";
    const label = shortcutDisplayChord(toggle);
    const fab = root.querySelector<HTMLElement>(".bsb-fab");
    const dockTab = root.querySelector<HTMLElement>(".bsb-dock-tab");
    if (fab) fab.title = toggle ? `SubBatch 工作台 · ${label}` : "SubBatch 工作台";
    if (dockTab) dockTab.title = toggle ? `展开 SubBatch 工作台 · ${label}` : "展开 SubBatch 工作台";
  }

  function shortcutCommandHtml(command: { id: string; label: string; hint: string; }) {
    const chord = state.shortcutConfig?.bindings?.[command.id] || "";
    const conflict = shortcutConflictInfo(chord, command.id);
    const recording = state.shortcutRecordingId === command.id;
    return `<article class="bsb-shortcut-row" data-shortcut-row="${escapeAttr(command.id)}"><div class="bsb-shortcut-copy"><strong>${escapeHtml(command.label)}</strong><span>${escapeHtml(command.hint)}</span></div><div class="bsb-shortcut-control"><button type="button" class="bsb-shortcut-key${recording ? " recording" : ""}" data-shortcut-record="${escapeAttr(command.id)}" aria-pressed="${recording ? "true" : "false"}">${recording ? "按下组合键…" : escapeHtml(shortcutDisplayChord(chord))}</button><button type="button" class="bsb-shortcut-reset" data-shortcut-reset="${escapeAttr(command.id)}" title="恢复默认">↺</button><span class="bsb-shortcut-state ${escapeAttr(conflict.level)}">${escapeHtml(conflict.text)}</span></div></article>`;
  }

  function renderShortcutSettings(root = document.getElementById(PANEL_ID)) {
    const host = root?.querySelector<HTMLElement>('[data-role="shortcut-settings"]');
    if (!host) return;
    const config = state.shortcutConfig || loadShortcutSettings();
    host.innerHTML = toTrustedHTML(`<div class="bsb-shortcut-page"><div class="bsb-shortcut-hero"><div><span class="bsb-shortcut-kicker">QUICK SUMMON</span><h3>快捷召唤</h3><p>快捷键只在 Bilibili 页面生效。正在输入文字时默认不触发，避免干扰搜索、弹幕和表单。</p></div><label class="bsb-flow-switch"><input type="checkbox" data-shortcut-pref="enabled" ${config.enabled ? "checked" : ""}><span class="bsb-flow-switch-track" aria-hidden="true"></span><span class="bsb-flow-switch-text">${config.enabled ? "已开启" : "已关闭"}</span></label></div>
      <section class="bsb-shortcut-card"><div class="bsb-shortcut-section-title"><strong>召唤行为</strong><span>主快捷键打开面板时，决定它出现在哪里、先看什么。</span></div><div class="bsb-shortcut-prefs"><label><span>面板布局</span><div class="bsb-flow-select"><select data-shortcut-pref="summonLayout"><option value="remember"${config.summonLayout === "remember" ? " selected" : ""}>记住上次</option><option value="floating"${config.summonLayout === "floating" ? " selected" : ""}>悬浮</option><option value="right"${config.summonLayout === "right" ? " selected" : ""}>右侧靠边</option><option value="left"${config.summonLayout === "left" ? " selected" : ""}>左侧靠边</option></select><span class="bsb-flow-select-icon">⌄</span></div></label><label><span>默认内容</span><div class="bsb-flow-select"><select data-shortcut-pref="summonTarget"><option value="remember"${config.summonTarget === "remember" ? " selected" : ""}>记住上次</option><option value="processed"${config.summonTarget === "processed" ? " selected" : ""}>AI 处理字幕</option><option value="postprocess"${config.summonTarget === "postprocess" ? " selected" : ""}>后处理 · 上次产物/模型</option></select><span class="bsb-flow-select-icon">⌄</span></div></label><label><span>靠边方向</span><div class="bsb-flow-select"><select data-shortcut-pref="preferredDock"><option value="right"${config.preferredDock === "right" ? " selected" : ""}>右侧</option><option value="left"${config.preferredDock === "left" ? " selected" : ""}>左侧</option></select><span class="bsb-flow-select-icon">⌄</span></div></label></div></section>
      <section class="bsb-shortcut-card"><div class="bsb-shortcut-section-title"><strong>命令快捷键</strong><span>点击快捷键框后直接按新的组合；Esc 取消，Backspace / Delete 清除。</span></div><div class="bsb-shortcut-list">${SHORTCUT_COMMANDS.map(shortcutCommandHtml).join("")}</div><div class="bsb-shortcut-foot"><span>建议使用 Ctrl + Alt + 字母/数字，避开 Chrome 与 B 站播放器常用键。</span><button type="button" class="bsb-btn ghost" data-shortcut-reset-all>恢复默认快捷键</button></div></section></div>`);
  }

  function ensureBuiltinStagePrompts(prompts: PromptProfile[]) {
    const list = [...(prompts || [])];
    if (!list.some((p) => p.stage === "preprocess")) list.unshift(coreCall("createPromptProfile", DEFAULT_PREPROCESS_PROMPT, 0));
    if (!list.some((p) => p.id === DEFAULT_HTML_FOLIO_PROMPT_ID)) {
      const mermaidAt = list.findIndex((p) => p.id === DEFAULT_PROMPT_ID);
      const html = coreCall("createPromptProfile", DEFAULT_HTML_FOLIO_PROMPT, list.length);
      if (mermaidAt >= 0) list.splice(mermaidAt + 1, 0, html);
      else list.push(html);
    }
    if (!list.some((p) => p.stage === "knowledge")) list.push(coreCall("createPromptProfile", DEFAULT_KNOWLEDGE_PROMPT, list.length));
    return list;
  }

  function migrateBuiltinPromptLanguageRules(prompts: PromptProfile[], storedVersion: number) {
    if (Number(storedVersion || 0) >= 3) return { prompts, changed: false };
    let changed = false;
    const next = (prompts || []).map((prompt) => {
      if (!prompt || ![DEFAULT_PREPROCESS_PROMPT_ID, DEFAULT_PROMPT_ID].includes(prompt.id)) return prompt;
      if (/简体中文/.test(String(prompt.systemPrompt || ""))) return prompt;
      const addition = prompt.id === DEFAULT_PREPROCESS_PROMPT_ID
        ? [
            "【输出语言（v5.8.1）】",
            "无论输入字幕是英语、日语、韩语或其他语言，规范化正文必须统一转换为简体中文；完整外语句子应忠实翻译。专有名词、模型名、API、代码、命令、参数和缩写可保留必要原文。",
          ].join("\n")
        : [
            "【输出语言（v5.8.1）】",
            "所有最终可见标题与 Mermaid 节点文字统一使用简体中文；若输入为其他语言先忠实转换。专有名词、模型名、API、代码、命令、参数和缩写可保留必要原文。",
          ].join("\n");
      changed = true;
      return { ...prompt, systemPrompt: `${String(prompt.systemPrompt || "").trim()}\n\n${addition}`.trim() };
    });
    return { prompts: next, changed };
  }

  function migrateBuiltinPreprocessChunkRules(prompts: PromptProfile[], storedVersion: number) {
    if (Number(storedVersion || 0) >= 4) return { prompts, changed: false };
    let changed = false;
    const next = (prompts || []).map((prompt) => {
      if (!prompt || prompt.id !== DEFAULT_PREPROCESS_PROMPT_ID) return prompt;
      let systemPrompt = String(prompt.systemPrompt || "");
      let userPromptTemplate = String(prompt.userPromptTemplate || "");
      if (!/本地拼接器|overlap/i.test(systemPrompt)) {
        systemPrompt = `${systemPrompt.trim()}\n\n【长视频分块（v5.9.0）】\n长字幕会按真实时间戳切成多个块；从第二块开始可能携带上一块末尾的少量 overlap 上下文。正常规范化并保留真实时间戳，不要自行删除或改写时间戳；脚本会依据“新内容起点”确定性去除 overlap 重复。`.trim();
        changed = true;
      }
      if (!/\{\{coreStart\}\}/.test(userPromptTemplate)) {
        userPromptTemplate = userPromptTemplate.replace(
          /字幕分块：\{\{chunkIndex\}\} \/ \{\{chunkCount\}\}/,
          "字幕分块：{{chunkIndex}} / {{chunkCount}}\n本块上下文起点：{{chunkStart}}\n本块新内容起点：{{coreStart}}\n本块结束：{{chunkEnd}}",
        );
        changed = true;
      }
      return { ...prompt, systemPrompt, userPromptTemplate };
    });
    return { prompts: next, changed };
  }

  function migrateBuiltinKnowledgeHighlightRules(prompts: PromptProfile[], storedVersion: number) {
    if (Number(storedVersion || 0) >= 6) return { prompts, changed: false };
    let changed = false;
    const next = (prompts || []).map((prompt) => {
      if (!prompt || prompt.id !== DEFAULT_KNOWLEDGE_PROMPT_ID) return prompt;
      const systemPrompt = String(prompt.systemPrompt || "");
      if (/【阅读强调】|==关键短语==/.test(systemPrompt)) return prompt;
      const addition = [
        "【阅读强调】",
        "9. 可以使用 ==关键短语== 标记真正值得用户记住的内容。系统会把 ==...== 渲染为视觉高亮。",
        "10. 高亮必须克制：每个自然段通常 0—2 处；优先高亮核心概念、关键结论、因果节点、关键数字、重要边界；一处高亮尽量是一个短语，而不是整段文字；禁止连续高亮多个句子；禁止为了视觉效果随意高亮普通描述。",
        "11. **...** 只表示普通加粗；==...== 表示更高一级的『核心记忆点』。",
        "12. 不要在代码、公式、Markdown 标题中使用 ==...==；不要嵌套写成 ==**文字**==。",
      ].join("\n");
      changed = true;
      return { ...prompt, systemPrompt: `${systemPrompt.trim()}\n\n${addition}`.trim() };
    });
    return { prompts: next, changed };
  }

  function migrateBuiltinHtmlFolioPrompt(prompts: PromptProfile[], storedVersion: number) {
    if (Number(storedVersion || 0) >= 9) return { prompts, changed: false };
    let changed = false;
    const next = (prompts || []).map((prompt) => {
      if (!prompt || prompt.id !== DEFAULT_HTML_FOLIO_PROMPT_ID) return prompt;
      changed = true;
      return coreCall("createPromptProfile", {
        ...DEFAULT_HTML_FOLIO_PROMPT,
        id: prompt.id,
        stage: "postprocess",
      }, 0);
    });
    return { prompts: next, changed };
  }

  function loadPromptProfiles() {
    try {
      const raw = storageGet(PROMPT_STORE_KEY, null);
      if (raw != null && raw !== "") {
        const parsed = typeof raw === "string" ? JSON.parse(raw) : raw;
        let prompts = coreCall("normalizePromptProfiles", Array.isArray(parsed) ? parsed : parsed?.prompts);
        // v1 migration: all legacy prompts are postprocess; inject the transparent built-in subtitle normalizer.
        prompts = ensureBuiltinStagePrompts(prompts);
        const storedVersion = Array.isArray(parsed) ? 0 : Number(parsed?.version || 0);
        const migratedLanguage = migrateBuiltinPromptLanguageRules(prompts, storedVersion);
        prompts = migratedLanguage.prompts;
        const migratedChunking = migrateBuiltinPreprocessChunkRules(prompts, storedVersion);
        prompts = migratedChunking.prompts;
        const migratedHighlight = migrateBuiltinKnowledgeHighlightRules(prompts, storedVersion);
        prompts = migratedHighlight.prompts;
        const migratedHtmlFolio = migrateBuiltinHtmlFolioPrompt(prompts, storedVersion);
        prompts = migratedHtmlFolio.prompts;
        const migrated = {
          changed:
            migratedLanguage.changed ||
            migratedChunking.changed ||
            migratedHighlight.changed ||
            migratedHtmlFolio.changed ||
            storedVersion < PROMPT_SCHEMA_VERSION,
        };
        const ids = coreCall("resolvePromptActiveIds",
          prompts,
          String(Array.isArray(parsed) ? "" : parsed?.activeId || ""),
          String(Array.isArray(parsed) ? "" : parsed?.activePreprocessId || ""),
          String(Array.isArray(parsed) ? "" : parsed?.activeKnowledgeId || ""),
        );
        if (migrated.changed) {
          try {
            storageSet(PROMPT_STORE_KEY, JSON.stringify({ version: PROMPT_SCHEMA_VERSION, activeId: ids.activeId, activePreprocessId: ids.activePreprocessId, activeKnowledgeId: ids.activeKnowledgeId, prompts }));
          } catch  { /* ignore migration persistence failure */ }
        }
        state.promptProfiles = prompts;
        state.activePromptId = ids.activeId;
        state.activePrePromptId = ids.activePreprocessId;
        state.activeKnowledgePromptId = ids.activeKnowledgeId;
        return { prompts, ...ids };
      }
    } catch  {
      /* fall through to first-run default */
    }
    const pre = coreCall("createPromptProfile", DEFAULT_PREPROCESS_PROMPT, 0);
    const post = coreCall("createPromptProfile", DEFAULT_MERMAID_PROMPT, 1);
    const html = coreCall("createPromptProfile", DEFAULT_HTML_FOLIO_PROMPT, 2);
    const knowledge = coreCall("createPromptProfile", DEFAULT_KNOWLEDGE_PROMPT, 3);
    const prompts = [pre, post, html, knowledge];
    state.promptProfiles = prompts;
    state.activePromptId = post.id;
    state.activePrePromptId = pre.id;
    state.activeKnowledgePromptId = knowledge.id;
    return { prompts, activeId: post.id, activePreprocessId: pre.id, activeKnowledgeId: knowledge.id };
  }

  function savePromptProfiles(prompts: unknown, activeId: string, activePreprocessId = state.activePrePromptId, activeKnowledgeId = state.activeKnowledgePromptId) {
    const normalized = coreCall("normalizePromptProfiles", prompts);
    const ids = coreCall("resolvePromptActiveIds", normalized, String(activeId || ""), String(activePreprocessId || ""), String(activeKnowledgeId || ""));
    try {
      storageSet(PROMPT_STORE_KEY, JSON.stringify({
        version: PROMPT_SCHEMA_VERSION,
        activeId: ids.activeId,
        activePreprocessId: ids.activePreprocessId,
        activeKnowledgeId: ids.activeKnowledgeId,
        prompts: normalized,
      }));
    } catch  {
      /* ignore */
    }
    state.promptProfiles = normalized;
    state.activePromptId = ids.activeId;
    state.activePrePromptId = ids.activePreprocessId;
    state.activeKnowledgePromptId = ids.activeKnowledgeId;
    refreshPromptSelector(document.getElementById(PANEL_ID));
    if (state.postTasks?.length) savePostTasks(state.postTasks);
    else loadPostTasks();
    return { prompts: normalized, ...ids };
  }

  function getActiveKnowledgePromptProfile() {
    const prompts = state.promptProfiles?.length || state.activeKnowledgePromptId
      ? state.promptProfiles
      : loadPromptProfiles().prompts;
    return prompts.find((p: { id: string; stage: string; }) => p.id === state.activeKnowledgePromptId && p.stage === "knowledge")
      || prompts.find((p: { stage: string; }) => p.stage === "knowledge") || null;
  }

  function getActivePromptProfile() {
    const prompts = state.promptProfiles?.length || state.activePromptId
      ? state.promptProfiles
      : loadPromptProfiles().prompts;
    return prompts.find((p: { id: string; stage: string; }) => p.id === state.activePromptId && p.stage === "postprocess")
      || prompts.find((p: { stage: string; }) => p.stage === "postprocess") || null;
  }

  function getActivePreprocessPromptProfile() {
    const prompts = state.promptProfiles?.length || state.activePrePromptId
      ? state.promptProfiles
      : loadPromptProfiles().prompts;
    return prompts.find((p: { id: string; stage: string; }) => p.id === state.activePrePromptId && p.stage === "preprocess")
      || prompts.find((p: { stage: string; }) => p.stage === "preprocess") || null;
  }

  // ─── Knowledge Drill-down · v6 ─────────────────────────────────────────
  function makeKnowledgeId(prefix = "k") {
    return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`;
  }

  let knowledgeRepository: ReturnType<typeof createKnowledgeRepository> | null = null;
  function currentKnowledgeRepository() {
    if (!knowledgeRepository) {
      const factory = appFn("knowledge.createRepository");
      if (factory && globalThis.indexedDB) {
        knowledgeRepository = SubBatch.SubBatchMonorepo.app.knowledge.createRepository(globalThis.indexedDB);
      }
    }
    return knowledgeRepository;
  }

  function knowledgeStoreRequest<T>(storeName: string, mode: IDBTransactionMode, handler: (store:IDBObjectStore)=>IDBRequest<T>) {
    const repository = currentKnowledgeRepository();
    if (!repository) return Promise.reject(new Error("IndexedDB unavailable"));
    return repository.request(storeName, mode, handler);
  }

  async function knowledgeRefreshCache() {
    try {
      const [anchors, nodes] = await Promise.all([
        knowledgeStoreRequest(KNOWLEDGE_ANCHOR_STORE, "readonly", (s) => s.getAll()),
        knowledgeStoreRequest(KNOWLEDGE_NODE_STORE, "readonly", (s) => s.getAll()),
      ]);
      state.knowledgeAnchors = SubBatch.SubBatchMonorepo.app.knowledge.sortAnchors(anchors as KnowledgeAnchor[]);
      const { nodes: reconciledNodes, recovered } = SubBatch.SubBatchMonorepo.app.knowledge.reconcileNodes(
        nodes as WorkbenchKnowledgeNode[], state.knowledgeNodes, !!state.knowledgeBusy, knowledgeVisibleAnswer,
      );
      state.knowledgeNodes = reconciledNodes;
      if (recovered.length) Promise.all(recovered.map((node) => knowledgeStoreRequest(KNOWLEDGE_NODE_STORE, "readwrite", (s) => s.put(node)))).catch(() => {});
    } catch (error) {
      state.knowledgeAnchors = state.knowledgeAnchors || [];
      state.knowledgeNodes = state.knowledgeNodes || [];
      throw error;
    }
    return { anchors: state.knowledgeAnchors, nodes: state.knowledgeNodes };
  }

  async function knowledgePutAnchor(anchor: KnowledgeAnchor) {
    return SubBatch.SubBatchMonorepo.app.knowledge.saveAnchor(state.knowledgeAnchors, anchor,
      (value) => knowledgeStoreRequest(KNOWLEDGE_ANCHOR_STORE, "readwrite", (store) => store.put(value)));
  }

  async function knowledgePutNode(node: WorkbenchKnowledgeNode) {
    return SubBatch.SubBatchMonorepo.app.knowledge.saveNode(state.knowledgeNodes, node,
      (value) => knowledgeStoreRequest(KNOWLEDGE_NODE_STORE, "readwrite", (store) => store.put(value)));
  }

  async function knowledgeDeleteAnchor(anchorId: string) {
    if (state.knowledgeRuntime && state.knowledgeActiveAnchorId === anchorId) abortKnowledgeRequest();
    const repository = currentKnowledgeRepository();
    if (!repository) throw new Error("IndexedDB unavailable");
    const remaining = await SubBatch.SubBatchMonorepo.app.knowledge.deleteAnchorCommitted(
      state.knowledgeAnchors, state.knowledgeNodes, anchorId,
      (id) => repository.deleteAnchor(id));
    state.knowledgeAnchors = remaining.anchors;
    state.knowledgeNodes = remaining.nodes;
    if (state.knowledgeActiveAnchorId === anchorId) {
      state.knowledgeActiveAnchorId = "";
      state.knowledgeActiveNodeId = "";
    }
  }

  function knowledgeSourceKey(bvid: string | undefined, page: number) {
    return `${String(bvid || "").toUpperCase()}:P${Math.max(1, Number(page) || 1)}`;
  }

  function currentKnowledgeSource() {
    const routeKey = currentRouteVideoKey();
    const current = routeKey
      ? (state.items.find((it) => routeVideoKey(it.bvid, Number(it.page) || 1) === routeKey)
        || (routeVideoKey(state.transcriptItem?.bvid, state.transcriptItem?.page || 1) === routeKey ? state.transcriptItem : null))
      : (state.transcriptItem || selectedItems()[0] || null);
    const bvid = current?.bvid || String(state.aiSessionInput?.vars?.bvid || "").match(/BV[\w]+/i)?.[0] || "";
    const page = Math.max(1, Number(current?.page || 1));
    return {
      sourceKey: knowledgeSourceKey(bvid, page),
      bvid,
      page,
      title: current?.title || String(state.aiSessionInput?.vars?.title || document.title || bvid),
      author: current?.author || String(state.aiSessionInput?.vars?.author || ""),
    };
  }

  function knowledgeNodesForAnchor(anchorId: string) {
    return SubBatch.SubBatchMonorepo.ui.knowledgeNavigation.nodesForAnchor(state.knowledgeNodes || [], anchorId);
  }

  function knowledgeAnchorById(id: string) {
    return SubBatch.SubBatchMonorepo.ui.knowledgeNavigation.anchorById(state.knowledgeAnchors || [], id);
  }

  function knowledgeNodeById(id: string) {
    return SubBatch.SubBatchMonorepo.ui.knowledgeNavigation.nodeById(state.knowledgeNodes || [], id);
  }

  function parseKnowledgeOutput(raw: string) {
    const source = String(raw || "");
    const match = source.match(/<suggestions>([\s\S]*?)(?:<\/suggestions>|$)/i);
    const answer = source.replace(/\n?<suggestions>[\s\S]*$/i, "").trim();
    const suggestions = match
      ? (match[1] || "").split(/\r?\n/).map((x) => x.replace(/^\s*[-*\d.)]+\s*/, "").trim()).filter(Boolean).slice(0, 4)
      : [];
    return { answer, suggestions };
  }

  function knowledgeVisibleAnswer(raw: string) {
    return parseKnowledgeOutput(raw).answer || String(raw || "").replace(/<suggestions>[\s\S]*$/i, "").trim();
  }

  /**
   * Post-process sanitized HTML: turn ==phrase== into highlighter marks.
   * Tree-walk text nodes only (skip code/math/links) so `a == b` in code stays intact.
   */
  function decorateMarkdownHighlights(html: string) {
    if (typeof document === "undefined") return String(html || "");
    const tpl = document.createElement("template");
    tpl.innerHTML = toTrustedHTML(String(html || ""));
    const walker = document.createTreeWalker(tpl.content, NodeFilter.SHOW_TEXT);
    const nodes: Text[] = [];
    while (walker.nextNode()) {
      if (walker.currentNode instanceof Text) nodes.push(walker.currentNode);
    }

    for (const node of nodes) {
      const parent = node.parentElement;
      if (!parent) continue;
      if (
      parent.closest(
        "pre, code, kbd, samp, a, .katex, .katex-html, .katex-mathml, .bsb-katex-display, .bsb-katex-inline, .bsb-math-fallback, .mermaid, .bsb-md-highlight, script, style",
      )
    ) {
      continue;
    }
      const text = node.nodeValue || "";
      if (!text.includes("==")) continue;

      const regex = /==([^=\n]{1,120}?)==/g;
      let match;
      let cursor = 0;
      let changed = false;
      const frag = document.createDocumentFragment();

      while ((match = regex.exec(text))) {
        changed = true;
        if (match.index > cursor) {
          frag.appendChild(document.createTextNode(text.slice(cursor, match.index)));
        }
        const value = String(match[1] || "").trim();
        if (!value) {
          frag.appendChild(document.createTextNode(match[0]));
          cursor = regex.lastIndex;
          continue;
        }
        let hash = 0;
        for (let i = 0; i < value.length; i += 1) {
          hash = ((hash * 31) + value.charCodeAt(i)) >>> 0;
        }
        const tone = hash % 4;
        const mark = document.createElement("mark");
        mark.className = `bsb-md-highlight bsb-md-highlight-${tone}`;
        mark.textContent = value;
        frag.appendChild(mark);
        cursor = regex.lastIndex;
      }
      if (!changed) continue;
      if (cursor < text.length) {
        frag.appendChild(document.createTextNode(text.slice(cursor)));
      }
      node.replaceWith(frag);
    }
    return tpl.innerHTML;
  }

  /**
   * Split pre-processed markdown into reading blocks.
   * Code fences must be protected first so blank lines inside ``` do not split cards.
   * Math should already be @@BSBMATHn@@ placeholders (from prepareMarkdownMath).
   */
  function knowledgeAnswerReadingBlocks(text: string) {
    const codes: string[] = [];
    let source = String(text || "").replace(/\r\n?/g, "\n").trim();
    if (!source) return [];
    source = source.replace(/```[\s\S]*?```/g, (m) => {
      const i = codes.length;
      codes.push(m);
      return `@@BSBSPLITCODE${i}@@`;
    });
    const restore = (chunk: string) =>
      String(chunk || "").replace(/@@BSBSPLITCODE(\d+)@@/g, (_, id) => {
        const i = Number(id);
        return codes[i] != null ? codes[i] : "";
      });

    const blocks = [];
    let paragraph: string[] = [];
    let topic = "";
    const flush = () => {
      const value = paragraph.join("\n").trim();
      paragraph = [];
      if (!value) return;
      blocks.push({ type: "paragraph", text: restore(value), topic });
    };
    for (const rawLine of source.split("\n")) {
      const line = rawLine.trimEnd();
      const trimmed = line.trim();
      if (!trimmed) {
        flush();
        continue;
      }
      // Standalone math display placeholders form their own card.
      if (/^@@BSBMATH\d+@@$/.test(trimmed)) {
        flush();
        blocks.push({ type: "paragraph", text: restore(trimmed), topic });
        continue;
      }
      const heading = trimmed.match(/^#{1,4}\s+(.+)$/);
      if (heading) {
        flush();
        topic = (heading[1] || "").replace(/[*_`]+/g, "").trim();
        blocks.push({ type: "heading", text: topic });
        continue;
      }
      if (/^(-{3,}|\*{3,}|_{3,})$/.test(trimmed)) {
        flush();
        continue;
      }
      paragraph.push(line);
    }
    flush();
    return blocks;
  }

  /** Load marked/DOMPurify/KaTeX before Knowledge HTML is painted. */
  async function ensureKnowledgeRenderLibs(text = "") {
    const source = String(text || "");
    await ensureMarkdownCore();
    if (hasMathSyntax(source)) await ensureKatex();
    if (hasCodeSyntax(source)) {
      try {
        await ensureHighlight();
      } catch  {
        /* optional */
      }
    }
  }

  /**
   * Parse one knowledge markdown chunk with shared maths table.
   * Order: marked → KaTeX placeholders → sanitize → ==highlight==.
   */
  function knowledgeChunkToHtml(chunk: string, maths: readonly {tex:string;display:boolean}[]) {
    let html = "";
    try {
      html =
        typeof marked !== "undefined" && marked?.parse
          ? marked.parse(String(chunk || ""))
          : simpleMarkdownFallback(String(chunk || ""));
    } catch  {
      html = simpleMarkdownFallback(String(chunk || ""));
    }
    if (maths?.length) html = replaceMathPlaceholders(html, maths, katexToHtml);
    return decorateMarkdownHighlights(sanitizeRenderedHtml(html));
  }

  /**
   * Render knowledge answers as segmented cards matching AI 处理字幕 reading UI.
   * Full-document prepareMarkdownMath first so multi-line $$ / code fences stay intact.
   */
  function renderKnowledgeAnswerCards(text: string, { streaming = false } = {}) {
    return SubBatch.SubBatchMonorepo.ui.knowledgeAnswerView.answerCardsHtml(text, {
      streaming,
      prepare: prepareMarkdownMath,
      blocks: knowledgeAnswerReadingBlocks,
      chunkHtml: knowledgeChunkToHtml,
      escapeHtml,
    });
  }

  async function hydrateKnowledgeAnswerDom(scope: Element, epoch = state.renderEpoch) {
    if (!scope) return;
    scope.querySelectorAll<HTMLAnchorElement>("a[href]").forEach((a) => {
      a.target = "_blank";
      a.rel = "noopener noreferrer";
    });
    try {
      await enhanceCodeBlocks(scope, epoch);
    } catch  {
      /* ignore highlight failures */
    }
  }

  function knowledgeGetModelConfig() {
    const profiles = state.aiProfiles?.length ? state.aiProfiles : loadAiProfiles();
    const ready = profiles.filter((p) => p.enabled !== false && p.apiKey && p.baseUrl && p.model);
    let model: AiProfile | null | undefined = ready.find((p) => p.id === state.knowledgeModelId);
    if (!model) model = ready.find((p) => p.enabled) || ready[0] || null;
    if (model && state.knowledgeModelId !== model.id) {
      state.knowledgeModelId = model.id;
      storageSet(KNOWLEDGE_MODEL_STORE_KEY, model.id);
    }
    return model;
  }

  function knowledgeModelOptionsHtml() {
    const profiles = state.aiProfiles?.length ? state.aiProfiles : loadAiProfiles();
    const ready = profiles.filter((p) => p.enabled !== false && p.apiKey && p.baseUrl && p.model);
    const selected = knowledgeGetModelConfig();
    if (!ready.length) return '<option value="">没有可用 LLM</option>';
    return ready.map((p) => `<option value="${escapeAttr(p.id)}"${selected?.id === p.id ? " selected" : ""}>${escapeHtml(p.name || p.model)}</option>`).join("");
  }

  function knowledgeContextHtml(anchor: KnowledgeEvidence|null|undefined) {
    return SubBatch.SubBatchMonorepo.ui.knowledgeAnswerView.evidenceHtml(
      anchor, state.ui?.knowledgeContextOpen === true, escapeHtml,
    );
  }

  function knowledgeAnswerBodyHtml(activeNode: KnowledgeAnswerNode|null|undefined) {
    return SubBatch.SubBatchMonorepo.ui.knowledgeAnswerView.answerBodyHtml(activeNode, {
      escapeHtml,
      visibleAnswer: knowledgeVisibleAnswer,
      renderCards: renderKnowledgeAnswerCards,
      suggestionsHtml: (node) => SubBatch.SubBatchMonorepo.ui.knowledgeTreeRenderer.suggestionsHtml(node, escapeAttr, escapeHtml),
    });
  }

  function knowledgeComposerHtml() {
    return SubBatch.SubBatchMonorepo.ui.knowledgeAnswerView.composerHtml(
      !!state.knowledgeBusy, knowledgeModelOptionsHtml(),
    );
  }

  function knowledgeRailBodyHtml(anchor: KnowledgeAnchor, activeNode: WorkbenchKnowledgeNode|null|undefined, { showTree = state.knowledgeTreeOpen } = {}) {
    const treeOpen = !!showTree;
    const treePane = treeOpen
      ? `<aside class="bsb-knowledge-tree-pane" data-role="knowledge-tree-pane"><div class="bsb-knowledge-pane-head"><span class="bsb-knowledge-kicker">追问树</span><button type="button" class="bsb-icon-btn" data-knowledge-tree-toggle title="收起追问树">‹</button></div><div class="bsb-knowledge-tree">${SubBatch.SubBatchMonorepo.ui.knowledgeTreeRenderer.treeHtml(anchor.id, activeNode?.id || "", state.knowledgeNodes || [], escapeHtml, escapeAttr)}</div></aside>`
      : "";
    return `${knowledgeContextHtml(anchor)}
      <div class="bsb-knowledge-crumbs">${SubBatch.SubBatchMonorepo.ui.knowledgeTreeRenderer.breadcrumbHtml(activeNode, activeNode ? SubBatch.SubBatchMonorepo.app.knowledge.ancestorNodes(activeNode, state.knowledgeNodes || []) : [], escapeHtml, escapeAttr)}${!treeOpen ? `<button type="button" class="bsb-mini" data-knowledge-tree-toggle title="展开追问树" style="margin-left:auto">☷ 追问树</button>` : ""}</div>
      <div class="bsb-knowledge-rail-split${treeOpen ? " with-tree" : ""}">${treePane}<div class="bsb-knowledge-split-main"><div class="bsb-knowledge-panel-main">${knowledgeAnswerBodyHtml(activeNode)}</div>${knowledgeComposerHtml()}</div></div>`;
  }

  /** Baseline name retained for golden function-name parity. */
  function knowledgeAnchorListItemHtml(anchor: KnowledgeAnchor, activeAnchorId = state.knowledgeActiveAnchorId) {
    const count = knowledgeNodesForAnchor(anchor.id).length;
    const active = anchor.id === activeAnchorId;
    return `<button type="button" class="bsb-knowledge-list-item${active ? " active" : ""}" data-knowledge-anchor-list="${escapeAttr(anchor.id)}">
      <span class="bsb-knowledge-list-dot"></span>
      <span class="bsb-knowledge-list-main"><strong>${escapeHtml(anchor.selectedText)}</strong><small>${count} 个追问${anchor.timeStart != null ? ` · ${coreCall("formatClock", anchor.timeStart)}` : ""}${anchor.starred ? " · ★" : ""}</small></span>
      ${anchor.starred ? '<span class="bsb-knowledge-star">★</span>' : ""}
    </button>`;
  }

  function knowledgeNavigatorHtml(anchors: KnowledgeAnchor[], activeAnchorId: string|undefined, activeNodeId: string) {
    if (!anchors.length) {
      return '<div class="bsb-knowledge-library-empty">没有匹配的知识锚点。<br>去 AI → 预处理 → AI 处理字幕中选中概念开始。</div>';
    }
    const groups = SubBatch.SubBatchMonorepo.ui.knowledgeNavigation.groupAnchors(
      anchors, (anchor) => knowledgeSourceKey(anchor.bvid, anchor.page || 1),
    );
    return groups.map((group) => {
      const items = group.anchors.map((anchor) => {
        const count = knowledgeNodesForAnchor(anchor.id).length;
        const active = anchor.id === activeAnchorId;
        const threads = active && count
          ? `<div class="bsb-knowledge-nav-threads">${SubBatch.SubBatchMonorepo.ui.knowledgeTreeRenderer.treeHtml(anchor.id, activeNodeId || "", state.knowledgeNodes || [], escapeHtml, escapeAttr)}</div>`
          : "";
        return `<div class="bsb-knowledge-nav-anchor">${knowledgeAnchorListItemHtml(anchor, activeAnchorId)}${threads}</div>`;
      }).join("");
      return `<section class="bsb-knowledge-source-group"><div class="bsb-knowledge-source-label" title="${escapeAttr(group.label)}">${escapeHtml(group.label)}</div>${items}</section>`;
    }).join("");
  }

  function knowledgeReaderHtml(anchor: KnowledgeAnchor|KnowledgeReaderAnchor, activeNode: WorkbenchKnowledgeNode|null|undefined, { isSmall = false } = {}) {
    return SubBatch.SubBatchMonorepo.ui.knowledgeReader.readerHtml(anchor, {
      isSmall,
      escapeAttr,
      escapeHtml,
      formatClock: (time) => coreCall("formatClock", time),
      contextHtml: knowledgeContextHtml(anchor),
      breadcrumbHtml: SubBatch.SubBatchMonorepo.ui.knowledgeTreeRenderer.breadcrumbHtml(
        activeNode,
        activeNode ? SubBatch.SubBatchMonorepo.app.knowledge.ancestorNodes(activeNode, state.knowledgeNodes || []) : [],
        escapeHtml, escapeAttr,
      ),
      answerHtml: knowledgeAnswerBodyHtml(activeNode),
      composerHtml: knowledgeComposerHtml(),
    });
  }

  function pinKnowledgeScrollTop(top = 0) {
    const root = document.getElementById(PANEL_ID);
    if (!root) return;
    root.querySelectorAll<HTMLElement>(".bsb-knowledge-panel-main, [data-role=\"knowledge-reader-scroll\"]").forEach((el) => {
      el.scrollTop = top;
    });
  }

  function scheduleKnowledgeRender() {
    if (state.knowledgePaintRaf) return;
    state.knowledgePaintRaf = window.setTimeout(() => {
      state.knowledgePaintRaf = 0;
      if (state.ui?.view === "knowledge") renderKnowledgeWorkspace().catch(() => {});
      else if (state.knowledgeRailOpen) renderKnowledgeRail().catch(() => {});
    }, 72);
  }

  async function renderKnowledgeRail() {
    const root = document.getElementById(PANEL_ID);
    const rail = root?.querySelector<HTMLElement>('[data-role="knowledge-rail"]');
    const aiView = root?.querySelector<HTMLElement>('[data-view-panel="ai"]');
    if (!rail || !aiView) return;
    applyKnowledgeLayoutVars(root);
    const oldPanel = rail.querySelector<HTMLElement>('.bsb-knowledge-panel-main');
    const oldScroll = state.knowledgeResetScroll ? 0 : (oldPanel?.scrollTop || 0);
    aiView.classList.toggle("knowledge-open", !!state.knowledgeRailOpen);
    rail.classList.toggle("open", !!state.knowledgeRailOpen);
    rail.setAttribute("aria-hidden", state.knowledgeRailOpen ? "false" : "true");
    if (!state.knowledgeRailOpen) return;
    if (!state.knowledgeAnchors.length) {
      try { await knowledgeRefreshCache(); } catch  { /* render empty */ }
    }
    const anchor = knowledgeAnchorById(state.knowledgeActiveAnchorId);
    if (!anchor) {
      rail.innerHTML = toTrustedHTML('<button type="button" class="bsb-knowledge-rail-resize" data-role="knowledge-rail-resize" title="拖拽调整 Knowledge 宽度" aria-label="调整 Knowledge 宽度"></button><div class="bsb-knowledge-rail-empty"><span>✦</span><strong>Knowledge</strong><p>在 AI 处理字幕中选中文字，创建一个局部知识锚点。</p><button type="button" class="bsb-btn ghost" data-knowledge-close>关闭</button></div>');
      return;
    }
    const nodes = knowledgeNodesForAnchor(anchor.id);
    if (!nodes.some((n: { id: string; }) => n.id === state.knowledgeActiveNodeId)) {
      const latest = [...nodes].sort((a, b) => Number(b.updatedAt || 0) - Number(a.updatedAt || 0))[0];
      state.knowledgeActiveNodeId = latest?.id || "";
    }
    const activeNode = knowledgeNodeById(state.knowledgeActiveNodeId);
    const answerText = knowledgeVisibleAnswer(activeNode?.answer || activeNode?.preview || "");
    try {
      await ensureKnowledgeRenderLibs(answerText);
    } catch  {
      /* fall back to simple markdown */
    }
    rail.innerHTML = toTrustedHTML(`<button type="button" class="bsb-knowledge-rail-resize" data-role="knowledge-rail-resize" title="拖拽调整 Knowledge 宽度" aria-label="调整 Knowledge 宽度"></button>
      <div class="bsb-knowledge-rail-head">
        <div class="bsb-knowledge-anchor-title"><span class="bsb-knowledge-kicker">KNOWLEDGE ANCHOR</span><strong>${escapeHtml(anchor.selectedText)}</strong><small>${escapeHtml(anchor.title || anchor.bvid)} · ${anchor.timeStart != null ? coreCall("formatClock", anchor.timeStart) : "局部字幕"}${Number(anchor.timeEnd) > Number(anchor.timeStart) ? `–${coreCall("formatClock", anchor.timeEnd || 0)}` : ""}</small></div>
        <div class="bsb-knowledge-rail-actions">${state.knowledgeBusy ? '<button type="button" class="bsb-icon-btn" data-knowledge-stop title="停止回答">■</button>' : ''}<button type="button" class="bsb-icon-btn${anchor.starred ? " active" : ""}" data-knowledge-star-anchor title="${anchor.starred ? "取消收藏锚点" : "收藏锚点"}">${anchor.starred ? "★" : "☆"}</button><button type="button" class="bsb-icon-btn" data-knowledge-new-root title="新建独立根问题">＋</button><button type="button" class="bsb-icon-btn${state.knowledgeTreeOpen ? " active" : ""}" data-knowledge-tree-toggle title="${state.knowledgeTreeOpen ? "收起追问树" : "展开追问树（并排）"}">☷</button><button type="button" class="bsb-icon-btn" data-knowledge-open-workspace title="在 Knowledge 工作区打开">↗</button><button type="button" class="bsb-icon-btn" data-knowledge-close title="关闭">×</button></div>
      </div>
      <div class="bsb-knowledge-rail-body">${knowledgeRailBodyHtml(anchor, activeNode)}</div>`);
    const nextPanel = rail.querySelector<HTMLElement>('.bsb-knowledge-panel-main');
    if (nextPanel) nextPanel.scrollTop = oldScroll;
    await hydrateKnowledgeAnswerDom(rail.querySelector<HTMLElement>(".bsb-knowledge-rail-body") || rail, state.renderEpoch);
  }

  async function openKnowledgeAnchor(anchorId: string, { workspace = false } = {}) {
    try { await knowledgeRefreshCache(); } catch (error) { setStatus(`知识库读取失败：${errorMessage(error)}`, "err"); }
    const anchor = knowledgeAnchorById(anchorId);
    if (!anchor) return;
    const selection = appCall("knowledge.selectAnchor", anchor.id, state.knowledgeNodes);
    state.knowledgeActiveAnchorId = selection.anchorId;
    state.knowledgeActiveNodeId = selection.nodeId;
    if (workspace) {
      setWorkspace("knowledge");
      await renderKnowledgeWorkspace();
    } else {
      state.knowledgeRailOpen = true;
      await renderKnowledgeRail();
    }
  }

  function closeKnowledgeRail() {
    state.knowledgeRailOpen = false;
    renderKnowledgeRail().catch(() => {});
  }

  function bindKnowledgeLayoutInteractions(root: WorkbenchPanelElement|null|undefined) {
    if (!root || root._bsbKnowledgeLayoutBound) return;
    root._bsbKnowledgeLayoutBound = true;

    const startResize = (kind: string, event: PointerEvent) => {
      if (!state.ui || event.button !== 0) return;
      event.preventDefault();
      event.stopPropagation();
      const startX = event.clientX;
      const startRail = clampKnowledgeRailW(state.ui.knowledgeRailW, state.ui.w);
      const startNav = clampKnowledgeNavW(state.ui.knowledgeNavW, state.ui.w);
      const rail = root.querySelector<HTMLElement>('[data-role="knowledge-rail"]');
      root.classList.add("knowledge-resizing");
      rail?.classList.add("resizing");
      const onMove = (ev: { clientX: number; }) => {
        if (!state.ui) return;
        if (kind === "rail") {
          // Drag left edge: move left = wider rail.
          state.ui.knowledgeRailW = clampKnowledgeRailW(startRail + (startX - ev.clientX), state.ui.w);
        } else if (kind === "nav") {
          state.ui.knowledgeNavW = clampKnowledgeNavW(startNav + (ev.clientX - startX), state.ui.w);
        }
        applyKnowledgeLayoutVars(root);
      };
      const onUp = () => {
        window.removeEventListener("pointermove", onMove);
        window.removeEventListener("pointerup", onUp);
        root.classList.remove("knowledge-resizing");
        rail?.classList.remove("resizing");
        saveUiGeom();
      };
      window.addEventListener("pointermove", onMove);
      window.addEventListener("pointerup", onUp);
    };

    root.addEventListener("pointerdown", (event) => {
      const target = event.target;
      if (!(target instanceof Element)) return;
      if (target.closest('[data-role="knowledge-rail-resize"]')) return startResize("rail", event);
      if (target.closest('[data-role="knowledge-nav-split"]')) return startResize("nav", event);
    });

    root.addEventListener("keydown", (event) => {
      const area = event.target;
      if (!(area instanceof HTMLTextAreaElement)) return;
      if (area.getAttribute("data-role") !== "knowledge-question") return;
      if (event.key !== "Enter" || event.shiftKey) return;
      event.preventDefault();
      if (state.knowledgeBusy) return;
      const q = String(area.value || "").trim();
      if (!q) return;
      knowledgeAsk(state.knowledgeActiveAnchorId, state.knowledgeActiveNodeId || null, q)
        .then(() => { area.value = ""; })
        .catch((error) => setStatus(`Knowledge 追问失败：${errorMessage(error)}`, "err"));
    });
  }

  function hideKnowledgeSelectionToolbar() {
    const root = document.getElementById(PANEL_ID);
    const toolbar = root?.querySelector<HTMLElement>('[data-role="knowledge-selection-toolbar"]');
    if (toolbar) toolbar.hidden = true;
  }

  function captureKnowledgeSelection() {
    const root = document.getElementById(PANEL_ID);
    const toolbar = root?.querySelector<HTMLElement>('[data-role="knowledge-selection-toolbar"]');
    if (!root || !toolbar || currentAiWorkbenchStage() !== "preprocess" || state.aiInputView !== "processed") return hideKnowledgeSelectionToolbar();
    const sel = window.getSelection?.();
    if (!sel || sel.isCollapsed || !sel.rangeCount) return hideKnowledgeSelectionToolbar();
    const text = sel.toString().trim();
    if (text.length < KNOWLEDGE_SELECTION_MIN || text.length > KNOWLEDGE_SELECTION_MAX) return hideKnowledgeSelectionToolbar();
    const range = sel.getRangeAt(0);
    const node = range.commonAncestorContainer instanceof Element ? range.commonAncestorContainer : range.commonAncestorContainer.parentElement;
    const body = node?.closest?.(".bsb-preprocess-block-body");
    const article = body?.closest<HTMLElement>(".bsb-preprocess-block");
    if (!body || !article || !root.contains(body)) return hideKnowledgeSelectionToolbar();
    const source = currentKnowledgeSource();
    const articleSourceKey = article.dataset.knowledgeSourceKey || source.sourceKey;
    const cards = Array.from(article.parentElement?.querySelectorAll<HTMLElement>(".bsb-preprocess-block") || [])
      .filter((card) => (card.dataset.knowledgeSourceKey || articleSourceKey) === articleSourceKey);
    const idx = cards.indexOf(article);
    const contextCards = cards.slice(Math.max(0, idx - 1), Math.min(cards.length, idx + 2));
    const contextText = contextCards.map((card) => {
      const topic = card.dataset.knowledgeTopic || "";
      const clock = card.dataset.knowledgeClock || "";
      const value = card.querySelector<HTMLElement>(".bsb-preprocess-block-body")?.textContent?.trim() || "";
      return `${clock ? `[${clock}] ` : ""}${topic ? `${topic}：` : ""}${value}`;
    }).join("\n\n");
    const rect = range.getBoundingClientRect();
    state.knowledgeSelection = {
      selectedText: text,
      sourceKey: articleSourceKey,
      bvid: article.dataset.knowledgeBvid || source.bvid,
      page: Number(article.dataset.knowledgePage || source.page || 1),
      title: article.dataset.knowledgeTitle || source.title,
      author: article.dataset.knowledgeAuthor || source.author,
      segmentId: article.dataset.knowledgeSegment || "",
      timeStart: Number(article.dataset.knowledgeStart || 0),
      timeEnd: Number(article.dataset.knowledgeEnd || article.dataset.knowledgeStart || 0),
      contextText,
      sourceHash: coreCall("md5", currentInputPreviewText("processed") || ""),
    };
    const compactSelection = text.replace(/\s+/g, " ");
    const selectionLabel = toolbar.querySelector<HTMLElement>('[data-role="knowledge-selection-text"]');
    if (selectionLabel) selectionLabel.textContent = compactSelection.length > 42 ? `${compactSelection.slice(0, 42)}…` : compactSelection;
    const width = 300;
    const left = Math.min(window.innerWidth - width - 10, Math.max(10, rect.left + rect.width / 2 - width / 2));
    const top = Math.max(10, rect.top - 48);
    toolbar.style.left = `${left}px`;
    toolbar.style.top = `${top}px`;
    toolbar.hidden = false;
  }

  async function ensureKnowledgeAnchorFromSelection({ starred = false } = {}) {
    const sel = state.knowledgeSelection;
    if (!sel?.selectedText) throw new Error("当前没有有效字幕选区");
    if (!state.knowledgeAnchors.length) await knowledgeRefreshCache();
    let anchor = state.knowledgeAnchors.find((a) => a.sourceKey === sel.sourceKey && a.selectedText === sel.selectedText && Math.abs(Number(a.timeStart || 0) - Number(sel.timeStart || 0)) <= 5);
    const now = Date.now();
    if (!anchor) {
      anchor = {
        id: makeKnowledgeId("anchor"),
        sourceKey: sel.sourceKey || "",
        bvid: sel.bvid || "",
        page: sel.page || 1,
        title: sel.title || "",
        author: sel.author || "",
        segmentId: sel.segmentId || "",
        selectedText: sel.selectedText,
        timeStart: sel.timeStart || 0,
        timeEnd: sel.timeEnd || 0,
        contextText: sel.contextText || "",
        sourceHash: sel.sourceHash || "",
        starred: !!starred,
        createdAt: now,
        updatedAt: now,
      };
    } else {
      anchor = { ...anchor, contextText: sel.contextText || anchor.contextText || "", sourceHash: sel.sourceHash || anchor.sourceHash || "", starred: anchor.starred || !!starred, updatedAt: now };
    }
    await knowledgePutAnchor(anchor);
    state.knowledgeActiveAnchorId = anchor.id;
    state.knowledgeActiveNodeId = "";
    state.knowledgeRailOpen = true;
    hideKnowledgeSelectionToolbar();
    await decorateKnowledgeAnchors();
    await renderKnowledgeRail();
    renderKnowledgeWorkspace().catch(() => {});
    return anchor;
  }

  let knowledgeController: ReturnType<typeof createKnowledgeController> | null = null;

  async function knowledgeAsk(anchorId: string, parentId: string|null, question: string) {
    const q = String(question || "").trim();
    if (!q || state.knowledgeBusy) return;
    if (!state.knowledgeAnchors.length) await knowledgeRefreshCache();
    const anchor = knowledgeAnchorById(anchorId);
    if (!anchor) throw new Error("知识锚点不存在");
    const model = knowledgeGetModelConfig();
    if (!model) throw new Error("没有可用的 LLM。请先在设置 → LLM 配置 Base URL / API Key / Model");
    const prompt = getActiveKnowledgePromptProfile();
    if (!prompt || (!prompt.systemPrompt.trim() && !prompt.userPromptTemplate.trim())) throw new Error("没有可用的 Knowledge Prompt");
    const parent = parentId ? knowledgeNodeById(parentId) : null;
    const now = Date.now();
    const node: WorkbenchKnowledgeNode = {
      id: makeKnowledgeId("node"),
      anchorId: anchor.id,
      parentId: parent?.id || null,
      question: q,
      answer: "",
      preview: "",
      suggestions: [],
      modelId: model.id,
      starred: false,
      status: "running",
      createdAt: now,
      updatedAt: now,
    };
    state.knowledgeNodes.push(node);
    state.knowledgeActiveNodeId = node.id;
    state.knowledgeBusy = true;
    // Keep tree open so follow-up threads stay visible beside the answer.
    await knowledgePutNode(node);
    state.knowledgeResetScroll = true;
    await Promise.all([
      renderKnowledgeRail(),
      renderKnowledgeWorkspace().catch(() => {}),
    ]);
    pinKnowledgeScrollTop(0);
    state.knowledgeResetScroll = false;
    const vars = {
      title: anchor.title || "",
      bvid: `${anchor.bvid || ""}${(anchor.page || 1) > 1 ? ` P${anchor.page}` : ""}`,
      author: anchor.author || "",
      anchorText: anchor.selectedText || "",
      sourceContext: anchor.contextText || anchor.selectedText || "",
      ancestorPath: appCall("knowledge.branchContext", parent, state.knowledgeNodes || []),
      question: q,
    };
    const messages: ChatCompletionOptions["messages"] = [];
    const systemPrompt = renderPromptTemplate(prompt.systemPrompt, vars).trim();
    const userPrompt = renderPromptTemplate(prompt.userPromptTemplate, vars).trim();
    if (systemPrompt) messages.push({ role: "system", content: systemPrompt });
    if (userPrompt) messages.push({ role: "user", content: userPrompt });
    if (!messages.length) {
      state.knowledgeBusy = false;
      node.status = "error";
      await knowledgePutNode(node).catch(() => {});
      throw new Error("Knowledge Prompt 为空");
    }
    const runtime = createAiRuntime(`Knowledge · ${model.name || model.model}`);
    state.knowledgeRuntime = runtime;
    knowledgeController ||= appCall("knowledge.createController");
    const request = knowledgeController.begin(node.id);
    let latest = "";
    let lastPreviewPersistAt = 0;
    await SubBatch.SubBatchMonorepo.app.knowledge.runAnswer({
      node,
      generate: () => request.stage(() => new Promise<void>((resolve, reject) => {
      requestChatCompletion({
        runtime,
        baseUrl: model.baseUrl,
        apiKey: model.apiKey,
        model: model.model,
        temperature: model.temperature,
        maxTokens: model.maxTokens,
        messages,
        stream: model.stream !== false,
        onStatus() {},
        onDelta(_delta, full: unknown) {
          if (!knowledgeAnchorById(anchor.id)) return;
          const preview = appCall("knowledge.updateStreamPreview", node, full, lastPreviewPersistAt, Date.now());
          latest = preview.latest;
          if (preview.shouldPersist) {
            lastPreviewPersistAt = preview.persistAt;
            knowledgeStoreRequest(KNOWLEDGE_NODE_STORE, "readwrite", (s) => s.put(node)).catch(() => {});
          }
          scheduleKnowledgeRender();
        },
        onDone(full) {
          latest = String(full || latest || "");
          resolve();
        },
        onError(error) { reject(error instanceof Error ? error : new Error(String(error || "Knowledge 请求失败"))); },
      });

      })).then(() => latest),
      parse: parseKnowledgeOutput,
      visible: knowledgeVisibleAnswer,
      partial: () => latest,
      stopped: () => runtime.abort || !request.current(),
      exists: () => !!knowledgeAnchorById(anchor.id),
      persist: (answer) => knowledgePutNode(answer),
      onSuccess: async () => {
        request.finish(node.status === "stopped" ? "stopped" : node.status === "error" ? "error" : "done");
        anchor.updatedAt = node.updatedAt;
        await knowledgePutAnchor(anchor);
        await ensureKnowledgeRenderLibs(node.answer).catch(() => {});
        setStatus(node.status === "stopped" ? "Knowledge 已停止" : `Knowledge · 已回答：${q.slice(0, 28)}${q.length > 28 ? "…" : ""}`, node.status === "stopped" ? "" : "ok");
      },
      onFailure: () => {
        request.finish(node.status === "stopped" ? "stopped" : node.status === "error" ? "error" : "done");
        setStatus(node.status === "stopped" ? "Knowledge 已停止" : `Knowledge 失败：${node.error}`, node.status === "stopped" ? "" : "err");
      },
      cleanup: async () => {
      if (state.knowledgeRuntime !== runtime) return;
      state.knowledgeBusy = false;
      state.knowledgeRuntime = null;
      await renderKnowledgeRail();
      await renderKnowledgeWorkspace().catch(() => {});

      },
    });
  }

  function abortKnowledgeRequest() {
    knowledgeController?.stop();
    const runtime = state.knowledgeRuntime;
    if (!runtime) return;
    runtime.abort = true;
    try { runtime.abortController?.abort(); } catch  { /* noop */ }
    try { runtime.xhr?.abort?.(); } catch  { /* noop */ }
    setStatus("正在停止 Knowledge 回答…");
  }

  /** Unwrap existing knowledge-anchor marks so re-decoration stays idempotent. */
  function unwrapKnowledgeAnchorMarks(root: Element) {
    if (!root) return;
    root.querySelectorAll("mark.bsb-knowledge-anchor-mark").forEach((mark) => {
      const parent = mark.parentNode;
      if (!parent) return;
      while (mark.firstChild) parent.insertBefore(mark.firstChild, mark);
      parent.removeChild(mark);
    });
  }

  /**
   * Wrap the first occurrence of `needle` in a text node under root.
   * Skips code/math/links so rich Markdown bodies keep structure.
   */
  function wrapFirstTextOccurrence(root: Node, needle: string|undefined, createMark:(text: string)=>HTMLElement) {
    const value = String(needle || "");
    if (!root || !value) return false;
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    const nodes: Text[] = [];
    while (walker.nextNode()) {
      if (walker.currentNode instanceof Text) nodes.push(walker.currentNode);
    }
    for (const node of nodes) {
      const parent = node.parentElement;
      if (!parent) continue;
      if (parent.closest("pre, code, kbd, samp, a, button, .katex, .bsb-katex-display, .bsb-katex-inline, .bsb-math-fallback, mark.bsb-knowledge-anchor-mark")) {
        continue;
      }
      const text = node.nodeValue || "";
      const idx = text.indexOf(value);
      if (idx < 0) continue;
      const before = text.slice(0, idx);
      const mid = text.slice(idx, idx + value.length);
      const after = text.slice(idx + value.length);
      const frag = document.createDocumentFragment();
      if (before) frag.appendChild(document.createTextNode(before));
      const mark = createMark(mid);
      if (mark) frag.appendChild(mark);
      else frag.appendChild(document.createTextNode(mid));
      if (after) frag.appendChild(document.createTextNode(after));
      node.replaceWith(frag);
      return true;
    }
    return false;
  }

  async function decorateKnowledgeAnchors(host: Element | null = null) {
    const root = document.getElementById(PANEL_ID);
    const scope = host || root?.querySelector<HTMLElement>('[data-role="ai-content"]');
    if (!scope || !scope.querySelector<HTMLElement>(".bsb-preprocess-reading")) return;
    try { await knowledgeRefreshCache(); } catch  { return; }
    const anchors = state.knowledgeAnchors;
    const bodies = Array.from(scope.querySelectorAll<HTMLElement>(".bsb-preprocess-block-body"));
    for (const body of bodies) {
      const article = body.closest<HTMLElement>(".bsb-preprocess-block");
      const rich = body.classList.contains("bsb-md-rich");
      const original = body.getAttribute("data-knowledge-plain") || body.textContent || "";
      const articleSourceKey = article?.dataset.knowledgeSourceKey || currentKnowledgeSource().sourceKey;
      const relevant = anchors.filter((a) => a.sourceKey === articleSourceKey && !!a.selectedText && original.includes(a.selectedText));
      if (!relevant.length) {
        if (article) article.classList.remove("has-knowledge");
        continue;
      }
      const ranges = relevant
        .map((a) => ({
          a,
          start: original.indexOf(a.selectedText || ""),
          end: original.indexOf(a.selectedText || "") + (a.selectedText || "").length,
        }))
        .filter((x) => x.start >= 0)
        .sort((x, y) => x.start - y.start || y.end - x.end);
      const accepted = [];
      let cursor = -1;
      for (const r of ranges) {
        if (r.start < cursor) continue;
        accepted.push(r);
        cursor = r.end;
      }
      if (rich) {
        // Keep Markdown/math HTML; only wrap text nodes for anchor marks.
        unwrapKnowledgeAnchorMarks(body);
        for (const r of accepted) {
          wrapFirstTextOccurrence(body, r.a.selectedText || "", (mid: string|null) => {
            const mark = document.createElement("mark");
            mark.className = "bsb-knowledge-anchor-mark";
            mark.dataset.knowledgeAnchorId = r.a.id;
            mark.title = `${knowledgeNodesForAnchor(r.a.id).length} 个追问 · 点击继续`;
            mark.textContent = mid;
            return mark;
          });
        }
      } else {
        let html = "";
        cursor = 0;
        for (const r of accepted) {
          html += escapeHtml(original.slice(cursor, r.start));
          html += `<mark class="bsb-knowledge-anchor-mark" data-knowledge-anchor-id="${escapeAttr(r.a.id)}" title="${knowledgeNodesForAnchor(r.a.id).length} 个追问 · 点击继续">${escapeHtml(original.slice(r.start, r.end))}</mark>`;
          cursor = r.end;
        }
        html += escapeHtml(original.slice(cursor));
        body.innerHTML = toTrustedHTML(html);
      }
      if (article) article.classList.add("has-knowledge");
    }
  }

  async function renderKnowledgeWorkspace() {
    const root = document.getElementById(PANEL_ID);
    const workspace = root?.querySelector<HTMLElement>('[data-role="knowledge-workspace"]') || root?.querySelector<HTMLElement>(".bsb-knowledge-workspace");
    const list = root?.querySelector<HTMLElement>('[data-role="knowledge-list"]');
    const detail = root?.querySelector<HTMLElement>('[data-role="knowledge-detail"]');
    const count = root?.querySelector<HTMLElement>('[data-role="knowledge-count"]');
    if (!list || !detail) return;
    applyKnowledgeLayoutVars(root);
    const isSmall = root?.getAttribute("data-panel-size") === "small";
    const oldScrollEl = detail.querySelector<HTMLElement>('[data-role="knowledge-reader-scroll"]');
    const oldScroll = state.knowledgeResetScroll ? 0 : (oldScrollEl?.scrollTop || 0);
    try {
      if (!state.knowledgeBusy) await knowledgeRefreshCache();
    } catch (error) {
      detail.innerHTML = toTrustedHTML(`<div class="bsb-empty"><strong>知识库不可用</strong><span>${escapeHtml(errorMessage(error))}</span></div>`);
      return;
    }
    const anchors = SubBatch.SubBatchMonorepo.ui.knowledgeNavigation.filterAnchors(
      state.knowledgeAnchors, state.knowledgeNodes, state.knowledgeSearch,
    );
    if (count) count.textContent = String(anchors.length);
    const selection = SubBatch.SubBatchMonorepo.ui.knowledgeNavigation.resolveSelection(
      anchors, state.knowledgeNodes, state.knowledgeActiveAnchorId, state.knowledgeActiveNodeId, isSmall,
    );
    state.knowledgeActiveAnchorId = selection.anchorId;
    state.knowledgeActiveNodeId = selection.nodeId;
    const anchor = knowledgeAnchorById(state.knowledgeActiveAnchorId);
    const activeNode = knowledgeNodeById(state.knowledgeActiveNodeId);
    const answerText = knowledgeVisibleAnswer(activeNode?.answer || activeNode?.preview || "");
    try {
      await ensureKnowledgeRenderLibs(answerText);
    } catch  {
      /* fall back to simple markdown */
    }
    list.innerHTML = toTrustedHTML(knowledgeNavigatorHtml(anchors, state.knowledgeActiveAnchorId, state.knowledgeActiveNodeId));
    workspace?.classList.toggle("detail-open", !!anchor);
    if (!anchor) {
      detail.innerHTML = toTrustedHTML('<div class="bsb-empty"><div class="bsb-empty-ico">◇</div><strong>选择一个知识锚点</strong><span>左侧按视频组织锚点；当前锚点的追问树会直接展开在其下方。</span></div>');
      return;
    }
    detail.innerHTML = toTrustedHTML(knowledgeReaderHtml(anchor, activeNode, { isSmall }));
    const nextScroll = detail.querySelector<HTMLElement>('[data-role="knowledge-reader-scroll"]');
    if (nextScroll) nextScroll.scrollTop = oldScroll;
    await hydrateKnowledgeAnswerDom(detail, state.renderEpoch);
  }

  // ─── Postprocess output tasks ───────────────────────────────────────────
  // A task is a user-facing output artifact. It references one POST Prompt and
  // one or more LLM profiles. This is intentionally separate from Prompt/LLM
  // definitions so the main AI surface can organize results by artifact first.
  function makePostTaskId() {
    return `output-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  }

  function normalizePostTask(seed: unknown, index = 0) {
    const o = seed && typeof seed === "object" && !Array.isArray(seed)
      ? seed as Record<string, unknown> : {};
    return {
      id: String(o.id || makePostTaskId()),
      promptId: String(o.promptId || ""),
      modelIds: Array.from(new Set((Array.isArray(o.modelIds) ? o.modelIds : []).map(String).filter(Boolean))),
      enabled: !(o.enabled === false || o.enabled === "false" || o.enabled === 0),
      order: Number.isFinite(Number(o.order)) ? Number(o.order) : index,
    };
  }

  function sanitizePostTasks(tasks: readonly unknown[] | null | undefined, prompts: readonly PromptProfile[],
    profiles: readonly AiProfile[], { createDefault = true } = {}) {
    const posts = (prompts || []).filter((p: { stage: string; }) => p.stage === "postprocess");
    const postIds = new Set(posts.map((p) => p.id));
    const profileIds = new Set((profiles || []).map((p) => p.id));
    let out = (Array.isArray(tasks) ? tasks : [])
      .map(normalizePostTask)
      .filter((t) => postIds.has(t.promptId))
      .map((t, i) => ({ ...t, modelIds: t.modelIds.filter((id) => profileIds.has(id)), order: i }));
    if (!out.length && createDefault && posts.length) {
      const preferred = posts.find((p: { id: string; }) => p.id === state.activePromptId) || posts[0];
      const enabledModels = (profiles || []).filter((p) => p.enabled).map((p) => p.id);
      if (!preferred) return out;
      out = [normalizePostTask({ promptId: preferred.id, modelIds: enabledModels, enabled: true, order: 0 }, 0)];
    }
    return out;
  }

  function loadPostTasks() {
    const prompts = state.promptProfiles?.length ? state.promptProfiles : loadPromptProfiles().prompts;
    const profiles = state.aiProfiles?.length ? state.aiProfiles : loadAiProfiles();
    let tasks = [];
    let storedTaskVersion = 0;
    try {
      const raw = storageGet(POST_TASKS_STORE_KEY, null);
      if (raw) {
        const parsed = typeof raw === "string" ? JSON.parse(raw) : raw;
        tasks = Array.isArray(parsed) ? parsed : parsed?.tasks;
        storedTaskVersion = Array.isArray(parsed) ? 1 : Number(parsed?.version || 1);
      }
    } catch  { /* use default */ }
    tasks = sanitizePostTasks(tasks, prompts, profiles, { createDefault: true });
    const htmlPrompt = prompts.find((p: { id: string; stage: string; }) => p.id === DEFAULT_HTML_FOLIO_PROMPT_ID && p.stage === "postprocess");
    if (htmlPrompt && storedTaskVersion < 2 && !tasks.some((t) => t.promptId === htmlPrompt.id)) {
      const modelIds = tasks[0]?.modelIds?.length
        ? [...tasks[0].modelIds]
        : profiles.filter((p) => p.enabled).map((p) => p.id);
      tasks.push(normalizePostTask({
        promptId: htmlPrompt.id,
        modelIds,
        enabled: true,
        order: tasks.length,
      }, tasks.length));
    }
    if (storedTaskVersion < POST_TASKS_SCHEMA_VERSION) {
      try {
        storageSet(POST_TASKS_STORE_KEY, JSON.stringify({ version: POST_TASKS_SCHEMA_VERSION, tasks }));
      } catch  { /* ignore */ }
    }
    state.postTasks = tasks;
    if (!tasks.some((t) => t.id === state.aiActiveTaskId)) state.aiActiveTaskId = tasks[0]?.id || "";
    return tasks;
  }

  function savePostTasks(tasks: ({ modelIds: unknown[]; order: number; id: string; promptId: string; enabled: boolean; }|{ modelIds: unknown[]; id: string; promptId?: string; })[]) {
    const prompts = state.promptProfiles?.length ? state.promptProfiles : loadPromptProfiles().prompts;
    const profiles = state.aiProfiles?.length ? state.aiProfiles : loadAiProfiles();
    const normalized = sanitizePostTasks(tasks, prompts, profiles, { createDefault: true });
    try {
      storageSet(POST_TASKS_STORE_KEY, JSON.stringify({ version: POST_TASKS_SCHEMA_VERSION, tasks: normalized }));
    } catch  { /* ignore */ }
    state.postTasks = normalized;
    if (!normalized.some((t) => t.id === state.aiActiveTaskId)) state.aiActiveTaskId = normalized[0]?.id || "";
    renderAiFlowDrawer();
    renderAiResultTabs();
    refreshAiChips();
    return normalized;
  }

  function currentPostTasks() {
    return state.postTasks?.length ? state.postTasks : loadPostTasks();
  }

  function promptForTask(task: { promptId?: string; }) {
    return (state.promptProfiles || []).find((p) => p.id === task?.promptId && p.stage === "postprocess") || null;
  }

  function promptListItemHtml(prompt: PromptProfile, { draggable = true } = {}) {
    const selected = prompt.id === state.promptEditorId;
    const active = prompt.stage === "preprocess" ? prompt.id === state.activePrePromptId : prompt.stage === "knowledge" ? prompt.id === state.activeKnowledgePromptId : prompt.id === state.activePromptId;
    const dragAttr = draggable ? 'draggable="true"' : 'draggable="false"';
    const title = draggable
      ? `${prompt.name} · 拖拽左侧 ⠿ 调整顺序`
      : `${prompt.name} · 清空搜索后可拖拽排序`;
    return `<div class="bsb-config-list-item${selected ? " selected" : ""}" role="button" tabindex="0" ${dragAttr} data-prompt-list-id="${escapeAttr(prompt.id)}" title="${escapeAttr(title)}">
      <span class="bsb-config-drag" aria-hidden="true" title="拖拽排序">⠿</span>
      <span class="bsb-config-dot${active ? " current" : ""}"></span>
      <span class="bsb-config-item-main">
        <span class="bsb-config-item-name">${escapeHtml(prompt.name)}</span>
        <span class="bsb-config-item-sub">${escapeHtml(prompt.hint || "自定义提示词")}</span>
      </span>
      ${active ? `<span class="bsb-config-badge">${prompt.stage === "preprocess" ? "当前" : prompt.stage === "knowledge" ? "Knowledge" : "默认"}</span>` : ""}
    </div>`;
  }

  function promptEditorHtml(prompt: { stage: unknown; id: unknown; name: unknown; hint: unknown; systemPrompt: unknown; userPromptTemplate: unknown; } | null | undefined, index: number) {
    if (!prompt) {
      return '<div class="bsb-config-editor-empty">没有可编辑的 Prompt。<br>请从左侧新建，或恢复内置 Prompt。</div>';
    }
    const active = prompt.stage === "preprocess" ? prompt.id === state.activePrePromptId : prompt.stage === "knowledge" ? prompt.id === state.activeKnowledgePromptId : prompt.id === state.activePromptId;
    const stageName = prompt.stage === "preprocess" ? "预处理" : prompt.stage === "knowledge" ? "Knowledge" : "后处理";
    const activeMeaning = prompt.stage === "preprocess" ? "当前输入整理默认" : prompt.stage === "knowledge" ? "局部追问默认 Prompt" : "新建产物默认 Prompt";
    return `<section data-prompt-id="${escapeAttr(prompt.id)}" data-prompt-stage="${escapeAttr(prompt.stage)}">
      <div class="bsb-config-editor-head">
        <div class="bsb-config-editor-title">
          <strong>${escapeHtml(prompt.name || `提示词 ${index + 1}`)}</strong>
          <span>${stageName} Prompt · ${active ? activeMeaning : "可在处理方案中自由组合"}</span>
        </div>
        <div class="bsb-config-editor-actions">
          <button type="button" class="bsb-btn ${active ? "ghost" : "primary"}" data-prompt-act="use">${active ? "默认" : "设为默认"}</button>
          <button type="button" class="bsb-btn ghost" data-prompt-act="duplicate">复制</button>
          <button type="button" class="bsb-btn danger" data-prompt-act="delete">删除</button>
        </div>
      </div>
      <label>名称
        <input type="text" data-prompt-field="name" value="${escapeAttr(prompt.name)}" placeholder="提示词名称" autocomplete="off">
      </label>
      <label>简短说明
        <input type="text" data-prompt-field="hint" value="${escapeAttr(prompt.hint)}" placeholder="说明它在管线中的用途" autocomplete="off">
      </label>
      <label>System Prompt
        <textarea data-prompt-field="systemPrompt" spellcheck="false">${escapeHtml(prompt.systemPrompt)}</textarea>
      </label>
      <label>User Prompt Template
        <textarea data-prompt-field="userPromptTemplate" spellcheck="false">${escapeHtml(prompt.userPromptTemplate)}</textarea>
      </label>
      <div class="bsb-prompt-vars">${prompt.stage === "preprocess"
        ? "可用变量：<code>{{title}}</code> <code>{{bvid}}</code> <code>{{author}}</code> <code>{{subtitle}}</code> <code>{{chunkIndex}}</code> <code>{{chunkCount}}</code>。"
        : prompt.stage === "knowledge"
          ? "可用变量：<code>{{title}}</code> <code>{{bvid}}</code> <code>{{author}}</code> <code>{{anchorText}}</code> <code>{{sourceContext}}</code> <code>{{ancestorPath}}</code> <code>{{question}}</code>。"
          : "可用变量：<code>{{title}}</code> <code>{{bvid}}</code> <code>{{author}}</code> <code>{{subtitle}}</code> <code>{{rawSubtitle}}</code> <code>{{processedSubtitle}}</code>。"}脚本只替换变量，不追加隐藏任务指令。</div>
      <div class="bsb-preprocess-note">${prompt.stage === "preprocess"
        ? "这是预处理 Prompt：只负责原始字幕的清洗、翻译与规范化，不做摘要、制图或知识重构。输出会成为后处理的输入。"
        : prompt.stage === "knowledge"
          ? "这是 Knowledge Prompt：只处理当前字幕锚点与当前追问分支。字幕局部上下文、祖先路径和当前问题会明确传入，不会隐藏整段视频上下文。"
          : "这是后处理 Prompt：负责把规范化字幕转换成 Mermaid、笔记、自测等最终产物。<code>{{subtitle}}</code> 在预处理开启时就是规范化稿，关闭时自动退回原始字幕。"}</div>
      <div class="bsb-ai-cfg-actions" style="margin-top:12px">
        <button type="button" class="bsb-btn primary" data-act="prompt-save">保存当前 Prompt</button>
      </div>
    </section>`;
  }

  function readPromptEditor(editor: HTMLElement, index: number) {
    const get = (key: string) => editor.querySelector<HTMLInputElement | HTMLTextAreaElement>(`[data-prompt-field="${key}"]`);
    return coreCall("createPromptProfile", {
      id: editor.dataset.promptId || coreCall("makePromptProfileId"),
      stage: editor.dataset.promptStage === "preprocess" ? "preprocess" : editor.dataset.promptStage === "knowledge" ? "knowledge" : "postprocess",
      name: String(get("name")?.value || `提示词 ${index + 1}`),
      hint: String(get("hint")?.value || "自定义提示词"),
      systemPrompt: String(get("systemPrompt")?.value || ""),
      userPromptTemplate: String(get("userPromptTemplate")?.value || ""),
    }, index);
  }

  function savePromptProfilesFromForm({ activeId }: { activeId?: string } = {}) {
    const root = ensurePanel();
    const current = state.promptProfiles?.length || state.activePromptId
      ? [...state.promptProfiles]
      : [...loadPromptProfiles().prompts];
    const editor = root.querySelector<HTMLElement>('[data-role="prompt-editor"] [data-prompt-id]');
    if (editor) {
      const index = current.findIndex((p) => p.id === editor.dataset.promptId);
      if (index >= 0) current[index] = readPromptEditor(editor, index);
    }
    const selected = activeId != null
      ? String(activeId)
      : String(root.querySelector<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>('[data-role="prompt-select"]')?.value || state.activePromptId || "");
    return savePromptProfiles(current, selected, state.activePrePromptId, state.activeKnowledgePromptId);
  }

  function refreshPromptSelector(root: HTMLElement|null) {
    if (!root) return;
    const postSelect = root.querySelector<HTMLInputElement | HTMLButtonElement | HTMLSelectElement | HTMLTextAreaElement>('[data-role="prompt-select"]');
    const preSelect = root.querySelector<HTMLInputElement | HTMLButtonElement | HTMLSelectElement | HTMLTextAreaElement>('[data-role="preprocess-prompt-select"]');
    const prompts = state.promptProfiles || [];
    const posts = prompts.filter((p) => p.stage === "postprocess");
    const pres = prompts.filter((p) => p.stage === "preprocess");

    if (postSelect) {
      postSelect.disabled = !posts.length;
      postSelect.innerHTML = toTrustedHTML(posts.length
        ? posts.map((p) => `<option value="${escapeAttr(p.id)}">${escapeHtml(p.name)}</option>`).join("")
        : '<option value="">没有后处理 Prompt</option>');
      const active = posts.some((p) => p.id === state.activePromptId) ? state.activePromptId : (posts[0]?.id || "");
      state.activePromptId = active;
      postSelect.value = active;
    }
    if (preSelect) {
      preSelect.disabled = !pres.length || !state.preprocessEnabled;
      preSelect.innerHTML = toTrustedHTML(pres.length
        ? pres.map((p) => `<option value="${escapeAttr(p.id)}">${escapeHtml(p.name)}</option>`).join("")
        : '<option value="">没有预处理 Prompt</option>');
      const active = pres.some((p) => p.id === state.activePrePromptId) ? state.activePrePromptId : (pres[0]?.id || "");
      state.activePrePromptId = active;
      preSelect.value = active;
    }
    const toggle = root.querySelector<HTMLInputElement>('[data-role="preprocess-enabled"]');
    if (toggle) toggle.checked = !!state.preprocessEnabled;
    updatePromptUi(root, getActivePromptProfile());
  }

  function commitConfigListReorder(kind: string, fromId: string, toId: string) {
    if (!fromId || !toId || fromId === toId) return false;
    const root = ensurePanel();
    if (kind === "llm") {
      try { saveAiProfilesFromForm(); } catch  { /* use memory/storage */ }
      const profiles = state.aiProfiles?.length ? state.aiProfiles.slice() : loadAiProfiles();
      const ids = profiles.map((p) => p.id);
      const nextIds = appCall("ordering.reorderIds", ids, fromId, toId);
      if (nextIds.join("\0") === ids.join("\0")) return false;
      const next = SubBatch.SubBatchMonorepo.app.ordering.applyConfigIdOrder(profiles, nextIds);
      saveAiProfiles(next);
      state.aiEditorId = fromId;
      fillAiConfigForm(root);
      const name = next.find((p) => p.id === fromId)?.name || "LLM";
      setStatus(`已调整 LLM 顺序：${name}`, "ok");
      return true;
    }
    if (kind === "prompt") {
      try { savePromptProfilesFromForm({ activeId: state.activePromptId }); } catch  { /* use memory/storage */ }
      const library = state.promptProfiles?.length
        ? {
            prompts: state.promptProfiles.slice(),
            activeId: state.activePromptId,
            activePreprocessId: state.activePrePromptId,
            activeKnowledgeId: state.activeKnowledgePromptId,
          }
        : loadPromptProfiles();
      const stage = state.ui?.promptStage === "postprocess"
        ? "postprocess"
        : state.ui?.promptStage === "knowledge"
          ? "knowledge"
          : "preprocess";
      const stageIds = library.prompts.filter((p: { stage: string; }) => p.stage === stage).map((p) => p.id);
      const nextStageIds = appCall("ordering.reorderIds", stageIds, fromId, toId);
      if (nextStageIds.join("\0") === stageIds.join("\0")) return false;
      const prompts = SubBatch.SubBatchMonorepo.app.ordering.applyPromptStageOrder(library.prompts, stage, nextStageIds);
      savePromptProfiles(prompts, library.activeId, library.activePreprocessId, library.activeKnowledgeId);
      state.promptEditorId = fromId;
      fillPromptConfigForm(root);
      const name = prompts.find((p) => p.id === fromId)?.name || "Prompt";
      setStatus(`已调整 Prompt 顺序：${name}`, "ok");
      return true;
    }
    return false;
  }

  function commitFlowModelReorder(taskId: string, fromId: string, toId: string) {
    if (!fromId || !toId || fromId === toId) return;
    const tasks = currentPostTasks().map((task) => ({
      ...task, modelIds: [...(task.modelIds || [])],
    }));
    const task = tasks.find((task) => task.id === taskId);
    if (!task) return;
    task.modelIds = appCall("ordering.reorderIds", task.modelIds, fromId, toId);
    savePostTasks(tasks);
  }

  function renderPromptList(root: HTMLElement) {
    const host = root?.querySelector<HTMLElement>('[data-role="prompt-list"]');
    if (!host) return;
    const q = String(state.promptSearch || "").trim().toLocaleLowerCase();
    const stage = state.ui?.promptStage === "postprocess" ? "postprocess" : state.ui?.promptStage === "knowledge" ? "knowledge" : "preprocess";
    const prompts = (state.promptProfiles || []).filter((p) => p.stage === stage);
    const filtered = q
      ? prompts.filter((p) => `${p.name}\n${p.hint}`.toLocaleLowerCase().includes(q))
      : prompts;
    const canReorder = !q && filtered.length > 1;
    host.dataset.reorderLocked = canReorder ? "0" : "1";
    host.innerHTML = toTrustedHTML(filtered.length
      ? filtered.map((p) => promptListItemHtml(p, { draggable: canReorder })).join("")
      : `<div class="bsb-config-list-empty">${prompts.length ? "没有匹配的 Prompt" : (stage === "preprocess" ? "还没有预处理 Prompt" : stage === "knowledge" ? "还没有 Knowledge Prompt" : "还没有后处理 Prompt")}</div>`);
  }

  function fillPromptConfigForm(root: HTMLElement) {
    if (!root) return;
    const library = loadPromptProfiles();
    const stage = state.ui?.promptStage === "postprocess" ? "postprocess" : state.ui?.promptStage === "knowledge" ? "knowledge" : "preprocess";
    if (!library.prompts.some((p: { id: string; stage: string; }) => p.id === state.promptEditorId && p.stage === stage)) {
      const preferredId = stage === "preprocess" ? library.activePreprocessId : stage === "knowledge" ? library.activeKnowledgeId : library.activeId;
      state.promptEditorId = library.prompts.find((p) => p.id === preferredId && p.stage === stage)?.id
        || library.prompts.find((p: { stage: string; }) => p.stage === stage)?.id || "";
    }
    const search = root.querySelector<HTMLInputElement>('[data-role="prompt-search"]');
    if (search && search.value !== state.promptSearch) search.value = state.promptSearch;
    renderPromptList(root);
    const editorHost = root.querySelector<HTMLElement>('[data-role="prompt-editor"]');
    if (editorHost) {
      const index = library.prompts.findIndex((p: { id: string; }) => p.id === state.promptEditorId);
      editorHost.innerHTML = toTrustedHTML(promptEditorHtml(index >= 0 ? library.prompts[index] : null, Math.max(0, index)));
    }
    refreshPromptSelector(root);
  }

  function handlePromptProfileAction(button: HTMLElement) {
    const editor = button.closest<HTMLElement>("[data-prompt-id]");
    const action = button.dataset.promptAct;
    if (!editor || !action) return;
    const library = savePromptProfilesFromForm({ activeId: state.activePromptId });
    const index = library.prompts.findIndex((p) => p.id === editor.dataset.promptId);
    if (index < 0) return;
    const current = library.prompts[index];
    if (!current) return;
    if (action === "use") {
      if (current.stage === "preprocess") savePromptProfiles(library.prompts, library.activeId, current.id, library.activeKnowledgeId);
      else if (current.stage === "knowledge") savePromptProfiles(library.prompts, library.activeId, library.activePreprocessId, current.id);
      else savePromptProfiles(library.prompts, current.id, library.activePreprocessId, library.activeKnowledgeId);
      state.promptEditorId = current.id;
      fillPromptConfigForm(ensurePanel());
      setStatus(`当前${current.stage === "preprocess" ? "预处理" : current.stage === "knowledge" ? "Knowledge" : "后处理"}提示词：${current.name}`, "ok");
      return;
    }
    if (action === "duplicate") {
      const copy = coreCall("createPromptProfile", { ...current, id: coreCall("makePromptProfileId"), name: `${current.name} 副本` }, index + 1);
      const prompts = [...library.prompts];
      prompts.splice(index + 1, 0, copy);
      savePromptProfiles(prompts, library.activeId, library.activePreprocessId, library.activeKnowledgeId);
      state.promptEditorId = copy.id;
      fillPromptConfigForm(ensurePanel());
      setStatus(`已复制提示词：${copy.name}`, "ok");
      return;
    }
    if (action === "delete") {
      const prompts = [...library.prompts];
      const [removed] = prompts.splice(index, 1);
      if (!removed) return;
      const sameStage = prompts.filter((p) => p.stage === removed.stage);
      let nextActiveId = library.activeId;
      let nextPreId = library.activePreprocessId;
      let nextKnowledgeId = library.activeKnowledgeId;
      if (removed.stage === "preprocess" && removed.id === library.activePreprocessId) nextPreId = sameStage[0]?.id || "";
      if (removed.stage === "postprocess" && removed.id === library.activeId) nextActiveId = sameStage[0]?.id || "";
      if (removed.stage === "knowledge" && removed.id === library.activeKnowledgeId) nextKnowledgeId = sameStage[0]?.id || "";
      savePromptProfiles(prompts, nextActiveId, nextPreId, nextKnowledgeId);
      state.promptEditorId = sameStage[0]?.id || "";
      fillPromptConfigForm(ensurePanel());
      setStatus(`已删除提示词：${removed.name}${sameStage.length ? "" : ` · 当前没有${removed.stage === "preprocess" ? "预处理" : removed.stage === "knowledge" ? "Knowledge" : "后处理"} Prompt`}`, sameStage.length ? "ok" : "err");
    }
  }

  function updatePromptUi(root: HTMLElement, prompt: { hint: string; } | null) {
    const hint = root?.querySelector<HTMLElement>('[data-role="prompt-hint"]');
    if (hint) hint.textContent = prompt?.hint || "请在设置中新增或恢复提示词";
  }

  function renderPromptTemplate(template: string, vars: Record<string,unknown>) {
    try {
      const api =
        typeof SubBatch !== "undefined" ? SubBatch?.SubBatchMonorepo : null;
      const pure = api?.core?.renderPromptTemplate;
      if (typeof pure === "function") return pure(template, vars);
    } catch  {
      /* monorepo unavailable — local fallback */
    }
    const values: Record<string, string> = {
      title: String(vars?.title || ""),
      bvid: String(vars?.bvid || ""),
      author: String(vars?.author || ""),
      subtitle: String(vars?.subtitle || ""),
      rawSubtitle: String(vars?.rawSubtitle || ""),
      processedSubtitle: String(vars?.processedSubtitle || ""),
      chunkIndex: String(vars?.chunkIndex || ""),
      chunkCount: String(vars?.chunkCount || ""),
      chunkStart: String(vars?.chunkStart || ""),
      coreStart: String(vars?.coreStart || ""),
      chunkEnd: String(vars?.chunkEnd || ""),
      anchorText: String(vars?.anchorText || ""),
      sourceContext: String(vars?.sourceContext || ""),
      ancestorPath: String(vars?.ancestorPath || ""),
      question: String(vars?.question || ""),
    };
    return String(template || "").replace(/\{\{\s*(title|bvid|author|subtitle|rawSubtitle|processedSubtitle|chunkIndex|chunkCount|chunkStart|coreStart|chunkEnd|anchorText|sourceContext|ancestorPath|question)\s*\}\}/g, (_, key: string) => values[key] ?? "");
  }

  function loadAiProfiles() {
    try {
      const raw = storageGet(AI_PROFILES_STORE_KEY, null);
      if (raw) {
        const parsed = typeof raw === "string" ? JSON.parse(raw) : raw;
        const list = Array.isArray(parsed) ? parsed : parsed?.profiles;
        if (Array.isArray(list) && list.length) {
          const storedVersion = Array.isArray(parsed) ? 1 : Number(parsed?.version || 1);
          const seeds = storedVersion < AI_PROFILES_SCHEMA_VERSION
            ? list.map((profile) => ({
                ...profile,
                // v2 以前的默认值 4096 自动升级；用户自定义的其它值保持不变。
                maxTokens: Number(profile?.maxTokens) === 4096 ? AI_DEFAULTS.maxTokens : profile?.maxTokens,
                // v4 起模型配置只保留 API 与采样参数；提示词迁移到独立模板库。
              }))
            : list;
          const normalized = coreCall("normalizeAiProfiles", seeds);
          if (storedVersion < AI_PROFILES_SCHEMA_VERSION) {
            storageSet(AI_PROFILES_STORE_KEY, JSON.stringify({
              version: AI_PROFILES_SCHEMA_VERSION,
              profiles: normalized,
            }));
          }
          return normalized;
        }
      }
    } catch  {
      /* fall through to legacy migration */
    }

    // 首次升级时把旧的单配置无损迁移为第一个 profile。
    try {
      const raw = storageGet(AI_STORE_KEY, null);
      if (raw) {
        const legacy = typeof raw === "string" ? JSON.parse(raw) : raw;
        if (legacy && typeof legacy === "object") {
          const migrated = [coreCall("createAiProfile", { ...legacy, name: legacy.name || legacy.model || "默认模型" }, 0)];
          storageSet(AI_PROFILES_STORE_KEY, JSON.stringify({ version: AI_PROFILES_SCHEMA_VERSION, profiles: migrated }));
          return migrated;
        }
      }
    } catch  {
      /* ignore */
    }
    return [coreCall("createAiProfile", { ...AI_DEFAULTS, name: "默认模型" }, 0)];
  }

  function saveAiProfiles(profiles: unknown) {
    const normalized = coreCall("normalizeAiProfiles", profiles);
    try {
      storageSet(AI_PROFILES_STORE_KEY, JSON.stringify({ version: AI_PROFILES_SCHEMA_VERSION, profiles: normalized }));
    } catch  {
      /* ignore */
    }
    state.aiProfiles = normalized;
    state.ai = normalized.find((x) => x.enabled) || normalized[0] || null;
    refreshPreprocessModelSelector(document.getElementById(PANEL_ID));
    if (state.postTasks?.length) savePostTasks(state.postTasks);
    else loadPostTasks();
    refreshAiChips();
    renderAiResultTabs();
    return normalized;
  }

  function enabledAiProfiles({ requireReady = false } = {}) {
    const profiles = state.aiProfiles?.length ? state.aiProfiles : loadAiProfiles();
    return profiles.filter((p) => p.enabled && (!requireReady || (p.apiKey && p.baseUrl && p.model)));
  }

  // 兼容脚本中“取一个配置”的辅助功能（例如 Mermaid 修复）：优先当前结果对应配置。

  function refreshPreprocessModelSelector(root: HTMLElement|null) {
    root = root || document.getElementById(PANEL_ID);
    const select = root?.querySelector<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>('[data-role="preprocess-model-select"]');
    if (!select) return;
    const profiles = state.aiProfiles?.length ? state.aiProfiles : loadAiProfiles();
    const ready = profiles.filter((p) => p.apiKey && p.baseUrl && p.model);
    const fallback = ready.find((p) => p.enabled) || ready[0] || null;
    if (!ready.length) {
      select.innerHTML = toTrustedHTML('<option value="">没有可用 LLM</option>');
      select.value = "";
      select.disabled = true;
      state.preprocessModelId = "";
      return;
    }
    select.disabled = !state.preprocessEnabled;
    select.innerHTML = toTrustedHTML(ready.map((p) => `<option value="${escapeAttr(p.id)}">${escapeHtml(p.name || p.model)}</option>`).join(""));
    if (!ready.some((p: { id: string; }) => p.id === state.preprocessModelId)) {
      state.preprocessModelId = fallback?.id || "";
      storageSet(PREPROCESS_MODEL_STORE_KEY, state.preprocessModelId);
    }
    select.value = state.preprocessModelId;
  }

  function getPreprocessModelConfig(profiles?: AiProfile[]) {
    const all = Array.isArray(profiles) && profiles.length ? profiles : (state.aiProfiles?.length ? state.aiProfiles : loadAiProfiles());
    const ready = all.filter((p) => p.apiKey && p.baseUrl && p.model);
    const selected = ready.find((p: { id: string; }) => p.id === state.preprocessModelId);
    return selected || ready.find((p) => p.enabled) || ready[0] || null;
  }

  function getStudioModelConfig(profiles?: AiProfile[]) {
    const all = Array.isArray(profiles) && profiles.length ? profiles : (state.aiProfiles?.length ? state.aiProfiles : loadAiProfiles());
    const ready = all.filter((p) => p.apiKey && p.baseUrl && p.model);
    const selected = ready.find((p: { id: string; }) => p.id === state.studioModelId);
    const fallback = selected || getPreprocessModelConfig(all) || knowledgeGetModelConfig() || ready.find((p) => p.enabled) || ready[0] || null;
    if (fallback && state.studioModelId !== fallback.id) {
      state.studioModelId = fallback.id;
      storageSet(STUDIO_MODEL_STORE_KEY, fallback.id);
    }
    return fallback;
  }

  function aiListItemHtml(profile: AiProfile, { draggable = true } = {}) {
    const selected = profile.id === state.aiEditorId;
    const name = profile.name || profile.model || "未命名模型";
    const dragAttr = draggable ? 'draggable="true"' : 'draggable="false"';
    const title = draggable
      ? `${name} · 拖拽左侧 ⠿ 调整顺序`
      : `${name} · 清空搜索后可拖拽排序`;
    return `<div class="bsb-config-list-item${selected ? " selected" : ""}" role="button" tabindex="0" ${dragAttr} data-ai-list-id="${escapeAttr(profile.id)}" title="${escapeAttr(title)}">
      <span class="bsb-config-drag" aria-hidden="true" title="拖拽排序">⠿</span>
      <span class="bsb-config-dot${profile.enabled ? " enabled" : ""}"></span>
      <span class="bsb-config-item-main">
        <span class="bsb-config-item-name">${escapeHtml(name)}</span>
        <span class="bsb-config-item-sub">${escapeHtml(profile.model || "未填写 model")}</span>
      </span>
      ${profile.enabled ? '<span class="bsb-config-badge">启用</span>' : ""}
    </div>`;
  }

  function aiEditorHtml(profile: AiProfile|null|undefined, index: number) {
    if (!profile) return '<div class="bsb-config-editor-empty">没有可编辑的 LLM 配置。</div>';
    const summary = [profile.baseUrl || "未填写 Base URL", profile.model || "未填写 model"].join(" · ");
    return `<section data-ai-profile-id="${escapeAttr(profile.id)}">
      <div class="bsb-config-editor-head">
        <div class="bsb-config-editor-title">
          <strong>${escapeHtml(profile.name || `模型 ${index + 1}`)}</strong>
          <span>${escapeHtml(summary)}</span>
        </div>
        <div class="bsb-config-editor-actions">
          <button type="button" class="bsb-btn ghost" data-ai-profile-act="duplicate">复制</button>
          <button type="button" class="bsb-btn danger" data-ai-profile-act="delete">删除</button>
        </div>
      </div>
      <label style="flex-direction:row;align-items:center;gap:8px;margin-bottom:10px">
        <input type="checkbox" data-ai-field="enabled" style="width:auto" ${profile.enabled ? "checked" : ""}>
        启用此模型（启用后参与并发分析）
      </label>
      <label>配置名称
        <input type="text" data-ai-field="name" value="${escapeAttr(profile.name || `模型 ${index + 1}`)}" placeholder="例如：NVIDIA - GPT OSS 120B" autocomplete="off">
      </label>
      <label>Base URL（含 /v1）
        <input type="text" data-ai-field="baseUrl" value="${escapeAttr(profile.baseUrl)}" placeholder="https://api.example.com/v1" autocomplete="off">
      </label>
      <label>API Key
        <input type="password" data-ai-field="apiKey" value="${escapeAttr(profile.apiKey)}" placeholder="sk-..." autocomplete="off">
      </label>
      <label>Model
        <input type="text" data-ai-field="model" value="${escapeAttr(profile.model)}" placeholder="gpt-4o-mini" autocomplete="off">
      </label>
      <div class="row2">
        <label>Temperature
          <input type="number" data-ai-field="temperature" min="0" max="2" step="0.1" value="${escapeAttr(profile.temperature)}">
        </label>
        <label>Max tokens
          <input type="number" data-ai-field="maxTokens" min="256" max="128000" step="256" value="${escapeAttr(profile.maxTokens)}">
        </label>
      </div>
      <label style="flex-direction:row;align-items:center;gap:8px;margin-bottom:10px">
        <input type="checkbox" data-ai-field="stream" style="width:auto" ${profile.stream ? "checked" : ""}>
        流式输出（建议开启）
      </label>
      <div class="bsb-ai-cfg-actions">
        <button type="button" class="bsb-btn primary" data-act="ai-save">保存当前 LLM</button>
      </div>
    </section>`;
  }

  function renderAiList(root: HTMLElement) {
    const host = root?.querySelector<HTMLElement>('[data-role="ai-list"]');
    if (!host) return;
    const q = String(state.aiSearch || "").trim().toLocaleLowerCase();
    const profiles = state.aiProfiles || [];
    const filtered = q
      ? profiles.filter((p) => `${p.name}\n${p.model}\n${p.baseUrl}`.toLocaleLowerCase().includes(q))
      : profiles;
    const canReorder = !q && filtered.length > 1;
    host.dataset.reorderLocked = canReorder ? "0" : "1";
    host.innerHTML = toTrustedHTML(filtered.length
      ? filtered.map((p) => aiListItemHtml(p, { draggable: canReorder })).join("")
      : `<div class="bsb-config-list-empty">${profiles.length ? "没有匹配的 LLM" : "还没有 LLM 配置"}</div>`);
  }

  function fillAiConfigForm(root: HTMLElement) {
    if (!root) return;
    state.aiProfiles = loadAiProfiles();
    state.ai = state.aiProfiles.find((x) => x.enabled) || state.aiProfiles[0] || null;
    if (!state.aiProfiles.some((p) => p.id === state.aiEditorId)) {
      state.aiEditorId = state.aiProfiles.find((p) => p.enabled)?.id || state.aiProfiles[0]?.id || "";
    }
    const search = root.querySelector<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>('[data-role="ai-search"]');
    if (search && search.value !== state.aiSearch) search.value = state.aiSearch;
    renderAiList(root);
    const host = root.querySelector<HTMLElement>('[data-role="ai-editor"]');
    if (!host) return;
    const index = state.aiProfiles.findIndex((p) => p.id === state.aiEditorId);
    host.innerHTML = toTrustedHTML(aiEditorHtml(index >= 0 ? state.aiProfiles[index] : null, Math.max(0, index)));
  }

  function readAiProfileCard(card: HTMLElement, index: number) {
    const get = (key: string) => card.querySelector<HTMLInputElement | HTMLTextAreaElement>(`[data-ai-field="${key}"]`);
    return coreCall("createAiProfile", {
      id: card.dataset.aiProfileId || coreCall("makeAiProfileId"),
      enabled: !!card.querySelector<HTMLInputElement>('[data-ai-field="enabled"]')?.checked,
      name: String(get("name")?.value || `模型 ${index + 1}`),
      baseUrl: String(get("baseUrl")?.value || "").trim().replace(/\/+$/, ""),
      apiKey: String(get("apiKey")?.value || "").trim(),
      model: String(get("model")?.value || AI_DEFAULTS.model).trim(),
      temperature: Number(get("temperature")?.value),
      maxTokens: Number(get("maxTokens")?.value) || AI_DEFAULTS.maxTokens,
      stream: !!card.querySelector<HTMLInputElement>('[data-ai-field="stream"]')?.checked,
    }, index);
  }

  function saveAiProfilesFromForm() {
    const root = ensurePanel();
    const profiles = state.aiProfiles?.length ? [...state.aiProfiles] : [...loadAiProfiles()];
    const editor = root.querySelector<HTMLElement>('[data-role="ai-editor"] [data-ai-profile-id]');
    if (editor) {
      const index = profiles.findIndex((x) => x.id === editor.dataset.aiProfileId);
      if (index >= 0) profiles[index] = readAiProfileCard(editor, index);
    }
    return saveAiProfiles(profiles);
  }

  function handleAiProfileAction(button: HTMLElement) {
    const editor = button.closest<HTMLElement>("[data-ai-profile-id]");
    const action = button.dataset.aiProfileAct;
    if (!editor || !action) return;
    const profiles = saveAiProfilesFromForm();
    const index = profiles.findIndex((x) => x.id === editor.dataset.aiProfileId);
    if (index < 0) return;
    const current = profiles[index];
    if (!current) return;
    if (action === "duplicate") {
      const copy = coreCall("createAiProfile", { ...current, id: coreCall("makeAiProfileId"), name: `${current.name} 副本` }, index + 1);
      profiles.splice(index + 1, 0, copy);
      saveAiProfiles(profiles);
      state.aiEditorId = copy.id;
      fillAiConfigForm(ensurePanel());
      setStatus(`已复制配置：${copy.name}`, "ok");
    } else if (action === "delete") {
      if (profiles.length <= 1) {
        setStatus("至少保留一个模型配置", "err");
        return;
      }
      const [removed] = profiles.splice(index, 1);
      if (!removed) return;
      const next = profiles[Math.min(index, profiles.length - 1)] || profiles[0];
      saveAiProfiles(profiles);
      state.aiEditorId = next?.id || "";
      fillAiConfigForm(ensurePanel());
      setStatus(`已删除配置：${removed.name}`, "ok");
    }
  }

  function toggleAiPanel(forceShow?: boolean) {
    ensurePanel();
    // v0.7：AI 是独立全高工作区，不再挤在底部小条
    if (forceShow === false) {
      setWorkspace("subs");
      return;
    }
    setWorkspace("ai");
    if (state.ui && state.ui.h < 640) {
      state.ui.h = Math.min(860, Math.max(640, state.ui.h));
      state.ui.w = Math.max(state.ui.w, 480);
      clampUiToViewport(state.ui);
      applyPanelGeometry();
      saveUiGeom();
    }
    refreshAiChips();
    // 不在这里重绘设置表单：否则“送去 AI”会先用存储值覆盖用户刚输入的 Key / maxTokens。
  }

  function createAiRuntime(label = "AI"): WorkbenchAiRuntime {
    return {
      label,
      abort: false,
      xhr: null,
      abortController: null,
    };
  }

  function createAiRun(
    profile: BatchModel, sessionId: number,
    task: WorkbenchPostTask | BatchTask | null = null, promptProfile: PromptProfile | null = null,
  ): WorkbenchAiRun {
    const taskId = String(task?.id || "legacy-output");
    const prompt = promptProfile ? coreCall("createPromptProfile", promptProfile, 0) : null;
    return {
      ...createAiRuntime(profile.name || profile.model),
      id: `${sessionId}:${taskId}:${profile.id}`,
      profileId: profile.id,
      taskId,
      taskSnapshot: task ? { ...task, modelIds: [...(task.modelIds || [])] } : null,
      promptId: prompt?.id || String(task?.promptId || ""),
      promptName: prompt?.name || "后处理",
      promptProfile: prompt ? { ...prompt } : null,
      config: { ...profile },
      raw: "",
      status: "queued",
      statusText: "等待发送",
      busy: false,
      error: "",
      sourceBvids: [],
      startedAt: 0,
      finishedAt: 0,
      scrollTop: 0,
      stickBottom: true,
      userReading: false,
      mermaidRepairing: false,
    };
  }

  function getActiveAiRun() {
    return state.aiActiveRunId ? state.aiRuns.get(state.aiActiveRunId) || null : null;
  }

  function anyAiRunBusy() {
    return state.aiRunOrder.some((id) => state.aiRuns.get(id)?.busy);
  }

  function activeAiRunBusy() {
    return !!getActiveAiRun()?.busy;
  }

  function aggregateRunStatus(runs: WorkbenchAiRun[]) {
    if (runs.some((r) => r.busy || r.status === "running")) return "running";
    if (runs.some((r: { status: string; }) => r.status === "error")) return "error";
    if (runs.length && runs.every((r: { status: string; }) => r.status === "done")) return "done";
    if (runs.some((r: { status: string; }) => r.status === "stopped")) return "stopped";
    return "queued";
  }

  function taskDisplayName(task: { modelIds: unknown[]; order: number; id: string; promptId: string; enabled: boolean; }|WorkbenchPostTask) {
    const run = state.aiRunOrder.map((id) => state.aiRuns.get(id)).find((r) => r?.taskId === task?.id);
    return run?.promptName || promptForTask(task)?.name || "未命名产物";
  }

  function loadStudioChatStore() {
    const parseStore = appFn("studio.parseStore");
    if (parseStore) {
      try { return parseStore(storageGet(STUDIO_CHAT_STORE_KEY, null)); }
      catch  { return {}; }
    }
    try {
      const raw = storageGet(STUDIO_CHAT_STORE_KEY, null);
      if (!raw) return {};
      const parsed = typeof raw === "string" ? JSON.parse(raw) : raw;
      return parsed && typeof parsed === "object" ? parsed : {};
    } catch  {
      return {};
    }
  }

  function persistStudioChat(routeKey = currentRouteVideoKey()) {
    const key = String(routeKey || "").trim();
    if (!key) return;
    const persist = appFn("studio.persist");
    if (persist) {
      const store = persist(loadStudioChatStore(), key, state, Date.now());
      try { storageSet(STUDIO_CHAT_STORE_KEY, JSON.stringify(store)); } catch  { /* ignore */ }
      return;
    }
    const store = loadStudioChatStore();
    store[key] = {
      messages: (state.studioMessages || []).slice(-40),
      memory: String(state.studioMemory || ""),
      memoryUntilId: String(state.studioMemoryUntilId || ""),
      memoryTurns: Number(state.studioMemoryTurns) || 0,
      contextPref: state.studioContextPref || "auto",
      updatedAt: Date.now(),
    };
    const keys = Object.keys(store).sort((a, b) => (store[b].updatedAt || 0) - (store[a].updatedAt || 0));
    for (const extra of keys.slice(24)) delete store[extra];
    try { storageSet(STUDIO_CHAT_STORE_KEY, JSON.stringify(store)); } catch  { /* ignore */ }
  }

  function loadStudioChat(routeKey = currentRouteVideoKey()) {
    const key = String(routeKey || "").trim();
    const restore = appFn("studio.restore");
    if (restore) {
      Object.assign(state, restore(loadStudioChatStore(), key));
      return;
    }
    const entry = key ? loadStudioChatStore()[key] : null;
    state.studioMessages = Array.isArray(entry?.messages) ? entry.messages : [];
    state.studioMemory = String(entry?.memory || "");
    state.studioMemoryUntilId = String(entry?.memoryUntilId || "");
    state.studioMemoryTurns = Number(entry?.memoryTurns) || 0;
    state.studioLastContextMeta = null;
    state.studioContextPref = ["raw", "processed"].includes(entry?.contextPref) ? entry.contextPref : "auto";
  }

  function studioTranscriptContext() {
    return appCall("studio.transcriptContext",
      currentInputPreviewText("raw"), currentInputPreviewText("processed"), state.studioContextPref);
  }

  function refreshStudioMemory() {
    return appCall("studio.refreshMemory", state, STUDIO_CHAT_KEEP_RECENT, STUDIO_CHAT_MEMORY_CHARS);
  }

  function matchStudioSlash(query: string) {
    const q = String(query || "").replace(/^\//, "").trim().toLowerCase();
    return STUDIO_SLASH_COMMANDS.filter((cmd) => !q || cmd.aliases.some((a) => a.startsWith(q) || a.includes(q)));
  }

  function parseStudioSlashInput(text: string) {
    const hit = String(text || "").trim().match(/^\/([^\s]+)(?:\s+([\s\S]*))?$/);
    if (!hit) return null;
    const token = String(hit[1] || "").toLowerCase();
    const cmd = STUDIO_SLASH_COMMANDS.find((c) => c.aliases.includes(token));
    return cmd ? { cmd, rest: String(hit[2] || "").trim() } : null;
  }

  function renderStudioSlashMenu() {
    const root = document.getElementById(PANEL_ID);
    const menu = root?.querySelector<HTMLElement>('[data-role="studio-slash"]');
    const input = root?.querySelector<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>('[data-role="studio-input"]');
    if (!menu || !input) return;
    const value = String(input.value || "");
    const typingCommand = /^\/[^\s]*$/.test(value);
    if (!typingCommand) {
      menu.hidden = true;
      return;
    }
    const items = matchStudioSlash(value);
    if (!items.length) {
      menu.hidden = true;
      return;
    }
    if (state.studioSlashIndex >= items.length) state.studioSlashIndex = 0;
    menu.hidden = false;
    menu.innerHTML = toTrustedHTML(items.map((cmd, i) => (
      `<button type="button" class="${i === state.studioSlashIndex ? "active" : ""}" data-studio-slash="${escapeAttr(cmd.id)}"><code>/${escapeHtml(cmd.aliases[0])}</code><span>${escapeHtml(cmd.hint)}</span></button>`
    )).join(""));
  }

  function hideStudioSlashMenu() {
    const menu = document.getElementById(PANEL_ID)?.querySelector<HTMLElement>('[data-role="studio-slash"]');
    if (menu) menu.hidden = true;
  }

  function studioMessageHtml(msg: StudioMessage) {
    const role = msg.role === "user" ? "user" : msg.role === "system" ? "system" : "assistant";
    if (role === "system") {
      return `<div class="bsb-studio-msg system">${escapeHtml(msg.content || "")}</div>`;
    }
    if (role === "user") {
      return `<div class="bsb-studio-msg user"><span class="bsb-studio-role">你</span><div class="bsb-studio-bubble">${escapeHtml(msg.content || "")}</div></div>`;
    }
    const streaming = msg.status === "running";
    const body = msg.content
      ? renderKnowledgeAnswerCards(msg.content, { streaming })
      : (streaming
        ? '<div class="bsb-knowledge-thinking">正在组织回答…</div>'
        : "<p></p>");
    return `<div class="bsb-studio-msg assistant" data-studio-msg="${escapeAttr(msg.id || "")}"><span class="bsb-studio-role">研读</span><div class="bsb-studio-answer" data-role="studio-answer">${body}</div></div>`;
  }

  function paintStudioAnswer(msgId: string|undefined, text: string, streaming: boolean) {
    const cards = document.querySelector(`#${PANEL_ID} [data-studio-msg="${msgId}"] [data-role="studio-answer"]`);
    if (!cards) return false;
    cards.innerHTML = toTrustedHTML(String(text || "").trim()
      ? renderKnowledgeAnswerCards(text, { streaming: !!streaming })
      : (streaming ? '<div class="bsb-knowledge-thinking">正在组织回答…</div>' : "<p></p>"));
    return true;
  }

  async function renderStudioCanvas() {
    const root = ensurePanel();
    if (state.ui) state.ui.aiStage = "chat";
    applyAiWorkbenchStageUi();
    const host = root.querySelector<HTMLElement>('[data-role="ai-content"]');
    const meta = root.querySelector<HTMLElement>('[data-role="ai-canvas-meta"]');
    const ctx = studioTranscriptContext();
    const route = currentRouteVideoRef();
    const pack = state.studioLastContextMeta;
    const bits = [ctx.source];
    if (route?.bvid) bits.push(route.bvid);
    if (pack?.compressed) bits.push(`字幕 ${Math.round(Number(pack.original) / 100) / 10}k→${Math.round(Number(pack.kept) / 100) / 10}k`);
    if (state.studioMemoryTurns) bits.push(`记忆 ${state.studioMemoryTurns} 轮`);
    if (meta) meta.textContent = bits.join(" · ");
    if (!host) return;
    if (!(state.studioMessages || []).length) {
      host.innerHTML = toTrustedHTML(`<div class="bsb-empty"><div class="bsb-empty-ico">◎</div><strong>对着这一期提问</strong><span>像聊天一样追问字幕。超长字幕会按问题压缩，旧对话会折进记忆。输入 <code>/</code> 可压缩、看记忆或清空。</span></div>`);
      return;
    }
    const joined = (state.studioMessages || []).map((m) => m.content || "").join("\n");
    try { await ensureKnowledgeRenderLibs(joined); } catch  { /* fallback inside cards */ }
    if (currentAiWorkbenchStage() !== "chat") return;
    const box = root.querySelector<HTMLElement>('[data-role="ai-md"]');
    const prevTop = box?.scrollTop || 0;
    host.innerHTML = toTrustedHTML(`<div class="bsb-studio-thread">${state.studioMessages.map(studioMessageHtml).join("")}</div>`);
    try { linkifyTimestamps(host); } catch  { /* ignore */ }
    await hydrateKnowledgeAnswerDom(host, state.renderEpoch);
    if (box) {
      state.aiProgScroll = true;
      box.scrollTop = prevTop;
      requestAnimationFrame(() => { state.aiProgScroll = false; });
    }
  }

  function refreshStudioStopUi() {
    const root = document.getElementById(PANEL_ID);
    if (!root) return;
    const show = !!(state.aiBusy || state.studioBusy);
    root.querySelectorAll<HTMLElement>('[data-act="ai-stop"]').forEach((b) => {
      b.style.display = show ? "" : "none";
    });
    const stream = root.querySelector<HTMLElement>('[data-role="ai-stream"]');
    if (stream) stream.classList.toggle("streaming", !!(state.studioBusy || (typeof activeAiRunBusy === "function" && activeAiRunBusy())));
  }

  function abortStudioRequest() {
    const runtime = state.studioRuntime;
    if (!runtime) return;
    runtime.abort = true;
    try { runtime.abortController?.abort(); } catch  { /* noop */ }
    try { runtime.xhr?.abort?.(); } catch  { /* noop */ }
  }

  function studioClearChat() {
    abortStudioRequest();
    state.studioBusy = false;
    state.studioRuntime = null;
    appCall("studio.clearTurnHistory", state);
    persistStudioChat();
    renderStudioCanvas();
    refreshStudioStopUi();
    setStatus("已清空当前对话", "ok");
  }

  function studioCopyLast() {
    const text = appCall("studio.lastAssistantText", state.studioMessages || []);
    if (!text) return setStatus("还没有可复制的回答", "err");
    clipboardWrite(text);
    setStatus("已复制上一条回答", "ok");
  }

  function studioExportChat() {
    const msgs = (state.studioMessages || []).filter((m) => m.role !== "system");
    if (!msgs.length) return setStatus("当前没有可导出的对话", "err");
    const route = currentRouteVideoRef();
    const memory = String(state.studioMemory || "").trim();
    const text = [
      memory ? `## 压缩记忆\n\n${memory}` : "",
      ...msgs.map((m) => `## ${m.role === "user" ? "你" : "研读"}\n\n${m.content || ""}`),
    ].filter(Boolean).join("\n\n");
    downloadText(`${safeFilename(`${route?.bvid || "video"}_对话`)}.md`, text);
    setStatus("已导出对话 Markdown", "ok");
  }

  function studioShowMemory() {
    refreshStudioMemory();
    const memory = String(state.studioMemory || "").trim();
    if (!memory) {
      setStatus("还没有压缩记忆。多聊几轮后旧对话会自动折进记忆。", "ok");
      return;
    }
    state.studioMessages = [
      ...(state.studioMessages || []),
      {
        id: `sys-${Date.now()}`,
        role: "system",
        content: `已压缩 ${state.studioMemoryTurns || 0} 轮旧对话：\n${memory}`,
      },
    ];
    persistStudioChat();
    renderStudioCanvas();
  }

  async function studioCompressNow() {
    const folded = refreshStudioMemory();
    persistStudioChat();
    renderStudioCanvas();
    if (!folded && !state.studioMemory) {
      setStatus("对话还不够长，无需压缩记忆", "ok");
      return;
    }
    const model = getStudioModelConfig();
    const memory = String(state.studioMemory || "").trim();
    if (!model || !memory || memory.length < 400) {
      setStatus(`已抽取压缩记忆 ${state.studioMemoryTurns || 0} 轮 · ${memory.length} 字`, "ok");
      return;
    }
    if (state.studioBusy) {
      setStatus(`已抽取压缩记忆 ${state.studioMemoryTurns || 0} 轮。生成中时不另调模型精炼。`, "ok");
      return;
    }
    const runtime = createAiRuntime("对话记忆压缩");
    state.studioRuntime = runtime;
    state.studioBusy = true;
    refreshStudioStopUi();
    setStatus("正在精炼压缩记忆…");
    let latest = "";
    try {
      await new Promise<void>((resolve, reject) => {
        requestChatCompletion({
          runtime,
          baseUrl: model.baseUrl,
          apiKey: model.apiKey,
          model: model.model,
          temperature: 0.2,
          maxTokens: 800,
          stream: false,
          messages: [
            {
              role: "system",
              content: "把旧对话记忆压成更短的要点清单。只保留问题、结论、步骤、边界和未决问题。简体中文。不要引言。每条一行，以 '- ' 开头，最多 12 条。",
            },
            { role: "user", content: memory },
          ],
          onStatus() {},
          onDelta(_delta, full) { latest = String(full || ""); },
          onDone(full) { latest = String(full || latest || ""); resolve(); },
          onError(error) { reject(error instanceof Error ? error : new Error(String(error || "压缩失败"))); },
        });
      });
      if (state.studioRuntime !== runtime || runtime.abort) return;
      const next = appCall("studio.compactMemoryText", latest.trim(), STUDIO_CHAT_MEMORY_CHARS);
      if (next) state.studioMemory = next;
      persistStudioChat();
      renderStudioCanvas();
      setStatus(`记忆已精炼 · ${state.studioMemory.length} 字`, "ok");
    } catch (error) {
      if (state.studioRuntime !== runtime) return;
      if (runtime.abort) setStatus("已停止记忆压缩");
      else setStatus(`记忆精炼失败，仍保留抽取稿：${errorMessage(error)}`, "err");
    } finally {
      if (state.studioRuntime === runtime) {
        state.studioBusy = false;
        state.studioRuntime = null;
        refreshStudioStopUi();
      }
    }
  }

  function runStudioSlash(commandId: string) {
    if (commandId === "clear") return studioClearChat();
    if (commandId === "stop") {
      abortStudioRequest();
      setStatus("正在停止对话生成…");
      return;
    }
    if (commandId === "copy") return studioCopyLast();
    if (commandId === "export") return studioExportChat();
    if (commandId === "compress") return studioCompressNow();
    if (commandId === "memory") return studioShowMemory();
    if (commandId === "raw") {
      state.studioContextPref = "raw";
      persistStudioChat();
      renderStudioCanvas();
      setStatus("对话上下文改为原始字幕", "ok");
      return;
    }
    if (commandId === "norm") {
      state.studioContextPref = "processed";
      persistStudioChat();
      renderStudioCanvas();
      setStatus("对话上下文改为规范化稿（没有则回退原文）", "ok");
      return;
    }
    if (commandId === "help") {
      state.studioMessages = [
        ...(state.studioMessages || []),
        {
          id: `sys-${Date.now()}`,
          role: "system",
          content: STUDIO_SLASH_COMMANDS.map((c) => `/${c.aliases[0]}  ${c.hint}`).join("\n"),
        },
      ];
      persistStudioChat();
      renderStudioCanvas();
    }
  }

  async function sendStudioChat(rawText: string) {
    const text = String(rawText || "").trim();
    if (!text || state.studioBusy) return;
    const slash = parseStudioSlashInput(text);
    if (slash) {
      runStudioSlash(slash.cmd.id);
      return;
    }
    const model = getStudioModelConfig();
    if (!model) {
      setStatus("没有可用 LLM。请先在设置 → LLM 填写 Base URL / API Key / Model", "err");
      return;
    }
    const ctx = studioTranscriptContext();
    if (!ctx.text) {
      setStatus("当前视频还没有字幕，先抓取后再提问", "err");
      return;
    }
    const route = currentRouteVideoRef();
    const { user: userMsg, assistant: botMsg } = appCall("studio.beginTurn", state, text);
    persistStudioChat();
    renderStudioCanvas();
    refreshStudioMemory();
    const packed = appCall("studio.compressTranscript",
      ctx.text,
      [text, ...(state.studioMessages || []).filter((m) => m.role === "user").slice(-3).map((m) => m.content)].join(" "),
    );
    state.studioLastContextMeta = packed;
    const memory = String(state.studioMemory || "").trim();
    const system = [
      "你在帮用户研读当前这条视频字幕。只根据提供的字幕与压缩记忆回答，不编造字幕没有的事实。",
      "简体中文。术语、命令、代码可留原文。不确定就明说。",
      "像对话一样直接答，先给结论，再补必要步骤或边界。不要复述整段字幕。",
      "",
      `<video>${route?.bvid || ""} P${route?.page || 1}</video>`,
      `<context_source>${ctx.source}${packed.compressed ? " · compressed" : ""}</context_source>`,
      memory ? `<conversation_memory>\n${memory}\n</conversation_memory>` : "",
      "<transcript>",
      packed.text,
      "</transcript>",
    ].filter(Boolean).join("\n");
    const messages = appCall("studio.buildChatMessages",
      system, state.studioMessages, userMsg.id || "", text, STUDIO_CHAT_KEEP_RECENT);
    const runtime = createAiRuntime(`对话 · ${model.name || model.model}`);
    state.studioRuntime = runtime;
    state.studioBusy = true;
    refreshStudioStopUi();
    let latest = "";
    try {
      await new Promise<void>((resolve, reject) => {
        requestChatCompletion({
          runtime,
          baseUrl: model.baseUrl,
          apiKey: model.apiKey,
          model: model.model,
          temperature: model.temperature,
          maxTokens: model.maxTokens,
          stream: model.stream !== false,
          messages,
          onStatus() {},
          onDelta(_delta, full: unknown) {
            if (state.studioRuntime !== runtime) return;
            latest = appCall("studio.updateTurn", botMsg, full);
            if (!paintStudioAnswer(botMsg.id, latest, true)) renderStudioCanvas();
          },
          onDone(full) { if (state.studioRuntime === runtime) latest = String(full || latest || ""); resolve(); },
          onError(error) { reject(error instanceof Error ? error : new Error(String(error || "对话失败"))); },
        });
      });
      if (state.studioRuntime !== runtime) return;
      appCall("studio.finishTurn", botMsg, latest, !!runtime.abort);
      setStatus(runtime.abort ? "对话已停止" : "对话已回复", runtime.abort ? "" : "ok");
    } catch (error) {
      if (state.studioRuntime !== runtime) return;
      const stopped = !!runtime.abort;
      appCall("studio.failTurn", botMsg, latest, error, stopped);
      setStatus(stopped ? "对话已停止" : `对话失败：${errorMessage(error)}`, stopped ? "" : "err");
    } finally {
      if (state.studioRuntime === runtime) {
        state.studioBusy = false;
        state.studioRuntime = null;
        persistStudioChat();
        renderStudioCanvas();
        refreshStudioStopUi();
      }
    }
  }

  function currentAiWorkbenchStage() {
    const stage = state.ui?.aiStage;
    if (stage === "postprocess" || stage === "chat") return stage;
    return "preprocess";
  }

  function applyAiWorkbenchStageUi() {
    const root = document.getElementById(PANEL_ID);
    if (!root) return;
    const stage = currentAiWorkbenchStage();
    const apply = typeof SubBatch !== "undefined"
      ? SubBatch?.SubBatchMonorepo?.ui?.studioController?.applyWorkbenchStageUi
      : null;
    if (typeof apply === "function") {
      apply(root, stage, state.aiInputView);
      refreshStudioStopUi();
      return;
    }
    root.querySelectorAll<HTMLElement>("[data-ai-stage]").forEach((button) => {
      const active = button.dataset.aiStage === stage;
      button.classList.toggle("active", active);
      button.setAttribute("aria-selected", active ? "true" : "false");
    });
    const preNav = root.querySelector<HTMLElement>('[data-role="ai-preprocess-nav"]');
    const postNav = root.querySelector<HTMLElement>('[data-role="ai-postprocess-nav"]');
    const dock = root.querySelector<HTMLElement>('[data-role="studio-dock"]');
    const wrap = root.querySelector<HTMLElement>(".bsb-ai-canvas-wrap");
    if (preNav) preNav.hidden = stage !== "preprocess";
    if (postNav) postNav.hidden = stage !== "postprocess";
    if (dock) dock.hidden = stage !== "chat";
    wrap?.classList.toggle("is-studio", stage === "chat");
    root.querySelectorAll<HTMLElement>("[data-preprocess-action]").forEach((el) => { el.hidden = stage !== "preprocess"; });
    root.querySelectorAll<HTMLElement>("[data-postprocess-action]").forEach((el) => { el.hidden = stage !== "postprocess"; });
    root.querySelectorAll<HTMLElement>("[data-studio-action]").forEach((el) => { el.hidden = stage !== "chat"; });
    root.querySelectorAll<HTMLElement>("[data-pipeline-action]").forEach((el) => { el.hidden = stage === "chat"; });
    const label = root.querySelector<HTMLElement>('[data-role="ai-canvas-stage-label"]');
    if (label) label.textContent = stage === "preprocess" ? "预处理" : stage === "chat" ? "对话" : "后处理";
    root.querySelectorAll<HTMLElement>("[data-ai-preprocess-view]").forEach((button) => {
      const active = button.dataset.aiPreprocessView === state.aiInputView;
      button.classList.toggle("active", active);
      button.setAttribute("aria-selected", active ? "true" : "false");
    });
    refreshStudioStopUi();
  }

  /** Render one preprocess paragraph with the same MD/math/highlight stack as Knowledge. */
  function renderProcessedTranscriptBodyHtml(plain: string) {
    const source = String(plain || "").trim();
    if (!source) return "";
    const { md, maths } = prepareMarkdownMath(source);
    return knowledgeChunkToHtml(md, maths);
  }

  function renderProcessedTranscriptCards(text: unknown) {
    const blocks = appCall("preprocess.readingBlocks", text);
    if (!blocks.length) return `<pre class="bsb-main-input-preview">${escapeHtml(text)}</pre>`;
    let paragraphIndex = 0;
    let sourceCount = 0;
    let readingSource = currentKnowledgeSource();
    const timestampRe = transcriptTimestampPattern();
    const html = blocks.map((block) => {
      if (block.type === "source") {
        sourceCount += 1;
        const match = block.text.match(/^([\w-]+)(?:\s+P(\d+))?\s*(.*)$/i);
        const id = match?.[1] || "字幕";
        const page = Number(match?.[2]) || 1;
        const title = (match?.[3] || block.text).trim() || id;
        readingSource = { ...readingSource, bvid: id, page, sourceKey: knowledgeSourceKey(id, page), title };
        return `<div class="bsb-preprocess-source"><span class="bsb-preprocess-source-mark">${sourceCount}</span><span class="bsb-preprocess-source-text"><strong>${escapeHtml(title)}</strong><span>${escapeHtml(id)}${page > 1 ? ` · P${page}` : ""} · AI 规范化稿</span></span></div>`;
      }
      if (block.type === "heading") {
        return `<div class="bsb-preprocess-section-title">${escapeHtml(block.text)}</div>`;
      }
      paragraphIndex += 1;
      const timestamps = transcriptTimestamps(block.text);
      const clean = block.text.replace(timestampRe, "").replace(/[ \t]+\n/g, "\n").replace(/\n[ \t]+/g, "\n").trim();
      const first = timestamps[0] || null;
      const last = timestamps[timestamps.length - 1] || first;
      const timeHtml = first
        ? `<span class="bsb-preprocess-block-time"><button type="button" class="bsb-time-link" data-seconds="${first.seconds}" data-bvid="${escapeAttr(first.bvid)}" data-page="${first.page}" title="跳到这段字幕">${escapeHtml(first.clock)}</button>${last && last.clock !== first.clock ? `<span class="bsb-preprocess-time-end">→ ${escapeHtml(last.clock)}</span>` : ""}</span>`
        : "";
      const warning = /识别存疑/.test(clean) ? `<span class="bsb-preprocess-warning">△ 识别存疑</span>` : "";
      const fallbackSource = readingSource || currentKnowledgeSource();
      const kbvid = first?.bvid || fallbackSource.bvid || "";
      const kpage = first?.page || fallbackSource.page || 1;
      const kstart = first?.seconds ?? 0;
      const kend = last?.seconds ?? kstart;
      const segmentId = `seg-${kbvid || "local"}-p${kpage}-${Math.round(kstart * 10)}-${coreCall("md5", clean || block.text).slice(0, 7)}`;
      const sourceKey = knowledgeSourceKey(kbvid, kpage);
      if (!clean) return "";
      const bodyHtml = renderProcessedTranscriptBodyHtml(clean);
      const topic = "topic" in block ? block.topic : "";
      return `<article class="bsb-preprocess-block" data-preprocess-block="${paragraphIndex}" data-knowledge-segment="${escapeAttr(segmentId)}" data-knowledge-source-key="${escapeAttr(sourceKey)}" data-knowledge-bvid="${escapeAttr(kbvid)}" data-knowledge-page="${kpage}" data-knowledge-start="${kstart}" data-knowledge-end="${kend}" data-knowledge-clock="${escapeAttr(first?.clock || "")}" data-knowledge-topic="${escapeAttr(topic || "")}" data-knowledge-title="${escapeAttr(fallbackSource.title || "")}" data-knowledge-author="${escapeAttr(fallbackSource.author || "")}"><div class="bsb-preprocess-block-head"><span class="bsb-preprocess-block-index">${String(paragraphIndex).padStart(2, "0")}</span>${topic ? `<span class="bsb-preprocess-block-topic">${escapeHtml(topic)}</span>` : ""}${warning}${timeHtml}</div><div class="bsb-preprocess-block-body bsb-md-rich" data-knowledge-plain="${escapeAttr(clean || block.text)}">${bodyHtml}</div></article>`;
    }).join("");
    return `<div class="bsb-preprocess-reading">${html}</div>`;
  }

  async function renderPreprocessCanvas() {
    const root = ensurePanel();
    if (state.ui) state.ui.aiStage = "preprocess";
    const processed = currentInputPreviewText("processed");
    const raw = currentInputPreviewText("raw");
    // SPA 换视频 / 自动抓取竞态：上一视频停在「规范化稿」时，新视频尚无 processed，
    // 必须回退到原始字幕，否则状态写“已就绪”而正文仍是“还没有 AI 处理字幕”。
    if (state.aiInputView === "processed" && !processed && raw) {
      state.aiInputView = "raw";
    }
    applyAiWorkbenchStageUi();
    const kind = state.aiInputView === "processed" ? "processed" : state.aiInputView === "timeline" ? "timeline" : "raw";
    const text = kind === "processed" ? processed : raw;
    const status = root.querySelector<HTMLElement>('[data-role="ai-preprocess-status"]');
    if (status) {
      if (!raw) status.textContent = "当前视频暂无字幕";
      else if (!state.preprocessEnabled) status.textContent = "预处理已关闭";
      else if (state.preprocessRun?.busy) status.textContent = state.preprocessRun.statusText || "AI 正在处理字幕…";
      else if (processed) status.textContent = state.preprocessRun?.statusText || "AI 字幕已就绪";
      else status.textContent = "原始字幕已就绪 · 尚未生成 AI 字幕";
    }
    const meta = root.querySelector<HTMLElement>('[data-role="ai-canvas-meta"]');
    if (meta) meta.textContent = kind === "processed" ? "AI 处理字幕" : kind === "timeline" ? "字幕时间线" : "字幕";
    state.renderEpoch += 1;
    state.aiViewingPreprocess = kind === "processed";
    const content = root.querySelector<HTMLElement>('[data-role="ai-content"]');
    if (!content) return;
    if (kind === "processed" && state.preprocessRun?.busy) {
      content.innerHTML = toTrustedHTML(`<div class="bsb-empty"><div class="bsb-empty-ico">◌</div><strong>AI 正在处理字幕…</strong><span>${escapeHtml(state.preprocessRun.statusText || "正在规范化、翻译并整理字幕")}</span></div>`);
    } else if (text) {
      if (kind === "processed") {
        try {
          await ensureKnowledgeRenderLibs(text);
        } catch  {
          /* simple markdown fallback */
        }
        content.innerHTML = toTrustedHTML(renderProcessedTranscriptCards(text));
        await decorateKnowledgeAnchors(content);
        await hydrateKnowledgeAnswerDom(content, state.renderEpoch);
      } else {
        content.innerHTML = toTrustedHTML(renderTranscriptReading(text, kind === "timeline", escapeHtml));
      }
    } else {
      const title = kind === "processed" ? "还没有 AI 处理字幕" : "还没有原始字幕";
      const detail = kind === "processed"
        ? (state.preprocessEnabled ? "运行处理方案后，这里会显示规范化后的简体中文字幕。" : "当前预处理已关闭，可在“处理方案”中开启。")
        : "先在字幕库抓取当前视频字幕。";
      content.innerHTML = toTrustedHTML(`<div class="bsb-empty"><div class="bsb-empty-ico">◇</div><strong>${title}</strong><span>${detail}</span></div>`);
    }
    refreshAiChips();
    saveUiGeom();
  }

  async function renderPostprocessCanvas() {
    const root = ensurePanel();
    if (state.ui) state.ui.aiStage = "postprocess";
    applyAiWorkbenchStageUi();
    renderAiResultTabs();
    const meta = root.querySelector<HTMLElement>('[data-role="ai-canvas-meta"]');
    const activeRun = getActiveAiRun();
    if (activeRun) {
      if (meta) meta.textContent = `${activeRun.promptName || "产物"} · ${activeRun.config.name || activeRun.config.model}`;
      await selectAiRun(activeRun.id);
      return;
    }
    const tasks = currentPostTasks().filter((t) => t.enabled !== false);
    const task = tasks.find((t) => t.id === state.aiActiveTaskId) || tasks[0];
    if (task) {
      if (meta) meta.textContent = taskDisplayName(task);
      await selectAiOutputTask(task.id);
      return;
    }
    const content = root.querySelector<HTMLElement>('[data-role="ai-content"]');
    if (meta) meta.textContent = "暂无后处理产物";
    if (content) content.innerHTML = toTrustedHTML('<div class="bsb-empty"><div class="bsb-empty-ico">◇</div><strong>还没有后处理产物</strong><span>打开“处理方案”添加全 Mermaid 学习图谱或其他 POST Prompt。</span></div>');
    saveUiGeom();
  }

  async function setAiWorkbenchStage(stage: string, opts: { silent?: boolean; render?: boolean } = {}) {
    const next = stage === "postprocess" ? "postprocess" : stage === "chat" ? "chat" : "preprocess";
    if (state.ui) state.ui.aiStage = next;
    applyAiWorkbenchStageUi();
    if (!opts.silent) saveUiGeom();
    if (opts.render === false) return;
    if (next === "preprocess") await renderPreprocessCanvas();
    else if (next === "chat") {
      loadStudioChat();
      renderStudioCanvas();
    } else await renderPostprocessCanvas();
  }

  function renderAiResultTabs() {
    const root = document.getElementById(PANEL_ID);
    const outputHost = root?.querySelector<HTMLElement>('[data-role="ai-result-tabs"]');
    const modelHost = root?.querySelector<HTMLElement>('[data-role="ai-model-tabs"]');
    if (!outputHost || !modelHost) return;
    const tasks = currentPostTasks().filter((t) => t.enabled !== false);
    if (!tasks.some((t) => t.id === state.aiActiveTaskId)) state.aiActiveTaskId = tasks[0]?.id || "";
    if (!tasks.length) {
      outputHost.innerHTML = toTrustedHTML('<span class="bsb-ai-result-empty">还没有输出产物 · 打开“处理方案”添加</span>');
      modelHost.innerHTML = toTrustedHTML("");
      return;
    }

    outputHost.innerHTML = toTrustedHTML(tasks.map((task) => {
      const runs = state.aiRunOrder.map((id) => state.aiRuns.get(id)).filter((r): r is WorkbenchAiRun => !!r && r.taskId === task.id);
      const status = aggregateRunStatus(runs);
      const active = task.id === state.aiActiveTaskId ? " active" : "";
      const configuredModels = task.modelIds?.length || 0;
      return `<button type="button" class="bsb-output-tab ${escapeAttr(status)}${active}" data-ai-output-task="${escapeAttr(task.id)}" title="${escapeAttr(taskDisplayName(task))}"><span class="dot"></span><span class="name">${escapeHtml(taskDisplayName(task))}</span><span class="count">${runs.length || configuredModels}</span></button>`;
    }).join(""));

    const activeTask = tasks.find((t) => t.id === state.aiActiveTaskId) || tasks[0];
    if (!activeTask) return;
    const runs = state.aiRunOrder.map((id) => state.aiRuns.get(id)).filter((r): r is WorkbenchAiRun => !!r && r.taskId === activeTask.id);
    if (runs.length) {
      const firstRun = runs[0];
      if (firstRun && !runs.some((r) => r.id === state.aiActiveRunId)) {
        state.aiActiveRunId = firstRun.id;
        syncActiveRunBridge(firstRun);
      }
      modelHost.innerHTML = toTrustedHTML(runs.map((run) => {
        const active = run.id === state.aiActiveRunId ? " active" : "";
        const status = run.status || (run.busy ? "running" : "queued");
        const name = run.config.name || run.config.model;
        return `<button type="button" class="bsb-model-tab ${escapeAttr(status)}${active}" data-ai-result-id="${escapeAttr(run.id)}" title="${escapeAttr(`${run.promptName} · ${name} · ${run.statusText || status}`)}"><span class="dot"></span><span>${escapeHtml(name)}</span></button>`;
      }).join(""));
    } else {
      const profiles = state.aiProfiles?.length ? state.aiProfiles : loadAiProfiles();
      const modelNames = (activeTask.modelIds || []).map((id) => profiles.find((p: { id: unknown; }) => p.id === id)).filter((p): p is AiProfile => !!p);
      modelHost.innerHTML = toTrustedHTML(modelNames.length
        ? modelNames.map((p) => `<span class="bsb-model-tab queued"><span class="dot"></span><span>${escapeHtml(p.name || p.model)}</span></span>`).join("")
        : '<span class="bsb-ai-result-empty">这个产物还没有选择 LLM</span>');
    }
  }

  function flowSelectHtml(dataAttr: string, optionsHtml: string, disabled = false) {
    return `<div class="bsb-flow-select"><select ${dataAttr} ${disabled ? "disabled" : ""}>${optionsHtml}</select><span class="bsb-flow-select-icon" aria-hidden="true">⌄</span></div>`;
  }

  function flowStepperHtml(dataAttr: string, value: number, min: number, max: number, step: number, unit = "", disabled = false) {
    const off = disabled ? "disabled" : "";
    return `<div class="bsb-flow-stepper ${disabled ? "disabled" : ""}"><button type="button" data-flow-step="-1" ${off} aria-label="减少">−</button><div class="bsb-flow-stepper-value"><input type="number" min="${min}" max="${max}" step="${step}" value="${escapeAttr(value)}" ${dataAttr} ${off}>${unit ? `<span class="bsb-flow-stepper-unit">${escapeHtml(unit)}</span>` : ""}</div><button type="button" data-flow-step="1" ${off} aria-label="增加">＋</button></div>`;
  }

  function flowTaskModelsHtml(task: WorkbenchPostTask, profiles: AiProfile[]) {
    const list = Array.isArray(profiles) ? profiles : [];
    const selectedIds = (task.modelIds || []).filter((id) => list.some((p) => p.id === id));
    const ranked = selectedIds.map((id: unknown, i: number) => {
      const profile = list.find((p) => p.id === id);
      const name = profile?.name || profile?.model || id;
      const off = profile && profile.enabled === false ? " · 停用" : "";
      return `<div class="bsb-model-rank" draggable="true" data-flow-model-id="${escapeAttr(id)}" title="拖动调整运行顺序">
        <span class="bsb-model-rank-handle" aria-hidden="true">⠿</span>
        <span class="bsb-model-rank-n">${String(i + 1).padStart(2, "0")}</span>
        <span class="bsb-model-rank-name">${escapeHtml(name)}${off}</span>
        <button type="button" class="bsb-model-rank-remove" data-flow-task-model-remove="${escapeAttr(id)}" title="移出运行队列" aria-label="移出 ${escapeAttr(name)}">×</button>
      </div>`;
    }).join("");
    const available = list.filter((p) => !selectedIds.includes(p.id)).map((p) => (
      `<button type="button" class="bsb-model-add" data-flow-task-model-add="${escapeAttr(p.id)}" title="追加到队列末尾">＋ ${escapeHtml(p.name || p.model)}${p.enabled === false ? " · 停用" : ""}</button>`
    )).join("");
    return `<div class="bsb-model-order">
      <div class="bsb-model-rank-list">${ranked || '<span class="bsb-ai-result-empty">还没有模型。从下方添加到运行队列，上到下即 1 → 2 → 3。</span>'}</div>
      ${list.length ? `<div class="bsb-model-add-list">${available || '<span class="bsb-ai-result-empty">全部模型已在队列中</span>'}</div>` : '<span class="bsb-ai-result-empty">请先在设置 → LLM 新建模型</span>'}
    </div>`;
  }

  function flowTaskCardHtml(task: WorkbenchPostTask, index: number, prompts: PromptProfile[], profiles: AiProfile[]) {
    const posts = prompts.filter((p: { stage: string; }) => p.stage === "postprocess");
    const prompt = posts.find((p) => p.id === task.promptId) || posts[0] || null;
    const promptOptions = posts.map((p: { id: unknown; name: unknown; }) => `<option value="${escapeAttr(p.id)}"${p.id === task.promptId ? " selected" : ""}>${escapeHtml(p.name)}</option>`).join("");
    return `<article class="bsb-output-task-card" data-flow-task-id="${escapeAttr(task.id)}">
      <div class="bsb-output-task-head"><span class="bsb-output-task-index">${String(index + 1).padStart(2, "0")}</span><span class="bsb-output-task-name">${escapeHtml(prompt?.name || "未命名产物")}</span><button type="button" class="bsb-mini" data-flow-task-remove="${escapeAttr(task.id)}" title="移除这个产物">移除</button></div>
      <div class="bsb-flow-field"><span class="bsb-flow-label">产物 Prompt</span>${flowSelectHtml("data-flow-task-prompt", promptOptions || '<option value="">没有 POST Prompt</option>')}</div>
      <div class="bsb-flow-field" style="margin-top:9px"><span class="bsb-flow-label">LLM 运行顺序</span>${flowTaskModelsHtml(task, profiles)}</div>
    </article>`;
  }

  function renderAiFlowDrawer() {
    const root = document.getElementById(PANEL_ID);
    const host = root?.querySelector<HTMLElement>('[data-role="ai-flow-drawer"]');
    if (!host) return;
    const prompts = state.promptProfiles?.length ? state.promptProfiles : loadPromptProfiles().prompts;
    const profiles = state.aiProfiles?.length ? state.aiProfiles : loadAiProfiles();
    const tasks = state.postTasks?.length ? state.postTasks : loadPostTasks();
    const pres = prompts.filter((p: { stage: string; }) => p.stage === "preprocess");
    const preOptions = pres.map((p: { id: unknown; name: unknown; }) => `<option value="${escapeAttr(p.id)}"${p.id === state.activePrePromptId ? " selected" : ""}>${escapeHtml(p.name)}</option>`).join("");
    const readyProfiles = profiles.filter((p) => p.apiKey && p.baseUrl && p.model);
    const preModelOptions = readyProfiles.map((p) => `<option value="${escapeAttr(p.id)}"${p.id === state.preprocessModelId ? " selected" : ""}>${escapeHtml(p.name || p.model)}</option>`).join("");
    const studioModel = getStudioModelConfig();
    const studioModelOptions = readyProfiles.map((p) => `<option value="${escapeAttr(p.id)}"${studioModel?.id === p.id ? " selected" : ""}>${escapeHtml(p.name || p.model)}</option>`).join("");
    const ctxPref = state.studioContextPref === "raw" || state.studioContextPref === "processed" ? state.studioContextPref : "auto";
    const ctxOptions = [
      `<option value="auto"${ctxPref === "auto" ? " selected" : ""}>自动（规范化稿优先）</option>`,
      `<option value="processed"${ctxPref === "processed" ? " selected" : ""}>规范化稿</option>`,
      `<option value="raw"${ctxPref === "raw" ? " selected" : ""}>原始字幕</option>`,
    ].join("");
    host.innerHTML = toTrustedHTML(`<div class="bsb-drawer-head"><div class="bsb-drawer-title"><strong>处理方案</strong><span>配置预处理、对话与后处理。这里只定义流程，不展示结果。</span></div><button type="button" class="bsb-icon-btn" data-act="ai-drawer-close" aria-label="关闭">×</button></div>
      <div class="bsb-drawer-body">
        <section class="bsb-flow-section">
          <div class="bsb-flow-section-head"><div><strong>预处理</strong><span>一次规范化，供对话与后处理复用</span></div><label class="bsb-flow-switch"><input type="checkbox" data-flow-preprocess-enabled ${state.preprocessEnabled ? "checked" : ""}><span class="bsb-flow-switch-track" aria-hidden="true"></span><span class="bsb-flow-switch-text">${state.preprocessEnabled ? "已开启" : "已关闭"}</span></label></div>
          <div class="bsb-flow-grid">
            <div class="bsb-flow-field"><span class="bsb-flow-label">Prompt</span>${flowSelectHtml("data-flow-preprompt", preOptions || '<option value="">没有预处理 Prompt</option>', !state.preprocessEnabled)}</div>
            <div class="bsb-flow-field"><span class="bsb-flow-label">LLM</span>${flowSelectHtml("data-flow-premodel", preModelOptions || '<option value="">没有可用 LLM</option>', !state.preprocessEnabled)}</div>
            <div class="bsb-flow-field"><span class="bsb-flow-label">全局并发</span>${flowStepperHtml("data-flow-preconcurrency", state.preprocessConcurrency, 1, 8, 1, "", !state.preprocessEnabled)}</div>
            <div class="bsb-flow-field"><span class="bsb-flow-label">目标块时长</span>${flowStepperHtml("data-flow-pretarget-minutes", state.preprocessTargetMinutes, 2, 30, 1, "分钟", !state.preprocessEnabled)}</div>
          </div>
          <details class="bsb-flow-advanced">
            <summary>高级切块设置</summary>
            <div class="bsb-flow-grid">
              <div class="bsb-flow-field"><span class="bsb-flow-label">上下文重叠</span>${flowStepperHtml("data-flow-preoverlap-seconds", state.preprocessOverlapSeconds, 0, 120, 5, "秒", !state.preprocessEnabled)}</div>
              <div class="bsb-flow-field"><span class="bsb-flow-label">单块字符硬上限</span>${flowStepperHtml("data-flow-premax-chars", state.preprocessMaxChars, 8000, 60000, 1000, "字符", !state.preprocessEnabled)}</div>
              <div class="bsb-flow-field"><span class="bsb-flow-label">失败重试</span>${flowStepperHtml("data-flow-preretries", state.preprocessRetries, 0, 4, 1, "次", !state.preprocessEnabled)}</div>
            </div>
          </details>
          <div class="bsb-preprocess-note">关闭后，对话与后处理直接读取原始字幕。长视频按真实时间戳优先切块；单块超过字符硬上限会提前截断。Overlap 只用于跨块上下文，最终按真实时间戳确定性去重。并发是全局 Worker 数，不会乘以视频数量。</div>
        </section>
        <section class="bsb-flow-section">
          <div class="bsb-flow-section-head"><div><strong>对话</strong><span>对着当前字幕多轮提问，不走「运行」流水线</span></div></div>
          <div class="bsb-flow-grid">
            <div class="bsb-flow-field"><span class="bsb-flow-label">LLM</span>${flowSelectHtml("data-flow-studiomodel", studioModelOptions || '<option value="">没有可用 LLM</option>')}</div>
            <div class="bsb-flow-field"><span class="bsb-flow-label">字幕上下文</span>${flowSelectHtml("data-flow-studiocontext", ctxOptions)}</div>
          </div>
          <div class="bsb-preprocess-note">在 AI 工作台的「对话」页提问。输入 / 可清空、压缩记忆、切换原文或规范化稿。超长字幕会按问题压缩，旧轮次会折进记忆。</div>
        </section>
        <section class="bsb-flow-section">
          <div class="bsb-flow-section-head"><div><strong>后处理</strong><span>${tasks.length} 个 · 每个产物独立选择 Prompt 与 LLM</span></div><button type="button" class="bsb-btn ghost" data-act="post-task-add">＋ 添加产物</button></div>
          <div data-role="flow-task-list">${tasks.map((t, i) => flowTaskCardHtml(t, i, prompts, profiles)).join("") || '<div class="bsb-input-empty">还没有后处理产物。</div>'}</div>
        </section>
        <div style="display:flex;justify-content:space-between;gap:8px;align-items:center"><span class="bsb-ai-result-empty">Prompt 与 LLM 的具体内容仍在“设置”中维护。</span><button type="button" class="bsb-btn" data-act="ai-reprocess" ${state.preprocessEnabled ? "" : "disabled"}>重做预处理</button></div>
      </div>`);
  }

  function currentInputPreviewText(kind: string) {
    const input = state.aiSessionInput;
    if (kind === "processed") return String(input?.vars?.processedSubtitle || state.preprocessRun?.text || "");
    if (input?.vars?.rawSubtitle) return String(input.vars.rawSubtitle);
    const routeKey = currentRouteVideoKey();
    const current = routeKey
      ? (state.items.find((it) => routeVideoKey(it.bvid, Number(it.page) || 1) === routeKey)
        || (routeVideoKey(state.transcriptItem?.bvid, state.transcriptItem?.page || 1) === routeKey ? state.transcriptItem : null))
      : null;
    if (current?.subStatus === "ok" && current.data?.length) return buildSubtitlePayload([current]);
    const ready = selectedItems().filter((it) => it.subStatus === "ok" && it.data?.length);
    return ready.length ? buildSubtitlePayload(ready) : "";
  }

  function renderAiInputDrawer() {
    const root = document.getElementById(PANEL_ID);
    const host = root?.querySelector<HTMLElement>('[data-role="ai-input-drawer"]');
    if (!host) return;
    const raw = currentInputPreviewText("raw");
    const processed = currentInputPreviewText("processed");
    if (state.aiInputView === "processed" && !processed && raw) state.aiInputView = "raw";
    const text = state.aiInputView === "processed" ? processed : raw;
    const preLabel = state.preprocessEnabled ? (processed ? "已规范化" : "等待规范化") : "预处理关闭";
    host.innerHTML = toTrustedHTML(`<div class="bsb-drawer-head"><div class="bsb-drawer-title"><strong>输入</strong><span>${escapeHtml(preLabel)} · 这里用于核查 AI 真正读取的材料</span></div><button type="button" class="bsb-icon-btn" data-act="ai-drawer-close" aria-label="关闭">×</button></div>
      <div class="bsb-drawer-body">
        <div style="display:flex;justify-content:space-between;gap:8px;align-items:center"><div class="bsb-input-tabs"><button type="button" data-input-view="raw" class="${state.aiInputView === "raw" ? "active" : ""}">字幕</button><button type="button" data-input-view="timeline" class="${state.aiInputView === "timeline" ? "active" : ""}">字幕时间线</button><button type="button" data-input-view="processed" class="${state.aiInputView === "processed" ? "active" : ""}" ${processed ? "" : "disabled"}>AI 处理字幕</button></div><button type="button" class="bsb-mini" data-act="ai-copy-input">复制正文</button></div>
        ${text ? (state.aiInputView === "processed" ? `<pre class="bsb-input-preview">${escapeHtml(transcriptReadingText(text))}</pre>` : renderTranscriptReading(text, state.aiInputView === "timeline", escapeHtml)) : '<div class="bsb-input-empty">当前没有可查看的输入。先在字幕库选择有字幕的视频，或运行一次处理方案。</div>'}
      </div>`);
  }

  function setAiDrawer(kind = "") {
    const root = document.getElementById(PANEL_ID);
    if (!root) return;
    state.aiDrawer = ["flow", "input"].includes(kind) ? kind : "";
    const flow = root.querySelector<HTMLElement>('[data-role="ai-flow-drawer"]');
    const input = root.querySelector<HTMLElement>('[data-role="ai-input-drawer"]');
    const backdrop = root.querySelector<HTMLElement>('[data-role="ai-drawer-backdrop"]');
    if (state.aiDrawer === "flow") renderAiFlowDrawer();
    if (state.aiDrawer === "input") renderAiInputDrawer();
    flow?.classList.toggle("open", state.aiDrawer === "flow");
    input?.classList.toggle("open", state.aiDrawer === "input");
    flow?.setAttribute("aria-hidden", state.aiDrawer === "flow" ? "false" : "true");
    input?.setAttribute("aria-hidden", state.aiDrawer === "input" ? "false" : "true");
    if (backdrop) backdrop.hidden = !state.aiDrawer;
  }

  async function selectAiOutputTask(taskId: string) {
    if (state.ui) state.ui.aiStage = "postprocess";
    applyAiWorkbenchStageUi();
    const task = currentPostTasks().find((t) => t.id === String(taskId || ""));
    if (!task) return;
    state.aiActiveTaskId = task.id;
    const runs = state.aiRunOrder.map((id) => state.aiRuns.get(id)).filter((r): r is WorkbenchAiRun => !!r && r.taskId === task.id);
    renderAiResultTabs();
    if (runs[0]) await selectAiRun(runs[0].id);
    else {
      const root = ensurePanel();
      const content = root.querySelector<HTMLElement>('[data-role="ai-content"]');
      if (content) content.innerHTML = toTrustedHTML(`<div class="bsb-empty"><div class="bsb-empty-ico">◇</div><strong>${escapeHtml(taskDisplayName(task))}</strong><span>这个产物还没有运行结果。点击“运行全部”按照当前处理方案生成。</span></div>`);
    }
  }

  function syncActiveRunBridge(run: WorkbenchAiRun | null | undefined) {
    state.aiRaw = run?.raw || "";
    state.aiSourceBvids = run?.sourceBvids || [];
    state.ai = run?.config || state.ai;
  }

  async function selectAiRun(runId: string) {
    if (state.ui) state.ui.aiStage = "postprocess";
    applyAiWorkbenchStageUi();
    const run = state.aiRuns.get(String(runId || ""));
    if (!run) return;
    state.aiViewingPreprocess = false;
    if (run.taskId) state.aiActiveTaskId = run.taskId;
    const root = ensurePanel();
    const box = root.querySelector<HTMLElement>('[data-role="ai-md"]');
    const previous = getActiveAiRun();
    if (previous && box) {
      previous.scrollTop = box.scrollTop;
      previous.stickBottom = state.aiStickBottom;
      previous.userReading = state.aiUserReading;
    }
    state.aiActiveRunId = run.id;
    // 使上一个标签仍在进行的 marked/Mermaid 异步渲染立即失效，避免覆盖新标签。
    state.renderEpoch += 1;
    syncActiveRunBridge(run);
    state.aiRenderedText = "";
    state.aiPendingText = run.raw || "";
    state.aiStreamTextNode = null;
    state.aiStickBottom = run.busy ? run.stickBottom !== false : false;
    state.aiUserReading = run.busy ? !!run.userReading : true;
    renderAiResultTabs();
    refreshAiChips();
    setAiBusy(anyAiRunBusy());

    const content = root.querySelector<HTMLElement>('[data-role="ai-content"]');
    if (run.busy) {
      if (content && !run.raw) {
        content.innerHTML = toTrustedHTML(`<div class="bsb-empty"><div class="bsb-empty-ico">◌</div><strong>${escapeHtml(run.config.name || run.config.model)} 正在生成…</strong><span>${escapeHtml(run.statusText || "正在连接模型")}</span></div>`);
      }
      paintAiStreamText(run.raw || "正在等待模型返回…");
      requestAnimationFrame(() => scrollAiToBottom(true));
    } else if (run.raw) {
      await renderAiMarkdown(run.raw, { streaming: false });
      if (box) box.scrollTop = Math.max(0, Number(run.scrollTop) || 0);
    } else if (content) {
      content.innerHTML = toTrustedHTML(`<div class="bsb-empty"><div class="bsb-empty-ico">${run.status === "error" ? "!" : "◌"}</div><strong>${escapeHtml(run.config.name || run.config.model)}</strong><span>${escapeHtml(run.error || run.statusText || "暂无输出")}</span></div>`);
    }
    setStatus(`${run.promptName || "产物"} · ${run.config.name || run.config.model} · ${run.statusText || run.status}`, run.status === "error" ? "err" : run.status === "done" ? "ok" : undefined);
  }

  function abortAiRun(run: WorkbenchAiRun | null | undefined) {
    if (!run) return;
    run.abort = true;
    try { run.abortController?.abort(); } catch  { /* noop */ }
    try { if (run.xhr && typeof run.xhr.abort === "function") run.xhr.abort(); } catch  { /* noop */ }
  }

  function abortAllAiRuns() {
    aiBatchCoordinator?.stop();
    state.aiRunOrder.forEach((id) => abortAiRun(state.aiRuns.get(id)));
    if (state.preprocessRun?.runtime) {
      state.preprocessRun.runtime.abort = true;
      try { state.preprocessRun.runtime.abortController?.abort(); } catch  { /* noop */ }
      try { state.preprocessRun.runtime.xhr?.abort?.(); } catch  { /* noop */ }
      for (const child of state.preprocessRun.childRuntimes || []) abortPreprocessChildRuntime(child);
    }
  }

  function latestAiConfigForRun(run: { profileId: string; config: unknown }) {
    let profiles = [];
    try {
      profiles = saveAiProfilesFromForm();
    } catch  {
      profiles = loadAiProfiles();
    }
    const latest = profiles.find((profile) => profile.id === run?.profileId);
    return coreCall("createAiProfile", latest || run?.config || AI_DEFAULTS, 0);
  }

  function validateAiRunConfigs(configs: readonly (BatchModel & Partial<AiProfile>)[]) {
    const invalid = (configs || []).filter((cfg) => !cfg?.apiKey || !cfg?.baseUrl || !cfg?.model);
    if (!invalid.length) return true;
    setStatus(`以下模型配置不完整：${invalid.map((cfg) => cfg?.name || cfg?.model || "未命名模型").join("、")}`, "err");
    return false;
  }

  function summarizeAiRuns(prefix = "全部产物生成结束") {
    setAiBusy(anyAiRunBusy());
    if (anyAiRunBusy()) return;
    const runs = state.aiRunOrder.map((id) => state.aiRuns.get(id)).filter((run): run is WorkbenchAiRun => !!run);
    if (!runs.length) return;
    const summary = appCall("ai.summarizeRuns", runs);
    if (!summary) return;
    const { done, failed, stopped } = summary;
    persistAiSessionCache().catch(() => {});
    setStatus(`${prefix} · 成功 ${done} · 失败 ${failed} · 停止 ${stopped}`, failed ? "err" : "ok");
  }

  async function regenerateActiveAiRun() {
    const oldRun = getActiveAiRun();
    const input = appCall("ai.cloneSessionInput", state.aiSessionInput);
    if (!oldRun || !input) {
      setStatus("当前没有可重新生成的模型结果，请先完成一次分析", "err");
      return;
    }
    if (oldRun.busy) {
      const restart = typeof pageWindow.confirm === "function"
        ? pageWindow.confirm(`“${oldRun.config.name || oldRun.config.model}”仍在生成。是否只停止该模型并重新生成？`)
        : false;
      if (!restart) return;
    }

    const config = latestAiConfigForRun(oldRun);
    if (!validateAiRunConfigs([config])) return;

    const runId = oldRun.id;
    abortAiRun(oldRun);
    const replacement = createAiRun(config, input.sessionId, oldRun.taskSnapshot, oldRun.promptProfile);
    // 保持结果身份和排列位置不变；只替换该产物的当前模型运行实例与输出。
    replacement.id = runId;
    replacement.profileId = oldRun.profileId;
    replacement.sourceBvids = [...(input.commonMeta.sourceBvids || [])];
    state.aiRuns.set(runId, replacement);
    state.aiActiveRunId = runId;
    syncActiveRunBridge(replacement);
    renderAiResultTabs();
    await selectAiRun(runId || "");
    setStatus(`${replacement.promptName} · ${config.name || config.model} · 仅重新生成当前版本 · 复用现有${input.preprocessEnabled ? "规范化稿" : "原始字幕"}`);

    await runAiProfile(replacement, input.vars, replacement.promptProfile, input.commonMeta);
    summarizeAiRuns("当前模型重新生成结束");
  }

  async function regenerateAllAiRuns() {
    const input = appCall("ai.cloneSessionInput", state.aiSessionInput);
    const oldRuns = state.aiRunOrder.map((id) => state.aiRuns.get(id)).filter((run): run is WorkbenchAiRun => !!run);
    if (!input || !oldRuns.length) {
      setStatus("当前没有可重新生成的批次，请先完成一次分析", "err");
      return;
    }
    if (anyAiRunBusy()) {
      const restart = typeof pageWindow.confirm === "function"
        ? pageWindow.confirm("仍有模型正在生成。是否停止所有当前请求并重新生成全部模型？")
        : false;
      if (!restart) return;
    }

    const runSpecs = oldRuns.map((run) => ({ old: run, config: latestAiConfigForRun(run) }));
    if (!validateAiRunConfigs(runSpecs.map((x) => x.config))) return;
    const activeOld = getActiveAiRun();

    state.aiAbort = true;
    abortAllAiRuns();
    const sessionId = ++state.aiSessionSeq;
    state.aiAbort = false;
    state.aiRuns = new Map();
    state.aiRunOrder = [];
    for (const spec of runSpecs) {
      const run = createAiRun(spec.config, sessionId, spec.old.taskSnapshot, spec.old.promptProfile);
      state.aiRuns.set(run.id, run);
      state.aiRunOrder.push(run.id);
    }
    state.aiActiveRunId = state.aiRunOrder.find((id) => {
      const run = state.aiRuns.get(id);
      return run?.profileId === activeOld?.profileId && run?.taskId === activeOld?.taskId;
    }) || state.aiRunOrder[0] || "";
    state.aiActiveTaskId = getActiveAiRun()?.taskId || state.aiActiveTaskId;
    state.aiSessionInput = appCall("ai.cloneSessionInput", input, sessionId);
    syncActiveRunBridge(getActiveAiRun());
    renderAiResultTabs();
    setAiBusy(true);
    if (state.aiActiveRunId) await selectAiRun(state.aiActiveRunId);
    setStatus(`正在重新生成全部 ${state.aiRunOrder.length} 个产物版本 · 不重复运行输入整理…`);

    await Promise.allSettled(state.aiRunOrder.map((id) => {
      const run = state.aiRuns.get(id);
      if (!run) return;
      return runAiProfile(run, input.vars, run.promptProfile, input.commonMeta);
    }));
    if (sessionId === state.aiSessionSeq) summarizeAiRuns("全部模型重新生成结束");
  }

  function setAiBusy(busy: boolean|null) {
    const anyBusy = busy == null ? anyAiRunBusy() : !!busy;
    state.aiBusy = anyBusy;
    const root = ensurePanel();
    root.classList.toggle("ai-busy", anyBusy);
    refreshActionDisabledState();
    refreshStudioStopUi();
    renderAiResultTabs();
  }

  function updateJumpLatestBtn() {
    const root = document.getElementById(PANEL_ID);
    if (!root) return;
    const jump = root.querySelector<HTMLElement>('[data-act="ai-jump"]');
    const stickBtn = root.querySelector<HTMLElement>('[data-act="ai-stick"]');
    // 粘底按钮：仅在真正跟随中亮
    if (stickBtn) {
      stickBtn.classList.toggle(
        "on",
        !!state.aiStickBottom && !state.aiUserReading,
      );
    }
    if (!jump) return;
    // 用户阅读锁 或 未跟随时显示「↓ 最新」
    const show =
      (!state.aiStickBottom || state.aiUserReading) &&
      !!(state.aiRaw || activeAiRunBusy());
    jump.classList.toggle("show", show);
  }

  function applyAiScrollResolved(r: {stick:boolean;userReading:boolean;allowPaintScroll:boolean}) {
    state.aiStickBottom = r.stick;
    state.aiUserReading = r.userReading;
    updateJumpLatestBtn();
  }

  /** 用户主动离开底部：进入阅读锁，后续 paint 绝对不改 scrollTop */
  function detachAiFollow() {
    applyAiScrollResolved(
      resolveAiScrollState(
        {
          stick: state.aiStickBottom,
          userReading: state.aiUserReading,
          progScroll: state.aiProgScroll,
        },
        { type: "detach" },
      ),
    );
  }

  /** 仅按钮/开始分析：恢复跟随并滚到底 */
  function resumeAiFollow() {
    applyAiScrollResolved(
      resolveAiScrollState(
        {
          stick: state.aiStickBottom,
          userReading: state.aiUserReading,
          progScroll: false,
        },
        { type: "resume" },
      ),
    );
    scrollAiToBottom(true);
  }

  /**
   * v0.8.4 自由滚动硬模型（修「永远滚不动」）：
   *
   * 旧 bug：scroll 事件在距底 <80px 时自动 stick=true → 流式 paint 下一帧拽回底部。
   * 用户刚上滑几像素就被重新粘底，体感永远「在原地」。
   *
   * 新规则：
   * 1) 跟随只由：开始分析 / 「粘底」开 / 「↓ 最新」打开
   * 2) 任意向上 wheel / 上滑 touch / PageUp → 立即 detach，加阅读锁
   * 3) 程序化 scrollTop 带 aiProgScroll 标记，scroll 监听忽略
   * 4) 阅读锁期间 paint **完全不碰** scrollTop
   * 5) 用户自己滚到真正贴底（gap<=12）才解除阅读锁并恢复跟随
   */
  function bindAiScrollBehavior(root: HTMLElement) {
    const box = root.querySelector<HTMLElement>('[data-role="ai-md"]');
    if (!box || box.dataset.bsbScrollBound === "1") return;
    box.dataset.bsbScrollBound = "1";

    const onLeaveBottom = () => {
      if (state.aiUserReading && !state.aiStickBottom) {
        updateJumpLatestBtn();
        return;
      }
      detachAiFollow();
    };

    // 捕获：向上意图优先于任何 paint
    box.addEventListener(
      "wheel",
      (e: { deltaY: number; }) => {
        if (e.deltaY < 0) onLeaveBottom();
      },
      { passive: true, capture: true },
    );
    // 触控板/手指：touchmove 向上
    let touchY: number | null = null;
    let pointerY: number | null = null;
    box.addEventListener(
      "touchstart",
      (e) => {
        const t = e.touches && e.touches[0];
        touchY = t ? t.clientY : null;
      },
      { passive: true, capture: true },
    );
    box.addEventListener(
      "touchmove",
      (e) => {
        const t = e.touches && e.touches[0];
        if (!t || touchY == null) return;
        if (t.clientY - touchY > 8) onLeaveBottom();
        touchY = t.clientY;
      },
      { passive: true, capture: true },
    );
    box.addEventListener(
      "pointerdown",
      () => {
        pointerY = null;
      },
      { passive: true },
    );
    box.addEventListener(
      "pointermove",
      (e: { buttons: number; pointerType: string; clientY: number; }) => {
        if (e.buttons === 0 && e.pointerType === "mouse") return;
        if (pointerY != null && e.clientY - pointerY > 8) {
          onLeaveBottom();
        }
        pointerY = e.clientY;
      },
      { passive: true },
    );
    box.addEventListener(
      "keydown",
      (e: { key: string; }) => {
        if (
          e.key === "ArrowUp" ||
          e.key === "PageUp" ||
          e.key === "Home"
        ) {
          onLeaveBottom();
        }
      },
      true,
    );

    box.addEventListener(
      "scroll",
      () => {
        const gap = box.scrollHeight - box.scrollTop - box.clientHeight;
        const r = resolveAiScrollState(
          {
            stick: state.aiStickBottom,
            userReading: state.aiUserReading,
            progScroll: state.aiProgScroll,
          },
          { type: "scroll", gap },
        );
        applyAiScrollResolved(r);
      },
      { passive: true },
    );
  }

  function scrollAiToBottom(force: boolean) {
    if (!force && (!state.aiStickBottom || state.aiUserReading)) {
      updateJumpLatestBtn();
      return;
    }
    const box = document.querySelector(`#${PANEL_ID} [data-role="ai-md"]`);
    if (!box) return;
    state.aiProgScroll = true;
    box.scrollTop = box.scrollHeight;
    requestAnimationFrame(() => {
      box.scrollTop = box.scrollHeight;
      // 再等一帧清标记，吞掉浏览器延迟的 scroll 事件
      requestAnimationFrame(() => {
        state.aiProgScroll = false;
        updateJumpLatestBtn();
      });
    });
  }

  function scrollAiToTop() {
    const box = document.querySelector(`#${PANEL_ID} [data-role="ai-md"]`);
    if (box) {
      state.aiProgScroll = true;
      box.scrollTop = 0;
      requestAnimationFrame(() => {
        state.aiProgScroll = false;
      });
    }
    detachAiFollow();
  }

  /** 流式绘制：只更新 text；非跟随模式零碰 scrollTop */
  function paintAiStreamText(full: unknown) {
    state.aiPendingText = String(full || "");
    if (state.aiPaintRaf || state.aiPaintTimer) return;

    const run = () => {
      state.aiPaintTimer = 0;
      state.aiPaintRaf = requestAnimationFrame(() => {
        state.aiPaintRaf = 0;
        const root = ensurePanel();
        const box = root.querySelector<HTMLElement>('[data-role="ai-md"]');
        const content = root.querySelector<HTMLElement>('[data-role="ai-content"]') || box;
        if (!box || !content) return;
        const text = state.aiPendingText || "…";
        let pre = content.querySelector<HTMLElement>(".bsb-ai-stream-body");
        let caret = content.querySelector<HTMLElement>(".bsb-ai-caret");
        if (!pre) {
          content.replaceChildren();
          pre = document.createElement("pre");
          pre.className = "bsb-ai-stream-body";
          state.aiStreamTextNode = document.createTextNode("");
          pre.appendChild(state.aiStreamTextNode);
          content.appendChild(pre);
          state.aiRenderedText = "";
        }
        if (!state.aiStreamTextNode || state.aiStreamTextNode.parentNode !== pre) {
          state.aiStreamTextNode = pre.firstChild instanceof Text ? pre.firstChild : pre.appendChild(document.createTextNode(""));
          state.aiRenderedText = state.aiStreamTextNode.data || "";
        }
        if (activeAiRunBusy() && !caret) {
          caret = document.createElement("span");
          caret.className = "bsb-ai-caret";
          caret.setAttribute("aria-hidden", "true");
          content.appendChild(caret);
        } else if (!activeAiRunBusy() && caret) caret.remove();

        const follow = resolveAiScrollState(
          { stick: state.aiStickBottom, userReading: state.aiUserReading, progScroll: false },
          { type: "paint" },
        ).allowPaintScroll;
        const freezeTop = box.scrollTop;

        // 追加尾部而不是每个 token 重写整段文本，避免累计 O(n²) DOM 写入。
        if (text.startsWith(state.aiRenderedText)) {
          state.aiStreamTextNode.appendData(text.slice(state.aiRenderedText.length));
        } else {
          state.aiStreamTextNode.data = text;
        }
        state.aiRenderedText = text;

        if (follow) {
          state.aiProgScroll = true;
          box.scrollTop = box.scrollHeight;
          requestAnimationFrame(() => { state.aiProgScroll = false; });
        } else if (box.scrollTop !== freezeTop && freezeTop > 0) {
          state.aiProgScroll = true;
          box.scrollTop = freezeTop;
          requestAnimationFrame(() => { state.aiProgScroll = false; });
        }
        updateJumpLatestBtn();
      });
    };
    state.aiPaintTimer = window.setTimeout(run, STREAM_PAINT_INTERVAL_MS);
  }

  function buildSubtitlePayload(items: WorkbenchLibraryItem[]) {
    return items
      .map((it) => {
        const head = `=== ${it.bvid}${(it.page || 1) > 1 ? " P" + it.page : ""} ${it.title || ""} ===`;
        return `${head}\n${coreCall("cuesToAiText", it.data || [], it.bvid, it.page || 1)}`;
      })
      .join("\n\n");
  }

  async function ensureMarkdownCore() {
    if (state.renderLibs.core) return;
    if (typeof DOMPurify.sanitize !== "function") throw new Error("HTML sanitizer unavailable");
    state.renderLibs.core = true;
  }

  async function ensureHighlight() {
    if (state.renderLibs.highlight) return;
    installRenderingStyles("highlight");
    state.renderLibs.highlight = true;
  }

  async function ensureKatex() {
    if (state.renderLibs.katex) return;
    installRenderingStyles("katex");
    state.renderLibs.katex = true;
  }

  async function ensureMermaid() {
    if (state.renderLibs.mermaid) return;
    if (typeof mermaid !== "undefined") {
      mermaid.initialize({
        startOnLoad: false,
        theme: "base",
        securityLevel: "strict",
        fontFamily: 'Inter, "PingFang SC", "Microsoft YaHei", system-ui, sans-serif',
        suppressErrorRendering: true,
        deterministicIds: false,
        themeVariables: mermaidThemeVariablesForFlavor(),
        themeCSS: mermaidThemeCssForFlavor(),
        flowchart: {
          htmlLabels: false,
          useMaxWidth: false,
          curve: "basis",
          nodeSpacing: 48,
          rankSpacing: 64,
          padding: 16,
        },
        sequence: {
          useMaxWidth: false,
          wrap: true,
          diagramMarginX: 32,
          diagramMarginY: 24,
          actorMargin: 72,
          width: 180,
          height: 72,
          boxMargin: 12,
          messageMargin: 42,
        },
      });
    }
    state.renderLibs.mermaid = true;
  }

  function hasMathSyntax(md: string) {
    return /```(?:math|latex|tex)|\$\$[\s\S]+?\$\$|\\\[|\\\(|\$[^\n$]+\$/.test(md);
  }

  function hasCodeSyntax(md: string) {
    return /```(?!mermaid|math|latex|tex)[^\n]*\n/i.test(md);
  }

  function hasMermaidSyntax(md: string) {
    return /```mermaid\s*\n/i.test(md);
  }

  async function yieldToMain() {
    const scheduler: unknown = Reflect.get(globalThis, "scheduler");
    if (scheduler && typeof scheduler === "object" && "yield" in scheduler && typeof scheduler.yield === "function") {
      await scheduler.yield();
    } else {
      await new Promise((resolve) => setTimeout(resolve, 0));
    }
  }

  /** KaTeX → HTML；失败返回 null 走 fallback */
  function katexToHtml(tex: string, display: boolean) {
    if (typeof katex === "undefined" || !katex.renderToString) return null;
    try {
      const html = katex.renderToString(String(tex || ""), {
        displayMode: !!display, throwOnError: false, strict: "ignore", trust: false, output: "html",
      });
      return display ? `<div class="bsb-katex-display">${html}</div>` : `<span class="bsb-katex-inline">${html}</span>`;
    } catch  { return null; }
  }

  function simpleMarkdownFallback(md: string) {
    let html = escapeHtml(md);
    html = html.replace(/```(\w*)\n([\s\S]*?)```/g, (_, lang, code) =>
      `<pre><span class="bsb-code-lang">${escapeHtml(lang || "text")}</span><code>${escapeHtml(code)}</code></pre>`);
    html = html.replace(/^### (.+)$/gm, "<h3>$1</h3>");
    html = html.replace(/^## (.+)$/gm, "<h2>$1</h2>");
    html = html.replace(/^# (.+)$/gm, "<h1>$1</h1>");
    html = html.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
    // Preserve ==highlight== for decorateMarkdownHighlights after sanitize.
    html = html.replace(/`([^`]+)`/g, "<code>$1</code>");
    html = html.replace(/\n\n/g, "</p><p>");
    return `<p>${html}</p>`;
  }

  function sanitizeRenderedHtml(html: string) {
    if (typeof DOMPurify === "undefined") return simpleMarkdownFallback(stripHtml(html));
    return DOMPurify.sanitize(html, {
      USE_PROFILES: { html: true },
      SANITIZE_NAMED_PROPS: true,
      FORBID_TAGS: ["script", "style", "iframe", "object", "embed", "form"],
      // mark: ==highlight== ; math/annotation: KaTeX/MathML leftovers
      ADD_TAGS: [
        "mark",
        "math",
        "semantics",
        "annotation",
        "mrow",
        "mi",
        "mo",
        "mn",
        "msup",
        "msub",
        "mfrac",
        "msqrt",
        "mtext",
        "mtable",
        "mtr",
        "mtd",
      ],
      // KaTeX relies on inline style for glyph positioning.
      ADD_ATTR: ["target", "rel", "aria-label", "data-bsb-m", "class", "style", "xmlns", "encoding"],
    });
  }

  async function replaceHostInBatches(host: Element, html: string, epoch: number) {
    const tpl = document.createElement("template");
    tpl.innerHTML = toTrustedHTML(html);
    const nodes = Array.from(tpl.content.childNodes);
    host.replaceChildren();
    for (let i = 0; i < nodes.length; i += RENDER_BATCH_SIZE) {
      if (epoch !== state.renderEpoch) return false;
      const frag = document.createDocumentFragment();
      nodes.slice(i, i + RENDER_BATCH_SIZE).forEach((node) => frag.appendChild(node));
      host.appendChild(frag);
      if (i + RENDER_BATCH_SIZE < nodes.length) await yieldToMain();
    }
    return true;
  }

  function linkifyTimestamps(host: Node) {
    const walker = document.createTreeWalker(host, NodeFilter.SHOW_TEXT);
    const nodes: Text[] = [];
    while (walker.nextNode()) {
      if (!(walker.currentNode instanceof Text)) continue;
      const p = walker.currentNode.parentElement;
      if (!p || p.closest("pre,code,a,button,.katex,.mermaid,.bsb-toc")) continue;
      if (/\[(?:BV[\w]+\s+)?(?:P\d+\s+)?(?:\d{1,2}:)?\d{1,2}:\d{2}\]/i.test(walker.currentNode.data)) nodes.push(walker.currentNode);
    }
    const re = /\[((BV[\w]+)\s+)?(?:P(\d+)\s+)?((?:\d{1,2}:)?\d{1,2}:\d{2})\]/gi;
    for (const node of nodes) {
      const text = node.data; let last = 0; let m; const frag = document.createDocumentFragment();
      while ((m = re.exec(text))) {
        if (m.index > last) frag.appendChild(document.createTextNode(text.slice(last, m.index)));
        const sec = (m[4] || "").split(":").map(Number).reduce((seconds, part) => seconds * 60 + part, 0);
        const btn = document.createElement("button");
        btn.type = "button"; btn.className = "bsb-time-link";
        btn.dataset.seconds = String(sec); btn.dataset.bvid = m[2] || ""; btn.dataset.page = m[3] || "1";
        btn.textContent = m[0]; btn.title = "跳到视频对应时间";
        frag.appendChild(btn); last = m.index + m[0].length;
      }
      if (last < text.length) frag.appendChild(document.createTextNode(text.slice(last)));
      node.replaceWith(frag);
    }
  }

  function seekToVideoTimestamp(seconds: unknown, bvid: string, page: number) {
    if (typeof seconds !== "number" || !Number.isFinite(seconds)) return;
    if (isYoutubePage()) {
      const current = SubBatch.SubBatchMonorepo.youtube.extractVideoRef(location.href);
      if (current?.videoId === bvid) { const video = document.querySelector("video"); if (video) { video.currentTime = Math.max(0, seconds); return; } }
      if (bvid) window.open("https://www.youtube.com/watch?v=" + encodeURIComponent(bvid) + "&t=" + Math.floor(seconds) + "s", "_blank", "noopener");
      return;
    }
    const currentBvid = extractBvid(location.href);
    let currentPage = 1;
    try { currentPage = Math.max(1, Number(new URL(location.href).searchParams.get("p")) || 1); } catch  { /* ignore */ }
    const targetPage = Math.max(1, Number(page) || 1);
    const sameVideo = !bvid || !currentBvid || bvid.toLowerCase() === currentBvid.toLowerCase();
    const video = document.querySelector("video");
    if (video && sameVideo && currentPage === targetPage) {
      video.currentTime = Math.max(0, seconds);
      if (video.paused) video.play().catch(() => {});
      video.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }
    if (bvid) {
      const u = new URL(`https://www.bilibili.com/video/${bvid}`);
      u.searchParams.set("p", String(targetPage));
      u.searchParams.set("t", String(Math.floor(seconds)));
      window.open(u.toString(), "_blank", "noopener");
    }
  }

  function buildToc(host: Element) {
    const headings = Array.from(host.querySelectorAll("h1,h2,h3")).filter((h) => !h.closest(".bsb-toc"));
    if (headings.length < 2) return;
    const details = document.createElement("details"); details.className = "bsb-toc"; details.open = true;
    const summary = document.createElement("summary"); summary.textContent = `本页目录 · ${headings.length}`;
    const nav = document.createElement("nav");
    headings.forEach((h, i) => {
      h.id = `bsb-note-h-${state.renderEpoch}-${i}`;
      const b = document.createElement("button"); b.type = "button"; b.dataset.level = h.tagName.slice(1);
      b.textContent = h.textContent.trim() || `章节 ${i + 1}`;
      b.addEventListener("click", () => h.scrollIntoView({ behavior: "smooth", block: "start" }));
      nav.appendChild(b);
    });
    details.append(summary, nav); host.prepend(details);
  }

  async function enhanceCodeBlocks(host: Element, epoch: number) {
    const blocks = Array.from(host.querySelectorAll<HTMLElement>("pre code"));
    if (!blocks.length) return;
    try { await ensureHighlight(); } catch (e) { console.warn("[bili-subbatch] highlight load", e); return; }
    for (let i = 0; i < blocks.length; i++) {
      if (epoch !== state.renderEpoch) return;
      const block = blocks[i];
      if (!block) continue;
      const pre = block.parentElement;
      const m = (block.className || "").match(/language-([\w#+-]+)/i);
      if (m && pre && !pre.querySelector<HTMLElement>(".bsb-code-lang")) {
        const tag = document.createElement("span"); tag.className = "bsb-code-lang"; tag.textContent = m[1] || ""; pre.insertBefore(tag, block);
      }
      try { if (typeof hljs !== "undefined") hljs.highlightElement(block); } catch  { /* unknown language */ }
      if (i % 5 === 4) await yieldToMain();
    }
  }

  /**
   * Mermaid 是结构图，不承担证据引用展示。模型偶尔会忽略提示词，
   * 因此在渲染、修复和持久化前统一移除图内 BV/P 时间戳。
   * 普通 Markdown 正文中的时间戳完全不受影响。
   */
  function stripMermaidTimestampCitations(code: string) {
    return String(code || "")
      // [BV1xxx P1 03:21] / [BV号 P号 mm:ss] / [P2 01:02:03]
      .replace(
        /[ \t]*\[\s*(?:BV(?:号|[A-Za-z0-9]+)?\s+)?P(?:号|\d+)\s+(?:mm:ss|\d{1,2}:\d{2}(?::\d{2})?)\s*\]/gi,
        "",
      )
      // 少数模型省略 P，只输出 [BV1xxx 03:21]
      .replace(
        /[ \t]*\[\s*BV(?:号|[A-Za-z0-9]+)?\s+(?:mm:ss|\d{1,2}:\d{2}(?::\d{2})?)\s*\]/gi,
        "",
      )
      .replace(/[ \t]+(?=\r?\n|$)/g, "")
      .trim();
  }

  function sanitizeMermaidTimestampCitationsInMarkdown(markdown: string) {
    return String(markdown || "").replace(
      /```mermaid\s*\r?\n([\s\S]*?)```/gi,
      (_, code) => `\`\`\`mermaid\n${stripMermaidTimestampCitations(code)}\n\`\`\``,
    );
  }

  function extractMermaidCode(text: string) {
    let source = String(text || "").trim();
    const fenced = source.match(/```(?:mermaid)?[ \t]*\r?\n([\s\S]*?)```/i);
    if (fenced) source = fenced[1] || "";
    source = source
      .replace(/^\s*```(?:mermaid)?\s*/i, "")
      .replace(/```\s*$/i, "")
      .replace(/^\s*mermaid\s*\r?\n/i, "")
      .trim();
    return stripMermaidTimestampCitations(source);
  }

  function replaceMermaidBlockAt(markdown: string, targetIdx: number, nextCode: string) {
    const fn = coreFn("replaceMermaidBlockAt");
    if (fn) return fn(markdown, targetIdx, nextCode);
    let current = -1;
    let replaced = false;
    const value = String(markdown || "").replace(
      /```mermaid\s*\r?\n([\s\S]*?)```/gi,
      (full) => {
        current += 1;
        if (current !== Number(targetIdx)) return full;
        replaced = true;
        return `\`\`\`mermaid\n${stripMermaidTimestampCitations(nextCode)}\n\`\`\``;
      },
    );
    return { value, replaced };
  }

  async function persistAiSessionCache(routeKey = state.aiSessionRouteKey || currentRouteVideoKey()) {
    const keyFn = coreFn("aiSessionCacheKey");
    const buildFn = coreFn("buildAiSessionCachePayload");
    const usableFn = coreFn("isUsableAiSessionCache");
    const ttlFn = coreFn("aiSessionCacheTtlMs");
    if (!keyFn || !buildFn || !usableFn) return false;
    const key = keyFn(routeKey);
    if (!key) return false;
    const payload = buildFn({
      routeKey,
      sessionInput: appCall("ai.cloneSessionInput", state.aiSessionInput, state.aiSessionInput?.sessionId),
      preprocessRun: state.preprocessRun ? { ...state.preprocessRun, settings: { ...state.preprocessRun.settings } } : null,
      runs: state.aiRunOrder.flatMap((id) => { const run = state.aiRuns.get(id); return run ? [{ ...run, config: { ...run.config } }] : []; }),
      activeRunId: state.aiActiveRunId,
      activeTaskId: state.aiActiveTaskId,
    });
    if (!usableFn(payload)) return false;
    await persistentCache.write(key, payload, ttlFn ? ttlFn() : 30 * 24 * 60 * 60_000);
    return true;
  }

  async function hydrateAiSessionFromCache(payload: AiSessionCachePayload, routeKey: string) {
    if (currentRouteVideoKey() && currentRouteVideoKey() !== routeKey) return false;
    const sessionId = ++state.aiSessionSeq;
    state.aiAbort = false;
    state.aiRuns = new Map();
    state.aiRunOrder = [];
    const savedRuns = Array.isArray(payload?.runs) ? payload.runs : [];
    for (const saved of savedRuns) {
      const draft = coreCall("draftHydratedAiRun", saved);
      if (!draft) continue;
      const run = createAiRun(
        latestAiConfigForRun({ profileId: draft.profileId, config: draft.config }),
        sessionId,
        draft.taskSnapshot ? normalizePostTask(draft.taskSnapshot) : null,
        draft.promptProfile ? coreCall("createPromptProfile", draft.promptProfile, 0) : null,
      );
      applyRestoredRunOutput(run, draft);
      state.aiRuns.set(run.id, run);
      state.aiRunOrder.push(run.id);
    }
    if (!state.aiRunOrder.length) return false;
    const savedActive = savedRuns.find((item) => item && item.id === payload.activeRunId) || null;
    state.aiActiveTaskId = payload.activeTaskId || savedActive?.taskId || "";
    state.aiActiveRunId = coreCall(
      "resolveRestoredActiveRunId",
      state.aiRunOrder.map((id) => state.aiRuns.get(id)),
      savedActive,
      state.aiActiveTaskId,
    );
    state.aiSessionInput = appCall("ai.cloneSessionInput", normalizeCachedSessionInput(payload.sessionInput), sessionId);
    if (state.aiSessionInput) state.aiSessionInput.routeKey = routeKey;
    const preprocess = coreCall("draftHydratedPreprocessRun", payload.preprocessRun);
    state.preprocessRun = preprocess
      ? restorePreprocessRun(preprocess, createAiRuntime("缓存预处理"))
      : null;
    state.aiSessionRouteKey = routeKey;
    state.autoAnalyzeKey = routeKey;
    state.aiViewingPreprocess = false;
    syncActiveRunBridge(getActiveAiRun());
    renderAiResultTabs();
    renderAiInputDrawer();
    refreshAiChips();
    setAiBusy(false);
    if (currentAiWorkbenchStage() === "postprocess" && state.aiActiveRunId) {
      await selectAiRun(state.aiActiveRunId);
    } else if (currentAiWorkbenchStage() === "preprocess") {
      await renderPreprocessCanvas();
    }
    return true;
  }

  async function restoreAiSessionForRoute(routeKey: string) {
    const key = String(routeKey || "").trim();
    if (!key || state.aiBusy) return false;
    if (
      state.aiSessionRouteKey === key &&
      state.aiRunOrder.some((id) => String(state.aiRuns.get(id)?.raw || "").trim())
    ) {
      state.autoAnalyzeKey = key;
      return true;
    }
    if (state.aiSessionRestoreKey === key && state.aiSessionRestorePromise) {
      return state.aiSessionRestorePromise;
    }
    state.aiSessionRestoreKey = key;
    state.aiSessionRestorePromise = (async () => {
      try {
        const cacheKey = coreCall("aiSessionCacheKey", key);
        if (!cacheKey) return false;
        const cached = await persistentCache.read<AiSessionCachePayload>(cacheKey);
        if (currentRouteVideoKey() && currentRouteVideoKey() !== key) return false;
        if (!cached || !coreCall("isUsableAiSessionCache", cached.value)) return false;
        return await hydrateAiSessionFromCache(cached.value, key);
      } catch (error) {
        console.warn("[bili-subbatch] restore ai session", error);
        return false;
      } finally {
        if (state.aiSessionRestoreKey === key) {
          state.aiSessionRestorePromise = null;
          state.aiSessionRestoreKey = "";
        }
      }
    })();
    return state.aiSessionRestorePromise;
  }

  function persistRepairedMermaid(targetRun: WorkbenchAiRun|null, idx: number, nextCode: string) {
    // targetRun 必须由点击“重绘”时捕获，不能在异步修复结束后重新读取当前标签。
    const run = targetRun || getActiveAiRun();
    const source = run?.raw ?? state.aiRaw;
    const result = replaceMermaidBlockAt(source, idx, nextCode);
    if (!result.replaced) return false;

    if (run) {
      run.raw = result.value;
      // 只有目标模型仍是当前标签时才更新全局渲染桥；否则保留当前标签内容。
      if (run.id === state.aiActiveRunId) {
        syncActiveRunBridge(run);
        state.aiRenderedText = run.raw;
        state.aiPendingText = run.raw;
      }
    } else {
      state.aiRaw = result.value;
      state.aiRenderedText = state.aiRaw;
      state.aiPendingText = state.aiRaw;
    }
    persistAiSessionCache().catch(() => {});
    return true;
  }

  function currentMermaidRepairResolution(targetRun: WorkbenchAiRun|null, preferredProfileId = "") {
    const run = targetRun || getActiveAiRun();
    const profiles = state.aiProfiles?.length ? state.aiProfiles : loadAiProfiles();
    const fn = coreFn("resolveMermaidRepairConfig");
    if (typeof fn === "function") {
      return fn({
        runConfig: run?.config || null,
        profileId: run?.profileId || run?.config?.id || "",
        profiles,
        preferredProfileId: preferredProfileId || "",
      });
    }
    const ready = profiles.filter((p) => p?.apiKey && p?.baseUrl && p?.model);
    return {
      config: ready[0] || null,
      source: ready[0] ? "fallback" : "none",
      missing: ready[0] ? [] : ["apiKey", "baseUrl", "model"],
      readyProfiles: ready,
    };
  }

  function mermaidSetupError(resolution: { missing: string[]; }) {
    const hintFn = coreFn("mermaidRepairSetupHint");
    const message = typeof hintFn === "function"
      ? hintFn(resolution.missing.filter((key): key is "apiKey" | "baseUrl" | "model" => key === "apiKey" || key === "baseUrl" || key === "model"))
      : "还没有可用的 LLM。打开 设置 → LLM 填写 API Key。";
    const err = Object.assign(new Error(message), { mermaidSetup: true, missing: resolution?.missing || [] });
    return err;
  }

  function openSettingsLlm(profileId: string) {
    const root = ensurePanel();
    if (profileId) state.aiEditorId = profileId;
    toggleAiPanel(true);
    setWorkspace("settings");
    setSettingsTab("llm");
    fillAiConfigForm(root);
    requestAnimationFrame(() => {
      const field = root.querySelector<HTMLElement>('[data-ai-field="apiKey"]');
      const label = field?.closest("label");
      root.querySelectorAll<HTMLElement>(".bsb-llm-field-focus").forEach((el) => el.classList.remove("bsb-llm-field-focus"));
      if (label) label.classList.add("bsb-llm-field-focus");
      field?.focus();
      field?.scrollIntoView({ block: "center", behavior: "smooth" });
    });
    setStatus("API Key 在「设置 → LLM」这一栏。填好后点保存，再回到笔记重绘。", "ok");
  }

  function saveInlineMermaidProfile(card: HTMLElement) {
    const get = (name: string) => card.querySelector<HTMLInputElement>(`[data-mermaid-field="${name}"]`);
    const baseUrl = String(get("baseUrl")?.value || "").trim().replace(/\/+$/, "");
    const apiKey = String(get("apiKey")?.value || "").trim();
    const model = String(get("model")?.value || "").trim();
    if (!baseUrl || !apiKey || !model) {
      setStatus("Base URL、API Key、Model 都要填", "err");
      return "";
    }
    const profiles = [...(state.aiProfiles?.length ? state.aiProfiles : loadAiProfiles())];
    const same = profiles.find((p) => String(p.baseUrl || "") === baseUrl && String(p.model || "") === model);
    if (same) {
      same.apiKey = apiKey;
      same.baseUrl = baseUrl;
      same.model = model;
      same.enabled = true;
      saveAiProfiles(profiles);
      return same.id;
    }
    const created = coreCall("createAiProfile", {
      name: "Mermaid 修复",
      baseUrl,
      apiKey,
      model,
      enabled: true,
    }, profiles.length);
    profiles.push(created);
    saveAiProfiles(profiles);
    return created.id;
  }

  function requestMermaidCodeRepair(code: string, error: unknown, idx: number, targetRun: WorkbenchAiRun|null, preferredProfileId?: string) {
    // 缓存会抹掉 apiKey；从设置里的 LLM 回填，不要让用户去翻设置。
    const resolved = currentMermaidRepairResolution(targetRun, preferredProfileId);
    const cfg = resolved.config;
    if (!cfg || resolved.source === "none" || !cfg.apiKey || !cfg.baseUrl || !cfg.model) {
      throw mermaidSetupError(resolved);
    }
    const runtime = createAiRuntime(`Mermaid 修复 · ${cfg.name || cfg.model || "AI"}`);

    const parseError = String(errorMessage(error) || "未知渲染错误").slice(0, 4000);
    const originalCode = String(code || "").slice(0, 30000);
    const messages = [
      {
        role: "system",
        content: [
          "你是 Mermaid 10.9.1 的确定性语法修复器，只处理用户给出的单个 flowchart。",
          "修复目标仅限语法和兼容性：引号、括号、节点 ID、标签、换行、箭头和不受支持的指令。",
          "必须保留原图的节点含义、关系方向、顺序和信息量；移除 Mermaid 节点、边和子图标题中的所有 BV/P/时间戳引用；不得补充字幕外事实，也不要把图改写成新的总结。",
          "输出只允许一个完整的 ```mermaid``` 代码块。使用 flowchart TD 或 flowchart LR；节点 ID 仅用 ASCII 字母数字；标签使用双引号。",
          "禁止 click、classDef、style、init、实验语法和除 <br/> 外的复杂 HTML。不要输出解释、前言或修改说明。",
        ].join("\n"),
      },
      {
        role: "user",
        content:
          `请修复第 ${Number(idx) + 1} 张 Mermaid 图。\n\n` +
          `【渲染错误】\n${parseError}\n\n` +
          `【原始 Mermaid】\n\`\`\`mermaid\n${originalCode}\n\`\`\``,
      },
    ];

    return new Promise<string>((resolve, reject) => {
      let latest = "";
      requestChatCompletion({
        runtime,
        baseUrl: cfg.baseUrl || "",
        apiKey: cfg.apiKey || "",
        model: cfg.model || "",
        temperature: 0.1,
        maxTokens: 32768,
        messages,
        stream: cfg.stream !== false,
        onStatus(msg) {
          setStatus(`Mermaid AI 修复 · ${msg}`);
        },
        onDelta(_delta, full, parts) {
          latest = String(parts?.content || full || latest);
        },
        onDone(full, parts) {
          const repaired = extractMermaidCode(parts?.content || full || latest);
          if (!repaired) {
            reject(new Error("AI 没有返回可用的 Mermaid 代码"));
            return;
          }
          resolve(repaired);
        },
        onError(err) {
          reject(err instanceof Error ? err : new Error(String(err || "AI 修复失败")));
        },
      });
    });
  }

  async function handleMermaidTool(button: HTMLButtonElement) {
    const action = button?.dataset?.mmdAct;
    const card = button?.closest<MermaidElement>(".bsb-mermaid-card, .bsb-mermaid-error");

    if (action === "open-llm") {
      const host = button.closest<MermaidElement>(".mermaid[data-bsb-m]");
      const resolved = currentMermaidRepairResolution(getActiveAiRun(), host?._bsbMermaidJob?.preferredProfileId);
      openSettingsLlm(resolved.config?.id || resolved.readyProfiles?.[0]?.id || state.aiEditorId);
      return;
    }

    if (action === "retry" || action === "retry-with" || action === "save-inline") {
      const host = button.closest<MermaidElement>(".mermaid[data-bsb-m]") || card?._bsbMermaidHost;
      const job = host?._bsbMermaidJob || card?._bsbMermaidJob;
      if (!host || !job) {
        setStatus("重绘失败：没有找到该图对应的 Mermaid 源码", "err");
        return;
      }
      const box = host.querySelector<MermaidElement>(".bsb-mermaid-error") || card;
      if (action === "save-inline") {
        const savedId = saveInlineMermaidProfile(box || host);
        if (!savedId) return;
        job.preferredProfileId = savedId;
      } else {
        const picked = box?.querySelector<HTMLSelectElement>('[data-role="mermaid-repair-model"]')?.value || "";
        if (picked) job.preferredProfileId = picked;
      }
      // 重绘只受当前模型约束：其他模型仍在生成时，不阻塞这个已完成模型。
      // 同时锁定目标 run，防止修复过程中切换标签后写错模型。
      const targetRun = getActiveAiRun();
      const targetName = targetRun?.config?.name || targetRun?.config?.model || "当前模型";
      if (targetRun ? targetRun.busy : state.aiBusy) {
        setStatus(`${targetName} 的 AI 笔记仍在生成，请完成或停止后再修复 Mermaid`, "err");
        return;
      }
      if (targetRun ? targetRun.mermaidRepairing : state.mermaidRepairing) {
        setStatus(`${targetName} 已有 Mermaid 图正在重绘`, "err");
        return;
      }

      if (card?.closest(".bsb-mermaid-modal")) closeMermaidFullscreen();
      if (targetRun) targetRun.mermaidRepairing = true;
      else state.mermaidRepairing = true;
      button.disabled = true;
      button.textContent = "重试中…";

      const originalCode = String(job.code || "");
      let activeCode = originalCode;
      try {
        // 第一步：原代码本地重试一次，解决偶发的库加载/并发问题，不消耗 AI。
        setStatus(`Mermaid 图 ${job.idx + 1} · 正在用原代码重试…`);
        const local = await renderMermaidNode(host, originalCode, job.idx, job.epoch, {
          force: true,
          maxAttempts: 1,
          showError: false,
          repaired: !!job.repaired,
          originalCode: job.originalCode || originalCode,
        });
        if (local.ok) {
          setStatus(`Mermaid 图 ${job.idx + 1} 已重新渲染；代码未改变`, "ok");
          return;
        }

        // 第二步：原代码稳定失败，说明大概率是语法/兼容性问题；只让 AI 修复此代码块。
        button.textContent = "AI 修复中…";
        setStatus(`Mermaid 图 ${job.idx + 1} 本地重试失败，正在修复代码…`);
        activeCode = await requestMermaidCodeRepair(originalCode, local.error, job.idx, targetRun, job.preferredProfileId);
        if (activeCode.trim() === originalCode.trim()) {
          throw new Error("AI 返回的 Mermaid 代码与原代码相同，未完成修复");
        }

        // 第三步：只有修复后的代码真实通过 Mermaid 渲染，才写回完整笔记源码。
        button.textContent = "验证中…";
        const repairedResult = await renderMermaidNode(host, activeCode, job.idx, job.epoch, {
          force: true,
          maxAttempts: 2,
          showError: false,
          repaired: true,
          originalCode,
        });
        if (!repairedResult.ok) throw repairedResult.error || new Error("修复后的代码仍无法渲染");

        const persisted = persistRepairedMermaid(targetRun, job.idx, activeCode);
        if (persisted) {
          try { await persistAiSessionCache(); } catch  { /* ignore */ }
        }
        const currentJob = host._bsbMermaidJob;
        if (currentJob) {
          currentJob.code = activeCode;
          currentJob.repaired = true;
          currentJob.originalCode = originalCode;
          currentJob.persisted = persisted;
        }
        setStatus(
          `Mermaid 图 ${job.idx + 1} 修复成功：代码已替换并重新渲染${persisted ? "，已写回笔记源码与缓存" : ""}`,
          "ok",
        );
      } catch (err) {
        console.error("[bili-subbatch] mermaid repair", err);
        host.dataset.bsbState = "error";
        host._bsbMermaidJob = {
          code: originalCode,
          idx: job.idx,
          epoch: job.epoch,
          originalCode: job.originalCode || originalCode,
          repaired: false,
          preferredProfileId: job.preferredProfileId || "",
        };
        renderMermaidError(host, originalCode, err, job.idx);
        setStatus(
          isMermaidSetupError(err)
            ? errorMessage(err) || "请在这张图里填写 API Key"
            : `Mermaid 图 ${job.idx + 1} 重绘失败：${errorMessage(err)}`,
          isMermaidSetupError(err) ? "" : "err",
        );
      } finally {
        if (targetRun) targetRun.mermaidRepairing = false;
        else state.mermaidRepairing = false;
        if (button.isConnected) {
          button.disabled = false;
          button.textContent = "重绘";
        }
      }
      return;
    }

    if (!card) return;
    const viewport = card.querySelector<MermaidElement>(".bsb-mermaid-viewport");
    if (action === "fit") fitMermaidToViewport(card);
    else if (action === "actual") setMermaidScale(card, 1, "actual");
    else if (action === "zoom-in") setMermaidScale(card, getMermaidScale(card) + 0.15);
    else if (action === "zoom-out") setMermaidScale(card, getMermaidScale(card) - 0.15);
    else if (action === "fullscreen") {
      if (card.closest(".bsb-mermaid-modal")) closeMermaidFullscreen();
      else openMermaidFullscreen(card);
    }
    if (viewport && action === "actual") { viewport.scrollLeft = 0; viewport.scrollTop = 0; }
  }

  function enqueueMermaidRender<T>(task: () => Promise<T>) {
    const run = state.mermaidQueue.catch(() => undefined).then(task);
    state.mermaidQueue = run.then(() => undefined, () => undefined);
    return run;
  }

  function renderMermaidError(node: MermaidElement, code: string, err: unknown, idx: number) {
    const message = err ? errorMessage(err) : "未知错误";
    const resolved = currentMermaidRepairResolution(getActiveAiRun(), node?._bsbMermaidJob?.preferredProfileId);
    const needsSetup = !!(isMermaidSetupError(err) || resolved.source === "none");
    node.replaceChildren();

    const box = document.createElement("section");
    box.className = needsSetup ? "bsb-mermaid-error is-setup" : "bsb-mermaid-error";
    const head = document.createElement("div");
    head.className = "bsb-mermaid-error-head";
    const title = document.createElement("strong");
    title.textContent = needsSetup
      ? `架构图 ${idx + 1} 还差一步：用 LLM 自动修好`
      : `架构流程图 ${idx + 1} 渲染失败`;
    const retry = document.createElement("button");
    retry.type = "button";
    retry.className = "bsb-mermaid-tool";
    retry.dataset.mmdAct = "retry";
    retry.textContent = needsSetup ? "配好后再试" : "重绘";
    retry.title = needsSetup
      ? "先在这张卡片里选模型或填写 API Key"
      : "先用原代码重试；仍失败则用设置里的 LLM 修复此图";
    head.append(title, retry);

    const setup = document.createElement("div");
    setup.className = "bsb-mermaid-setup";
    const copy = document.createElement("p");
    copy.className = "bsb-mermaid-setup-copy";
    const readyName = String(resolved.config?.name || resolved.config?.model || resolved.readyProfiles[0]?.name || "");
    copy.textContent = needsSetup
      ? (resolved.readyProfiles.length
        ? `笔记缓存不会保存 API Key。选一个已配置的模型（当前：${readyName || "未命名"}），点「用这个模型重绘」。`
        : "API Key 在「设置 → LLM」，不在这张图的源码里。也可以直接在下面填，不用去翻菜单。")
      : (readyName
        ? `点「重绘」会先本地重试，不行就用「${readyName}」自动修语法。`
        : "点「重绘」会先本地重试，不行再用 LLM 修语法。");
    setup.appendChild(copy);

    if (needsSetup || !resolved.readyProfiles.length) {
      const path = document.createElement("div");
      path.className = "bsb-mermaid-setup-path";
      path.innerHTML = toTrustedHTML("<span>入口</span><b>设置</b><span>→</span><b>LLM</b><span>→</span><b>API Key</b>");
      setup.appendChild(path);
    }

    if (needsSetup && resolved.readyProfiles.length) {
      const row = document.createElement("div");
      row.className = "bsb-mermaid-setup-row";
      const label = document.createElement("label");
      label.textContent = "用这个模型修";
      const select = document.createElement("select");
      select.dataset.role = "mermaid-repair-model";
      select.innerHTML = toTrustedHTML(resolved.readyProfiles.map((p) => {
        const id = String(p.id || "");
        const name = String(p.name || p.model || "未命名");
        const selected = id && id === (resolved.config?.id || "");
        return `<option value="${escapeAttr(id)}"${selected ? " selected" : ""}>${escapeHtml(name)}</option>`;
      }).join(""));
      label.appendChild(select);
      const useBtn = document.createElement("button");
      useBtn.type = "button";
      useBtn.className = "bsb-btn accent";
      useBtn.dataset.mmdAct = "retry-with";
      useBtn.textContent = "用这个模型重绘";
      row.append(label, useBtn);
      setup.appendChild(row);
    }

    if (!resolved.readyProfiles.length) {
      const grid = document.createElement("div");
      grid.className = "bsb-mermaid-setup-grid";
      grid.innerHTML = toTrustedHTML(`
        <label>Base URL（含 /v1）<input type="text" data-mermaid-field="baseUrl" value="${escapeAttr(resolved.config?.baseUrl || "")}" placeholder="https://api.example.com/v1" autocomplete="off"></label>
        <label>API Key<input type="password" data-mermaid-field="apiKey" value="" placeholder="就填在这里，不用去翻设置" autocomplete="off"></label>
        <label>Model<input type="text" data-mermaid-field="model" value="${escapeAttr(resolved.config?.model || "")}" placeholder="gpt-4o-mini" autocomplete="off"></label>
      `);
      setup.appendChild(grid);
    }

    const actions = document.createElement("div");
    actions.className = "bsb-mermaid-setup-actions";
    if (!resolved.readyProfiles.length) {
      const saveBtn = document.createElement("button");
      saveBtn.type = "button";
      saveBtn.className = "bsb-btn primary";
      saveBtn.dataset.mmdAct = "save-inline";
      saveBtn.textContent = "保存到 LLM 并重绘";
      actions.appendChild(saveBtn);
    }
    const openBtn = document.createElement("button");
    openBtn.type = "button";
    openBtn.className = "bsb-btn ghost";
    openBtn.dataset.mmdAct = "open-llm";
    openBtn.textContent = "打开 设置 → LLM";
    actions.appendChild(openBtn);
    setup.appendChild(actions);

    const details = document.createElement("details");
    const summary = document.createElement("summary");
    summary.textContent = "查看 Mermaid 源码与错误";
    const pre = document.createElement("pre");
    const codeNode = document.createElement("code");
    codeNode.textContent = `${code}\n\n${message}`;
    pre.appendChild(codeNode);
    details.append(summary, pre);
    box.append(head, setup, details);
    node.appendChild(box);
  }

  async function renderMermaidNode(
    node: MermaidElement,
    code: string,
    idx: number,
    epoch: number,
    { force = false, maxAttempts, showError = true, repaired = false, originalCode = "" }: { force?: boolean; maxAttempts?: number; showError?: boolean; repaired?: boolean; originalCode?: string } = {},
  ) {
    if (!node || epoch !== state.renderEpoch) return { ok: false, aborted: true };
    if (!force && node.dataset.bsbState === "done") return { ok: true, skipped: true };
    if (node.dataset.bsbState === "rendering") return { ok: false, busy: true };

    const previousState = node.dataset.bsbState || "pending";
    const previousJob = node._bsbMermaidJob || null;
    const job = {
      code: stripMermaidTimestampCitations(code),
      idx,
      epoch,
      repaired: !!repaired,
      originalCode: stripMermaidTimestampCitations(originalCode || previousJob?.originalCode || code),
    };
    node._bsbMermaidJob = job;
    node.dataset.bsbState = "rendering";
    const attempts = Math.max(1, Number(maxAttempts) || (force ? 2 : 3));
    let lastError = null;

    for (let attempt = 0; attempt < attempts; attempt++) {
      try {
        const rendered = await enqueueMermaidRender(async () => {
          await ensureMermaid();
          if (attempt > 0 && typeof mermaid !== "undefined") {
            // 只重新应用配置；不能把语法错误误认为 CDN/运行时故障。
            state.renderLibs.mermaid = false;
            await ensureMermaid();
          }
          if (epoch !== state.renderEpoch) return null;
          const id = `bsb-mmd-${Date.now()}-${idx}-${++state.mermaidRenderSeq}`;
          return mermaid.render(id, job.code);
        });
        if (!rendered || epoch !== state.renderEpoch) return { ok: false, aborted: true };
        const { svg } = rendered;
        const safeSvg = typeof DOMPurify !== "undefined"
          ? DOMPurify.sanitize(svg, {
              USE_PROFILES: { svg: true, svgFilters: true },
              ADD_ATTR: ["class", "style", "viewBox", "preserveAspectRatio", "role", "aria-label"],
            })
          : svg;
        const tpl = document.createElement("template");
        tpl.innerHTML = toTrustedHTML(safeSvg);
        const svgNode = tpl.content.querySelector("svg");
        if (!svgNode) throw new Error("Mermaid 未返回有效 SVG");

        node.replaceChildren(buildMermaidCard(svgNode, idx, node));
        node.dataset.bsbState = "done";
        return { ok: true, code: job.code, repaired: job.repaired };
      } catch (err) {
        lastError = err;
        if (epoch !== state.renderEpoch) return { ok: false, aborted: true, error: err };
        if (attempt + 1 < attempts) await sleep(180 * (attempt + 1));
      }
    }

    if (showError) {
      node.dataset.bsbState = "error";
      renderMermaidError(node, job.code, lastError, idx);
    } else {
      node.dataset.bsbState = previousState;
      node._bsbMermaidJob = previousJob || job;
    }
    return { ok: false, error: lastError, code: job.code };
  }

  function scheduleMermaid(host: HTMLElement, blocks: string[], epoch: number, scrollRoot: HTMLElement|null) {
    const nodes = Array.from(host.querySelectorAll<MermaidElement>(".mermaid[data-bsb-m]"));
    if (!nodes.length) return;
    if (state.mermaidObserver) state.mermaidObserver.disconnect();
    if ("IntersectionObserver" in window) {
      state.mermaidObserver = new IntersectionObserver((entries, observer) => {
        for (const entry of entries) if (entry.isIntersecting) {
          observer.unobserve(entry.target);
          if (!(entry.target instanceof HTMLElement)) continue;
          const node = entry.target as MermaidElement;
          const idx = Number(node.dataset.bsbM);
          renderMermaidNode(node, blocks[idx] || "", idx, epoch);
        }
      }, { root: scrollRoot || null, rootMargin: "320px 0px", threshold: 0.01 });
      nodes.forEach((node) => { node.dataset.bsbState = "pending"; state.mermaidObserver?.observe(node); });
    } else {
      nodes.forEach((node, idx) => renderMermaidNode(node, blocks[idx] || "", idx, epoch));
    }
  }

  const FOLIO_CLASS_ALLOW = new Set([
    "bsb-folio", "kicker", "lede", "callout", "steps", "quote", "meta",
  ]);

  function extractHtmlFolioSource(text: string) {
    const raw = String(text || "");
    const fence = raw.match(/```html\s*\n([\s\S]*?)```/i);
    if (fence?.[1]) return String(fence[1]).trim();
    const article = raw.match(/<article\b[\s\S]*<\/article>/i);
    return article ? article[0].trim() : "";
  }

  function isHtmlFolioSource(text: string) {
    return !!extractHtmlFolioSource(text);
  }

  function extractFolioTitle(html: string) {
    const hit = String(html || "").match(/<h1\b[^>]*>([\s\S]*?)<\/h1>/i);
    if (!hit) return "";
    return stripHtml(hit[1]).replace(/\s+/g, " ").trim();
  }

  function sanitizeFolioHtml(html: string) {
    if (typeof DOMPurify === "undefined") return `<article class="bsb-folio"><p>${escapeHtml(stripHtml(html))}</p></article>`;
    return DOMPurify.sanitize(html, {
      USE_PROFILES: { html: true },
      SANITIZE_NAMED_PROPS: true,
      FORBID_TAGS: ["script", "style", "iframe", "object", "embed", "form", "link", "meta", "svg", "img", "video", "audio", "base"],
      FORBID_ATTR: ["style", "width", "height", "align"],
      ADD_TAGS: ["article", "header", "footer", "section", "aside", "figure", "figcaption", "mark", "nav"],
      ADD_ATTR: ["class", "id", "data-kind", "aria-label", "role"],
    });
  }

  function pruneFolioClasses(root: HTMLElement) {
    root.querySelectorAll<HTMLElement>("[class]").forEach((el) => {
      const next = Array.from(el.classList).filter((name) => FOLIO_CLASS_ALLOW.has(name));
      if (next.length) el.className = next.join(" ");
      else el.removeAttribute("class");
    });
  }

  function slugFolioHeading(text: string, index: number) {
    const fn = coreFn("slugFolioHeading");
    if (fn) return fn(text, index);
    const base = String(text || "")
      .toLowerCase()
      .replace(/[^\u4e00-\u9fff\w]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 40);
    return `folio-${base || "s"}-${index + 1}`;
  }

  function collectFolioHeadings(article: HTMLElement) {
    return Array.from(article.querySelectorAll<HTMLHeadingElement>("h2, h3")).map((el, index) => ({
      el,
      id: el.id || slugFolioHeading(el.textContent, index),
      level: el.tagName === "H3" ? 3 : 2,
      text: String(el.textContent || "").replace(/\s+/g, " ").trim() || "未命名",
    }));
  }

  function decorateFolioArticle(article: HTMLElement) {
    if (!article.classList.contains("bsb-folio")) article.classList.add("bsb-folio");
    const headings = collectFolioHeadings(article);
    headings.forEach((item) => {
      if (!item.el.id) item.el.id = item.id;
      item.id = item.el.id;
    });
    article.querySelectorAll("aside").forEach((aside) => {
      const kind = String(aside.getAttribute("data-kind") || "").toLowerCase();
      if (kind && !["key", "note", "warn"].includes(kind)) aside.removeAttribute("data-kind");
      aside.classList.add("callout");
    });
    return headings;
  }

  function folioOutlineFromHeadings(headings: ReturnType<typeof collectFolioHeadings>): FolioOutlineNode[] {
    return coreCall("buildFolioOutline", headings.map((item) => ({
      id: item.id, level: item.level === 3 ? 3 as const : 2 as const, text: item.text,
    })));
  }

  function makeFolioTocLink(node: FolioOutlineNode, kind: "h2" | "h3", index?: number) {
    const link = document.createElement("button");
    link.type = "button";
    link.className = `bsb-folio-toc-link is-h${node.level}`;
    link.dataset.folioJump = node.id;
    if (kind === "h2") {
      const num = document.createElement("span");
      num.className = "bsb-folio-toc-index";
      num.textContent = coreFn("formatFolioChapterIndex")
        ? coreCall("formatFolioChapterIndex", index || 0)
        : String(index).padStart(2, "0");
      link.appendChild(num);
    } else {
      const dot = document.createElement("span");
      dot.className = "bsb-folio-toc-dot";
      link.appendChild(dot);
    }
    const label = document.createElement("span");
    label.className = "bsb-folio-toc-label";
    label.textContent = node.text;
    link.appendChild(label);
    return link;
  }

  function buildFolioToc(headings: ReturnType<typeof collectFolioHeadings>) {
    const outline = folioOutlineFromHeadings(headings);
    const stats = coreCall("countFolioOutline", outline);
    const summary = coreCall("folioOutlineSummary", stats);
    const aside = document.createElement("aside");
    aside.className = "bsb-folio-toc";
    aside.setAttribute("aria-label", "阅读大纲");
    const head = document.createElement("header");
    head.className = "bsb-folio-toc-head";
    head.innerHTML = toTrustedHTML(`<span class="bsb-folio-toc-kicker">目录</span><strong class="bsb-folio-toc-title">阅读大纲</strong><em class="bsb-folio-toc-meta">${escapeHtml(summary)}</em><span class="bsb-folio-toc-progress" aria-hidden="true"><i data-role="folio-progress"></i></span>`);
    const nav = document.createElement("nav");
    nav.className = "bsb-folio-toc-nav";
    outline.forEach((chapter, index: number) => {
      const item = document.createElement("div");
      item.className = `bsb-folio-toc-item${chapter.children.length ? " has-kids is-open" : ""}`;
      item.dataset.folioId = chapter.id;
      const row = document.createElement("div");
      row.className = "bsb-folio-toc-row";
      const twist = document.createElement("button");
      twist.type = "button";
      twist.className = "bsb-folio-toc-twist";
      twist.dataset.folioTwist = "1";
      twist.setAttribute("aria-label", "展开或收起小节");
      twist.setAttribute("aria-expanded", chapter.children.length ? "true" : "false");
      row.append(twist, makeFolioTocLink(chapter, "h2", index + 1));
      item.appendChild(row);
      if (chapter.children.length) {
        const kids = document.createElement("div");
        kids.className = "bsb-folio-toc-kids";
        chapter.children.forEach((child) => kids.appendChild(makeFolioTocLink(child, "h3")));
        item.appendChild(kids);
      }
      nav.appendChild(item);
    });
    aside.append(head, nav);
    return aside;
  }

  function setFolioTocCurrent(shell: HTMLDivElement, id: string) {
    const links = shell.querySelectorAll<HTMLElement>(".bsb-folio-toc-link");
    links.forEach((link) => {
      const on = link.dataset.folioJump === id;
      link.classList.toggle("is-current", on);
      if (on) {
        const item = link.closest(".bsb-folio-toc-item");
        if (item?.classList.contains("has-kids")) {
          item.classList.add("is-open");
          item.querySelector<HTMLElement>(".bsb-folio-toc-twist")?.setAttribute("aria-expanded", "true");
        }
        scrollFolioTocLinkIntoNav(link);
      }
    });
  }

  function scrollFolioTocLinkIntoNav(link: Element) {
    const nav = link?.closest?.(".bsb-folio-toc-nav");
    if (!nav || !link) return;
    const navRect = nav.getBoundingClientRect();
    const linkRect = link.getBoundingClientRect();
    if (linkRect.top < navRect.top) nav.scrollTop -= navRect.top - linkRect.top + 10;
    else if (linkRect.bottom > navRect.bottom) nav.scrollTop += linkRect.bottom - navRect.bottom + 10;
  }

  function syncFolioTocViewport(shell: HTMLDivElement, box: { clientHeight: number; } | null) {
    const toc = shell?.querySelector<HTMLElement>(".bsb-folio-toc");
    if (!toc || !box) return;
    toc.style.setProperty("--folio-toc-h", `${Math.max(180, Math.round(box.clientHeight))}px`);
  }

  function updateFolioProgress(shell: HTMLDivElement, box: { scrollHeight: number; clientHeight: number; scrollTop: number; }) {
    const bar = shell.querySelector<HTMLElement>("[data-role='folio-progress']");
    if (!bar || !box) return;
    const max = Math.max(1, box.scrollHeight - box.clientHeight);
    bar.style.width = `${Math.max(0, Math.min(100, (box.scrollTop / max) * 100))}%`;
  }

  function bindFolioToc(shell: HTMLDivElement, scrollRoot: Element|null) {
    const box = scrollRoot || shell.closest("[data-role='ai-md']");
    syncFolioTocViewport(shell, box);
    shell.addEventListener("click", (e) => {
      if (!(e.target instanceof Element)) return;
      if (e.target.closest?.("[data-folio-twist]")) {
        const item = e.target.closest(".bsb-folio-toc-item");
        if (!item?.classList.contains("has-kids")) return;
        const open = !item.classList.contains("is-open");
        item.classList.toggle("is-open", open);
        e.target.closest("[data-folio-twist]")?.setAttribute("aria-expanded", open ? "true" : "false");
        return;
      }
      if (e.target.closest?.("[data-folio-toc-fab]")) {
        shell.classList.toggle("is-toc-open");
        return;
      }
      if (e.target.closest?.("[data-folio-toc-scrim]")) {
        shell.classList.remove("is-toc-open");
        return;
      }
      const link = e.target.closest<HTMLElement>("[data-folio-jump]");
      if (!link) return;
      e.preventDefault();
      const target = shell.querySelector<HTMLElement>(`#${CSS.escape(link.dataset.folioJump || "")}`);
      if (!target) return;
      if (box) {
        const top = target.getBoundingClientRect().top - box.getBoundingClientRect().top + box.scrollTop - 16;
        box.scrollTo({ top, behavior: "smooth" });
      } else {
        target.scrollIntoView({ block: "start", behavior: "smooth" });
      }
      target.classList.remove("folio-flash");
      void target.offsetWidth;
      target.classList.add("folio-flash");
      setFolioTocCurrent(shell, link.dataset.folioJump || "");
      shell.classList.remove("is-toc-open");
    });
    if (box) {
      const onScroll = () => {
        updateFolioProgress(shell, box);
        const headings = Array.from(shell.querySelectorAll<HTMLElement>(".bsb-folio h2, .bsb-folio h3"));
        if (!headings.length) return;
        const top = box.getBoundingClientRect().top + 28;
        let current = headings[0];
        for (const heading of headings) {
          if (heading.getBoundingClientRect().top - top <= 0) current = heading;
        }
        if (current?.id) setFolioTocCurrent(shell, current.id);
      };
      box.addEventListener("scroll", onScroll, { passive: true });
      const onResize = () => {
        syncFolioTocViewport(shell, box);
        updateFolioProgress(shell, box);
      };
      window.addEventListener("resize", onResize);
      if (typeof ResizeObserver === "function") {
        const ro = new ResizeObserver(onResize);
        ro.observe(box);
      }
      onResize();
      onScroll();
    }
  }

  function mountHtmlFolio(host: Element, sourceHtml: string, scrollRoot: Element|null) {
    const raw = extractHtmlFolioSource(sourceHtml) || String(sourceHtml || "");
    const safe = sanitizeFolioHtml(raw);
    const tpl = document.createElement("template");
    tpl.innerHTML = toTrustedHTML(safe);
    let article = tpl.content.querySelector("article");
    if (!article) {
      article = document.createElement("article");
      article.className = "bsb-folio";
      article.append(...tpl.content.childNodes);
    }
    pruneFolioClasses(article);
    const headings = decorateFolioArticle(article);
    const shell = document.createElement("div");
    shell.className = "bsb-folio-shell";
    shell.dataset.role = "html-folio";
    if (headings.length) {
      const fab = document.createElement("button");
      fab.type = "button";
      fab.className = "bsb-folio-toc-fab";
      fab.dataset.folioTocFab = "1";
      fab.textContent = "目录";
      const scrim = document.createElement("div");
      scrim.className = "bsb-folio-toc-scrim";
      scrim.dataset.folioTocScrim = "1";
      shell.append(fab, scrim, buildFolioToc(headings));
    }
    const frame = document.createElement("div");
    frame.className = "bsb-folio-frame";
    frame.appendChild(article);
    shell.appendChild(frame);
    host.replaceChildren(shell);
    bindFolioToc(shell, scrollRoot);
    if (headings[0]) setFolioTocCurrent(shell, headings[0].id);
    requestAnimationFrame(() => syncFolioTocViewport(shell, scrollRoot || shell.closest("[data-role='ai-md']")));
    return shell;
  }

  function folioExportTokenCss(flavor: string|undefined) {
    const palette = getCtpPalette(flavor);
    return Object.entries(palette).map(([key, hex]) => `--ctp-${key}:${hex};`).join("");
  }

  function buildStandaloneFolioHtml(title: string, sourceHtml: string, flavor: string|undefined) {
    const raw = extractHtmlFolioSource(sourceHtml) || String(sourceHtml || "");
    const safe = sanitizeFolioHtml(raw);
    const tokens = folioExportTokenCss(flavor);
    const pageTitle = escapeHtml(title || "阅读页");
    return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${pageTitle}</title>
<style>
:root{${tokens}}
*{box-sizing:border-box}
html,body{margin:0;background:var(--ctp-base);color:var(--ctp-text)}
body{padding:48px 20px 80px}
.bsb-folio{max-width:40rem;margin:0 auto;font-family:"Iowan Old Style","Palatino Linotype",Palatino,"Songti SC","Source Han Serif SC","Noto Serif SC",Georgia,serif;font-size:18px;line-height:1.72}
.bsb-folio .kicker{margin:0 0 .7em;font-family:Inter,ui-sans-serif,system-ui,sans-serif;font-size:11px;font-weight:700;letter-spacing:.16em;text-transform:uppercase;color:var(--ctp-overlay0)}
.bsb-folio h1{margin:0 0 .55em;font-size:1.8em;font-weight:650;line-height:1.22;letter-spacing:-.02em}
.bsb-folio .lede{margin:0 0 1.8em;color:var(--ctp-subtext0)}
.bsb-folio section{margin:0 0 2em}
.bsb-folio h2{margin:0 0 .7em;font-size:1.2em}
.bsb-folio p{margin:0 0 .9em}
.bsb-folio aside{margin:1.1em 0;padding:.75em 1em;border-left:2px solid var(--ctp-lavender);background:color-mix(in srgb,var(--ctp-surface0) 42%,transparent);border-radius:0 10px 10px 0}
.bsb-folio aside[data-kind="key"]{border-left-color:var(--ctp-yellow)}
.bsb-folio aside[data-kind="warn"]{border-left-color:var(--ctp-peach)}
.bsb-folio aside[data-kind="note"]{border-left-color:var(--ctp-sapphire)}
.bsb-folio blockquote,.bsb-folio figure.quote{margin:1.15em 0;padding:0 0 0 1em;border-left:2px solid var(--ctp-overlay0);color:var(--ctp-subtext1);font-style:italic}
.bsb-folio mark{background:color-mix(in srgb,var(--ctp-yellow) 38%,transparent)}
.bsb-folio table{width:100%;border-collapse:collapse;font-size:.92em}
.bsb-folio th,.bsb-folio td{text-align:left;padding:.45em .55em;border-bottom:1px solid var(--ctp-surface1)}
.bsb-folio pre{padding:12px 14px;border-radius:10px;overflow:auto;background:var(--ctp-crust)}
.bsb-folio :not(pre)>code{background:var(--ctp-surface0);padding:.08em .35em;border-radius:5px}
</style>
</head>
<body>${safe}</body>
</html>
`;
  }

  async function renderAiMarkdown(md: unknown, { streaming = false } = {}) {
    const root = ensurePanel();
    const box = root.querySelector<HTMLElement>('[data-role="ai-md"]');
    const host = root.querySelector<HTMLElement>('[data-role="ai-content"]') || box;
    if (!host) return;
    if (streaming) return paintAiStreamText(md);
    closeMermaidFullscreen();

    // 防止最后一个流式定时绘制在增强渲染完成后反向覆盖 DOM。
    if (state.aiPaintTimer) { clearTimeout(state.aiPaintTimer); state.aiPaintTimer = 0; }
    if (state.aiPaintRaf) { cancelAnimationFrame(state.aiPaintRaf); state.aiPaintRaf = 0; }

    const epoch = ++state.renderEpoch;
    const originalSource = String(md || "");
    const source = sanitizeMermaidTimestampCitationsInMarkdown(originalSource);
    if (source !== originalSource) {
      const activeRun = getActiveAiRun();
      if (activeRun && String(activeRun.raw || "") === originalSource) {
        activeRun.raw = source;
        syncActiveRunBridge(activeRun);
      } else if (String(state.aiRaw || "") === originalSource) {
        state.aiRaw = source;
      }
    }
    if (isHtmlFolioSource(source)) {
      try { await ensureMarkdownCore(); } catch  { /* DOMPurify 可能已在页内 */ }
      if (epoch !== state.renderEpoch) return;
      mountHtmlFolio(host, source, box);
      if (box && !box.querySelector<HTMLElement>('[data-role="ai-anchor"]')) {
        const a = document.createElement("div"); a.className = "bsb-ai-anchor"; a.dataset.role = "ai-anchor"; box.appendChild(a);
      }
      if (box) {
        state.aiProgScroll = true; box.scrollTop = 0;
        requestAnimationFrame(() => { state.aiProgScroll = false; });
      }
      state.aiStickBottom = false; state.aiUserReading = true; updateJumpLatestBtn();
      return;
    }

    const needsMath = hasMathSyntax(source);
    const needsCode = hasCodeSyntax(source);
    const needsMermaid = hasMermaidSyntax(source);
    try {
      await ensureMarkdownCore();
      if (needsMath) await ensureKatex();
    } catch  {
      host.innerHTML = toTrustedHTML(simpleMarkdownFallback(source) + `<p style="color:var(--ctp-peach)">增强渲染库加载失败，已使用安全简易渲染。</p>`);
      if (box) box.scrollTop = 0;
      return;
    }
    if (epoch !== state.renderEpoch) return;

    const { md: mdMath, maths } = prepareMarkdownMath(source);
    const mermaidBlocks: string[] = [];
    const md2 = mdMath.replace(/```mermaid\s*\n([\s\S]*?)```/gi, (_, code) => {
      const i = mermaidBlocks.length; mermaidBlocks.push(code.trim());
      return `\n\n<div class="mermaid" data-bsb-m="${i}">${escapeHtml(code.trim())}</div>\n\n`;
    });
    let html;
    try { html = marked.parse(md2); } catch  { html = simpleMarkdownFallback(md2); }
    if (maths.length) html = replaceMathPlaceholders(html, maths, katexToHtml);
    html = sanitizeRenderedHtml(html);
    if (!(await replaceHostInBatches(host, html, epoch))) return;

    host.querySelectorAll<HTMLAnchorElement>("a[href]").forEach((a) => { a.target = "_blank"; a.rel = "noopener noreferrer"; });
    linkifyTimestamps(host);
    buildToc(host);
    if (needsMermaid) scheduleMermaid(host, mermaidBlocks, epoch, box);
    if (needsCode) await enhanceCodeBlocks(host, epoch);

    if (box && !box.querySelector<HTMLElement>('[data-role="ai-anchor"]')) {
      const a = document.createElement("div"); a.className = "bsb-ai-anchor"; a.dataset.role = "ai-anchor"; box.appendChild(a);
    }
    if (box) {
      state.aiProgScroll = true; box.scrollTop = 0;
      requestAnimationFrame(() => { state.aiProgScroll = false; });
    }
    state.aiStickBottom = false; state.aiUserReading = true; updateJumpLatestBtn();
  }

  /** The Application controller owns exactly one POST, stream decoding and cancellation.
   *  No legacy network fallback: a failed or ambiguous POST must never be replayed.
   */
  function requestChatCompletion(opts: Omit<ChatCompletionOptions, "network" | "pageHref">) {
    const runtime = opts.runtime || createAiRuntime(opts.model || "AI");
    return appCall("ai.request", {
      ...opts,
      runtime,
      network: runtimeNetwork(),
      pageHref: location.href,
    });
  }

  function abortPreprocessChildRuntime(runtime: WorkbenchAiRuntime) {
    if (!runtime) return;
    runtime.abort = true;
    try { runtime.abortController?.abort(); } catch  { /* noop */ }
    try { runtime.xhr?.abort?.(); } catch  { /* noop */ }
  }

  async function requestPreprocessChunk(runtime: WorkbenchAiRuntime, cfg: AiProfile, prompt: PromptProfile, vars: Record<string,unknown>, statusPrefix: string) {
    const messages = buildAiMessagesForProfile(cfg, vars, prompt);
    if (!messages.length) throw new Error("预处理 Prompt 为空");
    let latest = "";
    return await new Promise<string>((resolve, reject) => {
      requestChatCompletion({
        runtime,
        baseUrl: cfg.baseUrl || "",
        apiKey: cfg.apiKey || "",
        model: cfg.model || "",
        ...(cfg.temperature === undefined ? {} : { temperature: cfg.temperature }),
        ...(cfg.maxTokens === undefined ? {} : { maxTokens: cfg.maxTokens }),
        messages,
        stream: cfg.stream !== false,
        onStatus(msg) {
          if (runtime.abort || state.aiAbort) return;
          if (state.preprocessRun) state.preprocessRun.statusText = `${statusPrefix} · ${msg}`;
          renderAiResultTabs();
          setStatus(`预处理 · ${statusPrefix} · ${msg}`);
        },
        onDelta(_delta, full) {
          latest = String(full || "");
          if (state.aiViewingPreprocess && state.preprocessRun) {
            state.preprocessRun.preview = `### ${statusPrefix}\n\n${latest}`;
            paintAiStreamText(state.preprocessRun.preview || "正在规范化字幕…");
          }
        },
        onDone(full) { resolve(String(full || latest || "").trim()); },
        onError(err) { reject(err instanceof Error ? err : new Error(String(err || "预处理失败"))); },
      });
    });
  }

  async function preprocessItemsForAi(items: WorkbenchLibraryItem[], prompt: PromptProfile, cfg: AiProfile) {
    const settings = appCall("preprocess.settings", state);
    const modelName = cfg.name || cfg.model;
    return SubBatch.SubBatchMonorepo.app.preprocess.runPipeline(items, prompt.name, modelName, settings, {
      createRuntime: () => createAiRuntime("字幕预处理 · " + modelName),
      onStart: (run) => {
        state.preprocessRun = run;
        state.aiViewingPreprocess = true;
        renderAiResultTabs();
        setAiBusy(true);
      },
      onUpdate: () => renderAiResultTabs(),
      onComplete: () => {
        if (currentAiWorkbenchStage() === "preprocess" && state.aiInputView === "processed") {
          renderPreprocessCanvas().catch(() => {});
        }
      },
      isCancelled: (run) => !!state.aiAbort || !!run.runtime.abort,
      abortChild: (child) => abortPreprocessChildRuntime(child),
      getRaw: (item) => coreCall("cuesToAiText", item.data || [], item.bvid, item.page || 1),
      cacheKey: (item, raw) => coreCall("preprocessCacheKey", item, raw, prompt, cfg, settings),
      readCache: (key) => persistentCache.read(key),
      split: (item) => coreCall("splitCuesForPreprocess", { ...item, data: item.data || [] }, settings),
      forceRefresh: state.forcePreprocessOnce,
      cacheModel: cfg.model,
      runPool: (jobs, concurrency, handler, cancelled) =>
        SubBatch.SubBatchMonorepo.app.ai.runPool(jobs, concurrency, handler, cancelled),
      runChunk: (job, workerId, run) => SubBatch.SubBatchMonorepo.app.preprocess.runChunkWithRetry(job, settings.retries, workerId, {
        isCancelled: () => !!state.aiAbort || !!run.runtime.abort,
        createRuntime: (label) => createAiRuntime(label),
        register: (child) => run.childRuntimes.add(child),
        unregister: (child) => run.childRuntimes.delete(child),
        abort: (child) => abortPreprocessChildRuntime(child),
        formatClock: (seconds) => coreCall("formatClock", seconds),
        execute: (child, vars, label) => requestPreprocessChunk(child, cfg, prompt, vars, label),
        onRetry: (label) => { run.statusText = label + " · 失败，准备重试"; },
        sleep,
      }),
      stitch: (chunks, outputs) => coreCall("stitchPreprocessChunks", chunks, outputs),
      writeCache: (key, value) => persistentCache.write(key, value, PREPROCESS_CACHE_TTL_MS),
    });
  }

  async function selectPreprocessResult() {
    const run = state.preprocessRun;
    if (!run) return;
    if (state.ui) state.ui.aiStage = "preprocess";
    state.aiInputView = "processed";
    applyAiWorkbenchStageUi();
    state.aiViewingPreprocess = true;
    state.renderEpoch += 1;
    state.aiStickBottom = !!run.busy;
    state.aiUserReading = !run.busy;
    renderAiResultTabs();
    const text = run.raw || run.preview || "";
    if (run.busy) paintAiStreamText(text || "正在规范化字幕…");
    else if (text) await renderAiMarkdown(text, { streaming: false });
    else {
      const content = ensurePanel().querySelector<HTMLElement>('[data-role="ai-content"]');
      if (content) content.innerHTML = toTrustedHTML(`<div class="bsb-empty"><div class="bsb-empty-ico">◌</div><strong>预处理稿</strong><span>${escapeHtml(run.statusText || "暂无内容")}</span></div>`);
    }
    setStatus(`预处理 · ${run.promptName || "字幕规范化"} · ${run.statusText || run.status}`, run.status === "error" ? "err" : run.status === "done" ? "ok" : undefined);
  }

  function buildAiMessagesForProfile(_cfg: BatchModel, vars: Record<string,unknown>, promptProfile: PromptProfile | null) {
    const prompt = promptProfile ? coreCall("createPromptProfile", promptProfile, 0) : null;
    if (!prompt) return [];
    const system = renderPromptTemplate(prompt.systemPrompt, vars).trim();
    const user = renderPromptTemplate(prompt.userPromptTemplate, vars).trim();
    return [
      system ? { role: "system", content: system } : null,
      user ? { role: "user", content: user } : null,
    ].filter((message): message is { role: string; content: string } => message !== null);
  }

  function isCurrentAiRun(run: WorkbenchAiRun | null | undefined) {
    return !!run && state.aiRuns.get(run.id) === run;
  }

  function updateAiRun(run: WorkbenchAiRun, patch: Partial<WorkbenchAiRun>) {
    Object.assign(run, patch || {});
    // 单模型重试会以同一标签 ID 替换运行对象。旧请求即使稍后回调，也不得覆盖新结果。
    if (!isCurrentAiRun(run)) return;
    if (run.id === state.aiActiveRunId) syncActiveRunBridge(run);
    renderAiResultTabs();
    setAiBusy(anyAiRunBusy());
  }

  async function runAiProfile(run: WorkbenchAiRun, vars: Record<string,unknown>, promptProfile: PromptProfile | null, commonMeta: { sourceBvids?: string[] }) {
    if (!isCurrentAiRun(run)) return run;
    const cfg = run.config;
    run.abort = false;
    updateAiRun(run, {
      busy: true,
      status: "running",
      statusText: `正在连接 · max_tokens=${cfg.maxTokens}`,
      startedAt: Date.now(),
      sourceBvids: [...(commonMeta.sourceBvids || [])],
    });
    const messages = buildAiMessagesForProfile(cfg, vars, promptProfile);
    if (!messages.length) {
      updateAiRun(run, { busy: false, status: "error", statusText: "提示词为空", error: "当前提示词没有可发送内容" });
      return run;
    }
    const useStream = cfg.stream !== false;

    try {
      await new Promise<void>((resolve, reject) => {
        requestChatCompletion({
          runtime: run,
          baseUrl: cfg.baseUrl || "",
          apiKey: cfg.apiKey || "",
          model: cfg.model || "",
          ...(cfg.temperature === undefined ? {} : { temperature: cfg.temperature }),
          ...(cfg.maxTokens === undefined ? {} : { maxTokens: cfg.maxTokens }),
          messages,
          stream: useStream,
          onStatus(msg) {
            if (!isCurrentAiRun(run)) return;
            run.statusText = msg;
            if (run.id === state.aiActiveRunId) setStatus(`${run.promptName || "产物"} · ${cfg.name || cfg.model} · ${msg}`);
            renderAiResultTabs();
          },
          onDelta(_delta, full) {
            if (!isCurrentAiRun(run)) return;
            run.raw = sanitizeMermaidTimestampCitationsInMarkdown(full);
            if (run.id === state.aiActiveRunId) {
              syncActiveRunBridge(run);
              if (currentAiWorkbenchStage() === "postprocess") paintAiStreamText(run.raw);
            }
          },
          onDone(full) {
            if (isCurrentAiRun(run)) {
              run.raw = sanitizeMermaidTimestampCitationsInMarkdown(full || run.raw || "");
            }
            resolve();
          },
          onError(err) {
            reject(err instanceof Error ? err : new Error(String(err || "AI 请求失败")));
          },
        });
      });

      if (!isCurrentAiRun(run)) return run;
      if (run.abort || state.aiAbort) {
        if (run.raw && !/\*\(已停止\)\*\s*$/.test(run.raw)) run.raw += "\n\n*(已停止)*";
        updateAiRun(run, { busy: false, status: "stopped", statusText: "已停止", finishedAt: Date.now() });
      } else {
        updateAiRun(run, {
          busy: false,
          status: "done",
          statusText: `完成 · ${run.raw.length} 字符`,
          finishedAt: Date.now(),
        });
      }
    } catch (error) {
      if (!isCurrentAiRun(run)) return run;
      const message = String(errorMessage(error) || "未知错误");
      if (run.abort || state.aiAbort || /用户停止|abort/i.test(message)) {
        if (run.raw && !/\*\(已停止\)\*\s*$/.test(run.raw)) run.raw += "\n\n*(已停止)*";
        updateAiRun(run, { busy: false, status: "stopped", statusText: "已停止", finishedAt: Date.now() });
      } else {
        run.error = message;
        if (run.raw) run.raw += `\n\n> 错误：${message}`;
        updateAiRun(run, { busy: false, status: "error", statusText: `失败 · ${message.slice(0, 80)}`, finishedAt: Date.now() });
        console.error(`[bili-subbatch] ai ${cfg.name || cfg.model}`, error);
      }
    }

    if (isCurrentAiRun(run) && run.id === state.aiActiveRunId) {
      syncActiveRunBridge(run);
      if (currentAiWorkbenchStage() === "postprocess") {
        if (run.raw) await renderAiMarkdown(run.raw, { streaming: false });
        else await selectAiRun(run.id);
      }
    }
    if (isCurrentAiRun(run)) persistAiSessionCache().catch(() => {});
    return run;
  }

  let aiBatchCoordinator: ReturnType<typeof createAiBatchCoordinator> | null = null;

  async function doAiAnalyze(options: { automatic?: boolean; forceAll?: boolean; expectedRouteKey?: string; targets?: WorkbenchLibraryItem[] } = {}) {
    const automatic = !!options.automatic;
    if (state.aiBusy) {
      if (!automatic) setStatus("已有 AI 批次仍在生成；再次点击“送去 AI”可选择停止并重新分析", "err");
      return;
    }
    if (operationBusy()) {
      state.pendingAiSend = true;
      setStatus("扫描或字幕任务仍在运行 · 已排队，结束后自动送入 AI");
      return;
    }
    const forceAll = !!state.forcePreprocessOnce || !!options.forceAll;
    const routeKeyForCache = options.expectedRouteKey || currentRouteVideoKey();
    let cachedPayload: AiSessionCachePayload | null = null;
    if (!forceAll && routeKeyForCache && coreFn("aiSessionCacheKey") && coreFn("isUsableAiSessionCache")) {
      try {
        const rec = await persistentCache.read<AiSessionCachePayload>(coreCall("aiSessionCacheKey", routeKeyForCache));
        if (rec && coreCall("isUsableAiSessionCache", rec.value)) cachedPayload = rec.value;
      } catch  { /* ignore cache read */ }
    }
    const root = ensurePanel();

    // 手动运行：先读当前表单再切工作区，避免用存储值覆盖刚输入的 Key / maxTokens。
    // 自动 pipeline：面板可能从未打开，表单为空；只用已保存配置，且不展开面板。
    let profiles;
    let promptLibrary;
    if (automatic) {
      profiles = state.aiProfiles?.length ? state.aiProfiles : loadAiProfiles();
      state.aiProfiles = profiles;
      promptLibrary = loadPromptProfiles();
    } else {
      try {
        profiles = saveAiProfilesFromForm();
      } catch  {
        profiles = loadAiProfiles();
        state.aiProfiles = profiles;
      }
      try {
        promptLibrary = savePromptProfilesFromForm({ activeId: state.activePromptId });
      } catch  {
        promptLibrary = loadPromptProfiles();
      }
    }
    const preprocessPrompt = promptLibrary.prompts.find((p: { id: string; stage: string; }) => p.id === state.activePrePromptId && p.stage === "preprocess") || null;
    if (state.preprocessEnabled && (!preprocessPrompt || (!preprocessPrompt.systemPrompt.trim() && !preprocessPrompt.userPromptTemplate.trim()))) {
      setStatus("输入整理已开启，但没有可用的 PRE Prompt", "err");
      if (!automatic) setWorkspace("settings");
      return;
    }
    if (!automatic) toggleAiPanel(true);
    const configuredTasks = (automatic ? currentPostTasks() : savePostTasks(currentPostTasks())).filter((t) => t.enabled !== false);
    const planned = SubBatch.SubBatchMonorepo.app.ai.planTasks(configuredTasks, promptLibrary.prompts, profiles);
    const taskPlans = planned.plans;
    if (!taskPlans.length) {
      setStatus("当前处理方案没有可运行的产物：请为至少一个 POST Prompt 选择已启用的 LLM", "err");
      if (!automatic) setAiDrawer("flow");
      return;
    }
    const plannedRuns = planned.runs;
    const partitionFn = SubBatch.SubBatchMonorepo.app.ai.partitionRuns;
    const skipPrepareFn = coreFn("shouldSkipPrepareForCachedSession");
    if (!forceAll && cachedPayload && typeof partitionFn === "function") {
      const preview = partitionFn(plannedRuns, cachedPayload.runs, "");
      const skipPrepare = typeof skipPrepareFn === "function"
        ? skipPrepareFn(plannedRuns.length, preview.generate.length, preview.reuse.length, { automatic, force: forceAll })
        : (automatic && preview.generate.length === 0 && preview.reuse.length === plannedRuns.length);
      if (skipPrepare) {
        try {
          const restored = await restoreAiSessionForRoute(routeKeyForCache);
          if (restored) {
            setStatus(`已从缓存恢复 ${preview.reuse.length} 个模型版本 · 改模型后点“运行”只会重跑变化项`, "ok");
            return;
          }
        } catch  { /* fall through */ }
      }
    }
    const invalid = planned.invalid;
    if (invalid.length) {
      setStatus(`以下产物引用的 LLM 配置不完整：${invalid.map((x) => x.name || x.model).join("、")}`, "err");
      if (!automatic) {
        setWorkspace("settings");
        setSettingsTab("llm");
      }
      return;
    }

    const preprocessConfig = state.preprocessEnabled ? getPreprocessModelConfig(profiles) : null;
    if (state.preprocessEnabled && !preprocessConfig) {
      setStatus("预处理已开启，但没有可用的 LLM 配置", "err");
      if (!automatic) setWorkspace("settings");
      return;
    }

    const explicitTargets = Array.isArray(options.targets) ? options.targets.filter(Boolean) : null;
    let targets = explicitTargets ? [...explicitTargets] : selectedItems();
    if (!targets.length && !explicitTargets) {
      if (!state.items.length) {
        try { await doScan(); } catch  { /* noop */ }
      }
      targets = selectedItems();
    }
    if (options.expectedRouteKey && currentRouteVideoKey() !== options.expectedRouteKey) return;
    if (!targets.length) {
      setStatus("请先扫描并勾选要分析的视频", "err");
      return;
    }

    state.aiAbort = false;
    state.aiRuns = new Map();
    state.aiRunOrder = [];
    state.aiActiveRunId = "";
    state.preprocessRun = null;
    state.aiViewingPreprocess = false;
    const sessionId = ++state.aiSessionSeq;
    aiBatchCoordinator ||= appCall("ai.createCoordinator");
    const batch = aiBatchCoordinator.begin(String(sessionId));
    for (const plan of taskPlans) {
      for (const profile of plan.models) {
        const run = createAiRun(profile, sessionId, plan.task, plan.prompt);
        state.aiRuns.set(run.id, run);
        state.aiRunOrder.push(run.id);
      }
    }
    state.aiActiveTaskId = taskPlans[0]?.task?.id || "";
    state.aiActiveRunId = state.aiRunOrder.find((id) => state.aiRuns.get(id)?.taskId === state.aiActiveTaskId) || state.aiRunOrder[0] || "";
    syncActiveRunBridge(getActiveAiRun());
    renderAiResultTabs();
    setAiBusy(true);
    setStatus(`准备输入 · ${taskPlans.length} 个产物 · ${state.aiRunOrder.length} 个模型版本…`);

    const contentHost = root.querySelector<HTMLElement>('[data-role="ai-content"]');
    if (contentHost && currentAiWorkbenchStage() === "postprocess") {
      contentHost.innerHTML = toTrustedHTML(`<div class="bsb-empty"><div class="bsb-empty-ico">◌</div><strong>正在准备后处理输入…</strong><span>${state.preprocessEnabled ? "字幕只规范化一次，然后共享给" : "原始字幕将直接发送给"} ${taskPlans.length} 个后处理产物</span></div>`);
    } else if (currentAiWorkbenchStage() === "preprocess") {
      await renderPreprocessCanvas();
    }

    try {
      const ready = await batch.stage(() => SubBatch.SubBatchMonorepo.app.ai.ensureSubtitles(targets, state.delayMs, {
        cancelled: () => !!state.aiAbort,
        onFetching: (item, index, total) => setStatus("AI 准备字幕 " + (index + 1) + "/" + total + " · " + item.bvid + "…"),
        fetchSubtitle: (bvid, page) => fetchSubtitle(bvid, page),
        onUpdated: () => renderList(),
        sleep,
      }));
      if (options.expectedRouteKey && currentRouteVideoKey() !== options.expectedRouteKey) throw new Error("页面已切换到其他视频");
      if (!ready.length) {
        batch.finish("error");
        state.aiRunOrder.forEach((id) => {
          const run = state.aiRuns.get(id);
          if (run) updateAiRun(run, { busy: false, status: "error", statusText: "无可用字幕", error: "勾选项均无字幕" });
        });
        setStatus("勾选项均无字幕，无法发送 AI", "err");
        return;
      }
      if (state.aiAbort) throw new Error("用户停止");

      const rawBuilt = buildSubtitlePayload(ready);
      let stageInput = rawBuilt;
      if (state.preprocessEnabled && preprocessPrompt && preprocessConfig) {
        setStatus(`阶段 1/2 · 字幕预处理 · ${preprocessPrompt.name} · ${preprocessConfig.name || preprocessConfig.model}`);
        stageInput = await batch.stage(() => preprocessItemsForAi(ready, preprocessPrompt, preprocessConfig));
        if (state.aiAbort) throw new Error("用户停止");
      }
      const { cut, vars, commonMeta, sourceBvids } = appCall("ai.prepareBatchInput",
        ready, rawBuilt, stageInput, !!state.preprocessEnabled,
        (text) => coreCall("truncateForAi", text, MAX_SUBTITLE_CHARS),
        preprocessPrompt?.name || "", preprocessConfig?.name || preprocessConfig?.model || "");
      const sessionRouteKey = options.expectedRouteKey || currentRouteVideoKey();
      state.aiSessionRouteKey = sessionRouteKey;
      state.aiSessionInput = appCall("ai.cloneSessionInput", {
        sessionId,
        routeKey: sessionRouteKey,
        vars,
        taskSnapshots: taskPlans.map((plan) => ({ task: { ...plan.task, modelIds: [...(plan.task.modelIds || [])] }, prompt: { ...plan.prompt } })),
        preprocessPrompt: preprocessPrompt ? { ...preprocessPrompt } : null,
        preprocessConfig: preprocessConfig ? { ...preprocessConfig } : null,
        preprocessEnabled: !!state.preprocessEnabled,
        commonMeta,
      }, sessionId);
      state.aiRunOrder.forEach((id) => {
        const run = state.aiRuns.get(id);
        if (run) run.sourceBvids = [...sourceBvids];
      });
      state.aiViewingPreprocess = false;
      renderAiResultTabs();
      renderAiInputDrawer();
      refreshAiChips();
      if (currentAiWorkbenchStage() === "preprocess") await renderPreprocessCanvas();

      const inputHash = coreCall("aiSessionInputHash", vars);
      const split = (!forceAll && cachedPayload && typeof partitionFn === "function")
        ? partitionFn(plannedRuns, cachedPayload.runs, inputHash)
        : { reuse: [], generate: plannedRuns };
      const { reused, generateIds } = SubBatch.SubBatchMonorepo.app.ai.hydratePlannedRuns(
        state.aiRunOrder.map((id) => state.aiRuns.get(id)).filter((run): run is WorkbenchAiRun => !!run),
        split, sourceBvids,
        (cached) => coreCall("draftHydratedAiRun", cached));
      renderAiResultTabs();
      if (state.aiActiveRunId) {
        const active = state.aiRuns.get(state.aiActiveRunId);
        if (active?.raw && !active.busy) syncActiveRunBridge(active);
      }

      if (!generateIds.length) {
        batch.finish();
        setStatus(`已复用缓存 · ${reused} 个模型版本 · 未调用模型`, "ok");
        if (state.aiActiveRunId) await selectAiRun(state.aiActiveRunId);
        persistAiSessionCache().catch(() => {});
        return;
      }

      setStatus(`复用缓存 ${reused} · 新生成 ${generateIds.length} · ${ready.length} 条字幕${cut.truncated ? " · 输入已截断" : ""}`);
      const outcome = await batch.stage(() => appCall("ai.executeTasks", generateIds.map((id) => async () => {
        const run = state.aiRuns.get(id);
        if (!run) throw new Error("AI run was replaced");
        return runAiProfile(run, vars, run.promptProfile, commonMeta);
      })));
      batch.finish(state.aiAbort ? "stopped" : outcome.status);
      if (sessionId === state.aiSessionSeq) summarizeAiRuns(reused ? "部分模型复用缓存后生成结束" : "全部产物生成结束");
    } catch (error) {
      const message = String(errorMessage(error));
      batch.finish(state.aiAbort ? "stopped" : "error");
      if (sessionId === state.aiSessionSeq) {
        if (!state.aiAbort) setStatus(`AI 准备失败: ${message}`, "err");
        abortAllAiRuns();
        state.aiRunOrder.forEach((id) => {
          const run = state.aiRuns.get(id);
          if (!run || ["done", "error", "stopped"].includes(run.status)) return;
          updateAiRun(run, {
            busy: false,
            status: state.aiAbort ? "stopped" : "error",
            statusText: state.aiAbort ? "已停止" : `准备失败 · ${message.slice(0, 80)}`,
            error: state.aiAbort ? "" : message,
          });
        });
      }
    } finally {
      // 这里只同步当前真实运行状态。单模型重试可能已替换某个运行实例，
      // 原始批次的 finally 绝不能把新实例标记为“未完成”或解除其 busy。
      if (sessionId === state.aiSessionSeq) {
        setAiBusy(anyAiRunBusy());
        if (!anyAiRunBusy()) state.aiAbort = false;
        if (state.aiPaintRaf) { cancelAnimationFrame(state.aiPaintRaf); state.aiPaintRaf = 0; }
        if (state.aiPaintTimer) { clearTimeout(state.aiPaintTimer); state.aiPaintTimer = 0; }
        persistAiSessionCache().catch(() => {});
      }
    }
  }

  /**
   * 合集内视频页往往只有 BV，没有 URL 参数 sid。
   * 扫描「合集」时从 view 接口补 mid + ugc_season.id，便于一键拉全合集。
   */
  async function ensureCollectionContext(ctx: ScanContext) {
    if (!ctx || ctx.type !== "collection") return ctx;
    if (ctx.mid && ctx.season_id) return ctx;
    const bvid = ctx.bvid || extractBvid(location.href);
    if (!bvid) return ctx;
    try {
      const detail = await appCall("acquisition.fetchVideoDetail", runtimeNetwork(), bvid);
      const view = (detail && detail.data && detail.data.View) || {};
      const season = view.ugc_season || {};
      const mid = season.mid || view.owner?.mid || ctx.mid;
      const seasonId = season.id || ctx.season_id;
      if (mid) ctx.mid = String(mid);
      if (seasonId) ctx.season_id = String(seasonId);
      if (season.title && !ctx.collectionTitleHint) ctx.collectionTitleHint = String(season.title);
      if (view.owner?.name && !ctx.authorHint) ctx.authorHint = String(view.owner.name);
    } catch (error) {
      console.warn("[bili-subbatch] ensureCollectionContext", errorMessage(error));
    }
    return ctx;
  }

  /** IO: fetch view, then pure applyUgcSeasonToItems. */
  async function stampUgcSeasonGroupMeta<T extends LibraryGroupItem>(items: T[], bvid: string) {
    if (isYoutubePage()) return items;
    const list = items || [];
    if (!list.length) return list;
    const id = bvid || list[0]?.bvid;
    if (!id) return list;
    try {
      const detail = await appCall("acquisition.fetchVideoDetail", runtimeNetwork(), id);
      const view = (detail && detail.data && detail.data.View) || {};
      if (!view.ugc_season?.id) return list;
      return applyUgcSeasonToItems(list, view);
    } catch (error) {
      console.warn("[bili-subbatch] stampUgcSeasonGroupMeta", errorMessage(error));
      return list;
    }
  }

  async function doScan() {
    if (isYoutubePage()) {
      await autoCaptureCurrentVideo("manual-scan", { forceNetwork: true });
      return;
    }
    if (state.scanBusy) {
      state.cancelScan = true;
      state.pendingRescan = true;
      setStatus("当前扫描仍在运行 · 正在停止，随后自动重新扫描");
      return;
    }
    if (state.batchBusy) {
      state.cancel = true;
      state.cancelBatch = true;
      state.pendingRescan = true;
      setStatus("字幕任务仍在运行 · 正在停止，随后自动扫描当前页");
      return;
    }
    const scanId = ++state.scanSeq;
    refreshContextUI();
    let ctx: ScanContext = resolveContext();
    state.ctx = ctx;
    state.cancel = false;
    state.cancelScan = false;
    state.scanPaused = false;
    setScanBusy(true);
    setLibraryJob({ kind: "scan", index: 0, total: 0, label: "识别页面" });
    setStatus("扫描中…");
    try {
      const root = ensurePanel();
      state.maxPages = Math.max(
        1,
        Math.min(100, Number(root.querySelector<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>('[data-role="max-pages"]')?.value) || DEFAULT_MAX_PAGES),
      );
      state.delayMs = Math.max(
        0,
        Math.min(5000, Number(root.querySelector<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>('[data-role="delay"]')?.value) || DEFAULT_DELAY_MS),
      );

      if (ctx.type === "collection") {
        setStatus("解析合集信息…");
        ctx = await ensureCollectionContext(ctx);
        state.ctx = ctx;
      }

      // 合集内视频页（自动/含 ugc_season）扫描时，自动拉全合集并建文件夹
      // （对齐：视频选集扫全部分P → 自动文件夹）。显式「单个视频」模式不提升。
      if (
        ctx.type === "video"
        && state.mode !== "video"
        && state.mode !== "selection"
      ) {
        setStatus("检测合集信息…");
        const promoted = await ensureCollectionContext({ ...ctx, type: "collection" });
        if (promoted.mid && promoted.season_id) {
          ctx = { ...promoted, type: "collection", note: "auto_promoted_ugc_season" };
          state.ctx = ctx;
          setStatus(`识别到合集 · 将加载全列表并建立文件夹…`);
        }
      }

      appCall("scan.validateContext", ctx);

      let items: WorkbenchLibraryItem[] = [];
      let meta: Record<string, unknown> = {};

      // 单个视频 = 当前分P；视频选集 = 展开全部分P
      if (ctx.type === "video" || ctx.type === "selection") {
        const bvid = ctx.bvid || extractBvid(location.href);
        if (!bvid) throw new Error("未识别 BV 号");
        const expandParts = ctx.type === "selection";
        setStatus(
          expandParts
            ? `读取选集 ${bvid}（全部分P）…`
            : `读取单个视频 ${bvid}${(ctx.page || 1) > 1 ? " P" + ctx.page : ""}…`,
        );
        const loaded = await loadVideoAsItems(bvid, expandParts);
        // 单个视频：只保留当前 p（loadVideoAsItems 非 expand 时已是 1 条；
        // 若 expand=false 但我们要当前 p，需按 page 取）
        if (!expandParts) {
          const page = ctx.page || 1;
          if (loaded.pages && loaded.pages.length && page > 1) {
            // 重新按指定分P构造一条
            const part = loaded.pages[page - 1];
            items = [
              {
                bvid,
                aid: loaded.items[0]?.aid ?? null,
                title: part
                  ? `${loaded.meta?.title || bvid} - P${page}【${part.part || ""}】`
                  : loaded.meta?.title || bvid,
                author: loaded.meta?.author || "",
                page,
                part: part?.part || "",
              },
            ];
          } else {
            items = loaded.items.map((it) => ({ ...it, page: page || 1 }));
          }
          // 单条视频若仍属于 ugc 合集，打上合集分组元数据 → 字幕库显示文件夹
          items = await stampUgcSeasonGroupMeta(items, bvid);
        } else {
          items = attachSelectionGroupMeta(loaded.items, loaded.meta || {});
        }
        meta = loaded.meta || {};
        if (meta.multip && ctx.type === "video") {
          meta.hint = "多分P视频：可切换模式「视频选集」拉全部分P";
        }
      } else if (
        ctx.type === "user" ||
        ctx.type === "favorite" ||
        ctx.type === "collection" ||
        ctx.type === "search"
      ) {
        const pageSize = appCall("scan.pageSizeFor", ctx.type);
        const res = await loadAllListItems(ctx, {
          maxPages: state.maxPages,
          pageSize,
          delayMs: Math.min(state.delayMs, 400),
          onProgress: (t: string|null) => setStatus(t),
          shouldCancel: () => state.cancelScan || scanId !== state.scanSeq,
        });
        items = res.items;
        meta = res.meta || {};
        if (res.truncated) meta.truncated = true;
        if (ctx.type === "user") {
          // 个人主页：顶层 = UP 名；再拉合集列表（名称+短地址），把成员视频迁入合集文件夹。
          const author =
            String(meta.author || "").trim()
            || String(items.find((it) => String(it?.author || "").trim())?.author || "").trim()
            || "";
          items = attachUserSpaceGroupMeta(items, { author, mid: ctx.mid || "" });
          if (author) meta.author = author;
          try {
            setStatus("拉取合集列表（名称+地址）…");
            const seasons = await loadUserSpaceSeasons(ctx.mid, {
              maxPages: Math.max(5, Math.min(Number(state.maxPages) || 20, 40)),
              pageSize: 20,
              delayMs: Math.min(state.delayMs, 400),
              onProgress: (t: string|null) => setStatus(t),
              shouldCancel: () => state.cancelScan || scanId !== state.scanSeq,
            });
            if (state.cancelScan || scanId !== state.scanSeq) {
              const error = new Error("扫描已取消");
              error.name = "AbortError";
              throw error;
            }
            if (seasons.length) {
              const descriptors = seasons.map((s) => ({
                mid: s.mid,
                season_id: s.season_id,
                name: s.name,
                author,
                bvids: s.bvids,
              }));
              const stats = countSpaceCollectionMatches(items, descriptors);
              items = applySpaceCollectionMembership(items, descriptors);
              meta.collections = seasons.map((s) => ({
                name: s.name,
                season_id: s.season_id,
                shortUrl: s.shortUrl || buildCollectionShortUrl(s.mid, s.season_id),
                memberCount: (s.bvids || []).length,
              }));
              meta.collectionMatched = stats.matched;
              meta.collectionCount = stats.collectionCount;
              if (stats.matched > 0) {
                meta.hint = `已归入 ${stats.matched} 条到 ${stats.collectionCount} 个合集`;
              } else if (stats.collectionCount > 0) {
                meta.hint = `发现 ${stats.collectionCount} 个合集（当前页视频未命中成员，可调大「最多页」）`;
              }
            }
          } catch (err) {
            if (isAbortError(err)) throw err;
            console.warn("[bili-subbatch] loadUserSpaceSeasons", errorMessage(err));
            meta.collectionError = String(errorMessage(err) || "合集列表失败");
          }
          // 未进合集/选集的散视频统一进「视频」文件夹
          items = attachSpaceLooseVideosMeta(items);
        }
        if (ctx.type === "collection") {
          if (!meta.author && ctx.authorHint) meta.author = ctx.authorHint;
          if (!meta.name && ctx.collectionTitleHint) meta.name = ctx.collectionTitleHint;
          const archiveCount = items.length;
          setStatus(`展开合集内多分P单元（${archiveCount} 个稿件）…`);
          items = await expandCollectionArchivesWithParts(items.map((item) => ({ ...item, aid: Number(item.aid) || 0, pages: item.pages || [] })), {
            delayMs: Math.min(state.delayMs, 280),
            onProgress: (t: string|null) => setStatus(t),
            shouldCancel: () => state.cancelScan || scanId !== state.scanSeq,
          });
          if (items.length > archiveCount) {
            meta.expandedParts = items.length - archiveCount;
            meta.hint = [
              meta.hint,
              `已展开单元内分P ${archiveCount} → ${items.length} 条`,
            ].filter(Boolean).join(" · ");
          }
          // Pure attach: authorHint / collectionTitleHint fill UP + folder label.
          items = attachCollectionGroupMeta(items, meta, { mid: ctx.mid || "", season_id: ctx.season_id || "", collectionTitleHint: ctx.collectionTitleHint || "", authorHint: ctx.authorHint || "", parentFolder: "" });
        }
      } else {
        const fromDom = harvestBvidsFromDom();
        if (fromDom.length) {
          items = fromDom.map((b) => ({
            bvid: b,
            title: b,
            author: "",
            page: 1,
          }));
          meta = { fromDom: true };
        } else {
          throw new Error(
            "当前页未识别。请手动选择模式，或确认 URL 含 BV/mid/fid/keyword",
          );
        }
      }

      if (state.cancelScan || scanId !== state.scanSeq) {
        const error = new Error("扫描已取消");
        error.name = "AbortError";
        throw error;
      }

      const modeTag =
        ctx.source === "manual"
          ? `手动·${TYPE_LABEL[ctx.type]}`
          : `自动·${TYPE_LABEL[ctx.type]}`;
      const sourceLabel = String(meta.name || meta.title || meta.keyword || modeTag);
      const { added, existed } = appCall(
        "libraryScan.mergeItems",
        state.items, items, sourceLabel,
        (item) => routeVideoKey(item.bvid, item.page || 1),
      );
      state.meta = meta;
      state.captureDrawerOpen = false;
      const drawer = ensurePanel().querySelector<HTMLElement>('[data-role="capture-drawer"]');
      if (drawer) drawer.hidden = true;
      renderList();
      refreshContextUI();
      const trunc = meta.truncated ? "（已达页数上限，可调大「最多页」）" : "";
      let msg = `[${modeTag}] 扫描 ${items.length} 条 · 新增 ${added} · 已存在 ${existed}${trunc}`;
      if (meta.hint) msg += ` · ${meta.hint}`;
      setStatus(msg, "ok");
      if (meta.name || meta.title || meta.keyword) {
        const label = meta.name || meta.title || meta.keyword;
        const ctxEl = ensurePanel().querySelector<HTMLElement>('[data-role="ctx"]');
        if (ctxEl && !ctxEl.textContent.includes(String(label))) {
          ctxEl.textContent += ` · ${label}`;
        }
      }
    } catch (e) {
      if (isAbortError(e) || state.cancelScan) {
        setStatus(state.pendingRescan ? "旧扫描已停止 · 准备重新扫描…" : "扫描已停止");
      } else {
        console.error("[bili-subbatch] scan", e);
        setStatus(`扫描失败: ${errorMessage(e)}`, "err");
      }
    } finally {
      if (scanId === state.scanSeq) {
        state.cancelScan = false;
        state.scanPaused = false;
        setScanBusy(false);
        clearLibraryJob();
        flushPendingMainAction();
      }
    }
  }

  function harvestBvidsFromDom() {
    const seen = new Set();
    const out: string[] = [];
    document.querySelectorAll<HTMLAnchorElement>('a[href*="/video/BV"]').forEach((a) => {
      const b = extractBvid(a.getAttribute("href") || a.href || "");
      if (b && !seen.has(b)) {
        seen.add(b);
        out.push(b);
      }
    });
    return out;
  }

  async function doBatch(act: string) {
    if (state.batchBusy) {
      setStatus("已有字幕任务正在运行；可点击“停止”后重试", "err");
      return;
    }
    if (state.scanBusy) {
      setStatus("当前页仍在扫描；扫描完成后再执行字幕下载/复制", "err");
      return;
    }
    const batchId = ++state.batchSeq;
    const targets =
      act === "dl-ok-only"
        ? state.items.filter((it) => it.selected && it.subStatus === "ok" && it.data)
        : selectedItems();
    if (!targets.length) {
      setStatus(act === "dl-ok-only" ? "没有已成功的勾选项" : "请先勾选视频", "err");
      return;
    }

    state.cancel = false;
    state.cancelBatch = false;
    state.batchPaused = false;
    setBatchBusy(true);
    if (act === "fetch-selected") {
      try { setWorkspace("subs", { silent: true }); } catch  { /* panel not ready */ }
    }
    setLibraryJob({
      kind: "fetch",
      index: 0,
      total: targets.length,
      label: act === "fetch-selected" ? "准备抓取" : "准备导出",
    });
    // copy / download / fetch-selected 都会在缺字幕时补抓。
    const needData = act !== "copy-bvid";

    let ok = 0,
      empty = 0,
      err = 0;
    const delay = state.delayMs;
    let stoppedAt = -1;

    try {
      for (let i = 0; i < targets.length; i++) {
        await waitIfJobPaused();
        if (state.cancelBatch || state.cancel) {
          stoppedAt = i;
          setStatus(`已停止 · 完成 ${i}/${targets.length}`, "err");
          break;
        }
        const it = targets[i];
        if (!it) continue;
        const itemLabel = `${it.bvid}${(it.page || 1) > 1 ? " P" + it.page : ""}`;
        setLibraryJob({
          kind: "fetch",
          index: i + 1,
          total: targets.length,
          label: itemLabel,
        });
        setStatus(`${state.batchPaused ? "已暂停" : "字幕"} ${i + 1}/${targets.length} · ${itemLabel}…`);

        if (needData && (!it.data || it.subStatus !== "ok")) {
          try {
            const r = await fetchSubtitle(it.bvid, it.page || 1);
            it.subStatus = r.status;
            it.cue_count = r.cue_count || 0;
            it.data = r.data || null;
            it.error = r.error || "";
            it.lan = r.lan || "";
            if (!it.title && r.title) it.title = r.title;
            if (!it.author && r.author) it.author = r.author;
            if (r.status === "ok") ok++;
            else if (r.status === "empty") empty++;
            else err++;
          } catch (e) {
            it.subStatus = "error";
            it.error = errorMessage(e);
            err++;
          }
          renderList();
          if (i < targets.length - 1 && !state.cancelBatch && !state.cancel) {
            await sleep(delay);
            await waitIfJobPaused();
          }
        } else if (it.subStatus === "ok") {
          ok++;
        }
      }

      // export after fetch (or reuse)
      const ready = targets.filter((it) => it.subStatus === "ok" && it.data?.length);


      if (act === "fetch-selected") {
        if (stoppedAt >= 0) {
          setStatus(`已停止抓取 · 完成 ${stoppedAt}/${targets.length} · ok=${ok} empty=${empty} err=${err}`, "ok");
        } else {
          setStatus(`字幕抓取完成 · ok=${ok} empty=${empty} err=${err}`, err && !ok ? "err" : "ok");
        }
        return;
      }

      if (act === "copy") {
        if (!ready.length) {
          setStatus(`无可用字幕 · ok=${ok} empty=${empty} err=${err}`, "err");
          return;
        }
        const text = ready
          .map((it) => {
            const head =
              ready.length > 1
                ? `=== ${it.bvid}${(it.page || 1) > 1 ? " P" + it.page : ""} ${it.title || ""} ===\n`
                : "";
            return head + coreCall("cuesToTxt", it.data || []);
          })
          .join("\n\n");
        clipboardWrite(text);
        setStatus(`已复制 ${ready.length} 条字幕全文`, "ok");
        return;
      }

      if (act === "dl-srt" || act === "dl-txt" || act === "dl-ok-only") {
        const ext = act === "dl-txt" ? "txt" : "srt";
        const convert = (cues: readonly SubtitleCue[]) => coreCall(ext === "txt" ? "cuesToTxt" : "cuesToSrt", cues);
        const pool =
          act === "dl-ok-only"
            ? state.items.filter((it) => it.selected && it.subStatus === "ok" && it.data)
            : ready;
        if (!pool.length) {
          setStatus(`无可用字幕 · ok=${ok} empty=${empty} err=${err}`, "err");
          return;
        }
        const exported = await downloadSubtitleExportBatch(pool, ext, convert);
        setStatus(
          `已下载 ${exported.count} 个 ${ext.toUpperCase()} → ${SUBTITLE_EXPORT_ROOT}/ · index ${exported.indexEntries} 条 · 抓取 ok=${ok} empty=${empty} err=${err}`,
          "ok",
        );
      }
    } catch (e) {
      console.error("[bili-subbatch] batch", e);
      setStatus(`失败: ${errorMessage(e)}`, "err");
    } finally {
      if (batchId === state.batchSeq) {
        state.cancelBatch = false;
        state.cancel = false;
        state.batchPaused = false;
        setBatchBusy(false);
        clearLibraryJob();
        renderList();
        flushPendingMainAction();
      }
    }
  }

  /**
   * 字幕抓取成功后的自动分析调度：
   * - 默认开启，行为等同点击“开始分析”；
   * - 同一路由只自动触发一次；
   * - 该视频已有后处理缓存时只恢复，不重新用字幕生成；
   * - stale revalidate / 静默刷新不重复分析；
   * - AI 配置尚未完成时等待用户保存配置，保存后自动续跑。
   */
  function scheduleAutoAnalyze(item: WorkbenchLibraryItem, captureKey: string, reason = "capture", delay = AUTO_ANALYZE_DELAY_MS) {
    if (!state.autoAnalyzeEnabled || !item || item.subStatus !== "ok" || !item.data?.length) return;
    const key = captureKey || routeVideoKey(item.bvid, item.page || 1);
    if (!key || state.autoAnalyzeKey === key || state.autoAnalyzePendingKey === key) return;

    const readyProfiles = enabledAiProfiles({ requireReady: true });
    if (!readyProfiles.length) {
      setStatus(`已抓取 ${item.cue_count || item.data.length} 条字幕 · 保存并启用至少一个完整 AI 配置后将自动分析`, "ok");
      return;
    }

    clearTimeout(state.autoAnalyzeTimer);
    state.autoAnalyzePendingKey = key;
    state.autoAnalyzeTimer = window.setTimeout(async () => {
      state.autoAnalyzePendingKey = "";
      if (!state.autoAnalyzeEnabled || state.autoAnalyzeKey === key) return;

      if (currentRouteVideoKey() !== key) return;
      const target =
        state.items.find((x) => routeVideoKey(x.bvid, x.page || 1) === key) ||
        (routeVideoKey(state.transcriptItem?.bvid, state.transcriptItem?.page || 1) === key
          ? state.transcriptItem
          : null);
      if (!target || target.subStatus !== "ok" || !target.data?.length) return;

      // 同一视频的一次分析内部会并发运行多个配置；不同视频会话仍串行，避免结果互相覆盖。
      if (state.aiBusy) {
        scheduleAutoAnalyze(target, key, reason, 500);
        return;
      }

      state.autoAnalyzeKey = key;
      setStatus(`字幕已就绪 · 正在自动开始分析（${reason}）…`);
      try {
        await doAiAnalyze({ targets: [target], expectedRouteKey: key, automatic: true });
      } catch (error) {
        // doAiAnalyze 内部通常已处理错误；这里只防止未捕获异常污染页面。
        console.warn("[bili-subbatch] auto analyze", error);
      }
    }, Math.max(0, Number(delay) || 0));
  }

  function abortAiForAutoNavigation(nextRouteKey = "") {
    // 即使上一批已经生成结束，也必须让旧视频的输入/预处理稿立即失效。
    // 否则 B 站 SPA 换视频时抽屉会继续展示第一个视频的规范化稿。
    state.aiSessionSeq += 1;
    if (state.aiBusy) {
      state.aiAbort = true;
      abortAllAiRuns();
    }
    state.aiSessionInput = null;
    state.preprocessRun = null;
    state.aiSessionRouteKey = "";
    // 强制回到原始字幕视图，避免新视频仍停留在「规范化稿」空态。
    state.aiInputView = "raw";
    state.aiViewingPreprocess = false;
    state.aiRuns = new Map();
    state.aiRunOrder = [];
    state.aiActiveRunId = "";
    state.aiActiveTaskId = "";
    state.aiRaw = "";
    state.aiRenderedText = "";
    state.aiPendingText = "";
    state.knowledgeRailOpen = false;
    hideKnowledgeSelectionToolbar();
    renderKnowledgeRail().catch(() => {});
    setAiBusy(false);
    renderAiResultTabs();
    renderAiInputDrawer();
    refreshAiChips();
    abortStudioRequest();
    state.studioBusy = false;
    state.studioRuntime = null;
    loadStudioChat(nextRouteKey);
    if (currentAiWorkbenchStage() === "preprocess") renderPreprocessCanvas().catch(() => {});
    else if (currentAiWorkbenchStage() === "chat") renderStudioCanvas();
    const root = document.getElementById(PANEL_ID);
    const content = root?.querySelector<HTMLElement>('[data-role="ai-content"]');
    if (content && currentAiWorkbenchStage() === "postprocess") {
      content.innerHTML = toTrustedHTML(`<div class="bsb-empty"><div class="bsb-empty-ico">◌</div><strong>当前视频已切换</strong><span>${nextRouteKey ? escapeHtml(nextRouteKey) + " · " : ""}正在读取当前字幕，旧视频 AI 结果已解除绑定</span></div>`);
    }
  }

  /**
   * 调度当前视频自动抓字幕。
   * 必须允许在后台标签页运行：用户点进视频后切走、或后台打开视频页时，
   * 仍应静默抓取并（在开启自动分析时）送入 AI pipeline，不依赖面板保持打开。
   * 历史 bug：`document.hidden` 会直接 return，导致后台标签页完全不抓字幕。
   */
  function scheduleAutoCapture(reason: string|undefined, delay = AUTO_CAPTURE_DELAY_MS) {
    clearTimeout(state.autoCaptureTimer);
    if (!state.autoCaptureEnabled) return;
    state.autoCaptureTimer = window.setTimeout(() => {
      autoCaptureCurrentVideo(reason).catch((error) => {
        if (!isAbortError(error)) {
          console.warn("[bili-subbatch] auto capture", error);
        }
      });
    }, Math.max(0, Number(delay) || 0));
  }

  async function autoCaptureCurrentVideo(reason = "route", options: { forceNetwork?: boolean; silent?: boolean; requestedBvid?: string; requestedPage?: number } = {}) {
    if (!state.autoCaptureEnabled && !options.forceNetwork) return;
    if (state.autoEnablePlayerSubtitle) {
      enablePlayerSubtitle(null).catch(() => {});
    }
    const ctx = detectContext(location.href);
    const routeRef = options.requestedBvid ? null : currentRouteVideoRef();
    const bvid = options.requestedBvid || routeRef?.bvid || ctx.bvid;
    if (!bvid) return;
    const page = Math.max(1, Number(options.requestedPage || routeRef?.page || ctx.page || currentPageNumber()) || 1);
    const captureKey = routeVideoKey(bvid, page);
    const existing = state.items.find(
      (item) => routeVideoKey(item.bvid, item.page || 1) === captureKey,
    ) || (
      state.transcriptItem &&
      routeVideoKey(state.transcriptItem.bvid, state.transcriptItem.page || 1) === captureKey
        ? state.transcriptItem
        : null
    );
    if (!options.forceNetwork && state.autoCaptureKey === captureKey && ["ok", "empty"].includes(existing?.subStatus || "")) {
      if (existing?.subStatus === "ok") selectTranscriptItem(existing);
      return;
    }

    const epoch = ++state.autoCaptureEpoch;
    state.autoCaptureAbortController?.abort();
    const controller = new AbortController();
    state.autoCaptureAbortController = controller;
    state.autoCaptureKey = captureKey;

    const placeholder: WorkbenchLibraryItem = options.silent && existing
      ? { ...existing }
      : {
          bvid,
          title: document.title.replace(/_哔哩哔哩_bilibili$/i, "") || bvid,
          author: "",
          page,
          selected: true,
          subStatus: "wait",
          cue_count: 0,
          data: null,
          error: "",
          autoCaptured: true,
        };
    if (!options.silent) {
      rememberTranscriptItem(placeholder);
      // 资源库语义：打开视频只新增/更新当前 BV+P，不覆盖之前采集的合集或收藏夹。
      const placeholderIndex = state.items.findIndex(
        (entry) => routeVideoKey(entry.bvid, entry.page || 1) === captureKey,
      );
      const existingItem = state.items[placeholderIndex];
      if (existingItem) {
        Object.assign(existingItem, {
          title: placeholder.title || existingItem.title,
          author: placeholder.author || existingItem.author,
          autoCaptured: true,
        });
        rememberTranscriptItem(existingItem);
      } else {
        placeholder.sources = ["打开视频"];
        state.items.push(placeholder);
      }
      state.meta = { autoCaptured: true, reason };
      renderList();
      refreshContextUI();
      setStatus(`自动读取 ${bvid}${page > 1 ? " P" + page : ""} 字幕…`);
    }

    let result = null;
    let fastError: unknown = null;
    try {
      result = await fetchCurrentSubtitleFast(bvid, page, controller.signal, { forceNetwork: !!options.forceNetwork });
    } catch (error) {
      if (isAbortError(error)) throw error;
      fastError = error;
    }

    // 快速接口无轨道、受限或发生变化时，继续使用原脚本的完整 WBI/DM/AI 回退链。
    if (!result || result.status !== "ok") {
      if (controller.signal.aborted) throw new DOMException("操作已取消", "AbortError");
      try {
        result = await fetchSubtitle(bvid, page);
        if (result && result.status === "ok") result.source = "robust_fallback";
      } catch (error) {
        if (!result) result = { bvid, page, status: "error", error: errorMessage(error) };
      }
    }

    if (epoch !== state.autoCaptureEpoch || controller.signal.aborted) return;
    if (currentRouteVideoKey() !== captureKey) return;

    let item: WorkbenchLibraryItem = {
      ...placeholder,
      bvid: result?.bvid || bvid,
      aid: result?.aid || null,
      cid: result?.cid || null,
      title: result?.title || placeholder.title || "",
      author: result?.author || "",
      page: result?.page || page,
      pages: result?.pages || [],
      selected: true,
      subStatus: result?.status || "error",
      cue_count: result?.cue_count || 0,
      data: result?.data || null,
      error: result?.error || (fastError ? errorMessage(fastError) : ""),
      lan: result?.lan || "",
      lan_doc: result?.lan_doc || "",
      tracks: result?.tracks || placeholder.tracks || [],
      activeTrackIndex: typeof result?.activeTrackIndex === "number" && Number.isInteger(result.activeTrackIndex) ? result.activeTrackIndex : (placeholder.activeTrackIndex ?? -1),
      cachePath: result?.cachePath || "",
      cacheLevel: result?.cacheLevel || "",
      cacheStale: !!result?.cacheStale,
      source: result?.source || (fastError ? "fast_failed" : "fast"),
      autoCaptured: true,
    };
    // 合集内视频：自动打上 collection 分组，字幕库显示合集文件夹（与选集多 P 对齐）。
    try {
      const stamped = await stampUgcSeasonGroupMeta([item], item.bvid);
      if (stamped[0]) item = stamped[0];
    } catch  { /* ignore season stamp */ }
    rememberTranscriptItem(item);
    const sameIndex = state.items.findIndex(
      (entry) => routeVideoKey(entry.bvid, entry.page || 1) === captureKey,
    );
    const existingTarget = state.items[sameIndex];
    if (existingTarget) {
      let target = existingTarget;
      target.title = item.title || target.title || "";
      target.author = item.author || target.author || "";
      target.aid = item.aid ?? target.aid ?? null;
      target.cid = item.cid ?? target.cid ?? null;
      target.pages = item.pages || target.pages || [];
      target = mergeGroupFields(target, item);
      Object.assign(existingTarget, target);
      target = existingTarget;
      target.sources = Array.from(new Set([...(target.sources || []), "打开视频"].filter(Boolean)));
      SubBatch.SubBatchMonorepo.ui.transcriptController.copySubtitleState(target, item);
      state.transcriptItem = target;
      state.transcriptItemKey = captureKey;
    } else {
      item.sources = Array.from(new Set([...(item.sources || []), "打开视频"]));
      state.items.push(item);
      rememberTranscriptItem(item);
    }
    state.meta = {
      autoCaptured: true,
      title: item.title,
      author: item.author,
      source: item.source,
    };
    // 联动采集模式：多分P → 视频选集；合集 → 合集（便于一点「扫描/抓取所选」）
    const liveItem =
      state.items.find((x) => routeVideoKey(x.bvid, x.page || 1) === captureKey) || item;
    const modeSwitched = syncCaptureModeFromItem(liveItem, { silent: true });
    renderList();
    bindTranscriptVideoEvents();
    // 自动抓取可能在 AI 画布首次渲染之后才完成；同步刷新，避免状态显示
    // “原始字幕已就绪”而正文仍停留在“还没有原始字幕”的竞态假象。
    if (currentAiWorkbenchStage() === "preprocess") await renderPreprocessCanvas();

    if (item.subStatus === "ok") {
      if (state.autoEnablePlayerSubtitle) {
        window.setTimeout(() => enablePlayerSubtitle(item).catch(() => {}), 280);
      }
      const modeHint =
        modeSwitched === "selection"
          ? " · 模式→视频选集"
          : modeSwitched === "collection"
            ? " · 模式→合集"
            : "";
      setStatus(
        `已自动抓取 ${item.cue_count} 条字幕 · ${item.cachePath || item.cacheLevel || item.source}${modeHint}`,
        "ok",
      );
      // 静默的 stale-while-revalidate 只更新字幕缓存，不重复消耗一次 AI 请求。
      if (!options.silent && reason !== "stale-revalidate") {
        scheduleAutoAnalyze(item, captureKey, reason);
      }
      if (item.cacheStale && !options.forceNetwork) {
        window.setTimeout(() => {
          if (currentRouteVideoKey() === captureKey) {
            autoCaptureCurrentVideo("stale-revalidate", { forceNetwork: true, silent: true, requestedBvid: item.bvid, requestedPage: item.page || 1 }).catch(() => {});
          }
        }, 80);
      }
    } else if (item.subStatus === "empty") {
      setStatus("当前视频没有可读取字幕", "err");
    } else {
      setStatus(`自动抓取失败: ${item.error || "未知错误"}`, "err");
    }
  }

  // ─── SPA watch ──────────────────────────────────────────────────────────
  let lastHref = location.href;
  let lastRouteVideoKey = currentRouteVideoKey();
  let lastPlayingRef = currentRouteVideoRef();
  function onMaybeNavigate() {
    const href = location.href;
    const nextRef = currentRouteVideoRef();
    const nextVideoKey = nextRef?.key || "";
    const hrefChanged = href !== lastHref;
    const changedFn = bilibiliFn("playingVideoChanged");
    const videoChanged = !isYoutubePage() && typeof changedFn === "function"
      ? changedFn(lastPlayingRef, nextRef)
      : nextVideoKey !== lastRouteVideoKey;
    if (!hrefChanged && !videoChanged) return;
    lastHref = href;
    lastPlayingRef = nextRef;

    // 只有 BV+P / cid 真正变化才清空 AI/字幕绑定；同一视频的无关 URL 参数变化不扰动阅读。
    if (videoChanged) {
      persistStudioChat(lastRouteVideoKey);
      lastRouteVideoKey = nextVideoKey;
      state.autoCaptureAbortController?.abort();
      clearTimeout(state.autoAnalyzeTimer);
      state.autoAnalyzePendingKey = "";
      state.autoAnalyzeKey = "";
      abortAiForAutoNavigation(nextVideoKey);
      state.transcriptVideoAbort?.abort();
      state.transcriptSwitchAbort?.abort();
      state.transcriptActiveCueIndex = -1;
      state.transcriptQuery = "";
      state.transcriptFilteredIndexes = null;
      state.transcriptItemKey = nextVideoKey;
      state.transcriptItem = null;
      const transcriptSearch = document.getElementById(PANEL_ID)?.querySelector<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>('[data-role="transcript-search"]');
      if (transcriptSearch) transcriptSearch.value = "";
      refreshContextUI();
      renderTranscriptPanel();
      if (nextVideoKey) {
        restoreAiSessionForRoute(nextVideoKey).catch(() => {});
        scheduleAutoCapture("route-change");
      }
      return;
    }

    refreshContextUI();
  }

  let booted = false;
  function boot() {
    if (booted) return;
    booted = true;
    persistentCache.initChannel();
    ensurePanel();
    bindGlobalShortcuts();
    refreshContextUI();
    bindTranscriptVideoEvents();
    appCall("navigation.observe", {
      pageWindow,
      eventWindow: window,
      document,
      onNavigate: onMaybeNavigate,
      onPageShow: () => scheduleAutoCapture("pageshow", 120),
      onVisible: () => scheduleAutoCapture("visible", 120),
      pollMs: 800,
    });

    // 初次打开页面也默认抓取：不要求打开面板、不要求标签页在前台、不要求点击“扫描”。
    const routeKey = currentRouteVideoKey();
    if (routeKey) restoreAiSessionForRoute(routeKey).catch(() => {});
    if (state.autoEnablePlayerSubtitle) {
      enablePlayerSubtitle(null).catch(() => {});
    }
    scheduleAutoCapture("initial", 180);
  }

  function startUserscript() {
    appCall("activation.start", {
      pageWindow,
      eventWindow: window,
      document,
      href: () => location.href,
      boot,
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", startUserscript, { once: true });
  } else {
    startUserscript();
  }
}
