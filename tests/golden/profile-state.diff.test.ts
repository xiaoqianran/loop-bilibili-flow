import { describe, expect, it } from "vitest";

import {
  DEFAULT_AI_PROFILE_DEFAULTS,
  createAiProfile,
  createPromptProfile,
  normalizeAiProfiles,
  normalizePromptProfiles,
  resolvePromptActiveIds,
} from "../../packages/core/src/profile-state";
import { legacyFunction } from "./legacy-harness";

type UnknownFunction = (...args: any[]) => any;

const fixedPromptId = () => "prompt-fixed";
const fixedAiId = () => "ai-fixed";

const legacyMakePromptProfileId = () => "prompt-fixed";
const legacyCreatePromptProfile = legacyFunction<UnknownFunction>(
  "createPromptProfile",
  { makePromptProfileId: legacyMakePromptProfileId },
);
const legacyNormalizePromptProfiles = legacyFunction<UnknownFunction>(
  "normalizePromptProfiles",
  { createPromptProfile: legacyCreatePromptProfile },
);
const legacyResolvePromptActiveIds = legacyFunction<UnknownFunction>(
  "resolvePromptActiveIds",
);

const legacyMakeAiProfileId = () => "ai-fixed";
const legacyCreateAiProfile = legacyFunction<UnknownFunction>(
  "createAiProfile",
  {
    makeAiProfileId: legacyMakeAiProfileId,
    AI_DEFAULTS: DEFAULT_AI_PROFILE_DEFAULTS,
  },
);
const legacyNormalizeAiProfiles = legacyFunction<UnknownFunction>(
  "normalizeAiProfiles",
  {
    createAiProfile: legacyCreateAiProfile,
    AI_DEFAULTS: DEFAULT_AI_PROFILE_DEFAULTS,
  },
);

describe("profile state differential (legacy vs core)", () => {
  it("normalizes prompt profiles identically", () => {
    const samples = [
      { id: "p1", stage: "preprocess", name: "PRE", hint: "", systemPrompt: "s", userPromptTemplate: "u" },
      { id: "p2", stage: "knowledge", name: "K", hint: "h" },
      { id: "p3", stage: "other", name: "POST" },
    ];

    for (const [index, sample] of samples.entries()) {
      expect(createPromptProfile(sample, index, fixedPromptId)).toEqual(
        legacyCreatePromptProfile(sample, index),
      );
    }
    expect(normalizePromptProfiles(samples, fixedPromptId)).toEqual(
      legacyNormalizePromptProfiles(samples),
    );
  });

  it("resolves active prompt ids identically", () => {
    const profiles = normalizePromptProfiles(
      [
        { id: "pre", stage: "preprocess" },
        { id: "post", stage: "postprocess" },
        { id: "knowledge", stage: "knowledge" },
      ],
      fixedPromptId,
    );
    expect(resolvePromptActiveIds(profiles, "missing", "pre", "knowledge")).toEqual(
      legacyResolvePromptActiveIds(profiles, "missing", "pre", "knowledge"),
    );
  });

  it("normalizes AI profiles identically", () => {
    const samples = [
      {
        id: "a1",
        name: "Primary",
        enabled: true,
        baseUrl: "https://example.test///",
        apiKey: " key ",
        model: "model-a",
        temperature: 0.7,
        maxTokens: 4096,
        stream: "false",
      },
      { id: "a2", label: "Fallback", enabled: false, maxTokens: 999999 },
    ];

    for (const [index, sample] of samples.entries()) {
      expect(
        createAiProfile(
          sample,
          index,
          DEFAULT_AI_PROFILE_DEFAULTS,
          fixedAiId,
        ),
      ).toEqual(legacyCreateAiProfile(sample, index));
    }
    expect(
      normalizeAiProfiles(
        samples,
        DEFAULT_AI_PROFILE_DEFAULTS,
        fixedAiId,
      ),
    ).toEqual(legacyNormalizeAiProfiles(samples));
  });
});
