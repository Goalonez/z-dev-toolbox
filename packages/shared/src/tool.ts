export type ToolId = `${string}.${string}`;

export type ToolPlatform = "web" | "extension" | "desktop";
export type Locale = "zh-CN" | "en-US";
export type ThemeMode = "light" | "dark";

export type ToolCategory =
  | "data"
  | "encoding"
  | "text"
  | "security"
  | "time";

export interface ToolManifestLocalization {
  name?: string;
  summary?: string;
  category?: string;
  keywords?: string[];
}

export interface ToolManifest {
  id: ToolId;
  name: string;
  summary: string;
  category: ToolCategory;
  keywords: string[];
  platforms: ToolPlatform[];
  localizations?: Partial<Record<Locale, ToolManifestLocalization>>;
}

export interface ToolExecutionError {
  code: string;
  message: string;
  details?: string;
}

export type ToolResult<T> =
  | {
      ok: true;
      data: T;
    }
  | {
      ok: false;
      error: ToolExecutionError;
    };

export interface ToolboxPreferences {
  selectedToolId: ToolId | null;
  recent: ToolId[];
  locale: Locale;
  themeMode: ThemeMode;
  autoCopyOnSuccess: boolean;
}
