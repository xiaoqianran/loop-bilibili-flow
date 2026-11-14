/** Session-only hot cache. Maintains the legacy bsb:v2 storage keys and TTL. */
export function readSessionCache<T>(
  storage: () => Pick<Storage, "getItem" | "removeItem">,
  prefix: string,
  kind: string,
  key: string,
  ttlMs: number,
  now = Date.now(),
): T | null {
  try {
    const fullKey = prefix + kind + ":" + key;
    const raw = storage().getItem(fullKey);
    if (!raw) return null;
    const record = JSON.parse(raw);
    if (!record || now - Number(record.at || 0) > ttlMs) {
      storage().removeItem(fullKey);
      return null;
    }
    return record.value as T;
  } catch {
    return null;
  }
}

export function writeSessionCache(
  storage: () => Pick<Storage, "setItem">,
  prefix: string,
  kind: string,
  key: string,
  value: unknown,
  now = Date.now(),
): void {
  try {
    storage().setItem(prefix + kind + ":" + key, JSON.stringify({ at: now, value }));
  } catch {
    // Storage quota / private mode: the in-memory or IndexedDB cache remains usable.
  }
}
