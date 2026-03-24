import {
  useCallback,
  useDeferredValue,
  useEffect,
  useRef,
  useState,
} from "react";

import type { PlatformBridge } from "@z-dev-toolbox/platform";
import type {
  Locale,
  ThemeMode,
  ToolManifest,
  ToolPlatform,
  ToolboxPreferences,
} from "@z-dev-toolbox/shared";
import { defaultPreferences, useToolboxStore } from "@z-dev-toolbox/state";
import type { StorageAdapter } from "@z-dev-toolbox/storage";
import {
  toolRegistry,
  ToolSelect,
  type ToolPanelNotification,
} from "@z-dev-toolbox/tool-registry";
import { Button, Card, Input, cn } from "@z-dev-toolbox/ui";

const PREFERENCES_KEY = "shell:preferences";
const REPOSITORY_URL = "https://github.com/Goalonez/z-dev-toolbox";

interface ToolboxAppProps {
  bridge: PlatformBridge;
  platform: ToolPlatform;
  storage: StorageAdapter;
}

interface LocalizedManifest {
  name: string;
  summary: string;
  category: string;
  keywords: string[];
}

interface ToastState extends ToolPanelNotification {
  id: number;
}

const isWorkspaceEditable = (root: HTMLDivElement | null) => {
  const activeElement = document.activeElement;

  if (
    !(activeElement instanceof HTMLElement) ||
    !root?.contains(activeElement)
  ) {
    return false;
  }

  return activeElement.matches(
    "textarea, input, select, [contenteditable='true']",
  );
};

const shellCopy: Record<
  Locale,
  {
    projectName: string;
    searchPlaceholder: string;
    toolListLabel: string;
    noTools: string;
    emptyWorkspaceTitle: string;
    emptyWorkspaceDescription: string;
    repositoryLabel: string;
    settingsLabel: string;
    settingsTitle: string;
    closeSettingsLabel: string;
    localeLabel: string;
    themeLabel: string;
    autoCopyLabel: string;
    autoCopyDescription: string;
  }
> = {
  "zh-CN": {
    projectName: "Z Dev Toolbox",
    searchPlaceholder: "搜索工具",
    toolListLabel: "工具栏",
    noTools: "没有匹配项",
    emptyWorkspaceTitle: "没有匹配工具",
    emptyWorkspaceDescription: "请清除当前搜索条件，或尝试其他关键词。",
    repositoryLabel: "打开 GitHub 仓库",
    settingsLabel: "打开设置",
    settingsTitle: "设置",
    closeSettingsLabel: "关闭设置",
    localeLabel: "切换中英文",
    themeLabel: "切换夜间模式",
    autoCopyLabel: "自动复制结果",
    autoCopyDescription: "执行工具后自动把结果写入剪贴板。",
  },
  "en-US": {
    projectName: "Z Dev Toolbox",
    searchPlaceholder: "Search tools",
    toolListLabel: "Toolbox",
    noTools: "No matches",
    emptyWorkspaceTitle: "No matching tool",
    emptyWorkspaceDescription: "Clear the query or try another keyword.",
    repositoryLabel: "Open GitHub repository",
    settingsLabel: "Open settings",
    settingsTitle: "Settings",
    closeSettingsLabel: "Close settings",
    localeLabel: "Switch language",
    themeLabel: "Toggle dark mode",
    autoCopyLabel: "Auto copy result",
    autoCopyDescription:
      "Copy tool output to clipboard automatically after execution.",
  },
};

const getLocalizedManifest = (
  manifest: ToolManifest,
  locale: Locale,
): LocalizedManifest => {
  const localized = manifest.localizations?.[locale];

  return {
    name: localized?.name ?? manifest.name,
    summary: localized?.summary ?? manifest.summary,
    category: localized?.category ?? manifest.category,
    keywords: localized?.keywords ?? manifest.keywords,
  };
};

const getSearchText = (manifest: ToolManifest, locale: Locale) => {
  const localized = getLocalizedManifest(manifest, locale);

  return [
    manifest.name,
    manifest.summary,
    manifest.category,
    ...manifest.keywords,
    localized.name,
    localized.summary,
    localized.category,
    ...localized.keywords,
  ]
    .join(" ")
    .toLowerCase();
};

