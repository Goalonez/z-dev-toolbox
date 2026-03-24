import { useEffect } from "react";

import { ToolboxApp } from "@z-dev-toolbox/app-shell";
import { createExtensionPlatformBridge } from "@z-dev-toolbox/platform";
import { createExtensionStorageAdapter } from "@z-dev-toolbox/storage";

const bridge = createExtensionPlatformBridge();
const storage = createExtensionStorageAdapter("z-dev-toolbox:extension");
const EXTENSION_PAGE_TITLE = "Z Dev Toolbox";

export const ExtensionApp = () => {
  useEffect(() => {
    document.title = EXTENSION_PAGE_TITLE;
  }, []);

  return <ToolboxApp bridge={bridge} platform="extension" storage={storage} />;
};
