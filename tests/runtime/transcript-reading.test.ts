import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { sourceFunction } from "../golden/legacy-harness";
import { readingBlocks } from "../../apps/userscript/src/app/preprocess-controller";
import { renderTranscriptReading, transcriptReadingText, transcriptTimestampPattern, transcriptTimestamps } from "../../apps/userscript/src/ui/workspaces/transcript-reading";

const escape = (text: string) => text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const evidence = "=== tYU0QqfzxS0 示例 ===\n[tYU0QqfzxS0 P1 00:00] 开场\n[tYU0QqfzxS0 P1 00:12] <script>内容</script>\n\n=== BVabc P2 另一期 ===\n[BVabc P2 01:02:03] 结尾";

describe("transcript reading separates evidence from presentation", () => {
  it("copies readable text without video identifiers or timestamps, preserving Markdown indentation", () => {
    expect(transcriptReadingText(evidence)).toBe("示例\n开场\n<script>内容</script>\n\n另一期\n结尾");
    expect(transcriptReadingText("# 标题\n    code\n正文 [BVabc P1 00:12] 继续\n[tYU0QqfzxS0 P1 00:12]")).toBe("# 标题\n    code\n正文  继续");
  });

  it("shows only escaped subtitle text in plain view, with source identity once in its header", () => {
    const html = renderTranscriptReading(evidence, false, escape);
    expect(html).not.toContain("[tYU0QqfzxS0 P1");
    expect(html).not.toContain("bsb-time-link");
    expect(html).toContain("&lt;script&gt;内容&lt;/script&gt;");
    expect(html.match(/tYU0QqfzxS0/g)).toHaveLength(1);
  });

  it("keeps exact source, part and seconds for timestamp navigation across videos", () => {
    const html = renderTranscriptReading(evidence, true, escape);
    expect(html).toContain('data-seconds="0" data-bvid="tYU0QqfzxS0" data-page="1"');
    expect(html).toContain('data-seconds="12" data-bvid="tYU0QqfzxS0" data-page="1"');
    expect(html).toContain('data-seconds="3723" data-bvid="BVabc" data-page="2"');
    expect(html).not.toContain("[BVabc P2");
    expect(html).toContain(">01:02:03</button>");
  });

  it("recognizes YouTube identifiers with hyphens and underscores without inventing times", () => {
    expect(transcriptTimestamps("[a_B-123xyz0 P1 00:12] text [BVabc P2 01:02:03]")).toEqual([
      { bvid: "a_B-123xyz0", page: 1, clock: "00:12", seconds: 12 },
      { bvid: "BVabc", page: 2, clock: "01:02:03", seconds: 3723 },
    ]);
    expect(transcriptTimestamps("[missing] 普通正文")).toEqual([]);
    expect(renderTranscriptReading("正文", true, escape)).not.toContain("data-seconds");
    expect(renderTranscriptReading("[BVabc P1 00:12]", true, escape)).not.toContain("bsb-time-link");
  });

  it("renders existing processed YouTube evidence as clean paragraphs with working knowledge and time anchors", () => {
    const source = readFileSync(new URL("../../apps/userscript/src/workbench/runtime.ts", import.meta.url), "utf8");
    const render = sourceFunction<(text: string) => string>(source, "renderProcessedTranscriptCards", {
      appCall: (_name: string, text: string) => readingBlocks(text),
      currentKnowledgeSource: () => ({}),
      knowledgeSourceKey: (id: string, page: number) => `${id}:P${page}`,
      transcriptTimestampPattern, transcriptTimestamps,
      escapeHtml: escape, escapeAttr: escape,
      coreCall: () => "abcdefg",
      renderProcessedTranscriptBodyHtml: escape,
    });
    const html = render("=== tYU0QqfzxS0 P1 示例 ===\n[tYU0QqfzxS0 P1 00:12] 整理后的正文\n\n[tYU0QqfzxS0 P1 00:30]");
    expect(html).not.toContain("[tYU0QqfzxS0 P1");
    expect(html).toContain('data-seconds="12" data-bvid="tYU0QqfzxS0" data-page="1"');
    expect(html).toContain('data-knowledge-start="12"');
    expect(html).toContain('data-knowledge-plain="整理后的正文"');
    expect(html).not.toContain('data-preprocess-block="2"');
  });
});
