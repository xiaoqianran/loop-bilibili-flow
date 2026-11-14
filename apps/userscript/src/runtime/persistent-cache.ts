/** IndexedDB persistence and optional cross-tab invalidation. */
export interface CacheRecord<T = unknown> {
  key: string; value: T; updatedAt: number; expiresAt: number;
}
export interface PersistentCacheOptions {
  databaseName: string; databaseVersion: number; storeName: string; channelName: string;
  indexedDb: () => IDBFactory | undefined;
  broadcastChannel: () => (new (name: string) => BroadcastChannel) | undefined;
  onSubtitleChanged: (key: string) => void;
  now?: () => number;
}
export function createPersistentCache(options: PersistentCacheOptions) {
  let databasePromise: Promise<IDBDatabase> | null = null;
  let channel: BroadcastChannel | null = null;
  const now = options.now || Date.now;
  function open(): Promise<IDBDatabase> {
    if (databasePromise) return databasePromise;
    databasePromise = new Promise<IDBDatabase>((resolve, reject) => {
      const factory = options.indexedDb();
      if (!factory) return reject(new Error("IndexedDB unavailable"));
      const request = factory.open(options.databaseName, options.databaseVersion);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(options.storeName)) {
          db.createObjectStore(options.storeName, { keyPath: "key" });
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error || new Error("cache database open failed"));
    }).catch(error => {
      databasePromise = null;
      throw error;
    });
    return databasePromise;
  }
  async function remove(key: string): Promise<void> {
    try {
      const db = await open();
      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction(options.storeName, "readwrite");
        tx.objectStore(options.storeName).delete(key);
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      });
    } catch {
      // Ignore storage unavailability.
    }
  }
  async function read<T = unknown>(key: string): Promise<CacheRecord<T> | null> {
    try {
      const db = await open();
      const record = await new Promise<CacheRecord<T> | null>((resolve, reject) => {
        const tx = db.transaction(options.storeName, "readonly");
        const req = tx.objectStore(options.storeName).get(key);
        req.onsuccess = () => resolve(req.result || null);
        req.onerror = () => reject(req.error);
      });
      if (!record) return null;
      if (Number(record.expiresAt || 0) < now()) {
        void remove(key);
        return null;
      }
      return record;
    } catch {
      return null;
    }
  }
  async function write<T>(key: string, value: T, ttlMs: number): Promise<CacheRecord<T>> {
    const record = { key, value, updatedAt: now(), expiresAt: now() + ttlMs };
    try {
      const db = await open();
      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction(options.storeName, "readwrite");
        tx.objectStore(options.storeName).put(record);
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      });
      channel?.postMessage({ type: "cache-updated", key, updatedAt: record.updatedAt });
    } catch {
      // Continue with memory cache.
    }
    return record;
  }
  function initChannel(): void {
    if (channel) return;
    try {
      const Constructor = options.broadcastChannel();
      if (!Constructor) return;
      channel = new Constructor(options.channelName);
      channel.addEventListener("message", event => {
        const msg = event.data;
        if (!msg || msg.type !== "cache-updated" || !String(msg.key).startsWith("subtitle:")) return;
        options.onSubtitleChanged(String(msg.key).slice("subtitle:".length));
      });
    } catch {
      // BroadcastChannel is optional.
    }
  }
  return { read, write, remove, initChannel };
}
