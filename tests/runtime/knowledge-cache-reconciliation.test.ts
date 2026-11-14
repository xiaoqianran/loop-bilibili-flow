import { describe, expect, it, vi } from "vitest";
import { knowledge } from "../../apps/userscript/src/app";

describe("Knowledge persistent nodes reconciliation", () => {
  it("sorts anchors by most recent timestamp without modifying the fetched array", () => {
    const input = [{ id: "old", updatedAt: 1 }, { id: "new", updatedAt: 8 }];
    const ordered = knowledge.sortAnchors(input);
    expect(ordered.map(x => x.id)).toEqual(["new", "old"]);
    expect(input[0]!.id).toBe("old");
    expect(knowledge.sortAnchors(null)).toEqual([]);
  });

  it("recovers interrupted stored answers on startup and normalizes preview", () => {
    const nodes = [
      { id: "new", createdAt: 2, status: "running", answer: "", preview: "partial", updatedAt: 2 },
      { id: "old", createdAt: 1, status: "done", answer: "already", preview: "", updatedAt: 1 },
    ];
    const visible = vi.fn((text: string) => text.toUpperCase());
    const result = knowledge.reconcileNodes(nodes, [], false, visible, 100);
    expect(result.nodes.map(x => x.id)).toEqual(["old", "new"]);
    expect(result.recovered).toEqual([{
      id: "new", createdAt: 2, status: "stopped", answer: "PARTIAL",
      preview: "", error: "", updatedAt: 100,
    }]);
    expect(nodes[0]!.status).toBe("running");
    expect(visible).toHaveBeenCalledWith("partial");
  });

  it("preserves live running nodes while a request remains active", () => {
    const stored = [
      { id: "same", createdAt: 2, status: "running", answer: "old", preview: "" },
      { id: "other", createdAt: 1, status: "running", answer: "saved", preview: "" },
    ];
    const active = { id: "same", createdAt: 3, status: "running", answer: "live", preview: "" };
    const visible = vi.fn((text: string) => text);
    const { nodes, recovered } = knowledge.reconcileNodes(stored, [active], true, visible, 100);
    expect(nodes[1]).toBe(active);
    expect(nodes[0]).toBe(stored[1]);
    expect(recovered).toEqual([]);
    expect(visible).not.toHaveBeenCalled();
  });

  it("leaves absent and already completed nodes unchanged", () => {
    expect(knowledge.reconcileNodes(null, null, false, text => text, 1))
      .toEqual({ nodes: [], recovered: [] });
    const node = { id: "done", createdAt: 1, status: "done", answer: "complete" };
    const result = knowledge.reconcileNodes([node], [], false, text => text, 1);
    expect(result.nodes[0]).toBe(node);
    expect(result.recovered).toEqual([]);
  });
});
