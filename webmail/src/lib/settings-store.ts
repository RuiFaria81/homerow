// src/lib/settings-store.ts
import { createEffect } from "solid-js";
import { createStore } from "solid-js/store";

export type ReadingPanePosition = "right" | "bottom" | "none";
export type FontId = "dm-sans" | "inter" | "roboto" | "nunito" | "lato" | "system";
export type ThemeId = "light" | "dark" | "midnight" | "forest" | "solarized" | "rose" | "ocean" | "sunset" | "lavender" | "nord" | "mocha" | "mint";

export interface FontDef {
  name: string;
  family: string;
  googleFontsUrl?: string;
  previewText?: string;
}

export const FONTS: Record<FontId, FontDef> = {
  "dm-sans": {
    name: "DM Sans",
    family: "'DM Sans', -apple-system, BlinkMacSystemFont, sans-serif",
    previewText: "The quick brown fox",
  },
  inter: {
    name: "Inter",
    family: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
    googleFontsUrl: "https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap",
    previewText: "The quick brown fox",
  },
  roboto: {
    name: "Roboto",
    family: "'Roboto', -apple-system, BlinkMacSystemFont, sans-serif",
    googleFontsUrl: "https://fonts.googleapis.com/css2?family=Roboto:wght@300;400;500;700&display=swap",
    previewText: "The quick brown fox",
  },
  nunito: {
    name: "Nunito",
    family: "'Nunito', -apple-system, BlinkMacSystemFont, sans-serif",
    googleFontsUrl: "https://fonts.googleapis.com/css2?family=Nunito:wght@300;400;500;600;700&display=swap",
    previewText: "The quick brown fox",
  },
  lato: {
    name: "Lato",
    family: "'Lato', -apple-system, BlinkMacSystemFont, sans-serif",
    googleFontsUrl: "https://fonts.googleapis.com/css2?family=Lato:wght@300;400;700&display=swap",
    previewText: "The quick brown fox",
  },
  system: {
    name: "System",
    family: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
    previewText: "The quick brown fox",
  },
};

export interface ThemeVars {
  background: string;
  foreground: string;
  card: string;
  cardForeground: string;
  popover: string;
  popoverForeground: string;
  primary: string;
  primaryForeground: string;
  secondary: string;
  secondaryForeground: string;
  muted: string;
  mutedForeground: string;
  accent: string;
  accentForeground: string;
  destructive: string;
  border: string;
  input: string;
  ring: string;
  sidebar: string;
  sidebarForeground: string;
  sidebarPrimary: string;
  sidebarPrimaryForeground: string;
  sidebarAccent: string;
  sidebarAccentForeground: string;
  sidebarBorder: string;
  composeBg: string;
  composeHover: string;
  hoverBg: string;
  activeBg: string;
  searchBg: string;
  textSecondary: string;
  textMuted: string;
  borderLight: string;
}

export interface AppTheme {
  name: string;
  isDark: boolean;
  vars: ThemeVars;
}

export interface AppSettings {
  density: "compact" | "default" | "comfortable";
  readingPane: ReadingPanePosition;
  autoAdvance: "next" | "previous" | "list";
  emailsPerPage: string;
  theme: ThemeId;
  font: FontId;
  composer: "full" | "small";
  conversationView: boolean;
  expandAllThreadMessages: boolean;
  notifications: boolean;
  enableCategories: boolean;
  shortcutFeedback: boolean;
}

const defaultSettings: AppSettings = {
  density: "default",
  readingPane: "right",
  autoAdvance: "next",
  emailsPerPage: "50",
  theme: "light",
  font: "dm-sans",
  composer: "small",
  conversationView: true,
  expandAllThreadMessages: false,
  notifications: true,
  enableCategories: true,
  shortcutFeedback: false,
};

export const [settings, setSettings] = createStore<AppSettings>(defaultSettings);

