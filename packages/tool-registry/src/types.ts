import type { ComponentType } from "react";

import type { PlatformBridge } from "@z-dev-toolbox/platform";
import type { Locale, ToolManifest, ToolPlatform } from "@z-dev-toolbox/shared";
import type { StorageAdapter } from "@z-dev-toolbox/storage";

export interface ToolPanelNotification {
  tone: "success" | "error" | "muted";
  text: string;
}

export interface ToolPanelProps {
  platform: ToolPlatform;
  bridge: PlatformBridge;
  storage: StorageAdapter;
  locale: Locale;
  autoCopyOnSuccess: boolean;
  notify: (notification: ToolPanelNotification) => void;
}

export interface ToolRegistryEntry {
  manifest: ToolManifest;
  Panel: ComponentType<ToolPanelProps>;
}