const GitHubIcon = () => (
  <svg
    aria-hidden="true"
    className="h-4 w-4"
    fill="currentColor"
    viewBox="0 0 24 24"
  >
    <path d="M12 2C6.48 2 2 6.58 2 12.23c0 4.52 2.87 8.35 6.84 9.71.5.1.68-.22.68-.49 0-.24-.01-1.04-.01-1.89-2.78.62-3.37-1.21-3.37-1.21-.46-1.19-1.11-1.5-1.11-1.5-.91-.64.07-.63.07-.63 1 .08 1.53 1.06 1.53 1.06.9 1.57 2.35 1.12 2.92.85.09-.67.35-1.12.63-1.38-2.22-.26-4.56-1.14-4.56-5.09 0-1.12.39-2.03 1.03-2.75-.11-.26-.45-1.31.1-2.73 0 0 .84-.28 2.75 1.05A9.35 9.35 0 0 1 12 6.9c.85 0 1.71.12 2.51.36 1.91-1.33 2.75-1.05 2.75-1.05.55 1.42.21 2.47.11 2.73.64.72 1.03 1.63 1.03 2.75 0 3.96-2.35 4.82-4.58 5.08.36.32.68.95.68 1.92 0 1.39-.01 2.5-.01 2.84 0 .27.18.6.69.49A10.26 10.26 0 0 0 22 12.23C22 6.58 17.52 2 12 2Z" />
  </svg>
);

const GlobeIcon = () => (
  <svg
    aria-hidden="true"
    className="h-4 w-4"
    fill="none"
    stroke="currentColor"
    strokeLinecap="round"
    strokeLinejoin="round"
    strokeWidth="1.8"
    viewBox="0 0 24 24"
  >
    <circle cx="12" cy="12" r="9" />
    <path d="M3 12h18" />
    <path d="M12 3a14 14 0 0 1 0 18" />
    <path d="M12 3a14 14 0 0 0 0 18" />
  </svg>
);

const SettingsIcon = () => (
  <svg
    aria-hidden="true"
    className="h-4 w-4"
    fill="none"
    stroke="currentColor"
    strokeLinecap="round"
    strokeLinejoin="round"
    strokeWidth="1.8"
    viewBox="0 0 24 24"
  >
    <path d="M12 15.25A3.25 3.25 0 1 0 12 8.75a3.25 3.25 0 0 0 0 6.5Z" />
    <path d="M19.4 15a1.6 1.6 0 0 0 .32 1.77l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.6 1.6 0 0 0-1.77-.32 1.6 1.6 0 0 0-.97 1.46V21a2 2 0 0 1-4 0v-.09a1.6 1.6 0 0 0-.98-1.46 1.6 1.6 0 0 0-1.77.32l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.6 1.6 0 0 0 4.6 15a1.6 1.6 0 0 0-1.46-.97H3a2 2 0 0 1 0-4h.14A1.6 1.6 0 0 0 4.6 9a1.6 1.6 0 0 0-.32-1.77l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.6 1.6 0 0 0 8.88 4.6h.09a1.6 1.6 0 0 0 .97-1.46V3a2 2 0 0 1 4 0v.14a1.6 1.6 0 0 0 .97 1.46 1.6 1.6 0 0 0 1.77-.32l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.6 1.6 0 0 0 19.4 9c.14.37.53.62.93.62H21a2 2 0 0 1 0 4h-.67c-.4 0-.79.25-.93.62Z" />
  </svg>
);

const SunIcon = () => (
  <svg
    aria-hidden="true"
    className="h-4 w-4"
    fill="none"
    stroke="currentColor"
    strokeLinecap="round"
    strokeLinejoin="round"
    strokeWidth="1.8"
    viewBox="0 0 24 24"
  >
    <circle cx="12" cy="12" r="4" />
    <path d="M12 2v3" />
    <path d="M12 19v3" />
    <path d="M4.93 4.93l2.12 2.12" />
    <path d="M16.95 16.95l2.12 2.12" />
    <path d="M2 12h3" />
    <path d="M19 12h3" />
    <path d="M4.93 19.07l2.12-2.12" />
    <path d="M16.95 7.05l2.12-2.12" />
  </svg>
);

