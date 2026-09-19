export type PromptStage = "preprocess" | "knowledge" | "postprocess";

export interface PromptProfile {
  id: string;
  stage: PromptStage;
  name: string;
  hint: string;
  systemPrompt: string;
  userPromptTemplate: string;
}

export interface AiProfileDefaults {
  baseUrl: string;
  apiKey: string;
  model: string;
  temperature: number;
  maxTokens: number;
  stream: boolean;
}

export interface AiProfile extends AiProfileDefaults {
  id: string;
  name: string;
  enabled: boolean;
}

export const DEFAULT_AI_PROFILE_DEFAULTS: AiProfileDefaults = {
  baseUrl: "",
  apiKey: "",
  model: "openai/gpt-oss-120b",
  temperature: 0.4,
  maxTokens: 65_536,
  stream: true,
};

export function makePromptProfileId(): string {
  return `prompt-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export function createPromptProfile(
  seed: unknown,
  index = 0,
  createId: () => string = makePromptProfileId,
): PromptProfile {
  const source =
    seed && typeof seed === "object"
      ? (seed as Record<string, unknown>)
      : {};
  const stage: PromptStage =
    source.stage === "preprocess"
      ? "preprocess"
      : source.stage === "knowledge"
        ? "knowledge"
        : "postprocess";
  return {
    id: String(source.id || createId()),
    stage,
    name: String(source.name || `提示词 ${index + 1}`).slice(0, 100),
    hint: String(
      source.hint
        || (stage === "preprocess"
          ? "字幕预处理"
          : stage === "knowledge"
            ? "局部知识追问"
            : "后处理提示词"),
    ).slice(0, 160),
    systemPrompt: String(source.systemPrompt || ""),
    userPromptTemplate: String(source.userPromptTemplate || ""),
  };
}

export function normalizePromptProfiles(
  input: unknown,
  createId: () => string = makePromptProfileId,
): PromptProfile[] {
  return (Array.isArray(input) ? input : [])
    .filter((value) => value && typeof value === "object")
    .map((value, index) => createPromptProfile(value, index, createId));
}

export function resolvePromptActiveIds(
  prompts: readonly PromptProfile[],
  postId: string,
  preId: string,
  knowledgeId: string,
): {
  activeId: string;
  activePreprocessId: string;
  activeKnowledgeId: string;
} {
  const posts = prompts.filter((profile) => profile.stage === "postprocess");
  const preprocess = prompts.filter((profile) => profile.stage === "preprocess");
  const knowledge = prompts.filter((profile) => profile.stage === "knowledge");
  return {
    activeId: posts.some((profile) => profile.id === postId)
      ? postId
      : (posts[0]?.id || ""),
    activePreprocessId: preprocess.some((profile) => profile.id === preId)
      ? preId
      : (preprocess[0]?.id || ""),
    activeKnowledgeId: knowledge.some((profile) => profile.id === knowledgeId)
      ? knowledgeId
      : (knowledge[0]?.id || ""),
  };
}

export function makeAiProfileId(): string {
  return `ai-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export function createAiProfile(
  seed: unknown,
  index = 0,
  defaults: AiProfileDefaults = DEFAULT_AI_PROFILE_DEFAULTS,
  createId: () => string = makeAiProfileId,
): AiProfile {
  const source =
    seed && typeof seed === "object"
      ? (seed as Record<string, unknown>)
      : {};
  const temperature = Number(source.temperature);
  return {
    id: String(source.id || createId()),
    name: String(
      source.name || source.label || source.model || `模型 ${index + 1}`,
    ).slice(0, 80),
    enabled: source.enabled !== false,
    baseUrl: String(source.baseUrl || defaults.baseUrl).trim().replace(/\/+$/, ""),
    apiKey: String(
      source.apiKey != null ? source.apiKey : defaults.apiKey,
    ).trim(),
    model: String(source.model || defaults.model).trim(),
    temperature: Number.isFinite(temperature)
      ? temperature
      : defaults.temperature,
    maxTokens: Math.max(
      256,
      Math.min(
        128_000,
        Math.floor(Number(source.maxTokens) || defaults.maxTokens),
      ),
    ),
    stream: !(
      source.stream === false
      || source.stream === "false"
      || source.stream === 0
    ),
  };
}

export function normalizeAiProfiles(
  input: unknown,
  defaults: AiProfileDefaults = DEFAULT_AI_PROFILE_DEFAULTS,
  createId: () => string = makeAiProfileId,
): AiProfile[] {
  const list = Array.isArray(input) ? input : [];
  const normalized = list
    .filter((value) => value && typeof value === "object")
    .map((value, index) => createAiProfile(value, index, defaults, createId));
  return normalized.length
    ? normalized
    : [createAiProfile(defaults, 0, defaults, createId)];
}
