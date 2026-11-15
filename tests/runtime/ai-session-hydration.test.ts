import { describe, expect, it } from "vitest";
import { draftHydratedAiRun } from "@subbatch/core";
import { applyRestoredRunOutput, normalizeCachedSessionInput, restorePreprocessRun } from "../../apps/userscript/src/app/ai-session-hydration";

describe("AI session restoration boundaries", () => {
  it("restores PRE text and bounded settings without reviving a running request", () => {
    const run = restorePreprocessRun({
      raw: "normalized transcript", status: "running",
      settings: { concurrency: 100, targetMinutes: 0, overlapSeconds: -2, maxChars: 1, retries: 100 },
    }, { abort: false });
    expect(run).toMatchObject({ raw: "normalized transcript", text: "normalized transcript", status: "done", busy: false });
    expect(run.childRuntimes.size).toBe(0);
    expect(run.settings).toEqual({ concurrency: 8, targetMinutes: 8, overlapSeconds: 0, maxChars: 8000, retries: 4 });
  });

  it("rejects absent or malformed subtitle variables", () => {
    for (const input of [null, [], "bad", {}, { vars: [] }, { vars: { subtitle: 42 } }]) {
      expect(normalizeCachedSessionInput(input)).toBeNull();
    }
  });

  it("retains saved context and detaches editable model and source arrays", () => {
    const modelIds = ["m1"];
    const sourceBvids = ["BVone"];
    const input = {
      sessionId: 9, routeKey: "BVone:P2", vars: { subtitle: "evidence", title: "saved" },
      taskSnapshots: [{ task: { id: "t1", modelIds }, prompt: { id: "post" } }],
      preprocessConfig: { id: "pre-model", apiKey: "" }, preprocessEnabled: true,
      commonMeta: { sourceBvids, readyCount: 1 },
    };
    const result = normalizeCachedSessionInput(input)!;
    expect(result).toMatchObject(input);
    result.taskSnapshots![0]!.task!.modelIds!.push("m2");
    result.commonMeta!.sourceBvids!.push("BVtwo");
    expect(modelIds).toEqual(["m1"]);
    expect(sourceBvids).toEqual(["BVone"]);
  });

  it("discards malformed nested records before cloning a historical session", () => {
    const result = normalizeCachedSessionInput({
      vars: { subtitle: "valid" }, taskSnapshots: [null, 3, { task: { modelIds: "bad" }, prompt: [] }],
      commonMeta: { sourceBvids: ["BVone", 9] }, preprocessConfig: [],
    })!;
    expect(result.taskSnapshots).toEqual([{ task: { modelIds: [] }, prompt: null }]);
    expect(result.commonMeta!.sourceBvids).toEqual(["BVone"]);
    expect(result.preprocessConfig).toBeNull();
  });

  it("restores interrupted output without overwriting live credentials or normalized identities", () => {
    const config = { id: "model", apiKey: "current-key", model: "current-model" };
    const promptProfile = { id: "normalized-prompt" };
    const taskSnapshot = { id: "normalized-task", modelIds: ["model"] };
    const run = { id: "new-session:task:model", profileId: "model", raw: "", config, promptProfile, taskSnapshot };
    const draft = draftHydratedAiRun({
      profileId: "old-model", config: { apiKey: "", model: "old-model" }, promptProfile: null,
      raw: "saved answer", status: "running", sourceBvids: ["BVone"], scrollTop: 120,
    })!;
    expect(applyRestoredRunOutput(run, draft)).toBe(run);
    expect(run).toMatchObject({ id: "new-session:task:model", profileId: "model", raw: "saved answer", status: "done", busy: false, scrollTop: 120 });
    expect(run.config).toBe(config);
    expect(run.promptProfile).toBe(promptProfile);
    expect(run.taskSnapshot).toBe(taskSnapshot);
    draft.sourceBvids.push("BVtwo");
    expect(run).toMatchObject({ sourceBvids: ["BVone"] });
  });
});
