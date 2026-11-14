import { describe, expect, it } from "vitest";
import { knowledge } from "../../apps/userscript/src/app";

describe("Knowledge question-tree context policies", () => {
  const nodes = [
    { id: "root", anchorId: "a", question: "Root", answer: "Base answer", parentId: "" },
    { id: "child", anchorId: "a", question: "Why?", answer: "  Two   reasons \n noted ", parentId: "root" },
    { id: "grand", anchorId: "a", question: "What next?", answer: "", parentId: "child" },
  ];
  it("resolves ancestors in chronological order and retains object identities", () => {
    const chain = knowledge.ancestorNodes(nodes[2], nodes);
    expect(chain).toEqual([nodes[0], nodes[1]]);
    expect(chain[0]).toBe(nodes[0]);
    expect(knowledge.ancestorNodes(nodes[0], nodes)).toEqual([]);
  });
  it("forms bounded branch context and normalizes whitespace in answer summaries", () => {
    expect(knowledge.branchContext(nodes[2], nodes)).toBe(
      "1. 问题：Root\n   回答摘要：Base answer\n"
      + "2. 问题：Why?\n   回答摘要：Two reasons noted\n"
      + "3. 问题：What next?\n   回答摘要：（尚无回答）",
    );
    expect(knowledge.branchContext(null, nodes)).toBe("（这是该锚点下的新分支）");
    expect(knowledge.branchContext({ id: "orphan", parentId: "missing", question: "alone", anchorId: "a", answer: "" }, nodes))
      .toBe("1. 问题：alone\n   回答摘要：（尚无回答）");
  });
  it("limits traversal on cycles and limits prompt context to last six nodes", () => {
    const cycle = [
      { id: "a", parentId: "b", question: "A" },
      { id: "b", parentId: "a", question: "B" },
    ];
    expect(knowledge.ancestorNodes(cycle[0], cycle).length).toBe(2);
    const chain = Array.from({ length: 16 }, (_, i) => ({
      id: String(i), parentId: i ? String(i - 1) : "", question: "Q" + i, answer: "yes",
    }));
    expect(knowledge.ancestorNodes(chain[15], chain).length).toBe(12);
    const context = knowledge.branchContext(chain[15], chain);
    expect(context).toContain("问题：Q15");
    expect(context).not.toContain("问题：Q9");
    expect(context.split("回答摘要：").length - 1).toBe(6);
  });
});
