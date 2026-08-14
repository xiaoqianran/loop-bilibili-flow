import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import {
  buildFolioOutline,
  countFolioOutline,
  folioOutlineSummary,
  formatFolioChapterIndex,
  slugFolioHeading,
  aiRunIdentityKey,
  aiSessionCacheKey,
  aiSessionCacheTtlMs,
  aiSessionInputHash,
  buildAiSessionCachePayload,
  draftHydratedAiRun,
  isUsableAiSessionCache,
  partitionPlannedAiRuns,
  shouldSkipPrepareForCachedSession,
  knowledgeBranchContext,
  md5,
  parseKnowledgeOutput,
  preprocessCacheKey,
  replaceMermaidBlockAt,
  resolveRestoredActiveRunId,
  serializeAiRunForCache,
  shouldRestoreAutomaticAiSession,
  renderPromptTemplate,
  sanitizeMermaidTimestampCitationsInMarkdown,
  shortcutChordFromEvent,
  shortcutDisplayChord,
  splitCuesForPreprocess,
  stitchPreprocessChunks,
  toCues,
  cuesToSrt,
  cuesToTxt,
  type PreprocessItem,
} from "@subbatch/core";
import {
  detectContext,
  extractBvid,
  extractPlayingVideoHint,
  playingVideoChanged,
  resolvePlayingVideoRef,
  routeVideoKey,
} from "@subbatch/bilibili";

function fixture(name: string): string {
  return readFileSync(
    fileURLToPath(new URL(`../fixtures/${name}`, import.meta.url)),
    "utf8",
  );
}

