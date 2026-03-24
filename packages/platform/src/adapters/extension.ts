import type { PlatformBridge } from "../types";
import { createWebPlatformBridge } from "./web";

export const createExtensionPlatformBridge = (): PlatformBridge =>
  createWebPlatformBridge();
