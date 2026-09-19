import { describe, expect, it } from "vitest";

import {
  extractAssistantText,
  extractFromChoice,
  formatAiDisplay,
  parseSseDataLine,
  truncateForAi,
} from "../../packages/core/src/ai-protocol";
import { legacyFunction } from "./legacy-harness";

type UnknownFunction = (...args: any[]) => any;

const legacyExtractAssistantText =
  legacyFunction<UnknownFunction>("extractAssistantText");
const legacyExtractFromChoice =
  legacyFunction<UnknownFunction>("extractFromChoice", {
    extractAssistantText: legacyExtractAssistantText,
  });
const legacyFormatAiDisplay =
  legacyFunction<UnknownFunction>("formatAiDisplay");
const legacyTruncateForAi =
  legacyFunction<UnknownFunction>("truncateForAi", {
    MAX_SUBTITLE_CHARS: 160_000,
  });
const legacyParseSseDataLine =
  legacyFunction<UnknownFunction>("parseSseDataLine", {
    extractFromChoice: legacyExtractFromChoice,
  });

describe("AI protocol differential (legacy vs core)", () => {
  it("extracts assistant content and reasoning identically", () => {
    for (const sample of [
      null,
      {},
      { content: "answer", reasoning_content: "hidden" },
      { text: "fallback", reasoning: "trace" },
    ]) {
      expect(extractAssistantText(sample)).toEqual(
        legacyExtractAssistantText(sample),
      );
    }

    const choice = {
      delta: { content: "stream", reasoning_content: "r1" },
      message: { content: "message", reasoning: "r2" },
    };
    expect(extractFromChoice(choice)).toEqual(legacyExtractFromChoice(choice));
  });

  it("keeps display behavior without exposing reasoning", () => {
    for (const [content, reasoning] of [
      ["answer", "hidden"],
      ["", "hidden"],
      ["", ""],
    ]) {
      expect(formatAiDisplay(content, reasoning)).toBe(
        legacyFormatAiDisplay(content, reasoning),
      );
    }
  });

  it("truncates long AI input identically", () => {
    const source = Array.from(
      { length: 2_000 },
      (_, index) => `line-${index.toString().padStart(4, "0")} content`,
    ).join("\n");

    expect(truncateForAi(source, 8_000)).toEqual(
      legacyTruncateForAi(source, 8_000),
    );
    expect(truncateForAi("short", 8_000)).toEqual(
      legacyTruncateForAi("short", 8_000),
    );
  });

  it("parses OpenAI-compatible SSE lines identically", () => {
    const lines = [
      "",
      ": keepalive",
      "data: [DONE]",
      'data: {"choices":[{"delta":{"content":"hello","reasoning_content":"r"},"finish_reason":null}]}',
      'data: {"error":{"message":"bad request"}}',
      "data: not-json",
    ];

    for (const line of lines) {
      expect(parseSseDataLine(line)).toEqual(legacyParseSseDataLine(line));
    }
  });
});