describe("P2 extracted Pure Core", () => {
  it("matches route and subtitle Golden outputs", () => {
    const single = JSON.parse(fixture("single-video.json"));
    const collection = JSON.parse(fixture("collection.json"));
    expect(extractBvid("https://www.bilibili.com/video/bv1Ab411c7mD")).toBe(
      "BV1Ab411c7mD",
    );
    expect(detectContext(single.url)).toEqual(single.expected);
    expect(detectContext(collection.url)).toEqual(collection.expected);
    expect(routeVideoKey("bv1Test", 0)).toBe("BV1TEST:P1");
    expect(
      resolvePlayingVideoRef({
        href: "https://www.bilibili.com/video/BV1oldxxxx011?p=1",
        urlBvid: "BV1oldxxxx011",
        urlPage: 1,
        playing: { bvid: "BV1newxxxx011", page: 1, cid: 99, source: "player" },
      }),
    ).toMatchObject({
      bvid: "BV1newxxxx011",
      page: 1,
      cid: 99,
      key: "BV1NEWXXXX011:P1",
      source: "player",
    });
    expect(
      resolvePlayingVideoRef({
        href: "https://www.bilibili.com/video/BV1xxxx?p=1",
        urlBvid: "BV1xxxx",
        urlPage: 1,
        playing: { bvid: "BV1xxxx", page: 3, cid: 333, source: "player" },
      }),
    ).toMatchObject({ key: "BV1XXXX:P3", page: 3, cid: 333 });
    expect(
      extractPlayingVideoHint({
        player: {
          getManifest() {
            return { bvid: "BV1playxx011", cid: 12, aid: 8 };
          },
        },
        __INITIAL_STATE__: {
          videoData: {
            bvid: "BV1stalexx011",
            cid: 1,
            pages: [{ cid: 1 }, { cid: 12 }],
          },
        },
      }),
    ).toMatchObject({
      bvid: "BV1playxx011",
      cid: 12,
      page: 2,
      source: "player",
    });
    expect(
      playingVideoChanged(
        { key: "BV1X:P1", cid: 1 },
        { key: "BV1X:P1", cid: 2 },
      ),
    ).toBe(true);
    expect(
      playingVideoChanged(
        { key: "BV1X:P1", cid: 1 },
        { key: "BV1X:P1", cid: 1 },
      ),
    ).toBe(false);

    const cues = toCues([
      { sid: 9, from: 1.2, to: 3.456, content: "第一行" },
      { from: 4, to: 5, content: "第二行\n续行" },
    ]);
    expect(cuesToSrt(cues)).toBe(
      "1\n00:00:01,200 --> 00:00:03,456\n第一行\n\n" +
        "2\n00:00:04,000 --> 00:00:05,000\n第二行\n续行\n",
    );
    expect(cuesToTxt(cues)).toBe("第一行\n第二行\n续行");
  });

  it("matches PRE chunk, stitch and cache Golden outputs", () => {
    const item = JSON.parse(fixture("long-transcript.json")) as PreprocessItem;
    const chunks = splitCuesForPreprocess(item, {
      targetMinutes: 2,
      overlapSeconds: 30,
      maxChars: 8_000,
    });
    expect(chunks.map((chunk) => ({
      coreStartSec: chunk.coreStartSec,
      chunkStartSec: chunk.chunkStartSec,
      endSec: chunk.endSec,
      coreStartIdx: chunk.coreStartIdx,
      overlapStartIdx: chunk.overlapStartIdx,
      endIdx: chunk.endIdx,
    }))).toEqual([
      { coreStartSec: 0, chunkStartSec: 0, endSec: 100, coreStartIdx: 0, overlapStartIdx: 0, endIdx: 4 },
      { coreStartSec: 120, chunkStartSec: 90, endSec: 190, coreStartIdx: 4, overlapStartIdx: 3, endIdx: 7 },
    ]);

    const [first, second] = fixture("pre-output.txt").split("\n---CHUNK---\n");
    expect(
      stitchPreprocessChunks(
        [{ coreStartSec: 0 }, { coreStartSec: 120 }],
        [first, second],
      ),
    ).toBe(
      "[BV1TEST P2 00:00] 开场整理\n\n" +
        "[BV1TEST P2 01:30] 第三点整理\n\n" +
        "[BV1TEST P2 02:00] 第四点整理\n\n" +
        "[BV1TEST P2 02:30] 第五点整理",
    );

    expect(aiSessionCacheKey("BV1TEST:P1")).toBe("ai-session:BV1TEST:P1");
    expect(aiSessionCacheKey("")).toBe("");
    expect(isUsableAiSessionCache({ runs: [{ raw: "" }, { raw: "  " }] })).toBe(false);
    expect(isUsableAiSessionCache({ runs: [{ raw: "```mermaid\nflowchart TD\nA[\"ok\"]\n```" }] })).toBe(true);
    expect(serializeAiRunForCache({
      id: "1:task:model",
      profileId: "model",
      taskId: "task",
      config: { name: "本地", apiKey: "secret", model: "qwen" },
      raw: "graph",
      sourceBvids: ["BV1TEST"],
    })).toEqual({
      id: "1:task:model",
      profileId: "model",
      taskId: "task",
      taskSnapshot: null,
      promptId: "",
      promptName: "",
      promptProfile: null,
      config: { name: "本地", apiKey: "", model: "qwen" },
      raw: "graph",
      status: "",
      statusText: "",
      error: "",
      sourceBvids: ["BV1TEST"],
      startedAt: 0,
      finishedAt: 0,
      scrollTop: 0,
    });
    expect(resolveRestoredActiveRunId(
      [
        { id: "s:t1:m1", profileId: "m1", taskId: "t1" },
        { id: "s:t1:m2", profileId: "m2", taskId: "t1" },
      ],
      { profileId: "m2", taskId: "t1" },
      "t1",
    )).toBe("s:t1:m2");
    expect(shouldRestoreAutomaticAiSession({ automatic: true })).toBe(true);
    const sharedPrompt = { id: "post", systemPrompt: "sys", userPromptTemplate: "u {{subtitle}}" };
    const modelA = { baseUrl: "http://x", model: "a", temperature: 0.2, maxTokens: 1000 };
    const modelB = { baseUrl: "http://x", model: "b", temperature: 0.2, maxTokens: 1000 };
    const cachedRuns = [
      { taskId: "t1", profileId: "m1", promptId: "post", promptProfile: sharedPrompt, config: modelA, raw: "note-a" },
      { taskId: "t1", profileId: "m2", promptId: "post", promptProfile: sharedPrompt, config: modelB, raw: "note-b" },
    ];
    const inputHash = aiSessionInputHash({ subtitle: "same-sub" });
    const split = partitionPlannedAiRuns(
      [
        { taskId: "t1", profileId: "m1", promptId: "post", promptProfile: sharedPrompt, config: modelA },
        { taskId: "t1", profileId: "m2", promptId: "post", promptProfile: sharedPrompt, config: { ...modelB, maxTokens: 8000 } },
      ],
      cachedRuns,
      inputHash,
    );
    expect(split.reuse.map((item) => item.plan.profileId)).toEqual(["m1"]);
    expect(split.generate.map((item) => item.profileId)).toEqual(["m2"]);
    expect(shouldSkipPrepareForCachedSession(2, 0, 2, { automatic: true })).toBe(true);
    expect(shouldSkipPrepareForCachedSession(2, 1, 1, { automatic: true })).toBe(false);
    expect(aiRunIdentityKey(cachedRuns[0], inputHash)).toBe(
      aiRunIdentityKey(
        { taskId: "t1", profileId: "m1", promptId: "post", promptProfile: sharedPrompt, config: modelA },
        inputHash,
      ),
    );
    expect(shouldRestoreAutomaticAiSession({ automatic: true, forcePreprocessOnce: true })).toBe(false);
    expect(shouldRestoreAutomaticAiSession({ automatic: false })).toBe(false);
    expect(aiSessionCacheTtlMs()).toBe(30 * 24 * 60 * 60_000);
    expect(buildAiSessionCachePayload({
      routeKey: "BV1TEST:P1",
      sessionInput: { vars: { subtitle: "x" }, preprocessConfig: { apiKey: "secret" } },
      runs: [{ raw: "note", config: { apiKey: "secret" } }],
    }).sessionInput).toMatchObject({ preprocessConfig: { apiKey: "" } });
    expect(isUsableAiSessionCache(buildAiSessionCachePayload({
      runs: [{ raw: "" }],
    }))).toBe(false);
    expect(draftHydratedAiRun({ raw: "graph", status: "running" })).toMatchObject({
      raw: "graph",
      status: "done",
      statusText: "缓存",
      busy: false,
    });
    expect(replaceMermaidBlockAt(
      "```mermaid\nflowchart TD\nA[\"old [BV1 P1 00:01]\"]\n```",
      0,
      "flowchart TD\nA[\"new [BV1 P1 00:01]\"]",
    )).toEqual({
      replaced: true,
      value: "```mermaid\nflowchart TD\nA[\"new\"]\n```",
    });

    expect(slugFolioHeading("核心判断：为什么成立", 0)).toBe("folio-核心判断-为什么成立-1");
    expect(formatFolioChapterIndex(3)).toBe("03");
    const outline = buildFolioOutline([
      { id: "folio-a-1", level: 2, text: "问题" },
      { id: "folio-b-2", level: 3, text: "背景" },
      { id: "folio-c-3", level: 3, text: "矛盾" },
      { id: "folio-d-4", level: 2, text: "方法" },
    ]);
    expect(outline).toHaveLength(2);
    expect(outline[0]?.children.map((node) => node.text)).toEqual(["背景", "矛盾"]);
    expect(countFolioOutline(outline)).toEqual({ chapters: 2, sections: 4 });
    expect(folioOutlineSummary({ chapters: 2, sections: 4 })).toBe("2 章 · 4 节");

    expect(md5("raw transcript")).toBe("cf7b263a3cc99460b01b27ec78c65d16");
    expect(
      preprocessCacheKey(
        { bvid: "BV1TEST", page: 2 },
        "raw transcript",
        { systemPrompt: "system", userPromptTemplate: "Hello {{subtitle}}" },
        { baseUrl: "http://127.0.0.1:1234", model: "test-model", temperature: 0.2, maxTokens: 4096 },
        { targetMinutes: 8, overlapSeconds: 30, maxChars: 24_000 },
      ),
    ).toBe(
      "ai-preprocess:BV1TEST:P2:cf7b263a3cc99460b01b27ec78c65d16:" +
        "b246d03e9f11698199d7385eb19a3898:" +
        "8495553a552cf22f49f29877c3f174bd:" +
        "6e1d6b1c8ee6b9d809c489496c9b2995",
    );
  });

  it("matches Prompt, Mermaid, Knowledge and shortcut Golden outputs", () => {
    expect(
      renderPromptTemplate("{{ title }} · {{bvid}}\n{{subtitle}}\n{{unknown}}", {
        title: "标题",
        bvid: "BV1TEST",
        subtitle: "字幕",
      }),
    ).toBe("标题 · BV1TEST\n字幕\n{{unknown}}");
    expect(
      renderPromptTemplate(
        "{{chunkStart}}|{{coreStart}}|{{chunkEnd}}",
        { chunkStart: "00:00", coreStart: "00:30", chunkEnd: "02:00" },
      ),
    ).toBe("00:00|00:30|02:00");

    const markdown =
      "正文 [BV1TEST P2 03:21]\n```mermaid\ngraph TD\nA[概念 [BV1TEST P2 03:21]] --> B[结论 [P2 04:00]]\n```";
    expect(sanitizeMermaidTimestampCitationsInMarkdown(markdown)).toBe(
      "正文 [BV1TEST P2 03:21]\n```mermaid\ngraph TD\nA[概念] --> B[结论]\n```",
    );

    expect(parseKnowledgeOutput(fixture("knowledge-output.txt"))).toEqual({
      answer: "这是一个基于当前锚点的回答。",
      suggestions: ["这个结论的前提是什么？", "有哪些反例？", "如何应用到实践？"],
    });
    expect(
      knowledgeBranchContext(
        { question: "继续？", answer: "继续回答" },
        [{ question: "起点？", answer: "起点回答" }],
      ),
    ).toBe(
      "1. 问题：起点？\n   回答摘要：起点回答\n" +
        "2. 问题：继续？\n   回答摘要：继续回答",
    );

    const chord = shortcutChordFromEvent({
      code: "Digit1",
      ctrlKey: true,
      altKey: true,
    });
    expect(chord).toBe("Ctrl+Alt+Digit1");
    expect(shortcutDisplayChord(chord)).toBe("Ctrl + Alt + 1");
  });
});
