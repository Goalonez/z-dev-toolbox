import { ToolboxApp } from "@z-dev-toolbox/app-shell";
import { createDesktopPlatformBridge } from "@z-dev-toolbox/platform";
import { createDesktopStorageAdapter } from "@z-dev-toolbox/storage";

const bridge = createDesktopPlatformBridge();
const storage = createDesktopStorageAdapter("z-dev-toolbox:desktop");

export const App = () => (
  <ToolboxApp bridge={bridge} platform="desktop" storage={storage} />
);
