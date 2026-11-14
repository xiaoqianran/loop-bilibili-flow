import { describe, expect, it } from "vitest";
import { knowledgeNavigation as nav } from "../../apps/userscript/src/ui";

const anchors = [
  { id: "a1", selectedText: "GPT", title: "模型学习", contextText: "LLM context", bvid: "BV1", page: 1 },
  { id: "a2", selectedText: "训练", title: "Transformer", contextText: "机器学习", bvid: "BV2", page: 2 },
  { id: "a3", selectedText: "微调", title: "训练课程", contextText: "扩展", bvid: "BV1", page: 1 },
];
const nodes = [
  { id: "n1", anchorId: "a1", question: "What is context", answer: "tokens", updatedAt: 1 },
  { id: "n2", anchorId: "a1", question: "How many?", answer: "4096", updatedAt: 9 },
  { id: "n3", anchorId: "a2", question: "什么意思", preview: "推理阶段", updatedAt: 3 },
];

describe("Knowledge navigation controller", () => {
  it("finds anchor and node without copying, returning null for unknown IDs", () => {
    expect(nav.anchorById(anchors, "a2")).toBe(anchors[1]);
    expect(nav.nodeById(nodes, "n2")).toBe(nodes[1]);
    expect(nav.nodesForAnchor(nodes, "a1")).toEqual([nodes[0], nodes[1]]);
    expect(nav.anchorById(anchors, "missing")).toBeNull();
    expect(nav.nodeById(nodes, "missing")).toBeNull();
    expect(nav.nodesForAnchor(nodes, "missing")).toEqual([]);
  });
  it("filters case-insensitively across anchor fields, questions, answers and previews", () => {
    expect(nav.filterAnchors(anchors, nodes, "  TRANSFORMER ")).toEqual([anchors[1]]);
    expect(nav.filterAnchors(anchors, nodes, "4096")).toEqual([anchors[0]]);
    expect(nav.filterAnchors(anchors, nodes, "推理")).toEqual([anchors[1]]);
    expect(nav.filterAnchors(anchors, nodes, "训练")).toEqual([anchors[1], anchors[2]]);
    expect(nav.filterAnchors(anchors, nodes, "absent")).toEqual([]);
    expect(nav.filterAnchors(anchors, nodes, "")).toBe(anchors);
  });
  it("keeps a valid selection and falls back to newest node for invalid node IDs", () => {
    expect(nav.resolveSelection(anchors, nodes, "a1", "n1", false)).toEqual({
      anchorId: "a1", nodeId: "n1",
    });
    expect(nav.resolveSelection(anchors, nodes, "a1", "removed", false)).toEqual({
      anchorId: "a1", nodeId: "n2",
    });
    expect(nav.resolveSelection(anchors, nodes, "a3", "", false)).toEqual({
      anchorId: "a3", nodeId: "",
    });
  });
  it("clears hidden selection, defaults desktop to first visible anchor and mobile to empty", () => {
    const visible = [anchors[1]!];
    expect(nav.resolveSelection(visible, nodes, "a1", "n1", false)).toEqual({
      anchorId: "a2", nodeId: "n3",
    });
    expect(nav.resolveSelection(visible, nodes, "a1", "n1", true)).toEqual({
      anchorId: "", nodeId: "",
    });
    expect(nav.resolveSelection([], nodes, "a1", "n1", false)).toEqual({
      anchorId: "", nodeId: "",
    });
  });
  it("groups video sources in first-seen order and retains input anchor identity", () => {
    const groups = nav.groupAnchors(anchors, anchor => anchor.bvid + ":P" + (anchor.page || 1));
    expect(groups.map(group => group.key)).toEqual(["BV1:P1", "BV2:P2"]);
    expect(groups[0]).toMatchObject({ label: "模型学习 · BV1", anchors: [anchors[0], anchors[2]] });
    expect(groups[1]).toMatchObject({ label: "Transformer · BV2 P2", anchors: [anchors[1]] });
    expect(groups[0]?.anchors[0]).toBe(anchors[0]);
    expect(nav.groupAnchors([{ id: "s", sourceKey: "custom", title: "Pinned" }], () => "fallback")[0]?.key)
      .toBe("custom");
  });
});