// Initialize from localStorage
if (typeof window !== "undefined") {
  try {
    const stored = localStorage.getItem("settings");
    if (stored) {
      const parsed = JSON.parse(stored);
      // Migrate old themeMode + themeAccent to new theme
      if (!parsed.theme && parsed.themeMode) {
        parsed.theme = parsed.themeMode === "dark" ? "dark" : "light";
      }
      // Migrate very old darkMode setting
      if (!parsed.theme) {
        const oldDark = localStorage.getItem("darkMode");
        parsed.theme = oldDark === "true" ? "dark" : "light";
      }
      setSettings({ ...defaultSettings, ...parsed });
    }
  } catch (e) {
    console.error("Failed to load settings", e);
  }
}

// Persist to localStorage whenever settings change
createEffect(() => {
  if (typeof window !== "undefined") {
    localStorage.setItem("settings", JSON.stringify(settings));
  }
});

// Full theme definitions
export const THEMES: Record<ThemeId, AppTheme> = {
  light: {
    name: "Light",
    isDark: false,
    vars: {
      background: "#f6f8fc",
      foreground: "#1a1a2e",
      card: "#ffffff",
      cardForeground: "#1a1a2e",
      popover: "#ffffff",
      popoverForeground: "#1a1a2e",
      primary: "#1a73e8",
      primaryForeground: "#ffffff",
      secondary: "#edf0f4",
      secondaryForeground: "#1a1a2e",
      muted: "#edf0f4",
      mutedForeground: "#5f6368",
      accent: "#d3e3fd",
      accentForeground: "#1a73e8",
      destructive: "#ea4335",
      border: "#e4e7eb",
      input: "#edf0f4",
      ring: "#1a73e8",
      sidebar: "#ffffff",
      sidebarForeground: "#1a1a2e",
      sidebarPrimary: "#1a73e8",
      sidebarPrimaryForeground: "#ffffff",
      sidebarAccent: "#d3e3fd",
      sidebarAccentForeground: "#1a73e8",
      sidebarBorder: "#f0f2f5",
      composeBg: "#c2e7ff",
      composeHover: "#a8daf7",
      hoverBg: "#edf2fc",
      activeBg: "#d3e3fd",
      searchBg: "#edf0f4",
      textSecondary: "#5f6368",
      textMuted: "#8e9196",
      borderLight: "#f0f2f5",
    },
  },
  dark: {
    name: "Dark",
    isDark: true,
    vars: {
      background: "#111827",
      foreground: "#f0f2f5",
      card: "#1e293b",
      cardForeground: "#f0f2f5",
      popover: "#1e293b",
      popoverForeground: "#f0f2f5",
      primary: "#8ab4f8",
      primaryForeground: "#1a1a2e",
      secondary: "#1e293b",
      secondaryForeground: "#f0f2f5",
      muted: "#374151",
      mutedForeground: "#9ca3af",
      accent: "rgba(138,180,248,0.15)",
      accentForeground: "#8ab4f8",
      destructive: "#f87171",
      border: "rgba(255,255,255,0.08)",
      input: "rgba(255,255,255,0.08)",
      ring: "#8ab4f8",
      sidebar: "#1e293b",
      sidebarForeground: "#f0f2f5",
      sidebarPrimary: "#8ab4f8",
      sidebarPrimaryForeground: "#1a1a2e",
      sidebarAccent: "rgba(138,180,248,0.15)",
      sidebarAccentForeground: "#8ab4f8",
      sidebarBorder: "rgba(255,255,255,0.06)",
      composeBg: "rgba(138,180,248,0.2)",
      composeHover: "rgba(138,180,248,0.3)",
      hoverBg: "rgba(255,255,255,0.05)",
      activeBg: "rgba(138,180,248,0.15)",
      searchBg: "rgba(255,255,255,0.06)",
      textSecondary: "#9ca3af",
      textMuted: "#6b7280",
      borderLight: "rgba(255,255,255,0.04)",
    },
  },
  midnight: {
    name: "Midnight",
    isDark: true,
    vars: {
      background: "#0f0f1a",
      foreground: "#e2e0ff",
      card: "#1a1a2e",
      cardForeground: "#e2e0ff",
      popover: "#1a1a2e",
      popoverForeground: "#e2e0ff",
      primary: "#a78bfa",
      primaryForeground: "#1a0040",
      secondary: "#1a1a2e",
      secondaryForeground: "#e2e0ff",
      muted: "#252040",
      mutedForeground: "#9d99c0",
      accent: "rgba(167,139,250,0.15)",
      accentForeground: "#a78bfa",
      destructive: "#f87171",
      border: "rgba(167,139,250,0.12)",
      input: "rgba(167,139,250,0.08)",
      ring: "#a78bfa",
      sidebar: "#14142a",
      sidebarForeground: "#e2e0ff",
      sidebarPrimary: "#a78bfa",
      sidebarPrimaryForeground: "#1a0040",
      sidebarAccent: "rgba(167,139,250,0.15)",
      sidebarAccentForeground: "#a78bfa",
      sidebarBorder: "rgba(167,139,250,0.08)",
      composeBg: "rgba(167,139,250,0.2)",
      composeHover: "rgba(167,139,250,0.3)",
      hoverBg: "rgba(167,139,250,0.07)",
      activeBg: "rgba(167,139,250,0.15)",
      searchBg: "rgba(167,139,250,0.06)",
      textSecondary: "#9d99c0",
      textMuted: "#6b6880",
      borderLight: "rgba(167,139,250,0.06)",
    },
  },
  forest: {
    name: "Forest",
    isDark: true,
    vars: {
      background: "#0a1410",
      foreground: "#d4e8d4",
      card: "#112118",
      cardForeground: "#d4e8d4",
      popover: "#112118",
      popoverForeground: "#d4e8d4",
      primary: "#4ade80",
      primaryForeground: "#052e16",
      secondary: "#112118",
      secondaryForeground: "#d4e8d4",
      muted: "#1a3325",
      mutedForeground: "#86b59a",
      accent: "rgba(74,222,128,0.15)",
      accentForeground: "#4ade80",
      destructive: "#f87171",
      border: "rgba(74,222,128,0.12)",
      input: "rgba(74,222,128,0.08)",
      ring: "#4ade80",
      sidebar: "#0d1c14",
      sidebarForeground: "#d4e8d4",
      sidebarPrimary: "#4ade80",
      sidebarPrimaryForeground: "#052e16",
      sidebarAccent: "rgba(74,222,128,0.15)",
      sidebarAccentForeground: "#4ade80",
      sidebarBorder: "rgba(74,222,128,0.08)",
      composeBg: "rgba(74,222,128,0.2)",
      composeHover: "rgba(74,222,128,0.3)",
      hoverBg: "rgba(74,222,128,0.07)",
      activeBg: "rgba(74,222,128,0.15)",
      searchBg: "rgba(74,222,128,0.06)",
      textSecondary: "#86b59a",
      textMuted: "#5a7a68",
      borderLight: "rgba(74,222,128,0.06)",
    },
  },
  solarized: {
    name: "Solarized",
    isDark: false,
    vars: {
      background: "#fdf6e3",
      foreground: "#073642",
      card: "#eee8d5",
      cardForeground: "#073642",
      popover: "#eee8d5",
      popoverForeground: "#073642",
      primary: "#268bd2",
      primaryForeground: "#fdf6e3",
      secondary: "#e8e2cf",
      secondaryForeground: "#073642",
      muted: "#e8e2cf",
      mutedForeground: "#657b83",
      accent: "#c8dfed",
      accentForeground: "#268bd2",
      destructive: "#dc322f",
      border: "#d8d0b8",
      input: "#e8e2cf",
      ring: "#268bd2",
      sidebar: "#eee8d5",
      sidebarForeground: "#073642",
      sidebarPrimary: "#268bd2",
      sidebarPrimaryForeground: "#fdf6e3",
      sidebarAccent: "#c8dfed",
      sidebarAccentForeground: "#268bd2",
      sidebarBorder: "#d8d0b8",
      composeBg: "#c8dfed",
      composeHover: "#b0ccdf",
      hoverBg: "#e8e2cf",
      activeBg: "#c8dfed",
      searchBg: "#e8e2cf",
      textSecondary: "#657b83",
      textMuted: "#839496",
      borderLight: "#e8e2cf",
    },
  },
  rose: {
    name: "Rose",
    isDark: false,
    vars: {
      background: "#fff8f9",
      foreground: "#2d1520",
      card: "#ffffff",
      cardForeground: "#2d1520",
      popover: "#ffffff",
      popoverForeground: "#2d1520",
      primary: "#e91e63",
      primaryForeground: "#ffffff",
      secondary: "#fce4ec",
      secondaryForeground: "#2d1520",
      muted: "#fce4ec",
      mutedForeground: "#9c5472",
      accent: "#fce4ec",
      accentForeground: "#e91e63",
      destructive: "#c62828",
      border: "#f8d7e3",
      input: "#fce4ec",
      ring: "#e91e63",
      sidebar: "#ffffff",
      sidebarForeground: "#2d1520",
      sidebarPrimary: "#e91e63",
      sidebarPrimaryForeground: "#ffffff",
      sidebarAccent: "#fce4ec",
      sidebarAccentForeground: "#e91e63",
      sidebarBorder: "#fce4ec",
      composeBg: "#fce4ec",
      composeHover: "#f8d7e3",
      hoverBg: "#fce4ec",
      activeBg: "#fce4ec",
      searchBg: "#fce4ec",
      textSecondary: "#9c5472",
      textMuted: "#c48a9c",
      borderLight: "#fce4ec",
    },
  },
  ocean: {
    name: "Ocean",
    isDark: true,
    vars: {
      background: "#0b1a2e",
      foreground: "#cce3f5",
      card: "#112240",
      cardForeground: "#cce3f5",
      popover: "#112240",
      popoverForeground: "#cce3f5",
      primary: "#38bdf8",
      primaryForeground: "#0b1a2e",
      secondary: "#112240",
      secondaryForeground: "#cce3f5",
      muted: "#1a3050",
      mutedForeground: "#7aadcc",
      accent: "rgba(56,189,248,0.15)",
      accentForeground: "#38bdf8",
      destructive: "#f87171",
      border: "rgba(56,189,248,0.12)",
      input: "rgba(56,189,248,0.08)",
      ring: "#38bdf8",
      sidebar: "#0d1e36",
      sidebarForeground: "#cce3f5",
      sidebarPrimary: "#38bdf8",
      sidebarPrimaryForeground: "#0b1a2e",
      sidebarAccent: "rgba(56,189,248,0.15)",
      sidebarAccentForeground: "#38bdf8",
      sidebarBorder: "rgba(56,189,248,0.08)",
      composeBg: "rgba(56,189,248,0.2)",
      composeHover: "rgba(56,189,248,0.3)",
      hoverBg: "rgba(56,189,248,0.07)",
      activeBg: "rgba(56,189,248,0.15)",
      searchBg: "rgba(56,189,248,0.06)",
      textSecondary: "#7aadcc",
      textMuted: "#4a7a96",
      borderLight: "rgba(56,189,248,0.06)",
    },
  },
  sunset: {
    name: "Sunset",
    isDark: true,
    vars: {
      background: "#1c0f00",
      foreground: "#f5d5a8",
      card: "#2a1a00",
      cardForeground: "#f5d5a8",
      popover: "#2a1a00",
      popoverForeground: "#f5d5a8",
      primary: "#f97316",
      primaryForeground: "#1c0f00",
      secondary: "#2a1a00",
      secondaryForeground: "#f5d5a8",
      muted: "#3a2800",
      mutedForeground: "#c49050",
      accent: "rgba(249,115,22,0.15)",
      accentForeground: "#f97316",
      destructive: "#f87171",
      border: "rgba(249,115,22,0.12)",
      input: "rgba(249,115,22,0.08)",
      ring: "#f97316",
      sidebar: "#200f00",
      sidebarForeground: "#f5d5a8",
      sidebarPrimary: "#f97316",
      sidebarPrimaryForeground: "#1c0f00",
      sidebarAccent: "rgba(249,115,22,0.15)",
      sidebarAccentForeground: "#f97316",
      sidebarBorder: "rgba(249,115,22,0.08)",
      composeBg: "rgba(249,115,22,0.2)",
      composeHover: "rgba(249,115,22,0.3)",
      hoverBg: "rgba(249,115,22,0.07)",
      activeBg: "rgba(249,115,22,0.15)",
      searchBg: "rgba(249,115,22,0.06)",
      textSecondary: "#c49050",
      textMuted: "#8a6030",
      borderLight: "rgba(249,115,22,0.06)",
    },
  },
  lavender: {
    name: "Lavender",
    isDark: false,
    vars: {
      background: "#f8f5ff",
      foreground: "#2e1a4a",
      card: "#ffffff",
      cardForeground: "#2e1a4a",
      popover: "#ffffff",
      popoverForeground: "#2e1a4a",
      primary: "#7c3aed",
      primaryForeground: "#ffffff",
      secondary: "#ede8fb",
      secondaryForeground: "#2e1a4a",
      muted: "#ede8fb",
      mutedForeground: "#6b4fa0",
      accent: "#ddd6fe",
      accentForeground: "#7c3aed",
      destructive: "#dc2626",
      border: "#e2d9f3",
      input: "#ede8fb",
      ring: "#7c3aed",
      sidebar: "#ffffff",
      sidebarForeground: "#2e1a4a",
      sidebarPrimary: "#7c3aed",
      sidebarPrimaryForeground: "#ffffff",
      sidebarAccent: "#ddd6fe",
      sidebarAccentForeground: "#7c3aed",
      sidebarBorder: "#ede8fb",
      composeBg: "#ddd6fe",
      composeHover: "#c4b5fd",
      hoverBg: "#ede8fb",
      activeBg: "#ddd6fe",
      searchBg: "#ede8fb",
      textSecondary: "#6b4fa0",
      textMuted: "#9d80c8",
      borderLight: "#ede8fb",
    },
  },
  nord: {
    name: "Nord",
    isDark: true,
    vars: {
      background: "#2e3440",
      foreground: "#eceff4",
      card: "#3b4252",
      cardForeground: "#eceff4",
      popover: "#3b4252",
      popoverForeground: "#eceff4",
      primary: "#88c0d0",
      primaryForeground: "#2e3440",
      secondary: "#3b4252",
      secondaryForeground: "#eceff4",
      muted: "#434c5e",
      mutedForeground: "#d8dee9",
      accent: "rgba(136,192,208,0.15)",
      accentForeground: "#88c0d0",
      destructive: "#bf616a",
      border: "rgba(236,239,244,0.1)",
      input: "rgba(236,239,244,0.08)",
      ring: "#88c0d0",
      sidebar: "#3b4252",
      sidebarForeground: "#eceff4",
      sidebarPrimary: "#88c0d0",
      sidebarPrimaryForeground: "#2e3440",
      sidebarAccent: "rgba(136,192,208,0.15)",
      sidebarAccentForeground: "#88c0d0",
      sidebarBorder: "rgba(236,239,244,0.08)",
      composeBg: "rgba(136,192,208,0.2)",
      composeHover: "rgba(136,192,208,0.3)",
      hoverBg: "rgba(236,239,244,0.05)",
      activeBg: "rgba(136,192,208,0.15)",
      searchBg: "rgba(236,239,244,0.06)",
      textSecondary: "#d8dee9",
      textMuted: "#8892a0",
      borderLight: "rgba(236,239,244,0.06)",
    },
  },
  mocha: {
    name: "Mocha",
    isDark: true,
    vars: {
      background: "#1c1410",
      foreground: "#e8d5c0",
      card: "#2a1f18",
      cardForeground: "#e8d5c0",
      popover: "#2a1f18",
      popoverForeground: "#e8d5c0",
      primary: "#d4a574",
      primaryForeground: "#1c1410",
      secondary: "#2a1f18",
      secondaryForeground: "#e8d5c0",
      muted: "#3a2e25",
      mutedForeground: "#b08060",
      accent: "rgba(212,165,116,0.15)",
      accentForeground: "#d4a574",
      destructive: "#f87171",
      border: "rgba(212,165,116,0.12)",
      input: "rgba(212,165,116,0.08)",
      ring: "#d4a574",
      sidebar: "#201810",
      sidebarForeground: "#e8d5c0",
      sidebarPrimary: "#d4a574",
      sidebarPrimaryForeground: "#1c1410",
      sidebarAccent: "rgba(212,165,116,0.15)",
      sidebarAccentForeground: "#d4a574",
      sidebarBorder: "rgba(212,165,116,0.08)",
      composeBg: "rgba(212,165,116,0.2)",
      composeHover: "rgba(212,165,116,0.3)",
      hoverBg: "rgba(212,165,116,0.07)",
      activeBg: "rgba(212,165,116,0.15)",
      searchBg: "rgba(212,165,116,0.06)",
      textSecondary: "#b08060",
      textMuted: "#806040",
      borderLight: "rgba(212,165,116,0.06)",
    },
  },
  mint: {
    name: "Mint",
    isDark: false,
    vars: {
      background: "#f0fdf4",
      foreground: "#0a2e1a",
      card: "#ffffff",
      cardForeground: "#0a2e1a",
      popover: "#ffffff",
      popoverForeground: "#0a2e1a",
      primary: "#059669",
      primaryForeground: "#ffffff",
      secondary: "#d1fae5",
      secondaryForeground: "#0a2e1a",
      muted: "#d1fae5",
      mutedForeground: "#2d7a55",
      accent: "#a7f3d0",
      accentForeground: "#059669",
      destructive: "#dc2626",
      border: "#c6f0d8",
      input: "#d1fae5",
      ring: "#059669",
      sidebar: "#ffffff",
      sidebarForeground: "#0a2e1a",
      sidebarPrimary: "#059669",
      sidebarPrimaryForeground: "#ffffff",
      sidebarAccent: "#a7f3d0",
      sidebarAccentForeground: "#059669",
      sidebarBorder: "#d1fae5",
      composeBg: "#a7f3d0",
      composeHover: "#6ee7b7",
      hoverBg: "#d1fae5",
      activeBg: "#a7f3d0",
      searchBg: "#d1fae5",
      textSecondary: "#2d7a55",
      textMuted: "#4da070",
      borderLight: "#d1fae5",
    },
  },
};

// Density sizing
export const DENSITY_CONFIG = {
  compact: {
    rowHeight: "h-9",
    rowPy: "py-1",
    fontSize: "text-xs",
    sidebarPy: "py-1.5",
    gap: "gap-0",
  },
  default: {
    rowHeight: "h-11",
    rowPy: "py-2",
    fontSize: "text-sm",
    sidebarPy: "py-2.5",
    gap: "gap-0.5",
  },
  comfortable: {
    rowHeight: "h-14",
    rowPy: "py-3",
    fontSize: "text-sm",
    sidebarPy: "py-3",
    gap: "gap-1",
  },
};
