export function stripMermaidTimestampCitations(code: string): string {
  return String(code || "")
    .replace(
      /[ \t]*\[\s*(?:BV(?:号|[A-Za-z0-9]+)?\s+)?P(?:号|\d+)\s+(?:mm:ss|\d{1,2}:\d{2}(?::\d{2})?)\s*\]/gi,
      "",
    )
    .replace(
      /[ \t]*\[\s*BV(?:号|[A-Za-z0-9]+)?\s+(?:mm:ss|\d{1,2}:\d{2}(?::\d{2})?)\s*\]/gi,
      "",
    )
    .replace(/[ \t]+(?=\r?\n|$)/g, "")
    .trim();
}

export function sanitizeMermaidTimestampCitationsInMarkdown(
  markdown: string,
): string {
  return String(markdown || "").replace(
    /```mermaid\s*\r?\n([\s\S]*?)```/gi,
    (_, code: string) =>
      `\`\`\`mermaid\n${stripMermaidTimestampCitations(code)}\n\`\`\``,
  );
}

export type MermaidRepairModel = {
  id?: string;
  name?: string;
  baseUrl?: string;
  model?: string;
  apiKey?: string;
  temperature?: number;
  maxTokens?: number;
  stream?: boolean;
  enabled?: boolean;
};

export type MermaidRepairMissing = "apiKey" | "baseUrl" | "model";

export type MermaidRepairResolution = {
  config: MermaidRepairModel | null;
  source: "run" | "profile" | "fallback" | "none";
  missing: MermaidRepairMissing[];
  readyProfiles: MermaidRepairModel[];
};

function mermaidField(value: unknown): string {
  return String(value ?? "").trim();
}

function isReadyMermaidModel(model: MermaidRepairModel | null | undefined): boolean {
  return !!(mermaidField(model?.apiKey) && mermaidField(model?.baseUrl) && mermaidField(model?.model));
}

function mergeMermaidRepairModel(
  base: MermaidRepairModel | null | undefined,
  fill: MermaidRepairModel | null | undefined,
): MermaidRepairModel {
  const next: MermaidRepairModel = {};
  const id = mermaidField(base?.id) || mermaidField(fill?.id);
  const name = mermaidField(base?.name) || mermaidField(fill?.name);
  const baseUrl = mermaidField(base?.baseUrl) || mermaidField(fill?.baseUrl);
  const model = mermaidField(base?.model) || mermaidField(fill?.model);
  const apiKey = mermaidField(base?.apiKey) || mermaidField(fill?.apiKey);
  if (id) next.id = id;
  if (name) next.name = name;
  if (baseUrl) next.baseUrl = baseUrl;
  if (model) next.model = model;
  if (apiKey) next.apiKey = apiKey;
  const temperature = base?.temperature ?? fill?.temperature;
  if (temperature !== undefined && Number.isFinite(Number(temperature))) {
    next.temperature = Number(temperature);
  }
  const maxTokens = base?.maxTokens ?? fill?.maxTokens;
  if (maxTokens !== undefined && Number.isFinite(Number(maxTokens))) {
    next.maxTokens = Number(maxTokens);
  }
  const stream = base?.stream ?? fill?.stream;
  if (stream !== undefined) next.stream = !!stream;
  return next;
}

function missingMermaidFields(model: MermaidRepairModel | null | undefined): MermaidRepairMissing[] {
  const missing: MermaidRepairMissing[] = [];
  if (!mermaidField(model?.apiKey)) missing.push("apiKey");
  if (!mermaidField(model?.baseUrl)) missing.push("baseUrl");
  if (!mermaidField(model?.model)) missing.push("model");
  return missing;
}

/**
 * Session cache strips apiKey. Repair must refill from live LLM profiles
 * (same profileId first, then any ready model) instead of sending the user
 * to hunt Settings.
 */
export function resolveMermaidRepairConfig(input: {
  runConfig?: MermaidRepairModel | null;
  profileId?: string | null;
  profiles?: Array<MermaidRepairModel | null | undefined> | null;
  preferredProfileId?: string | null;
} = {}): MermaidRepairResolution {
  const profiles = (input.profiles || []).filter(
    (item): item is MermaidRepairModel => !!item && typeof item === "object",
  );
  const enabledReady = profiles.filter((item) => item.enabled !== false && isReadyMermaidModel(item));
  const anyReady = profiles.filter((item) => isReadyMermaidModel(item));
  const readyProfiles = enabledReady.length ? enabledReady : anyReady;

  const run = input.runConfig && typeof input.runConfig === "object" ? input.runConfig : null;
  const profileId = mermaidField(input.profileId) || mermaidField(run?.id);
  const preferredId = mermaidField(input.preferredProfileId);
  const matched =
    (preferredId && profiles.find((item) => item.id === preferredId))
    || (profileId && profiles.find((item) => item.id === profileId))
    || null;

  let merged = mergeMermaidRepairModel(run, matched);
  let source: MermaidRepairResolution["source"] = "none";
  if (isReadyMermaidModel(merged)) {
    source = mermaidField(run?.apiKey) ? "run" : matched ? "profile" : "run";
  } else if (readyProfiles[0]) {
    const preferred = preferredId
      ? readyProfiles.find((item) => item.id === preferredId)
      : undefined;
    merged = mergeMermaidRepairModel(preferred || readyProfiles[0], null);
    source = "fallback";
  }

  const missing = missingMermaidFields(merged);
  if (missing.length) {
    return { config: Object.keys(merged).length ? merged : null, source: "none", missing, readyProfiles };
  }
  return { config: merged, source, missing: [], readyProfiles };
}

export function mermaidRepairSetupHint(missing: MermaidRepairMissing[] | null | undefined): string {
  const list = Array.isArray(missing) ? missing : [];
  if (list.includes("apiKey") && (list.includes("baseUrl") || list.includes("model"))) {
    return "还没有可用的 LLM。在这张图里填写 Base URL / API Key / Model，或打开 设置 → LLM。";
  }
  if (list.includes("apiKey")) return "这个模型还没有 API Key。在这张图里填写，或打开 设置 → LLM。";
  if (list.includes("baseUrl")) return "这个模型还没有 Base URL。在这张图里填写，或打开 设置 → LLM。";
  if (list.includes("model")) return "这个模型还没有 Model 名。在这张图里填写，或打开 设置 → LLM。";
  return "还没有可用的 LLM。打开 设置 → LLM 配好后再重绘。";
}

export function replaceMermaidBlockAt(
  markdown: string,
  targetIdx: number,
  nextCode: string,
): { value: string; replaced: boolean } {
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

