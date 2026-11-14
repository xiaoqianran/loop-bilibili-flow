import { ai as protocol } from "@subbatch/core";
import type { NetworkAdapter, NetworkRequest } from "@subbatch/runtime";

export interface AiRequestRuntime {
  abort: boolean;
  abortController: AbortController | null;
  xhr?: { abort?(): void } | null;
}

export interface ChatCompletionOptions {
  runtime: AiRequestRuntime;
  network: NetworkAdapter;
  pageHref: string;
  baseUrl: string;
  apiKey: string;
  model: string;
  temperature?: number;
  maxTokens?: number;
  messages: Array<{ role: string; content: string }>;
  stream?: boolean;
  onDelta?(delta: string, full: string, details: AiResponseDetails): void;
  onDone?(full: string, details: AiResponseDetails): void;
  onError?(error: Error): void;
  onStatus?(status: string): void;
}

export interface AiResponseDetails {
  content: string;
  reasoning: string;
  finishReason: string;
  sawDone: boolean;
}

function completionUrl(baseUrl: string): string {
  const base = String(baseUrl || "").trim().replace(/\/+$/, "");
  if (!base) throw new Error("AI Base URL 不能为空");
  const url = new URL(base + "/chat/completions");
  if (url.protocol !== "https:" && url.protocol !== "http:") {
    throw new Error("AI Base URL 仅支持 HTTP(S)");
  }
  return url.href;
}

function transportFor(url: string, pageHref: string): NonNullable<NetworkRequest["transport"]> {
  // Cross-origin AI calls are sent through GM from the beginning. A failed
  // POST must never be replayed on a second transport after ambiguous delivery.
  try {
    return new URL(url).origin === new URL(pageHref).origin ? "page" : "privileged";
  } catch {
    return "privileged";
  }
}

function toError(value: unknown): Error {
  return value instanceof Error ? value : new Error(String(value));
}

interface StreamAccumulator {
  push(chunk: string): void;
  finish(): AiResponseDetails;
  current(): AiResponseDetails;
  hasEvents(): boolean;
}

function streamAccumulator(
  onDelta?: ChatCompletionOptions["onDelta"],
): StreamAccumulator {
  let content = "";
  let reasoning = "";
  let finishReason = "";
  let sawDone = false;
  let foundEvents = false;
  let buffer = "";

  const current = (): AiResponseDetails => ({ content, reasoning, finishReason, sawDone });
  const consumeLine = (line: string): void => {
    const cleaned = line.trim();
    if (cleaned.startsWith("data:")) foundEvents = true;
    const parsed = protocol.parseSseLine(cleaned);
    if (parsed.kind === "error") throw new Error(parsed.message);
    if (parsed.kind === "done") sawDone = true;
    if (parsed.kind !== "delta") return;
    content += parsed.content;
    reasoning += parsed.reasoning;
    if (parsed.finishReason) finishReason = parsed.finishReason;
    if (parsed.content || parsed.reasoning) {
      onDelta?.("", protocol.display(content, reasoning), current());
    }
  };
  return {
    push(chunk) {
      buffer += chunk;
      let newline = buffer.indexOf("\n");
      while (newline !== -1) {
        consumeLine(buffer.slice(0, newline));
        buffer = buffer.slice(newline + 1);
        newline = buffer.indexOf("\n");
      }
    },
    finish() {
      if (buffer.trim()) consumeLine(buffer);
      buffer = "";
      return current();
    },
    current,
    hasEvents: () => foundEvents,
  };
}

function parseJsonResponse(text: string): AiResponseDetails {
  const data = JSON.parse(text) as Record<string, unknown>;
  if (data.error) {
    const error = data.error as { message?: string };
    throw new Error(error?.message || JSON.stringify(data.error));
  }
  const choice = Array.isArray(data.choices) ? data.choices[0] : null;
  const { content, reasoning } = protocol.extractChoice(choice);
  const finishReason =
    choice && typeof choice === "object"
      ? String((choice as { finish_reason?: string }).finish_reason || "")
      : "";
  return { content, reasoning, finishReason, sawDone: false };
}

