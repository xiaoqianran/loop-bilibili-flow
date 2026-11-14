import { describe, expect, it, vi } from "vitest";
import { ai } from "../../apps/userscript/src/app";

describe("AI batch prepared input migration", () => {
  it("keeps request variables and session metadata aligned with normalized subtitle input", () => {
    const ready = [
      { bvid: "BVfirst", title: "First", author: "UP" },
      { bvid: "BVsecond", title: "Second", author: "Other" },
    ];
    const truncate = vi.fn((text: string) => ({ text: text.slice(0, 4), truncated: true }));
    const result = ai.prepareBatchInput(ready, "raw complete", "processed complete", true, truncate, "PRE Prompt", "Model Label");
    expect(truncate).toHaveBeenCalledExactlyOnceWith("processed complete");
    expect(result.vars).toEqual({
      title: "First / Second", bvid: "BVfirst, BVsecond", author: "UP",
      subtitle: "proc", rawSubtitle: "raw complete", processedSubtitle: "processed complete",
    });
    expect(result.commonMeta).toEqual({
      sourceBvids: ["BVfirst", "BVsecond"], truncated: true, readyCount: 2,
      preprocessEnabled: true, preprocessPromptName: "PRE Prompt", preprocessModelName: "Model Label",
    });
  });

  it("preserves raw subtitle mode and absent-title defaults", () => {
    const result = ai.prepareBatchInput([{ bvid: "BVfirst" }], "raw", "raw", false,
      text => ({ text, truncated: false }), "", "");
    expect(result.vars).toMatchObject({
      title: "", author: "", bvid: "BVfirst", subtitle: "raw",
      processedSubtitle: "", rawSubtitle: "raw",
    });
    expect(result.commonMeta.preprocessEnabled).toBe(false);
  });

  it("hydrates only matching cached runs, and schedules missing tasks in source order", () => {
    const runs = [
      { id: "r1", taskId: "t1", profileId: "p1", status: "queued" },
      { id: "r2", taskId: "t1", profileId: "p2", status: "queued" },
      { id: "r3", taskId: "t2", profileId: "p3", status: "queued" },
    ];
    const draft = vi.fn((cached: { raw: string }) => ({ status: "done", raw: cached.raw }));
    const result = ai.hydratePlannedRuns(runs, {
      reuse: [
        { plan: { taskId: "t1", profileId: "p1" }, cached: { raw: "answer" } },
        { plan: { taskId: "missing", profileId: "p1" }, cached: { raw: "absent" } },
      ],
      generate: [
        { taskId: "t2", profileId: "p3" },
        { taskId: "missing", profileId: "p1" },
        { taskId: "t1", profileId: "p2" },
      ],
    }, ["BVfirst"], draft);
    expect(result).toEqual({ reused: 1, generateIds: ["r3", "r2"] });
    expect(runs[0]).toMatchObject({ raw: "answer", status: "done", sourceBvids: ["BVfirst"] });
    expect(runs[1]!.status).toBe("queued");
    expect(draft).toHaveBeenCalledTimes(1);
  });

  it("retains generation when cache draft is unavailable", () => {
    const runs = [{ id: "r1", taskId: "t1", profileId: "p1" }];
    expect(ai.hydratePlannedRuns(runs, {
      reuse: [{ plan: { taskId: "t1", profileId: "p1" }, cached: "missing" }],
      generate: [],
    }, [], () => null)).toEqual({ reused: 0, generateIds: [] });
  });
});
