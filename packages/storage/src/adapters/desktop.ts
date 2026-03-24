import type { StorageAdapter } from "../types";
import { createWebStorageAdapter } from "./web";

export const createDesktopStorageAdapter = (
  namespace = "z-dev-toolbox",
): StorageAdapter => createWebStorageAdapter(namespace);
