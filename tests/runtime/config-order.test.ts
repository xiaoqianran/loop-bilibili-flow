import { describe, expect, it } from "vitest";
import { ordering } from "../../apps/userscript/src/app";

describe("Settings and post-task ordering policies", () => {
  it("moves an existing id to the requested position without mutating input", () => {
    const ids = ["a", "b", "c", "d"];
    expect(ordering.reorderIds(ids, "a", "c")).toEqual(["b", "c", "a", "d"]);
    expect(ordering.reorderIds(ids, "d", "b")).toEqual(["a", "d", "b", "c"]);
    expect(ids).toEqual(["a", "b", "c", "d"]);
  });
  it("ignores missing, equal and malformed drag identifiers", () => {
    const ids = ["a", "b", "c"];
    for (const [from, to] of [["a", "a"], ["X", "b"], ["a", "X"], ["", "b"]] as const) {
      expect(ordering.reorderIds(ids, from, to)).toEqual(ids);
    }
    expect(ordering.reorderIds(null, "a", "b")).toEqual([]);
  });
  it("reorders LLM profiles by their identities and keeps omitted profiles in original order", () => {
    const items = [{ id: "a" }, { id: "b" }, { id: "c" }, { id: "d" }];
    expect(ordering.applyConfigIdOrder(items, ["ghost", "c", "a", "a"]))
      .toEqual([items[2], items[0], items[1], items[3]]);
    expect(items.map(item => item.id)).toEqual(["a", "b", "c", "d"]);
    expect(ordering.applyConfigIdOrder([], ["a"])).toEqual([]);
  });
  it("only rearranges the selected prompt stage while retaining other-stage slots", () => {
    const prompts = [
      { id: "pre1", stage: "preprocess" },
      { id: "post1", stage: "postprocess" },
      { id: "pre2", stage: "preprocess" },
      { id: "know", stage: "knowledge" },
      { id: "pre3", stage: "preprocess" },
    ];
    const output = ordering.applyPromptStageOrder(prompts, "preprocess", ["pre3", "post1", "pre1"]);
    expect(output).toEqual([prompts[4], prompts[1], prompts[0], prompts[3], prompts[2]]);
    expect(prompts.map(item => item.id)).toEqual(["pre1", "post1", "pre2", "know", "pre3"]);
  });
  it("ignores cross-stage and duplicate ids in stage ordering", () => {
    const prompts = [
      { id: "a", stage: "preprocess" },
      { id: "b", stage: "postprocess" },
      { id: "c", stage: "preprocess" },
    ];
    expect(ordering.applyPromptStageOrder(prompts, "preprocess", ["b", "c", "c", "missing"]))
      .toEqual([prompts[2], prompts[1], prompts[0]]);
    expect(ordering.applyPromptStageOrder(prompts, "unknown", ["a"])).toEqual(prompts);
  });
});
