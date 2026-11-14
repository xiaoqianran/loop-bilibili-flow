/** IndexedDB port with transaction-complete semantics and version-change recovery. */
export interface KnowledgeDbOptions {
  name: string;
  version: number;
  anchorStore: string;
  nodeStore: string;
}

export interface KnowledgeDbRepository {
  open(): Promise<IDBDatabase>;
  request<T>(store: string, mode: IDBTransactionMode, handler: (store: IDBObjectStore) => IDBRequest<T> | T): Promise<T>;
  deleteAnchor(anchorId: string): Promise<void>;
}

export function createKnowledgeDb(
  factory: IDBFactory,
  settings: KnowledgeDbOptions,
): KnowledgeDbRepository {
  let pending: Promise<IDBDatabase> | null = null;

  function open(): Promise<IDBDatabase> {
    if (pending) return pending;
    pending = new Promise<IDBDatabase>((resolve, reject) => {
      if (!factory) { reject(new Error("IndexedDB unavailable")); return; }
      const req = factory.open(settings.name, settings.version);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(settings.anchorStore)) {
          const store = db.createObjectStore(settings.anchorStore, { keyPath: "id" });
          store.createIndex("sourceKey", "sourceKey", { unique: false });
          store.createIndex("updatedAt", "updatedAt", { unique: false });
        }
        if (!db.objectStoreNames.contains(settings.nodeStore)) {
          const store = db.createObjectStore(settings.nodeStore, { keyPath: "id" });
          store.createIndex("anchorId", "anchorId", { unique: false });
          store.createIndex("parentId", "parentId", { unique: false });
          store.createIndex("updatedAt", "updatedAt", { unique: false });
        }
      };
      req.onblocked = () => reject(new Error("Knowledge 数据库升级被其他标签页阻塞"));
      req.onerror = () => reject(req.error || new Error("Knowledge DB open failed"));
      req.onsuccess = () => {
        const db = req.result;
        db.onversionchange = () => {
          db.close();
          pending = null;
        };
        resolve(db);
      };
    }).catch((error) => {
      pending = null;
      throw error;
    });
    return pending;
  }

  async function request<T>(
    storeName: string,
    mode: IDBTransactionMode,
    handler: (store: IDBObjectStore) => IDBRequest<T> | T,
  ): Promise<T> {
    const db = await open();
    return new Promise<T>((resolve, reject) => {
      let tx: IDBTransaction;
      try { tx = db.transaction(storeName, mode); }
      catch (error) { reject(error); return; }
      let value: T;
      let settled = false;
      const rejectOnce = (error: unknown) => {
        if (settled) return;
        settled = true;
        reject(error || tx.error || new Error("Knowledge transaction failed"));
      };
      tx.oncomplete = () => {
        if (settled) return;
        settled = true;
        resolve(value);
      };
      tx.onerror = () => rejectOnce(tx.error);
      tx.onabort = () => rejectOnce(tx.error || new Error("Knowledge transaction aborted"));
      try {
        const result = handler(tx.objectStore(storeName));
        if (result && typeof result === "object" && "onsuccess" in result) {
          const req = result as IDBRequest<T>;
          req.onsuccess = () => { value = req.result; };
          req.onerror = () => rejectOnce(req.error);
        } else {
          value = result as T;
        }
      } catch (error) {
        try { tx.abort(); } catch { /* no active transaction */ }
        rejectOnce(error);
      }
    });
  }

  async function deleteAnchor(anchorId: string): Promise<void> {
    const db = await open();
    await new Promise<void>((resolve, reject) => {
      let tx: IDBTransaction;
      try { tx = db.transaction([settings.anchorStore, settings.nodeStore], "readwrite"); }
      catch (error) { reject(error); return; }
      let settled = false;
      const rejectOnce = (error: unknown) => {
        if (settled) return;
        settled = true;
        reject(error || tx.error || new Error("Knowledge delete failed"));
      };
      tx.oncomplete = () => {
        if (settled) return;
        settled = true;
        resolve();
      };
      tx.onerror = () => rejectOnce(tx.error);
      tx.onabort = () => rejectOnce(tx.error || new Error("Knowledge delete aborted"));

      try {
        // All matching nodes are deleted inside the SAME readwrite transaction.
        // Do not rely on state.knowledgeNodes, which can be only partly loaded.
        const nodes = tx.objectStore(settings.nodeStore).index("anchorId");
        const cursorRequest = nodes.openCursor(IDBKeyRange.only(anchorId));
        cursorRequest.onsuccess = () => {
          const cursor = cursorRequest.result;
          if (!cursor) return;
          cursor.delete();
          cursor.continue();
        };
        cursorRequest.onerror = () => rejectOnce(cursorRequest.error);
        tx.objectStore(settings.anchorStore).delete(anchorId);
      } catch (error) {
        try { tx.abort(); } catch { /* no active transaction */ }
        rejectOnce(error);
      }
    });
  }

  return { open, request, deleteAnchor };
}
