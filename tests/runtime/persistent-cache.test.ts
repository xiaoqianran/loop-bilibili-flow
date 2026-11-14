import { describe, expect, it, vi } from "vitest";
import { createPersistentCache } from "../../apps/userscript/src/runtime/persistent-cache";

function makeFakeDatabase() {
  const records = new Map<string, unknown>();
  const stores = new Set<string>();
  let calls = 0;
  const db = {
    objectStoreNames: { contains: (name: string) => stores.has(name) },
    createObjectStore: (name: string) => { stores.add(name); return {}; },
    transaction: (_name: string, mode: string) => {
      const tx = {
        oncomplete: null as null | (() => void),
        onerror: null as null | (() => void),
        error: null,
        objectStore: () => ({
          get: (key: string) => {
            const req = { result: records.get(key), error: null, onsuccess: null as null | (() => void), onerror: null };
            queueMicrotask(() => req.onsuccess?.());
            return req;
          },
          put: (record: { key: string }) => {
            records.set(record.key, record);
            queueMicrotask(() => tx.oncomplete?.());
          },
          delete: (key: string) => {
            records.delete(key);
            queueMicrotask(() => tx.oncomplete?.());
          },
        }),
      };
      void mode;
      return tx;
    },
  };
  const factory = {
    open: (name: string, version: number) => {
      expect(name).toBe("bili-subbatch-cache-v2");
      expect(version).toBe(1);
      calls++;
      const request = {
        result: db, error: null, onupgradeneeded: null as null | (() => void),
        onsuccess: null as null | (() => void), onerror: null,
      };
      queueMicrotask(() => {
        request.onupgradeneeded?.();
        request.onsuccess?.();
      });
      return request;
    },
  };
  return { records, stores, factory: factory as unknown as IDBFactory, openCalls: () => calls };
}

describe("persistent IndexedDB cache adapter", () => {
  const create = (fixture: ReturnType<typeof makeFakeDatabase>, clock: () => number) =>
    createPersistentCache({
      databaseName: "bili-subbatch-cache-v2", databaseVersion: 1, storeName: "records",
      channelName: "bili-subbatch-cache-v2", indexedDb: () => fixture.factory,
      broadcastChannel: () => undefined, onSubtitleChanged: () => {}, now: clock,
    });

  it("opens once, upgrades the records store and round-trips an expiring value", async () => {
    const fixture = makeFakeDatabase();
    let now = 100;
    const cache = create(fixture, () => now);
    const written = await cache.write("subtitle:test", { text: "hello" }, 200);
    expect(written).toEqual({ key: "subtitle:test", value: { text: "hello" }, updatedAt: 100, expiresAt: 300 });
    expect(fixture.stores.has("records")).toBe(true);
    expect(await cache.read("subtitle:test")).toEqual(written);
    expect(fixture.openCalls()).toBe(1);
    now = 300;
    expect(await cache.read("subtitle:test")).toEqual(written);
    now = 301;
    expect(await cache.read("subtitle:test")).toBeNull();
    await Promise.resolve();
    expect(fixture.records.has("subtitle:test")).toBe(false);
  });

  it("removes stored records and keeps missing records null", async () => {
    const fixture = makeFakeDatabase();
    const cache = create(fixture, () => 5);
    expect(await cache.read("not-found")).toBeNull();
    await cache.write("key", 42, 100);
    await cache.remove("key");
    expect(await cache.read("key")).toBeNull();
  });

  it("gracefully degrades when IndexedDB is unavailable and retries opens", async () => {
    const fixture = makeFakeDatabase();
    let available = false;
    const cache = createPersistentCache({
      databaseName: "bili-subbatch-cache-v2", databaseVersion: 1, storeName: "records",
      channelName: "bili-subbatch-cache-v2",
      indexedDb: () => available ? fixture.factory : undefined,
      broadcastChannel: () => undefined, onSubtitleChanged: () => {}, now: () => 5,
    });
    expect(await cache.read("key")).toBeNull();
    expect(await cache.write("key", 1, 10)).toMatchObject({ key: "key", value: 1 });
    available = true;
    expect(await cache.write("key", 2, 10)).toMatchObject({ value: 2 });
    expect((await cache.read<number>("key"))?.value).toBe(2);
  });

  it("ignores unrelated broadcast events and invalidates subtitle changes only", async () => {
    const invalidated: string[] = [];
    let receiver: ((event: { data: unknown }) => void) | undefined;
    const postMessage = vi.fn();
    const Constructor = class {
      constructor(name: string) { expect(name).toBe("bili-subbatch-cache-v2"); }
      addEventListener(_event: string, callback: (event: { data: unknown }) => void) { receiver = callback; }
      postMessage = postMessage;
    };
    const fixture = makeFakeDatabase();
    const cache = createPersistentCache({
      databaseName: "bili-subbatch-cache-v2", databaseVersion: 1, storeName: "records",
      channelName: "bili-subbatch-cache-v2", indexedDb: () => fixture.factory,
      broadcastChannel: () => Constructor as unknown as new (name: string) => BroadcastChannel,
      onSubtitleChanged: key => invalidated.push(key), now: () => 10,
    });
    cache.initChannel();
    cache.initChannel();
    receiver?.({ data: { type: "cache-updated", key: "subtitle:BV1:1" } });
    receiver?.({ data: { type: "cache-updated", key: "subtitle-track:BV1" } });
    receiver?.({ data: { type: "other", key: "subtitle:BV1:2" } });
    expect(invalidated).toEqual(["BV1:1"]);
    await cache.write("subtitle:BV1:1", "x", 200);
    expect(postMessage).toHaveBeenCalledWith({
      type: "cache-updated", key: "subtitle:BV1:1", updatedAt: 10,
    });
  });
});
