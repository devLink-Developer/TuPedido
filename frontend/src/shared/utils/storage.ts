export function readJsonStorage<T>(storage: Storage, key: string): T | null {
  const raw = storage.getItem(key);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export function writeJsonStorage<T>(storage: Storage, key: string, value: T) {
  storage.setItem(key, JSON.stringify(value));
}

export function removeStorageValue(storage: Storage, key: string) {
  storage.removeItem(key);
}
