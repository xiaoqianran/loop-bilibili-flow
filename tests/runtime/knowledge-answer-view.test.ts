import { describe, expect, it, vi } from "vitest";
import { knowledgeAnswerView as view } from "../../apps/userscript/src/ui";
import { knowledge } from "../../apps/userscript/src/app";

const escape = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const base = {
  escapeHtml: escape,
  visibleAnswer: (raw: string) => raw.replace(/<suggestions>[\s\S]*$/, "").trim(),
  renderCards: vi.fn((answer: string, { streaming }: { streaming: boolean }) =>
    "<article data-streaming='" + streaming + "'>" + escape(answer) + "</article>"),
  suggestionsHtml: (node: { question: string }) => "<div>" + escape(node.question) + "</div>",
};

describe("Knowledge evidence, answer and composer view", () => {
  it("escapes transcript selection and conditionally shows surrounding context", () => {
    expect(view.evidenceHtml(null, false, escape)).toBe("");
    const anchor = { selectedText: " <AI> \n key", contextText: "surrounding <script>" };
    const hidden = view.evidenceHtml(anchor, false, escape);
    expect(hidden).toContain('aria-expanded="false"');
    expect(hidden).toContain("hidden");
    expect(hidden).toContain("&lt;AI&gt;");
    expect(hidden).toContain("&lt;script&gt;");
    expect(hidden).not.toContain("<script>");
    const open = view.evidenceHtml(anchor, true, escape);
    expect(open).toContain('aria-expanded="true"');
    expect(open).toContain("收起");
    expect(view.evidenceHtml({ selectedText: "Same", contextText: "Same" }, true, escape))
      .not.toContain("前后文");
  });
  it("preserves no-question welcome, running and stopped/error fallbacks", () => {
    expect(view.answerBodyHtml(null, base)).toContain("解释这个概念");
    const running = view.answerBodyHtml({ question: "<Q>", preview: "in progress", status: "running", starred: true }, base);
    expect(running).toContain('bsb-knowledge-answer streaming');
    expect(running).toContain("&lt;Q&gt;");
    expect(running).toContain('data-knowledge-star-node');
    expect(running).toContain("data-streaming");
    const stopped = view.answerBodyHtml({ question: "Stopped", status: "stopped" }, base);
    expect(stopped).toContain("回答已停止");
    const failed = view.answerBodyHtml({ question: "Broken", status: "error", error: "<bad>" }, base);
    expect(failed).toContain("&lt;bad&gt;");
    expect(failed).not.toContain("<bad>");
  });
  it("disables composer during streaming and shows model options unchanged", () => {
    const enabled = view.composerHtml(false, '<option value="m">Model</option>');
    const busy = view.composerHtml(true, '<option value="m">Model</option>');
    expect(enabled).toContain("发送");
    expect(enabled).not.toContain('textarea data-role="knowledge-question" rows="2" placeholder="继续追问… Enter 发送 · Shift+Enter 换行" disabled');
    expect(busy).toContain("生成中");
    expect(busy).toContain('data-knowledge-send disabled');
    expect(busy).toContain('<option value="m">Model</option>');
  });
  it("builds segmented cards using provided rendering ports and retains streaming class", () => {
    const prepare = vi.fn((source: string) => ({ md: source, maths: [] }));
    const chunkHtml = vi.fn((text: string) => "<p>" + escape(text) + "</p>");
    const blocks = vi.fn(() => [
      { type: "heading", text: "Heading" },
      { type: "paragraph", text: "First", topic: "Topic" },
      { type: "paragraph", text: "Second" },
    ]);
    const options = { prepare, blocks, chunkHtml, escapeHtml: escape, streaming: true };
    const result = view.answerCardsHtml("  lines  ", options);
    expect(result).toContain("bsb-knowledge-answer-reading is-streaming");
    expect(result).toContain("bsb-preprocess-section-title");
    expect(result).toContain("01");
    expect(result).toContain("02");
    expect(result).toContain("Topic");
    expect(result).toContain("<p>Second</p>");
    expect(prepare).toHaveBeenCalledWith("lines");
    expect(chunkHtml).toHaveBeenCalledTimes(2);
    expect(view.answerCardsHtml(" ", options)).toBe("");
    expect(view.answerCardsHtml("hello", {
      ...options, blocks: () => [],
    })).toContain("bsb-knowledge-answer-card");
  });
});

describe("Knowledge streaming preview persistence", () => {
  it("updates in-memory preview and marks snapshots due only after 1800ms", () => {
    const node = { id: "n", preview: "", updatedAt: 0 };
    expect(knowledge.updateStreamPreview(node, "A", 100, 1850)).toEqual({
      latest: "A", persistAt: 100, shouldPersist: false,
    });
    expect(node).toMatchObject({ preview: "A", updatedAt: 1850 });
    expect(knowledge.updateStreamPreview(node, "AB", 100, 1901)).toEqual({
      latest: "AB", persistAt: 1901, shouldPersist: true,
    });
    expect(knowledge.updateStreamPreview(node, null, 1901, 2000)).toEqual({
      latest: "", persistAt: 1901, shouldPersist: false,
    });
  });
});