const MoonIcon = () => (
  <svg
    aria-hidden="true"
    className="h-4 w-4"
    fill="none"
    stroke="currentColor"
    strokeLinecap="round"
    strokeLinejoin="round"
    strokeWidth="1.8"
    viewBox="0 0 24 24"
  >
    <path d="M21 12.79A9 9 0 1 1 11.21 3c-.06.33-.09.67-.09 1.02a9 9 0 0 0 9.88 8.77Z" />
  </svg>
);

const ThemeToggleIcon = ({ themeMode }: { themeMode: ThemeMode }) =>
  themeMode === "dark" ? <SunIcon /> : <MoonIcon />;

const getToastTitle = (tone: ToolPanelNotification["tone"], locale: Locale) => {
  if (tone === "error") {
    return locale === "zh-CN" ? "执行失败" : "Failed";
  }

  if (tone === "success") {
    return locale === "zh-CN" ? "执行完成" : "Completed";
  }

  return locale === "zh-CN" ? "提示" : "Notice";
};

const ToastIcon = ({ tone }: { tone: ToolPanelNotification["tone"] }) => {
  if (tone === "error") {
    return (
      <svg
        aria-hidden="true"
        className="h-4 w-4"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.9"
        viewBox="0 0 24 24"
      >
        <path d="M12 8v5" />
        <path d="M12 16h.01" />
        <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.72 3h16.92a2 2 0 0 0 1.72-3L13.71 3.86a2 2 0 0 0-3.42 0Z" />
      </svg>
    );
  }

  if (tone === "success") {
    return (
      <svg
        aria-hidden="true"
        className="h-4 w-4"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.9"
        viewBox="0 0 24 24"
      >
        <path d="m5 12 4.2 4.2L19 6.5" />
      </svg>
    );
  }

  return (
    <svg
      aria-hidden="true"
      className="h-4 w-4"
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="1.9"
      viewBox="0 0 24 24"
    >
      <path d="M12 8h.01" />
      <path d="M11 12h1v4h1" />
      <circle cx="12" cy="12" r="9" />
    </svg>
  );
};

