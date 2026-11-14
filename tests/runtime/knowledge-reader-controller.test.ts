import { describe, expect, it, vi } from "vitest";
import { knowledgeReader } from "../../apps/userscript/src/ui";

const escape = (source: string) => source.replace(/&/g, "&amp;").replace(/</g, "&lt;")
  .replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const base = {
  escapeAttr: escape, escapeHtml: escape, formatClock: (seconds: number) => seconds + "s",
  contextHtml: "<section>Context</section>",
  breadcrumbHtml: "<button>Ancestor</button>",
  answerHtml: "<div>Answer</div>",
  composerHtml: "<textarea>Composer</textarea>",
};

describe("Knowledge reader markup", () => {
  it("renders selected anchor and escaped metadata while preserving reader slots", () => {
    const html = knowledgeReader.readerHtml({
      id: "a", selectedText: '<Topic "X">', title: "Learning", bvid: "BVtest", page: 3, timeStart: 54,
    }, base);
    expect(html).toContain("&lt;Topic &quot;X&quot;&gt;");
    expect(html).toContain("Learning · BVtest P3 · 54s");
    expect(html).toContain('data-knowledge-star-anchor');
    expect(html).toContain('data-knowledge-delete-anchor');
    expect(html).toContain('data-knowledge-more-toggle');
    expect(html).toContain('bsb-knowledge-reader-scroll');
    expect(html).toContain(base.contextHtml);
    expect(html).toContain(base.breadcrumbHtml);
    expect(html).toContain(base.answerHtml);
    expect(html).toContain(base.composerHtml);
    expect(html).not.toContain("<Topic");
  });

  it("shows mobile back button only for small screens and preserves starred state", () => {
    const anchor = { id: "a", selectedText: "Question", starred: true, bvid: "BV2", page: 1 };
    const desktop = knowledgeReader.readerHtml(anchor, base);
    const mobile = knowledgeReader.readerHtml(anchor, { ...base, isSmall: true });
    expect(desktop).not.toContain('data-knowledge-back-list');
    expect(mobile).toContain('data-knowledge-back-list');
    expect(mobile).toContain('data-knowledge-star-anchor title="取消收藏"');
    expect(mobile).not.toContain("☆");
    expect(desktop).toContain("BV2");
    expect(desktop).not.toContain("BV2 P1");
  });

  it("works with missing optional metadata", () => {
    const html = knowledgeReader.readerHtml({ id: "a" }, base);
    expect(html).toContain("局部字幕锚点");
    expect(html).toContain("bsb-knowledge-reader-title");
  });
});

describe("Knowledge reader click intent", () => {
  const actions = () => ({
    starAnchor: vi.fn(), starNode: vi.fn(), deleteAnchor: vi.fn(), toggleMore: vi.fn(),
  });
  it.each([
    ["[data-knowledge-star-anchor]", "starAnchor"],
    ["[data-knowledge-star-node]", "starNode"],
    ["[data-knowledge-delete-anchor]", "deleteAnchor"],
    ["[data-knowledge-more-toggle]", "toggleMore"],
  ] as const)("dispatches %s through a single action", (selector, action) => {
    const callbacks = actions();
    const target = { closest: (test: string) => test === selector ? {} : null };
    expect(knowledgeReader.dispatchReaderClick(target, callbacks)).toBe(true);
    expect(callbacks[action]).toHaveBeenCalledOnce();
    expect(Object.values(callbacks).filter(fn => fn.mock.calls.length > 0)).toHaveLength(1);
  });
  it("ignores unrelated clicks and null inputs", () => {
    const callbacks = actions();
    expect(knowledgeReader.dispatchReaderClick({ closest: () => null }, callbacks)).toBe(false);
    expect(knowledgeReader.dispatchReaderClick(null, callbacks)).toBe(false);
    expect(knowledgeReader.dispatchReaderClick({}, callbacks)).toBe(false);
    for (const fn of Object.values(callbacks)) expect(fn).not.toHaveBeenCalled();
  });
});