export function request(options: ChatCompletionOptions): AiRequestRuntime {
  const runtime = options.runtime;
  try { runtime.abortController?.abort(); } catch { /* old operation */ }
  try { runtime.xhr?.abort?.(); } catch { /* legacy operation */ }
  runtime.abortController = null;
  runtime.xhr = null;

  let url: string;
  try {
    url = completionUrl(options.baseUrl);
  } catch (error) {
    options.onError?.(toError(error));
    return runtime;
  }

  const controller = new AbortController();
  runtime.abortController = controller;
  const useStream = options.stream !== false;
  const maxTokens = Math.max(256, Math.min(128000, Math.floor(Number(options.maxTokens) || 8192)));
  const transport = transportFor(url, options.pageHref);
  options.onStatus?.("准备请求 · max_tokens=" + maxTokens);
  options.onStatus?.(transport === "privileged" ? "跨域 GM 单次请求…" : "页内 fetch 请求…");

  const accumulator = streamAccumulator(options.onDelta);
  const payload = {
    model: String(options.model || "").trim(),
    messages: options.messages,
    temperature: options.temperature,
    max_tokens: maxTokens,
    stream: useStream,
  };

  void (async () => {
    let result: AiResponseDetails | null = null;
    try {
      if (runtime.abort) throw new Error("用户停止");
      const response = await options.network.request(url, {
        method: "POST",
        transport,
        fallback: "never",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer " + options.apiKey,
          Accept: useStream ? "text/event-stream, application/json" : "application/json",
        },
        body: JSON.stringify(payload),
        signal: controller.signal,
        stream: useStream,
        ...(useStream ? { onChunk: (text: string) => accumulator.push(text) } : {}),
      });

      if (!response.ok) throw new Error("HTTP " + response.status + ": " + response.text.slice(0, 300));
      if (useStream && accumulator.hasEvents()) {
        result = accumulator.finish();
      } else {
        result = parseJsonResponse(response.text);
        options.onDelta?.("", protocol.display(result.content, result.reasoning), result);
      }
      if (!result.content && !result.reasoning) throw new Error("AI 响应无正文");
      if (result.finishReason === "length") {
        throw new Error("输出达到 max_tokens=" + maxTokens + "，结果已截断");
      }
      if (useStream && accumulator.hasEvents() && !result.sawDone && !result.finishReason) {
        throw new Error("流式连接在 [DONE]/finish_reason 之前中断");
      }
      options.onDone?.(protocol.display(result.content, result.reasoning), result);
    } catch (error) {
      const partial = result || accumulator.current();
      if (runtime.abort || controller.signal.aborted) {
        if (partial.content || partial.reasoning) {
          options.onStatus?.("已停止，保留已接收内容");
          options.onDone?.(protocol.display(partial.content, partial.reasoning), partial);
        } else {
          options.onError?.(new Error("用户停止"));
        }
      } else {
        options.onError?.(toError(error));
      }
    } finally {
      if (runtime.abortController === controller) runtime.abortController = null;
    }
  })();
  return runtime;
}

/** Concurrency-limited application worker pool, used by the PRE pipeline. */
export async function runPool<T>(
  jobs: readonly T[],
  workerCount: number,
  handler: (job: T, workerId: number) => Promise<unknown>,
  isCancelled: () => boolean = () => false,
): Promise<void> {
  let cursor = 0;
  let failed = false;
  async function worker(workerId: number): Promise<void> {
    while (!failed) {
      if (isCancelled()) throw new Error("用户停止");
      const index = cursor++;
      if (index >= jobs.length) return;
      try {
        await handler(jobs[index]!, workerId);
      } catch (error) {
        failed = true;
        throw error;
      }
    }
  }
  const count = Math.min(Math.max(1, Math.floor(workerCount) || 1), Math.max(1, jobs.length));
  const results = await Promise.allSettled(Array.from({ length: count }, (_, i) => worker(i + 1)));
  const failure = results.find((result): result is PromiseRejectedResult => result.status === "rejected");
  if (failure) throw failure.reason;
}
