import type { PlatformBridge } from "../types";
import { createWebPlatformBridge } from "./web";

export const createDesktopPlatformBridge = (): PlatformBridge =>
  createWebPlatformBridge();
