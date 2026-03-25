import { ToolboxApp } from "@z-dev-toolbox/app-shell";
import { createDesktopStorageAdapter } from "@z-dev-toolbox/storage";

import { createDesktopPlatformBridge } from "./platform-bridge";

const bridge = createDesktopPlatformBridge();
const storage = createDesktopStorageAdapter("z-dev-toolbox:desktop");

export const App = () => (
  <ToolboxApp bridge={bridge} platform="desktop" storage={storage} />
);
