import { afterEach, describe, expect, it, vi } from "vitest";
import { createRepository } from "../../apps/userscript/src/app/knowledge-repository";

afterEach(() => vi.unstubAllGlobals());

describe("Knowledge IndexedDB repository (v1 compatibility)", () => {
  it("opens the historical database with unchanged stores and indexes", async () => {
    const names = new Set<string>();
    const indices: string[] = [];
    const db = {
      objectStoreNames: { contains: (name: string) => names.has(name) },
      createObjectStore(name: string, config: unknown) {
        expect(config).toEqual({ keyPath: "id" });
        names.add(name);
        return { createIndex: (index: string) => { indices.push(name + ":" + index); } };
      },
      close: vi.fn(),
      onversionchange: null as (() => void) | null,
    };
    const factory = {
      open: vi.fn((name: string, version: number) => {
        expect(name).toBe("bili-subbatch-knowledge-v1");
        expect(version).toBe(1);
        const req: Record<string, unknown> = { result: db };
        queueMicrotask(() => {
          (req.onupgradeneeded as () => void)?.();
          (req.onsuccess as () => void)?.();
        });
        return req;
      }),
    };
    const repository = createRepository(factory as unknown as IDBFactory);
    expect(await repository.open()).toBe(db);
    expect(factory.open).toHaveBeenCalledWith("bili-subbatch-knowledge-v1", 1);
    expect(names).toEqual(new Set(["anchors", "nodes"]));
    expect(indices).toEqual([
      "anchors:sourceKey", "anchors:updatedAt",
      "nodes:anchorId", "nodes:parentId", "nodes:updatedAt",
    ]);
    db.onversionchange?.();
    expect(db.close).toHaveBeenCalledOnce();
    await repository.open();
    expect(factory.open).toHaveBeenCalledTimes(2);
  });

  it("deletes all related nodes and the anchor in one readwrite transaction", async () => {
    const operations: string[] = [];
    const txCalls: Array<{ names: string[]; mode: string }> = [];
    const storedNodes = ["n1", "n2"];
    let cursorIndex = 0;
    const req: {
      result: null | { delete(): void; continue(): void };
      onsuccess?: () => void;
      onerror?: () => void;
      error: null;
    } = { result: null, error: null };

    function emitCursor() {
      req.result = cursorIndex < storedNodes.length ? {
        delete() { operations.push("node:" + storedNodes[cursorIndex]); },
        continue() { cursorIndex += 1; queueMicrotask(emitCursor); },
      } : null;
      req.onsuccess?.();
    }

    const db = {
      close: vi.fn(),
      objectStoreNames: { contains: () => true },
      transaction(names: string[], mode: string) {
        txCalls.push({ names, mode });
        const tx = {
          error: null,
          oncomplete: null as (() => void) | null,
          onerror: null,
          onabort: null,
          objectStore(name: string) {
            if (name === "nodes") {
              return { index: () => ({
                openCursor: (range: string) => {
                  expect(range).toBe("anchorId:test");
                  queueMicrotask(emitCursor);
                  return req;
                },
              }) };
            }
            return { delete: (id: string) => { operations.push("anchor:" + id); } };
          },
        };
        setTimeout(() => tx.oncomplete?.(), 0);
        return tx;
      },
    };
    const factory = {
      open() {
        const openReq: Record<string, unknown> = { result: db };
        queueMicrotask(() => (openReq.onsuccess as () => void)?.());
        return openReq;
      },
    };
    vi.stubGlobal("IDBKeyRange", { only: (id: string) => "anchorId:" + id });
    await createRepository(factory as unknown as IDBFactory).deleteAnchor("test");
    expect(txCalls).toEqual([{ names: ["anchors", "nodes"], mode: "readwrite" }]);
    expect(operations).toContain("anchor:test");
    expect(operations).toContain("node:n1");
    expect(operations).toContain("node:n2");
  });
});
