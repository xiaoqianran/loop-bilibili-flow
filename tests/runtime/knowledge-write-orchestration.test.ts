import { describe, expect, it, vi } from "vitest";
import { knowledge } from "../../apps/userscript/src/app";

describe("Knowledge write/delete transaction-first orchestration", () => {
  it("upserts anchors only after commit and sorts by update time", async () => {
    const old = { id: "old", updatedAt: 4, selectedText: "old" };
    const update = { id: "old", updatedAt: 8, selectedText: "new" };
    const another = { id: "other", updatedAt: 6, selectedText: "other" };
    const anchors = [old, another];
    let resolveCommit!: (value: unknown) => void;
    const wait = new Promise(resolve => { resolveCommit = resolve; });
    const commit = vi.fn(() => wait);
    const saving = knowledge.saveAnchor(anchors, update, commit);
    expect(anchors).toEqual([old, another]);
    resolveCommit(undefined);
    expect(await saving).toBe(update);
    expect(anchors).toEqual([update, another]);
    expect(commit).toHaveBeenCalledOnce();
    const newest = { id: "new", updatedAt: 12, selectedText: "newest" };
    await knowledge.saveAnchor(anchors, newest, async () => {});
    expect(anchors.map(item => item.id)).toEqual(["new", "old", "other"]);
  });

  it("upserts nodes preserving list order and object identity", async () => {
    const old = { id: "1", answer: "old" };
    const next = { id: "1", answer: "new" };
    const nodes = [old];
    expect(await knowledge.saveNode(nodes, next, async () => {})).toBe(next);
    expect(nodes).toEqual([next]);
    const second = { id: "2", answer: "second" };
    await knowledge.saveNode(nodes, second, async () => {});
    expect(nodes).toEqual([next, second]);
  });

  it("does not modify in-memory anchors or nodes if persistence fails", async () => {
    const old = { id: "a", updatedAt: 3 };
    const anchors = [old];
    const nodes = [{ id: "n", anchorId: "a" }];
    const fail = async (): Promise<void> => { throw new Error("disk unavailable"); };
    await expect(knowledge.saveAnchor(anchors, { id: "b", updatedAt: 9 }, fail)).rejects.toThrow("disk unavailable");
    expect(anchors).toEqual([old]);
    await expect(knowledge.saveNode(nodes, { id: "n2", anchorId: "a" }, fail)).rejects.toThrow("disk unavailable");
    expect(nodes).toEqual([{ id: "n", anchorId: "a" }]);
  });

  it("deletes linked nodes only after the repository delete transaction commits", async () => {
    const anchors = [{ id: "a" }, { id: "b" }];
    const nodes = [{ id: "n1", anchorId: "a" }, { id: "n2", anchorId: "b" }, { id: "n3", anchorId: "a" }];
    let resolve!: () => void;
    const gate = new Promise<void>(done => { resolve = done; });
    const persist = vi.fn(() => gate);
    const deleting = knowledge.deleteAnchorCommitted(anchors, nodes, "a", persist);
    expect(anchors).toHaveLength(2);
    expect(nodes).toHaveLength(3);
    resolve();
    expect(await deleting).toEqual({
      anchors: [{ id: "b" }],
      nodes: [{ id: "n2", anchorId: "b" }],
    });
    expect(persist).toHaveBeenCalledExactlyOnceWith("a");
    expect(anchors).toHaveLength(2);
  });

  it("keeps all in-memory records untouched on failed deletion", async () => {
    const anchors = [{ id: "a" }];
    const nodes = [{ id: "n", anchorId: "a" }];
    await expect(knowledge.deleteAnchorCommitted(anchors, nodes, "a", async () => {
      throw new Error("transaction aborted");
    })).rejects.toThrow("transaction aborted");
    expect(anchors).toEqual([{ id: "a" }]);
    expect(nodes).toEqual([{ id: "n", anchorId: "a" }]);
  });
});
