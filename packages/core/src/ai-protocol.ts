export const DEFAULT_AI_INPUT_MAX_CHARS = 160_000;

export type AssistantText = {
  content: string;
  reasoning: string;
};

export type AiSseLine =
  | { kind: "skip" }
  | { kind: "done" }
  | { kind: "error"; message: string }
  | {
      kind: "delta";
      content: string;
      reasoning: string;
      finishReason: string;
      usage: unknown;
    };

export function extractAssistantText(piece: unknown): AssistantText {
  if (!piece || typeof piece !== "object") {
    return { content: "", reasoning: "" };
  }
  const value = piece as Record<string, unknown>;
  const content =
    (typeof value.content === "string" && value.content)
    || (typeof value.text === "string" && value.text)
    || "";
  const reasoning =
    (typeof value.reasoning_content === "string" && value.reasoning_content)
    || (typeof value.reasoning === "string" && value.reasoning)
    || "";
  return { content, reasoning };
}

export function extractFromChoice(choice: unknown): AssistantText {
  if (!choice || typeof choice !== "object") {
    return { content: "", reasoning: "" };
  }
  const value = choice as Record<string, unknown>;
  const fromDelta = extractAssistantText(value.delta);
  const fromMessage = extractAssistantText(value.message);
  return {
    content: fromDelta.content || fromMessage.content || "",
    reasoning: fromDelta.reasoning || fromMessage.reasoning || "",
  };
}

export function formatAiDisplay(content: unknown, reasoning: unknown): string {
  const body = String(content || "");
  if (body.trim()) return body;
  // Never expose provider reasoning / chain-of-thought in the UI.
  return reasoning && String(reasoning).trim() ? "正在分析字幕并组织笔记…" : "";
}

export function truncateForAi(
  text: unknown,
  maxChars: number | null | undefined = DEFAULT_AI_INPUT_MAX_CHARS,
): { text: string; truncated: boolean; originalLen: number } {
  const source = String(text || "");
  const limit = maxChars == null
    ? DEFAULT_AI_INPUT_MAX_CHARS
    : Math.max(4_000, Number(maxChars));
  if (source.length <= limit) {
    return { text: source, truncated: false, originalLen: source.length };
  }

  const markerBudget = 420;
  const usable = Math.max(3_000, limit - markerBudget);
  const headLen = Math.floor(usable * 0.44);
  const tailLen = Math.floor(usable * 0.24);
  const middleBudget = usable - headLen - tailLen;
  const windows = 3;
  const windowLen = Math.floor(middleBudget / windows);
  const middleStart = headLen;
  const middleEnd = source.length - tailLen;
  const span = Math.max(1, middleEnd - middleStart - windowLen);
  const parts = [source.slice(0, headLen).replace(/[^\n]*$/, "")];

  for (let index = 0; index < windows; index += 1) {
    const at =
      middleStart + Math.floor((span * (index + 1)) / (windows + 1));
    let piece = source.slice(at, at + windowLen);
    piece = piece.replace(/^[^\n]*\n?/, "").replace(/[^\n]*$/, "");
    parts.push(`\n…[中段采样 ${index + 1}/${windows}]…\n${piece}`);
  }

  parts.push(
    `\n…[省略 ${source.length - usable} 字；保留结尾]…\n${source
      .slice(-tailLen)
      .replace(/^[^\n]*\n?/, "")}`,
  );
  return {
    text: parts.join(""),
    truncated: true,
    originalLen: source.length,
  };
}

export function parseSseDataLine(line: unknown): AiSseLine {
  const text = String(line || "").trim();
  if (!text || text.startsWith(":") || !text.startsWith("data:")) {
    return { kind: "skip" };
  }
  const data = text.slice(5).trim();
  if (!data) return { kind: "skip" };
  if (data === "[DONE]") return { kind: "done" };

  try {
    const payload = JSON.parse(data) as Record<string, unknown>;
    if (payload.error) {
      const error =
        payload.error && typeof payload.error === "object"
          ? (payload.error as Record<string, unknown>)
          : null;
      return {
        kind: "error",
        message:
          (typeof error?.message === "string" && error.message)
          || JSON.stringify(payload.error),
      };
    }

    const choices = Array.isArray(payload.choices) ? payload.choices : [];
    const choice = choices[0];
    const piece = extractFromChoice(choice);
    const finishReason =
      choice && typeof choice === "object"
        ? String((choice as Record<string, unknown>).finish_reason || "")
        : "";

    return {
      kind: "delta",
      ...piece,
      finishReason,
      usage: payload.usage || null,
    };
  } catch {
    return { kind: "skip" };
  }
}
