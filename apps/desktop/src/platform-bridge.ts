import { getVersion } from "@tauri-apps/api/app";
import { relaunch } from "@tauri-apps/plugin-process";
import { check, type Update } from "@tauri-apps/plugin-updater";
import {
  createWebPlatformBridge,
  type AppUpdateCheckResult,
  type AppUpdateInfo,
  type PlatformBridge,
} from "@z-dev-toolbox/platform";

const DEFAULT_TIMEOUT_MS = 8000;

const readErrorMessage = (error: unknown) => {
  if (error instanceof Error) {
    return error.message;
  }

  return String(error);
};

const isUpdaterUnsupported = (message: string) => {
  const normalized = message.toLowerCase();

  return [
    "plugin updater not found",
    "plugin not found",
    "unknown ipc command",
    "plugin:updater|check not allowed",
    "plugin:updater|download_and_install not allowed",
    "current build does not enable app updates",
    "updater is not configured",
  ].some((pattern) => normalized.includes(pattern));
};

const isOfflineError = (message: string) => {
  const normalized = message.toLowerCase();

  return [
    "dns error",
    "network",
    "timed out",
    "timeout",
    "connection refused",
    "connection reset",
    "error sending request",
    "failed to send request",
    "tcp connect error",
    "unreachable",
    "temporary failure",
  ].some((pattern) => normalized.includes(pattern));
};

const toUpdateInfo = (update: Update): AppUpdateInfo => ({
  currentVersion: update.currentVersion,
  version: update.version,
  date: update.date,
  body: update.body,
  rawJson: update.rawJson,
});

const resolveCurrentVersion = async () => {
  try {
    return await getVersion();
  } catch {
    return "unknown";
  }
};

export const createDesktopPlatformBridge = (): PlatformBridge => {
  const fallback = createWebPlatformBridge();
  let pendingUpdate: Update | null = null;

  return {
    ...fallback,
    async getAppVersion() {
      return await resolveCurrentVersion();
    },
    async checkForAppUpdate(options): Promise<AppUpdateCheckResult> {
      const currentVersion = await resolveCurrentVersion();

      try {
        const update = await check({
          timeout: options?.timeoutMs ?? DEFAULT_TIMEOUT_MS,
        });

        pendingUpdate = update;

        if (!update) {
          return {
            status: "up-to-date",
            currentVersion,
            update: null,
          };
        }

        return {
          status: "available",
          currentVersion,
          update: toUpdateInfo(update),
        };
      } catch (error) {
        pendingUpdate = null;
        const message = readErrorMessage(error);

        if (isUpdaterUnsupported(message)) {
          return {
            status: "unsupported",
            currentVersion,
            update: null,
            message,
          };
        }

        if (isOfflineError(message)) {
          return {
            status: "offline",
            currentVersion,
            update: null,
            message,
          };
        }

        return {
          status: "error",
          currentVersion,
          update: null,
          message,
        };
      }
    },
    async installAppUpdate() {
      if (!pendingUpdate) {
        throw new Error("当前没有可安装的更新。");
      }

      const update = pendingUpdate;
      pendingUpdate = null;

      try {
        await update.downloadAndInstall();
      } finally {
        await update.close().catch(() => undefined);
      }

      await relaunch();
    },
  };
};
