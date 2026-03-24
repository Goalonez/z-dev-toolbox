import { ToolboxApp } from "@z-dev-toolbox/app-shell";
import { createWebPlatformBridge } from "@z-dev-toolbox/platform";
import { createWebStorageAdapter } from "@z-dev-toolbox/storage";

const bridge = createWebPlatformBridge();
const storage = createWebStorageAdapter("z-dev-toolbox:web");

export const App = () => (
  <ToolboxApp bridge={bridge} platform="web" storage={storage} />
);
