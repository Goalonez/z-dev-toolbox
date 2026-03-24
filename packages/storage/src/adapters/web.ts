import type { StorageAdapter } from "../types";

const resolveLocalStorage = (): Storage | null => {
  if (typeof globalThis === "undefined" || !("localStorage" in globalThis)) {
    return null;
  }

  return globalThis.localStorage;
};

export const createWebStorageAdapter = (
  namespace = "z-dev-toolbox",
): StorageAdapter => {
  const localStorage = resolveLocalStorage();
  const keyOf = (key: string) => `${namespace}:${key}`;

  return {
    async getItem<T>(key: string) {
      const raw = localStorage?.getItem(keyOf(key));

      if (!raw) {
        return null;
      }

      try {
        return JSON.parse(raw) as T;
      } catch {
        return null;
      }
    },
    async setItem<T>(key: string, value: T) {
      localStorage?.setItem(keyOf(key), JSON.stringify(value));
    },
    async removeItem(key: string) {
      localStorage?.removeItem(keyOf(key));
    }
  };
};
