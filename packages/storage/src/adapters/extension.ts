import type { StorageAdapter } from "../types";
import { createWebStorageAdapter } from "./web";

type ChromeLike = {
  runtime?: {
    lastError?: {
      message?: string;
    };
  };
  storage?: {
    local?: {
      get: (key: string, callback: (items: Record<string, unknown>) => void) => void;
      set: (items: Record<string, unknown>, callback?: () => void) => void;
      remove: (key: string, callback?: () => void) => void;
    };
  };
};

const rejectLastError = (chromeLike: ChromeLike, reject: (error: Error) => void) => {
  const message = chromeLike.runtime?.lastError?.message;

  if (message) {
    reject(new Error(message));
    return true;
  }

  return false;
};

export const createExtensionStorageAdapter = (
  namespace = "z-dev-toolbox",
): StorageAdapter => {
  const fallback = createWebStorageAdapter(namespace);
  const chromeLike = (globalThis as { chrome?: ChromeLike }).chrome ?? {};
  const extensionStorage = chromeLike?.storage?.local;

  if (!extensionStorage) {
    return fallback;
  }

  const keyOf = (key: string) => `${namespace}:${key}`;

  return {
    async getItem<T>(key: string) {
      return await new Promise<T | null>((resolve, reject) => {
        extensionStorage.get(keyOf(key), (items) => {
          if (rejectLastError(chromeLike, reject)) {
            return;
          }

          resolve((items?.[keyOf(key)] as T | undefined) ?? null);
        });
      });
    },
    async setItem<T>(key: string, value: T) {
      await new Promise<void>((resolve, reject) => {
        extensionStorage.set({ [keyOf(key)]: value }, () => {
          if (rejectLastError(chromeLike, reject)) {
            return;
          }

          resolve();
        });
      });
    },
    async removeItem(key: string) {
      await new Promise<void>((resolve, reject) => {
        extensionStorage.remove(keyOf(key), () => {
          if (rejectLastError(chromeLike, reject)) {
            return;
          }

          resolve();
        });
      });
    }
  };
};