export const ToolboxApp = ({ bridge, platform, storage }: ToolboxAppProps) => {
  const [hydrated, setHydrated] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [toast, setToast] = useState<ToastState | null>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const workspaceRef = useRef<HTMLDivElement>(null);
  const toastTimeoutRef = useRef<number | null>(null);
  const search = useToolboxStore((state) => state.search);
  const selectedToolId = useToolboxStore((state) => state.selectedToolId);
  const recent = useToolboxStore((state) => state.recent);
  const locale = useToolboxStore((state) => state.locale);
  const themeMode = useToolboxStore((state) => state.themeMode);
  const autoCopyOnSuccess = useToolboxStore((state) => state.autoCopyOnSuccess);
  const setSearch = useToolboxStore((state) => state.setSearch);
  const selectTool = useToolboxStore((state) => state.selectTool);
  const hydrate = useToolboxStore((state) => state.hydrate);
  const markRecent = useToolboxStore((state) => state.markRecent);
  const setLocale = useToolboxStore((state) => state.setLocale);
  const setThemeMode = useToolboxStore((state) => state.setThemeMode);
  const setAutoCopyOnSuccess = useToolboxStore(
    (state) => state.setAutoCopyOnSuccess,
  );
  const deferredSearch = useDeferredValue(search.trim().toLowerCase());
  const text = shellCopy[locale];

  const availableTools = toolRegistry.filter((tool) =>
    tool.manifest.platforms.includes(platform),
  );

  const filteredTools = availableTools.filter((tool) => {
    if (!deferredSearch) {
      return true;
    }

    return getSearchText(tool.manifest, locale).includes(deferredSearch);
  });

  const visibleTools = filteredTools;

  const selectedTool =
    visibleTools.find((tool) => tool.manifest.id === selectedToolId) ??
    visibleTools[0] ??
    null;

  const focusSearchInput = useCallback(() => {
    searchInputRef.current?.focus();
    searchInputRef.current?.select();
  }, []);

  const focusFirstWorkspaceField = useCallback(() => {
    const firstField = workspaceRef.current?.querySelector<HTMLElement>(
      "textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [contenteditable='true']:not([contenteditable='false'])",
    );

    firstField?.focus();
  }, []);

  const activateTool = useCallback(
    (
      toolId: ToolManifest["id"],
      options?: { focusSearch?: boolean; focusWorkspace?: boolean },
    ) => {
      selectTool(toolId);
      markRecent(toolId);

      if (options?.focusSearch) {
        window.requestAnimationFrame(() => {
          focusSearchInput();
        });
      }

      if (options?.focusWorkspace) {
        window.requestAnimationFrame(() => {
          focusFirstWorkspaceField();
        });
      }
    },
    [focusFirstWorkspaceField, focusSearchInput, markRecent, selectTool],
  );

  const cycleVisibleTool = useCallback(
    (direction: 1 | -1) => {
      if (visibleTools.length === 0) {
        return;
      }

      const currentIndex = visibleTools.findIndex(
        (tool) => tool.manifest.id === selectedTool?.manifest.id,
      );
      const normalizedIndex = currentIndex >= 0 ? currentIndex : 0;
      const nextIndex =
        (normalizedIndex + direction + visibleTools.length) %
        visibleTools.length;
      const nextTool = visibleTools[nextIndex];

      if (nextTool) {
        activateTool(nextTool.manifest.id);
      }
    },
    [activateTool, selectedTool?.manifest.id, visibleTools],
  );

  const notify = useCallback((notification: ToolPanelNotification) => {
    if (toastTimeoutRef.current) {
      window.clearTimeout(toastTimeoutRef.current);
    }

    const nextToast: ToastState = {
      ...notification,
      id: Date.now(),
    };

    setToast(nextToast);
    toastTimeoutRef.current = window.setTimeout(() => {
      setToast((current) => (current?.id === nextToast.id ? null : current));
      toastTimeoutRef.current = null;
    }, 2200);
  }, []);

  useEffect(() => {
    let cancelled = false;

    const loadPreferences = async () => {
      const saved = await storage.getItem<ToolboxPreferences>(PREFERENCES_KEY);

      if (cancelled) {
        return;
      }

      hydrate(saved ?? defaultPreferences);
      setHydrated(true);
    };

    void loadPreferences();

    return () => {
      cancelled = true;
    };
  }, [hydrate, storage]);

  useEffect(() => {
    document.documentElement.dataset.theme = themeMode;
  }, [themeMode]);

  useEffect(() => {
    if (!hydrated) {
      return;
    }

    if (!selectedTool && visibleTools[0]) {
      selectTool(visibleTools[0].manifest.id);
    }
  }, [hydrated, selectTool, selectedTool, visibleTools]);

  useEffect(() => {
    if (!hydrated) {
      return;
    }

    void storage.setItem<ToolboxPreferences>(PREFERENCES_KEY, {
      selectedToolId,
      recent,
      locale,
      themeMode,
      autoCopyOnSuccess,
    });
  }, [
    autoCopyOnSuccess,
    hydrated,
    locale,
    recent,
    selectedToolId,
    storage,
    themeMode,
  ]);

  useEffect(() => {
    if (!hydrated) {
      return;
    }

    const frame = window.requestAnimationFrame(() => {
      focusSearchInput();
    });

    return () => {
      window.cancelAnimationFrame(frame);
    };
  }, [focusSearchInput, hydrated]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        focusSearchInput();
        return;
      }

      if (event.key === "Escape" && isSettingsOpen) {
        setIsSettingsOpen(false);
        return;
      }

      if (
        event.key === "Escape" &&
        !event.metaKey &&
        !event.ctrlKey &&
        !event.altKey &&
        isWorkspaceEditable(workspaceRef.current)
      ) {
        event.preventDefault();
        focusSearchInput();
        return;
      }

      if (event.key !== "Enter" || !isWorkspaceEditable(workspaceRef.current)) {
        return;
      }

      if (event.shiftKey && !event.ctrlKey && !event.metaKey && !event.altKey) {
        event.preventDefault();
        focusSearchInput();
        return;
      }

      if (
        (event.ctrlKey || event.metaKey) &&
        !event.shiftKey &&
        !event.altKey
      ) {
        const primaryAction =
          workspaceRef.current?.querySelector<HTMLButtonElement>(
            "[data-tool-primary-action='true']:not([disabled])",
          );

        if (!primaryAction) {
          return;
        }

        event.preventDefault();
        primaryAction.click();
      }
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [focusSearchInput, isSettingsOpen]);

  useEffect(() => {
    return () => {
      if (toastTimeoutRef.current) {
        window.clearTimeout(toastTimeoutRef.current);
      }
    };
  }, []);

  const ActivePanel = selectedTool?.Panel;
  const selectedToolName = selectedTool
    ? getLocalizedManifest(selectedTool.manifest, locale).name
    : "";

  return (
    <div className="min-h-dvh h-dvh overflow-hidden bg-background bg-shell-grid bg-[size:36px_36px] text-foreground">
      <div className="mx-auto flex h-full w-full max-w-[1700px] px-2 py-2 sm:px-3 sm:py-3 lg:px-4 lg:py-4">
        <div className="grid h-full min-h-0 w-full gap-3 grid-rows-[auto_minmax(0,1fr)] md:grid-cols-[220px_minmax(0,1fr)] md:grid-rows-1">
          <Card className="flex min-h-0 flex-col gap-2.5 overflow-hidden p-2.5 sm:gap-3 sm:p-3">
            <div className="space-y-2 border-b border-[rgb(var(--color-border)/var(--divider-border-alpha))] pb-2.5 md:space-y-3">
              <div className="flex items-start justify-between gap-3 md:block md:text-center">
                <div className="min-w-0 text-left md:text-center">
                  <div className="truncate text-[1.15rem] font-semibold leading-none tracking-[-0.03em] text-foreground sm:text-[1.3rem] lg:text-[1.42rem]">
                    {text.projectName}
                  </div>
                </div>
                <div className="flex items-center justify-start gap-1.5 md:mt-2 md:justify-center">
                  <Button
                    aria-label={text.settingsLabel}
                    className="h-9 w-9 rounded-full sm:h-8 sm:w-8"
                    size="icon"
                    variant="secondary"
                    onClick={() => {
                      setIsSettingsOpen(true);
                    }}
                  >
                    <SettingsIcon />
                  </Button>
                  <Button
                    aria-label={text.localeLabel}
                    className="h-9 w-9 rounded-full sm:h-8 sm:w-8"
                    size="icon"
                    variant="secondary"
                    onClick={() => {
                      setLocale(locale === "zh-CN" ? "en-US" : "zh-CN");
                    }}
                  >
                    <GlobeIcon />
                  </Button>
                  <Button
                    aria-label={text.themeLabel}
                    className="h-9 w-9 rounded-full sm:h-8 sm:w-8"
                    size="icon"
                    variant="secondary"
                    onClick={() => {
                      setThemeMode(themeMode === "dark" ? "light" : "dark");
                    }}
                  >
                    <ThemeToggleIcon themeMode={themeMode} />
                  </Button>
                  <a
                    aria-label={text.repositoryLabel}
                    className={cn(
                      "inline-flex h-9 w-9 items-center justify-center rounded-full border border-[rgb(var(--color-border)/var(--control-border-alpha))] bg-[linear-gradient(180deg,rgb(var(--color-surface)/0.97),rgb(var(--color-surface-strong)/0.94))] text-foreground shadow-[0_14px_28px_-24px_rgb(var(--color-shadow-ambient)/0.26)] transition-[background-color,border-color,color,box-shadow,transform] sm:h-8 sm:w-8",
                      "hover:-translate-y-0.5 hover:border-accent/16 hover:bg-surfaceStrong/98 hover:shadow-[0_18px_32px_-24px_rgb(var(--color-shadow-ambient)/0.32),0_8px_20px_-18px_rgb(var(--color-shadow-warm)/0.16)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/22 focus-visible:ring-offset-2 focus-visible:ring-offset-background",
                    )}
                    href={REPOSITORY_URL}
                    rel="noreferrer"
                    target="_blank"
                  >
                    <GitHubIcon />
                  </a>
                </div>
              </div>
            </div>

            <div className="space-y-2 md:hidden">
              <div className="grid grid-cols-[minmax(0,1fr)_minmax(9rem,42%)] gap-2">
                <Input
                  ref={searchInputRef}
                  autoFocus
                  className="h-11 rounded-[18px]"
                  placeholder={text.searchPlaceholder}
                  type="search"
                  value={search}
                  onChange={(event) => {
                    setSearch(event.currentTarget.value);
                  }}
                  onKeyDown={(event) => {
                    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
                      event.preventDefault();
                      cycleVisibleTool(event.key === "ArrowDown" ? 1 : -1);
                      return;
                    }

                    if (event.key === "Enter") {
                      event.preventDefault();
                      focusFirstWorkspaceField();
                    }
                  }}
                />
                <ToolSelect
                  aria-label={text.toolListLabel}
                  className="h-11 w-full rounded-[18px] px-3 text-sm"
                  value={selectedTool?.manifest.id}
                  renderValue={() => selectedToolName || text.noTools}
                  onValueChange={(value: string) => {
                    const nextTool = visibleTools.find(
                      (tool) => tool.manifest.id === value,
                    );

                    if (!nextTool) {
                      return;
                    }

                    activateTool(nextTool.manifest.id, { focusWorkspace: true });
                  }}
                >
                  {visibleTools.map((tool) => {
                    const manifest = getLocalizedManifest(tool.manifest, locale);

                    return (
                      <option key={tool.manifest.id} value={tool.manifest.id}>
                        {manifest.name}
                      </option>
                    );
                  })}
                </ToolSelect>
              </div>
            </div>

            <div className="hidden space-y-2 md:block">
              <div className="text-[0.65rem] font-medium uppercase tracking-[0.18em] text-muted sm:text-[0.68rem] sm:tracking-[0.24em]">
                {text.toolListLabel}
              </div>
              <Input
                ref={searchInputRef}
                autoFocus
                className="h-11 rounded-[18px]"
                placeholder={text.searchPlaceholder}
                type="search"
                value={search}
                onChange={(event) => {
                  setSearch(event.currentTarget.value);
                }}
                onKeyDown={(event) => {
                  if (event.key === "ArrowDown" || event.key === "ArrowUp") {
                    event.preventDefault();
                    cycleVisibleTool(event.key === "ArrowDown" ? 1 : -1);
                    return;
                  }

                  if (event.key === "Enter") {
                    event.preventDefault();
                    focusFirstWorkspaceField();
                  }
                }}
              />
            </div>

            <div className="hidden min-h-0 gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden md:flex md:flex-1 md:flex-col md:overflow-x-hidden md:overflow-y-auto md:pb-0 md:pr-1">
              {visibleTools.map((tool) => {
                const manifest = getLocalizedManifest(tool.manifest, locale);
                const isActive = tool.manifest.id === selectedTool?.manifest.id;

                return (
                  <div
                    key={tool.manifest.id}
                    data-tool-nav-item="true"
                    className={cn(
                      "relative flex min-w-[132px] shrink-0 items-center gap-3 rounded-[18px] border px-3 py-2.5 text-left transition-[background-color,border-color,color,transform,box-shadow] sm:min-w-[148px] md:w-full md:min-w-0 md:rounded-[19px]",
                      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/24 focus-visible:ring-offset-2 focus-visible:ring-offset-background",
                      isActive
                        ? "border-accent/30 bg-[linear-gradient(180deg,rgb(var(--color-surface)/0.99),rgb(var(--color-accent-soft)/0.8))] text-foreground shadow-[0_18px_32px_-24px_rgb(var(--color-shadow-ambient)/0.34),0_8px_20px_-16px_rgb(var(--color-shadow-warm)/0.2)]"
                        : "border-[rgb(var(--color-border)/var(--control-border-alpha))] bg-[linear-gradient(180deg,rgb(var(--color-surface)/0.97),rgb(var(--color-surface-strong)/0.94))] text-foreground shadow-[0_14px_26px_-24px_rgb(var(--color-shadow-ambient)/0.22)] hover:-translate-y-0.5 hover:border-accent/16 hover:bg-surfaceStrong/98 hover:shadow-[0_18px_30px_-22px_rgb(var(--color-shadow-ambient)/0.3),0_8px_20px_-18px_rgb(var(--color-shadow-warm)/0.14)]",
                    )}
                    role="button"
                    tabIndex={0}
                    onMouseDown={(event) => {
                      event.preventDefault();
                    }}
                    onClick={() => {
                      activateTool(tool.manifest.id, { focusSearch: true });
                    }}
                    onKeyDown={(event) => {
                      if (event.key === "ArrowDown" || event.key === "ArrowUp") {
                        event.preventDefault();
                        cycleVisibleTool(event.key === "ArrowDown" ? 1 : -1);
                        return;
                      }

                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();

                        if (isActive && event.key === "Enter") {
                          focusFirstWorkspaceField();
                          return;
                        }

                        activateTool(tool.manifest.id, {
                          focusSearch: event.key !== "Enter",
                          focusWorkspace: event.key === "Enter"
                        });
                      }
                    }}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-[13px] font-medium leading-5 sm:text-sm">
                        {manifest.name}
                      </div>
                    </div>
                  </div>
                );
              })}

              {visibleTools.length === 0 ? (
                <div className="flex h-24 min-w-[132px] shrink-0 items-center justify-center rounded-[20px] border border-dashed border-border bg-background/35 px-4 text-sm text-muted md:h-32 md:min-w-0 md:rounded-[22px]">
                  {text.noTools}
                </div>
              ) : null}
            </div>
          </Card>

          <div
            ref={workspaceRef}
            className="min-h-0 overflow-x-hidden overflow-y-auto px-0.5 py-0.5 xl:overflow-hidden"
          >
            {ActivePanel ? (
              <ActivePanel
                key={selectedTool.manifest.id}
                autoCopyOnSuccess={autoCopyOnSuccess}
                bridge={bridge}
                locale={locale}
                notify={notify}
                platform={platform}
                storage={storage}
              />
            ) : (
              <div className="flex h-full min-h-0 items-center justify-center rounded-[26px] border border-dashed border-[rgb(var(--color-border)/var(--divider-border-alpha))] bg-background/34 px-6 text-center text-sm text-muted">
                <div className="space-y-2">
                  <div className="text-base font-medium text-foreground">
                    {text.emptyWorkspaceTitle}
                  </div>
                  <div>{text.emptyWorkspaceDescription}</div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
      {toast ? (
        <div className="pointer-events-none fixed inset-x-3 top-3 z-50 md:left-auto md:right-4 md:top-4">
          <div
            className={cn(
              "relative flex max-w-none items-start gap-3 overflow-hidden rounded-[22px] border px-4 py-3.5 text-sm text-foreground shadow-[0_30px_64px_-34px_rgb(var(--color-shadow-ambient)/0.62),0_10px_24px_-20px_rgb(var(--color-shadow-warm)/0.16)] backdrop-blur-[20px] md:max-w-[360px]",
              toast.tone === "error"
                ? "border-danger/22 bg-[linear-gradient(180deg,rgb(var(--color-surface)/0.98),rgba(198,100,78,0.14))]"
                : toast.tone === "success"
                  ? "border-accent/22 bg-[linear-gradient(180deg,rgb(var(--color-surface)/0.98),rgb(var(--color-accent-soft)/0.78))]"
                  : "border-[rgb(var(--color-border)/0.54)] bg-[linear-gradient(180deg,rgb(var(--color-surface)/0.98),rgb(var(--color-surface-strong)/0.94))]",
            )}
          >
            <span
              className={cn(
                "absolute inset-y-0 left-0 w-1.5",
                toast.tone === "error"
                  ? "bg-danger"
                  : toast.tone === "success"
                    ? "bg-accent"
                    : "bg-[rgb(var(--color-accent)/0.8)]",
              )}
            />
            <span
              className={cn(
                "mt-0.5 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl border",
                toast.tone === "error"
                  ? "border-danger/24 bg-danger/12 text-danger"
                  : toast.tone === "success"
                    ? "border-accent/22 bg-accentSoft/62 text-accent"
                    : "border-[rgb(var(--color-border)/0.58)] bg-[rgb(var(--color-surface-muted)/0.22)] text-accent",
              )}
            >
              <ToastIcon tone={toast.tone} />
            </span>
            <div className="min-w-0 flex-1">
              <div className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted">
                {getToastTitle(toast.tone, locale)}
              </div>
              <div className="mt-1 break-words text-sm font-medium leading-5 text-foreground">
                {toast.text}
              </div>
            </div>
          </div>
        </div>
      ) : null}
      {isSettingsOpen ? (
        <div className="fixed inset-0 z-40 flex items-end justify-center bg-[radial-gradient(circle_at_top,rgb(var(--color-accent)/0.16),transparent_28%),rgb(var(--color-shadow-ambient)/0.48)] px-3 py-3 backdrop-blur-[10px] sm:items-center sm:px-4">
          <button
            aria-label={text.closeSettingsLabel}
            className="absolute inset-0"
            type="button"
            onClick={() => {
              setIsSettingsOpen(false);
            }}
          />
          <Card className="relative z-10 w-full max-w-[29rem] overflow-hidden rounded-[28px] bg-[linear-gradient(180deg,rgb(var(--color-surface)/0.99),rgb(var(--color-surface-strong)/0.95))] p-0 shadow-[0_42px_96px_-42px_rgb(var(--color-shadow-ambient)/0.56),0_14px_28px_-18px_rgb(var(--color-shadow-warm)/0.18)] sm:rounded-[32px]">
            <div className="pointer-events-none absolute inset-x-8 top-0 h-20 bg-[radial-gradient(circle_at_top,rgb(var(--color-accent-soft)/0.72),transparent_70%)] blur-2xl" />
            <div className="relative flex items-center justify-between gap-4 border-b border-[rgb(var(--color-border)/var(--divider-border-alpha))] px-4 py-4">
              <div className="flex items-center gap-3">
                <span className="inline-flex h-10 w-10 items-center justify-center rounded-[1rem] border border-accent/14 bg-accentSoft/74 text-accent shadow-[0_14px_26px_-20px_rgb(var(--color-shadow-warm)/0.16)]">
                  <SettingsIcon />
                </span>
                <div className="text-[0.72rem] font-semibold uppercase tracking-[0.18em] text-muted">
                  {text.settingsTitle}
                </div>
              </div>
              <Button
                aria-label={text.closeSettingsLabel}
                className="h-9 w-9 rounded-full"
                size="icon"
                variant="outline"
                onClick={() => {
                  setIsSettingsOpen(false);
                }}
              >
                ×
              </Button>
            </div>
            <div className="px-4 py-4">
              <button
                className="group flex w-full items-center justify-between gap-4 rounded-[24px] border border-[rgb(var(--color-border)/var(--control-border-alpha))] bg-[linear-gradient(180deg,rgb(var(--color-surface)/0.96),rgb(var(--color-surface-strong)/0.92))] px-4 py-4 text-left shadow-[0_18px_32px_-28px_rgb(var(--color-shadow-ambient)/0.3)] transition-[border-color,box-shadow,transform] hover:-translate-y-0.5 hover:border-accent/18 hover:shadow-[0_22px_38px_-28px_rgb(var(--color-shadow-ambient)/0.36),0_8px_20px_-16px_rgb(var(--color-shadow-warm)/0.16)]"
                type="button"
                onClick={() => {
                  setAutoCopyOnSuccess(!autoCopyOnSuccess);
                }}
              >
                <div>
                  <div className="text-sm font-medium text-foreground">
                    {text.autoCopyLabel}
                  </div>
                  <div className="mt-1 text-xs leading-5 text-muted">
                    {text.autoCopyDescription}
                  </div>
                </div>
                <span
                  className={cn(
                    "relative inline-flex h-8 w-14 rounded-full border shadow-[0_12px_24px_-18px_rgb(var(--color-shadow-ambient)/0.24)] transition-[background-color,border-color]",
                    autoCopyOnSuccess
                      ? "border-accent/32 bg-[linear-gradient(135deg,rgb(var(--color-accent)/0.9),rgb(var(--color-accent-soft)/0.96))]"
                      : "border-[rgb(var(--color-border)/0.54)] bg-[linear-gradient(180deg,rgb(var(--color-surface-muted)/0.46),rgb(var(--color-background)/0.7))]",
                  )}
                >
                  <span
                    className={cn(
                      "absolute top-0.5 h-6 w-6 rounded-full border border-[rgb(var(--color-border)/0.56)] bg-[linear-gradient(180deg,rgb(var(--color-surface)/0.98),rgb(var(--color-surface-strong)/0.92))] shadow-[0_8px_16px_-10px_rgb(var(--color-shadow-ambient)/0.5)] transition-transform",
                      autoCopyOnSuccess ? "left-[1.8rem]" : "left-0.5",
                    )}
                  />
                </span>
              </button>
            </div>
          </Card>
        </div>
      ) : null}
    </div>
  );
};
