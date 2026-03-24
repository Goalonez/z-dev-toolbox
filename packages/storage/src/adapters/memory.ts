import type { StorageAdapter } from "../types";

export const createMemoryStorageAdapter = (
  namespace = "z-dev-toolbox",
): StorageAdapter => {
  const store = new Map<string, unknown>();

  const toKey = (key: string) => `${namespace}:${key}`;

  return {
    async getItem<T>(key: string) {
      return (store.get(toKey(key)) as T | undefined) ?? null;
    },
    async setItem<T>(key: string, value: T) {
      store.set(toKey(key), value);
    },
    async removeItem(key: string) {
      store.delete(toKey(key));
    }
  };
};
