export interface AppUpdateInfo {
  currentVersion: string;
  version: string;
  date?: string;
  body?: string;
  rawJson: Record<string, unknown>;
}

export type AppUpdateStatus =
  | "available"
  | "up-to-date"
  | "offline"
  | "unsupported"
  | "error";

export interface AppUpdateCheckResult {
  status: AppUpdateStatus;
  currentVersion: string;
  update: AppUpdateInfo | null;
  message?: string;
}

export interface PlatformBridge {
  copyText(text: string): Promise<void>;
  readText(): Promise<string>;
  saveTextFile(filename: string, content: string): Promise<void>;
  getAppVersion(): Promise<string>;
  checkForAppUpdate(options?: {
    timeoutMs?: number;
  }): Promise<AppUpdateCheckResult>;
  installAppUpdate(): Promise<void>;
}
