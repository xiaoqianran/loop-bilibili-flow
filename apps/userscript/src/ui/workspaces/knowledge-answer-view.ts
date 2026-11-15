/** View-only Knowledge evidence, answer and composer markup. */
type EscapeText = (text: string) => string;
export interface KnowledgeEvidence {
  selectedText?: string;
  contextText?: string;
}
export interface KnowledgeAnswerNode {
  question: string;
  suggestions?: string[];
  answer?: string;
  preview?: string;
  status?: string;
  error?: string;
  starred?: boolean;
}
export interface AnswerBodyOptions {
  escapeHtml: EscapeText;
  visibleAnswer: (raw: string) => string;
  renderCards: (answer: string, options: { streaming: boolean }) => string;
  suggestionsHtml: (node: KnowledgeAnswerNode) => string;
}

export function evidenceHtml(anchor: KnowledgeEvidence | null | undefined, open: boolean, escapeHtml: EscapeText): string {
    const selected = String(anchor?.selectedText || "").trim();
    const context = String(anchor?.contextText || "").trim();
    if (!selected && !context) return "";
    const showContext = context && context !== selected;
    const preview = selected.replace(/\s+/g, " ");
    const short = preview.length > 28 ? `${preview.slice(0, 28)}…` : preview;
    return `<div class="bsb-knowledge-evidence" data-role="knowledge-context">
      <button type="button" class="bsb-knowledge-evidence-chip" data-knowledge-evidence-toggle aria-expanded="${open ? "true" : "false"}">
        <strong>字幕依据</strong><em>${escapeHtml(short)}</em><span class="action">${open ? "收起" : "查看上下文"}</span>
      </button>
      <div class="bsb-knowledge-evidence-panel" data-role="knowledge-evidence-panel" ${open ? "" : "hidden"}>
        <div><strong>选区</strong><pre>${escapeHtml(selected)}</pre></div>
        ${showContext ? `<div><strong>前后文</strong><pre>${escapeHtml(context)}</pre></div>` : ""}
      </div>
    </div>`;
  }


export function answerBodyHtml(activeNode: KnowledgeAnswerNode | null | undefined, options: AnswerBodyOptions): string {
    const { escapeHtml, visibleAnswer, renderCards, suggestionsHtml } = options;
    if (!activeNode) {
      return `<div class="bsb-knowledge-welcome"><div class="bsb-knowledge-orb">✦</div><strong>从这里向下钻</strong><span>这个锚点还没有问题。可以直接提问，或者先让 AI 解释它。</span><button type="button" data-knowledge-quick="explain">解释这个概念</button></div>`;
    }
    const answer = visibleAnswer(activeNode.answer || activeNode.preview || "");
    const streaming = activeNode.status === "running";
    const statusLabel = streaming
      ? "正在回答"
      : activeNode.status === "stopped"
        ? "已停止"
        : activeNode.status === "error"
          ? "回答失败"
          : "当前问题";
    const answerFallback = activeNode.status === "error"
      ? `<div class="bsb-knowledge-thinking">回答失败${activeNode.error ? `：${escapeHtml(activeNode.error)}` : ""}</div>`
      : activeNode.status === "stopped"
        ? '<div class="bsb-knowledge-thinking">回答已停止。可以从这个节点继续提出新的问题。</div>'
        : '<div class="bsb-knowledge-thinking">正在组织回答…</div>';
    const answerHtml = answer
      ? renderCards(answer, { streaming })
      : answerFallback;
    return `<article class="bsb-knowledge-question-card"><div class="bsb-knowledge-question"><div class="bsb-knowledge-question-meta"><span>${statusLabel}</span><button type="button" class="bsb-knowledge-node-star${activeNode.starred ? " active" : ""}" data-knowledge-star-node title="${activeNode.starred ? "取消收藏这个回答" : "收藏这个回答"}">${activeNode.starred ? "★" : "☆"}</button></div><h3>${escapeHtml(activeNode.question)}</h3></div></article>
      <div class="bsb-knowledge-answer${streaming ? " streaming" : ""}">${answerHtml}</div>
      ${suggestionsHtml(activeNode)}`;
  }


export function composerHtml(busy: boolean, modelOptionsHtml: string): string {
    return `<div class="bsb-knowledge-composer">
      <div class="bsb-knowledge-composer-box">
        <textarea data-role="knowledge-question" rows="2" placeholder="继续追问… Enter 发送 · Shift+Enter 换行" ${busy ? "disabled" : ""}></textarea>
        <div class="bsb-knowledge-composer-tools">
          <select class="bsb-knowledge-model-select" data-role="knowledge-model" title="回答模型" ${busy ? "disabled" : ""}>${modelOptionsHtml}</select>
          <button type="button" class="bsb-btn accent" data-knowledge-send ${busy ? "disabled" : ""}>${busy ? "生成中" : "发送"}</button>
        </div>
      </div>
    </div>`;
  }


export function answerCardsHtml<M>(
  text: string,
  options: {
    streaming?: boolean;
    prepare: (source: string) => { md: string; maths: M[] };
    blocks: (md: string) => Array<{ type: string; text: string; topic?: string }>;
    chunkHtml: (chunk: string, maths: M[]) => string;
    escapeHtml: (source: string) => string;
  },
): string {
    const { streaming = false, prepare, blocks: splitBlocks, chunkHtml, escapeHtml } = options;
    const source = String(text || "").trim();
    if (!source) return "";
    const { md, maths } = prepare(source);
    const blocks = splitBlocks(md);
    if (!blocks.length) {
      return `<div class="bsb-preprocess-reading bsb-knowledge-answer-reading"><article class="bsb-preprocess-block bsb-knowledge-answer-card"><div class="bsb-preprocess-block-head"><span class="bsb-preprocess-block-index">01</span></div><div class="bsb-preprocess-block-body bsb-knowledge-card-body">${chunkHtml(md, maths)}</div></article></div>`;
    }
    let paragraphIndex = 0;
    const html = blocks
      .map((block) => {
        if (block.type === "heading") {
          return `<div class="bsb-preprocess-section-title">${escapeHtml(block.text)}</div>`;
        }
        paragraphIndex += 1;
        const bodyHtml = chunkHtml(block.text, maths);
        return `<article class="bsb-preprocess-block bsb-knowledge-answer-card"><div class="bsb-preprocess-block-head"><span class="bsb-preprocess-block-index">${String(paragraphIndex).padStart(2, "0")}</span>${block.topic ? `<span class="bsb-preprocess-block-topic">${escapeHtml(block.topic)}</span>` : ""}</div><div class="bsb-preprocess-block-body bsb-knowledge-card-body">${bodyHtml}</div></article>`;
      })
      .join("");
    return `<div class="bsb-preprocess-reading bsb-knowledge-answer-reading${streaming ? " is-streaming" : ""}">${html}</div>`;
  }
