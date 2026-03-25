import type { PlatformBridge } from "../types";

const UNSUPPORTED_VERSION = "unsupported";

const ensureClipboard = () => {
  if (!globalThis.navigator?.clipboard) {
    throw new Error("当前环境不支持剪贴板访问。");
  }

  return globalThis.navigator.clipboard;
};

export const createWebPlatformBridge = (): PlatformBridge => ({
  async copyText(text: string) {
    await ensureClipboard().writeText(text);
  },
  async readText() {
    return await ensureClipboard().readText();
  },
  async saveTextFile(filename: string, content: string) {
    const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");

    anchor.href = url;
    anchor.download = filename;
    anchor.click();

    URL.revokeObjectURL(url);
  },
  async getAppVersion() {
    return UNSUPPORTED_VERSION;
  },
  async checkForAppUpdate() {
    return {
      status: "unsupported",
      currentVersion: UNSUPPORTED_VERSION,
      update: null,
    };
  },
  async installAppUpdate() {
    throw new Error("当前环境不支持应用更新。");
  }
});
