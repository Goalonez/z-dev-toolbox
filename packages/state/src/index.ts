import { create } from "zustand";

import type {
  Locale,
  ThemeMode,
  ToolId,
  ToolboxPreferences
} from "@z-dev-toolbox/shared";

interface ToolboxState extends ToolboxPreferences {
  search: string;
  setSearch: (value: string) => void;
  selectTool: (toolId: ToolId) => void;
  hydrate: (preferences: Partial<ToolboxPreferences>) => void;
  markRecent: (toolId: ToolId) => void;
  setLocale: (locale: Locale) => void;
  setThemeMode: (themeMode: ThemeMode) => void;
  setAutoCopyOnSuccess: (enabled: boolean) => void;
}

const RECENT_LIMIT = 6;

export const defaultPreferences: ToolboxPreferences = {
  selectedToolId: null,
  recent: [],
  locale: "zh-CN",
  themeMode: "light",
  autoCopyOnSuccess: true
};

export const useToolboxStore = create<ToolboxState>((set) => ({
  ...defaultPreferences,
  search: "",
  setSearch: (search) => {
    set({ search });
  },
  selectTool: (selectedToolId) => {
    set({ selectedToolId });
  },
  hydrate: (preferences) => {
    set((state) => ({
      selectedToolId: preferences.selectedToolId ?? state.selectedToolId,
      recent: preferences.recent ?? state.recent,
      locale: preferences.locale ?? state.locale,
      themeMode: preferences.themeMode ?? state.themeMode,
      autoCopyOnSuccess: preferences.autoCopyOnSuccess ?? state.autoCopyOnSuccess
    }));
  },
  markRecent: (toolId) => {
    set((state) => ({
      recent: [toolId, ...state.recent.filter((item) => item !== toolId)].slice(
        0,
        RECENT_LIMIT,
      )
    }));
  },
  setLocale: (locale) => {
    set({ locale });
  },
  setThemeMode: (themeMode) => {
    set({ themeMode });
  },
  setAutoCopyOnSuccess: (autoCopyOnSuccess) => {
    set({ autoCopyOnSuccess });
  }
}));
