import { Router, useLocation, useNavigate } from "@solidjs/router";
import { FileRoutes } from "@solidjs/start/router";
import { Suspense, Show, createSignal, createEffect, createMemo, createResource, onCleanup, onMount } from "solid-js";
import { Link, Meta, MetaProvider } from "@solidjs/meta";
import Sidebar from "~/components/Sidebar";
import Header from "~/components/Header";
import ComposeModal from "~/components/ComposeModal";
import CommandPalette from "~/components/CommandPalette";
import QuickSettings from "~/components/QuickSettings";
import ToastContainer from "~/components/ToastContainer";
import { IconSend } from "~/components/Icons";
import { settings, THEMES, FONTS } from "~/lib/settings-store";
import { folderCounts } from "~/lib/sidebar-store";
import { getUnreadCountForSection, getAutoReplySettings } from "~/lib/mail-client";
import { categoryKeyFromFilterId, getCategoryTabs, getConfiguredCategories, isCategoryFilterId, labelsState, PRIMARY_CATEGORY_KEY } from "~/lib/labels-store";
import { SHORTCUT_ACTIONS, type ShortcutActionId, getEffectiveActionShortcuts, splitShortcutSteps, formatShortcut } from "~/lib/keyboard-shortcuts-store";
import { showToast } from "~/lib/toast-store";
import { toggleCommandPalette, commandPaletteOpen } from "~/lib/command-palette-store";
import "./app.css";

interface ImportBannerJob {
  id: string;
  status: "created" | "uploading" | "queued" | "running" | "completed" | "failed" | "cancelled";
  startedAt: string | null;
  fileSizeBytes: number;
  uploadedBytes: number;
  processedMessages: number;
  dbImportedMessages: number;
  imapSyncedMessages: number;
  estimatedTotalMessages: number | null;
  estimationInProgress: boolean;
  estimationScannedBytes: number;
  estimationTotalBytes: number;
  updatedAt: string;
}

interface AutoReplyBannerSettings {
  enabled: boolean;
  subject: string;
  bodyHtml: string;
  bodyText: string;
  startDate: string | null;
  endDate: string | null;
}

export default function App() {
  const SIDEBAR_COLLAPSED_KEY = "sidebarCollapsed";
  const [quickSettingsOpen, setQuickSettingsOpen] = createSignal(false);
  const [searchTerm, setSearchTerm] = createSignal("");
  const [sidebarCollapsed, setSidebarCollapsed] = createSignal(false);
  const [importBannerJob, setImportBannerJob] = createSignal<ImportBannerJob | null>(null);
  const [autoReplySettings, { refetch: refetchAutoReplySettings }] = createResource(getAutoReplySettings);
  const activeImportStatuses: ImportBannerJob["status"][] = ["created", "uploading", "queued", "running"];

  onMount(() => {
    const saved = localStorage.getItem(SIDEBAR_COLLAPSED_KEY);
    if (saved === "true") {
      setSidebarCollapsed(true);
    }
    if (window.location.pathname === "/login") {
      return;
    }

    const rank = (status: ImportBannerJob["status"]) => {
      if (status === "running") return 1;
      if (status === "uploading") return 2;
      if (status === "queued") return 3;
      if (status === "created") return 4;
      return 9;
    };

    const pick = (jobs: ImportBannerJob[]) => {
      const active = jobs.filter((j) => activeImportStatuses.includes(j.status));
      if (!active.length) return null;
      return [...active].sort((a, b) => {
        const r = rank(a.status) - rank(b.status);
        if (r !== 0) return r;
        return Date.parse(b.updatedAt) - Date.parse(a.updatedAt);
      })[0];
    };

    const updateImportBanner = async () => {
      try {
        const res = await fetch("/api/imports/takeout/jobs");
        if (!res.ok) return;
        const payload = (await res.json()) as { jobs?: ImportBannerJob[] };
        const job = payload.jobs ? pick(payload.jobs) : null;
        setImportBannerJob(job);
        localStorage.setItem("takeoutImportActive", job ? "true" : "false");
      } catch {
        // Keep last known banner state on transient network errors.
      }
    };

    void updateImportBanner();
    const timer = setInterval(() => {
      void updateImportBanner();
    }, 2500);
    return () => clearInterval(timer);
  });

  onMount(() => {
    if (typeof window === "undefined") return;
    const handleClearSearchInput = () => {
      setSearchTerm("");
    };
    window.addEventListener("webmail-clear-search-input", handleClearSearchInput);
    onCleanup(() => {
      window.removeEventListener("webmail-clear-search-input", handleClearSearchInput);
    });
  });

  onMount(() => {
    if (window.location.pathname === "/login") return;
    const handleAutoReplyUpdated = () => {
      void refetchAutoReplySettings();
    };
    window.addEventListener("auto-reply-settings-updated", handleAutoReplyUpdated);
    const timer = setInterval(() => {
      void refetchAutoReplySettings();
    }, 30_000);
    return () => {
      window.removeEventListener("auto-reply-settings-updated", handleAutoReplyUpdated);
      clearInterval(timer);
    };
  });

  // Apply theme: set data-kb-theme for Kobalte and all CSS custom properties
  createEffect(() => {
    if (typeof document === "undefined") return;
    const theme = THEMES[settings.theme];
    const root = document.documentElement;
    root.setAttribute("data-kb-theme", theme.isDark ? "dark" : "light");
    const v = theme.vars;
    root.style.setProperty("--background", v.background);
    root.style.setProperty("--foreground", v.foreground);
    root.style.setProperty("--card", v.card);
    root.style.setProperty("--card-foreground", v.cardForeground);
    root.style.setProperty("--popover", v.popover);
    root.style.setProperty("--popover-foreground", v.popoverForeground);
    root.style.setProperty("--primary", v.primary);
    root.style.setProperty("--primary-foreground", v.primaryForeground);
    root.style.setProperty("--secondary", v.secondary);
    root.style.setProperty("--secondary-foreground", v.secondaryForeground);
    root.style.setProperty("--muted", v.muted);
    root.style.setProperty("--muted-foreground", v.mutedForeground);
    root.style.setProperty("--accent", v.accent);
    root.style.setProperty("--accent-foreground", v.accentForeground);
    root.style.setProperty("--destructive", v.destructive);
    root.style.setProperty("--border", v.border);
    root.style.setProperty("--input", v.input);
    root.style.setProperty("--ring", v.ring);
    root.style.setProperty("--sidebar", v.sidebar);
    root.style.setProperty("--sidebar-foreground", v.sidebarForeground);
    root.style.setProperty("--sidebar-primary", v.sidebarPrimary);
    root.style.setProperty("--sidebar-primary-foreground", v.sidebarPrimaryForeground);
    root.style.setProperty("--sidebar-accent", v.sidebarAccent);
    root.style.setProperty("--sidebar-accent-foreground", v.sidebarAccentForeground);
    root.style.setProperty("--sidebar-border", v.sidebarBorder);
    root.style.setProperty("--compose-bg", v.composeBg);
    root.style.setProperty("--compose-hover", v.composeHover);
    root.style.setProperty("--hover-bg", v.hoverBg);
    root.style.setProperty("--active-bg", v.activeBg);
    root.style.setProperty("--search-bg", v.searchBg);
    root.style.setProperty("--text-secondary", v.textSecondary);
    root.style.setProperty("--text-muted", v.textMuted);
    root.style.setProperty("--border-light", v.borderLight);
  });

  // Apply font family and dynamically load Google Fonts if needed
  createEffect(() => {
    if (typeof document === "undefined") return;
    const font = FONTS[settings.font];
    // Inject Google Fonts stylesheet once per font
    if (font.googleFontsUrl) {
      const linkId = `gfont-${settings.font}`;
      if (!document.getElementById(linkId)) {
        const link = document.createElement("link");
        link.id = linkId;
        link.rel = "stylesheet";
        link.href = font.googleFontsUrl;
        document.head.appendChild(link);
      }
    }
    document.documentElement.style.setProperty("--font-ui", font.family);
  });

  const uploadProgressPercent = () => {
    const job = importBannerJob();
    if (!job || job.fileSizeBytes <= 0) return 0;
    return Math.min(100, Math.round((job.uploadedBytes / job.fileSizeBytes) * 100));
  };

  const analysisProgressPercent = () => {
    const job = importBannerJob();
    if (!job) return 0;
    if (job.estimationInProgress && job.estimationTotalBytes > 0) {
      return Math.min(100, Math.round((job.estimationScannedBytes / job.estimationTotalBytes) * 100));
    }
    if (!job.estimationInProgress && (job.estimatedTotalMessages ?? 0) > 0) {
      return 100;
    }
    return 0;
  };

  const importProgressPercent = () => {
    const job = importBannerJob();
    if (!job) return 0;
    if ((job.status === "running" || job.status === "completed") && job.estimatedTotalMessages && job.estimatedTotalMessages > 0) {
      const inDbPhase = job.status === "running" && job.processedMessages < job.estimatedTotalMessages;
      if (inDbPhase) {
        return Math.min(100, Math.round((job.processedMessages / job.estimatedTotalMessages) * 100));
      }
      const syncTarget = Math.max(1, job.dbImportedMessages || 1);
      const synced = Math.max(job.imapSyncedMessages ?? 0, 0);
      return Math.min(100, Math.round((synced / syncTarget) * 100));
    }
    if (job.status === "completed") {
      return 100;
    }
    return 0;
  };

  const shouldShowImportBanner = () => !!importBannerJob();
  const bannerMode = (): "upload" | "analysis" | "import" => {
    const job = importBannerJob();
    if (!job) return "upload";
    if (job.estimationInProgress) return "analysis";
    const hasPendingUpload = job.fileSizeBytes > 0 && job.uploadedBytes < job.fileSizeBytes;
    if (hasPendingUpload) return "upload";
    return "import";
  };
  const bannerProgressPercent = () => {
    const mode = bannerMode();
    if (mode === "upload") return uploadProgressPercent();
    if (mode === "analysis") return analysisProgressPercent();
    return importProgressPercent();
  };
  const bannerModeLabel = () => {
    const mode = bannerMode();
    if (mode === "upload") return "Upload";
    if (mode === "analysis") return "Analysis";
    return "Import";
  };
  const currentImportPhaseLabel = () => {
    const job = importBannerJob();
    if (!job) return "Preparing import.";
    if (bannerMode() === "analysis") return "Analyzing Google Takeout archive.";
    if (bannerMode() === "upload") return "Uploading Google Takeout archive.";
    if (job.status === "completed") return "Google Takeout import completed.";
    if (job.status === "queued") return "Queued import is waiting to start.";
    if (job.status === "running" && job.estimatedTotalMessages && job.processedMessages < job.estimatedTotalMessages) {
      return "Importing messages to local database.";
    }
    if (job.status === "running" && job.imapSyncedMessages < job.dbImportedMessages) {
      return "Imported to database. Syncing to IMAP mailbox.";
    }
    if (job.status === "running") return "Importing messages from Google Takeout.";
    return "Preparing import.";
  };
  const formatEta = (seconds: number) => {
    if (seconds < 60) return `${Math.max(1, Math.round(seconds))}s`;
    if (seconds < 3600) return `${Math.round(seconds / 60)}m`;
    const h = Math.floor(seconds / 3600);
    const m = Math.round((seconds % 3600) / 60);
    return m > 0 ? `${h}h ${m}m` : `${h}h`;
  };

  const importEtaLabel = () => {
    const job = importBannerJob();
    if (!job) return null;
    if (job.status !== "running" || job.estimationInProgress) return null;
    if (!job.estimatedTotalMessages || job.estimatedTotalMessages <= 0) return null;
    if (!job.startedAt) return null;
    const elapsedSec = (Date.now() - Date.parse(job.startedAt)) / 1000;
    if (!Number.isFinite(elapsedSec) || elapsedSec < 20) return null;
    const inDbPhase = job.processedMessages < job.estimatedTotalMessages;
    const done = inDbPhase ? job.processedMessages : job.imapSyncedMessages;
    if (done < 20) return null;
    const rate = done / elapsedSec;
    if (!Number.isFinite(rate) || rate <= 0.05) return null;
    const target = inDbPhase ? job.estimatedTotalMessages : Math.max(1, job.dbImportedMessages || 1);
    const remaining = Math.max(0, target - done);
    const etaSec = remaining / rate;
    return formatEta(etaSec);
  };

  const isAutoReplyActive = (settings: AutoReplyBannerSettings | undefined): boolean => {
    if (!settings?.enabled) return false;
    const now = new Date();
    if (settings.startDate) {
      const start = new Date(`${settings.startDate}T00:00:00`);
      if (now < start) return false;
    }
    if (settings.endDate) {
      const end = new Date(`${settings.endDate}T23:59:59.999`);
      if (now > end) return false;
    }
    return true;
  };

  const shouldShowAutoReplyBanner = () => isAutoReplyActive(autoReplySettings() as AutoReplyBannerSettings | undefined);
  const autoReplyBannerMessage = () => {
    const settings = autoReplySettings() as AutoReplyBannerSettings | undefined;
    if (!settings) return "Auto reply is active. Replies are sent once per sender per active period.";
    if (settings.startDate && settings.endDate) {
      return `Auto reply is active from ${settings.startDate} until ${settings.endDate}. Replies are sent once per sender per active period.`;
    }
    if (settings.startDate) {
      return `Auto reply is active from ${settings.startDate}. Replies are sent once per sender per active period.`;
    }
    if (settings.endDate) {
      return `Auto reply is active until ${settings.endDate}. Replies are sent once per sender per active period.`;
    }
    return "Auto reply is active. Replies are sent once per sender per active period.";
  };


  createEffect(() => {
    if (typeof window === "undefined") return;
    localStorage.setItem(SIDEBAR_COLLAPSED_KEY, sidebarCollapsed() ? "true" : "false");
  });

  onMount(() => {
    if (typeof window === "undefined") return;

    let pendingChordStep: string | null = null;
    let chordTimer: ReturnType<typeof setTimeout> | undefined;
    const SHIFTED_SYMBOL_ALIASES: Record<string, string> = {
      "/": "?",
      "1": "!",
      "3": "#",
    };
    const REVERSE_SHIFTED_ALIASES: Record<string, string> = {
      "?": "/",
      "!": "1",
      "#": "3",
    };
    const appActionIds: ShortcutActionId[] = [
      "openLeftMenu",
      "openRightMenu",
      "menuNextItem",
      "menuPreviousItem",
      "menuActivateItem",
      "openCommandPalette",
    ];

    const isInInput = (el: EventTarget | null): boolean => {
      if (!el || !(el instanceof HTMLElement)) return false;
      const tag = el.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return true;
      if (el.isContentEditable) return true;
      return false;
    };

    const addCandidate = (
      set: Set<string>,
      key: string,
      mods: { ctrl: boolean; alt: boolean; shift: boolean; meta: boolean },
    ) => {
      if (!key) return;
      const prefix = ["ctrl", "alt", "shift", "meta"]
        .filter((mod) => mods[mod as keyof typeof mods])
        .join("+");
      set.add(prefix ? `${prefix}+${key}` : key);
    };

    const eventStepCandidates = (e: KeyboardEvent): Set<string> => {
      const candidates = new Set<string>();
      const mods = { ctrl: e.ctrlKey, alt: e.altKey, shift: e.shiftKey, meta: e.metaKey };

      let key = e.key;
      if (key === "Esc") key = "Escape";
      if (key === " ") key = "Space";
      if (key.startsWith("Arrow")) key = key.slice(5);
      key = key.toLowerCase();

      const isLetter = key.length === 1 && /[a-z]/.test(key);
      if (isLetter && e.shiftKey) {
        addCandidate(candidates, key, mods);
        return candidates;
      }

      if (e.shiftKey) {
        addCandidate(candidates, key, mods);
        const alias = SHIFTED_SYMBOL_ALIASES[key] || key;
        addCandidate(candidates, alias, { ...mods, shift: false });
        if (REVERSE_SHIFTED_ALIASES[key]) addCandidate(candidates, key, { ...mods, shift: false });
        return candidates;
      }

      addCandidate(candidates, key, mods);
      return candidates;
    };

    const shortcutsFor = (actionId: ShortcutActionId): string[][] =>
      getEffectiveActionShortcuts(actionId)
        .map((shortcut) => splitShortcutSteps(shortcut))
        .filter((steps) => steps.length > 0);

    const actionLabelById = (actionId: ShortcutActionId) =>
      SHORTCUT_ACTIONS.find((action) => action.id === actionId)?.label || actionId;

    const showShortcutFeedback = (shortcut: string, actionId: ShortcutActionId) => {
      if (!settings.shortcutFeedback) return;
      showToast(`${formatShortcut(shortcut)} -> ${actionLabelById(actionId)}`, "info");
    };

    const matchSingleStepAction = (
      candidates: Set<string>,
    ): { actionId: ShortcutActionId; shortcut: string } | null => {
      for (const actionId of appActionIds) {
        for (const steps of shortcutsFor(actionId)) {
          if (steps.length === 1 && candidates.has(steps[0])) {
            return { actionId, shortcut: steps[0] };
          }
        }
      }
      return null;
    };

    const matchChordAction = (
      firstStep: string,
      candidates: Set<string>,
    ): { actionId: ShortcutActionId; shortcut: string } | null => {
      for (const actionId of appActionIds) {
        for (const steps of shortcutsFor(actionId)) {
          if (steps.length === 2 && steps[0] === firstStep && candidates.has(steps[1])) {
            return { actionId, shortcut: `${steps[0]} ${steps[1]}` };
          }
        }
      }
      return null;
    };

    const matchChordStart = (candidates: Set<string>): string | null => {
      for (const actionId of appActionIds) {
        const match = shortcutsFor(actionId).find((steps) => steps.length === 2 && candidates.has(steps[0]));
        if (match) return match[0];
      }
      return null;
    };

    const getFocusedMenuItems = (): HTMLElement[] => {
      const rightPanel = document.querySelector<HTMLElement>('[data-shortcut-right-menu="true"]');
      const rightOpen = quickSettingsOpen() && Boolean(rightPanel);
      const leftPanel = document.querySelector<HTMLElement>('[data-shortcut-left-menu="true"]');
      const panel =
        rightOpen
          ? rightPanel
          : (!sidebarCollapsed() && leftPanel ? leftPanel : null);
      if (!panel) return [];
      const candidates = Array.from(panel.querySelectorAll<HTMLElement>("a[href], button"));
      return candidates.filter((el) => {
        const hidden = el.getAttribute("aria-hidden") === "true";
        const disabled = el.hasAttribute("disabled");
        const visible = el.getClientRects().length > 0;
        return !hidden && !disabled && visible;
      });
    };

    const isMenuFocusContext = (): boolean => {
      if (quickSettingsOpen()) return true;
      const active = document.activeElement as HTMLElement | null;
      if (!active) return false;
      return Boolean(
        active.closest('[data-shortcut-left-menu="true"], [data-shortcut-right-menu="true"]'),
      );
    };

    const moveMenuFocus = (direction: 1 | -1): boolean => {
      const items = getFocusedMenuItems();
      if (!items.length) return false;
      const active = document.activeElement as HTMLElement | null;
      const currentIndex = items.findIndex((item) => item === active);
      const startIndex = currentIndex === -1 ? (direction > 0 ? -1 : 0) : currentIndex;
      const nextIndex = (startIndex + direction + items.length) % items.length;
      items[nextIndex]?.focus();
      return true;
    };

    const activateFocusedMenuItem = (): boolean => {
      const items = getFocusedMenuItems();
      if (!items.length) return false;
      const active = document.activeElement as HTMLElement | null;
      if (!active || !items.includes(active)) return false;
      active.click();
      return true;
    };

    const openLeftMenu = (): boolean => {
      if (!sidebarCollapsed()) {
        setSidebarCollapsed(true);
        return true;
      }
      setSidebarCollapsed(false);
      queueMicrotask(() => {
        const items = getFocusedMenuItems();
        items[0]?.focus();
      });
      return true;
    };

    const openRightMenu = (): boolean => {
      if (quickSettingsOpen()) {
        setQuickSettingsOpen(false);
        return true;
      }
      setQuickSettingsOpen(true);
      queueMicrotask(() => {
        const items = getFocusedMenuItems();
        items[0]?.focus();
      });
      return true;
    };

    const executeAction = (actionId: ShortcutActionId, e: KeyboardEvent): boolean => {
      if (window.location.pathname === "/login") return false;
      if (actionId === "openCommandPalette") {
        e.preventDefault();
        toggleCommandPalette();
        return true;
      }
      if (actionId === "openLeftMenu") {
        e.preventDefault();
        return openLeftMenu();
      }
      if (actionId === "openRightMenu") {
        e.preventDefault();
        return openRightMenu();
      }
      if (actionId === "menuNextItem") {
        if (!isMenuFocusContext()) return false;
        const handled = moveMenuFocus(1);
        if (handled) e.preventDefault();
        return handled;
      }
      if (actionId === "menuPreviousItem") {
        if (!isMenuFocusContext()) return false;
        const handled = moveMenuFocus(-1);
        if (handled) e.preventDefault();
        return handled;
      }
      if (actionId === "menuActivateItem") {
        if (!isMenuFocusContext()) return false;
        const handled = activateFocusedMenuItem();
        if (handled) e.preventDefault();
        return handled;
      }
      return false;
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      // Allow Cmd/Ctrl+K to open command palette even from inputs
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        toggleCommandPalette();
        return;
      }
      if (commandPaletteOpen()) return;
      if (isInInput(e.target)) return;
      if (e.key === "Tab" && isMenuFocusContext()) {
        const handled = moveMenuFocus(e.shiftKey ? -1 : 1);
        if (handled) {
          e.preventDefault();
          return;
        }
      }
      const candidates = eventStepCandidates(e);

      if (pendingChordStep) {
        if (chordTimer !== undefined) clearTimeout(chordTimer);
        const matchedChordAction = matchChordAction(pendingChordStep, candidates);
        pendingChordStep = null;
        if (matchedChordAction && executeAction(matchedChordAction.actionId, e)) {
          showShortcutFeedback(matchedChordAction.shortcut, matchedChordAction.actionId);
          return;
        }
      }

      const singleAction = matchSingleStepAction(candidates);
      if (singleAction && executeAction(singleAction.actionId, e)) {
        showShortcutFeedback(singleAction.shortcut, singleAction.actionId);
        return;
      }

      const chordStart = matchChordStart(candidates);
      if (chordStart) {
        pendingChordStep = chordStart;
        chordTimer = setTimeout(() => {
          pendingChordStep = null;
        }, 800);
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    onCleanup(() => {
      document.removeEventListener("keydown", handleKeyDown);
      if (chordTimer !== undefined) clearTimeout(chordTimer);
    });
  });

  return (
    <MetaProvider>
      <Link rel="manifest" href="/manifest.webmanifest" />
      <Link rel="icon" href="/favicon.svg" type="image/svg+xml" />
      <Link rel="icon" href="/pwa-192.png" sizes="192x192" />
      <Link rel="apple-touch-icon" href="/pwa-192.png" />
      <Meta name="theme-color" content="#0f766e" />
      <Meta name="mobile-web-app-capable" content="yes" />
      <Meta name="apple-mobile-web-app-capable" content="yes" />
      <Meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
      <Router
        root={(props) => {
          const navigate = useNavigate();
          const location = useLocation();

          const handleSearch = (query: string) => {
            if (query.trim()) {
              navigate(`/search?q=${encodeURIComponent(query.trim())}`);
            } else {
              navigate("/");
            }
          };

          const toTitleCase = (value: string) =>
            value
              .replace(/[-_]+/g, " ")
              .trim()
              .split(/\s+/)
              .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
              .join(" ");

          const toPrimaryCategorySection = () => {
            const categoryLabels = getConfiguredCategories()
              .map((category) => `Category ${category.name}`.trim())
              .filter(Boolean);
            if (categoryLabels.length === 0) return "inbox:primary";
            return `inbox:primary:${categoryLabels.join("|")}`;
          };

          const resolveInboxFilterContext = (filter: string | null): { title: string; unreadSection: string; fallbackFolder?: string } => {
            if (filter === "starred") return { title: "Starred", unreadSection: "starred", fallbackFolder: "Starred" };
            if (filter === "important") return { title: "Important", unreadSection: "important", fallbackFolder: "Important" };
            if (filter && isCategoryFilterId(filter) && settings.enableCategories) {
              const key = categoryKeyFromFilterId(filter) || PRIMARY_CATEGORY_KEY;
              if (key === PRIMARY_CATEGORY_KEY) return { title: "Inbox", unreadSection: toPrimaryCategorySection() };
              const category = getCategoryTabs().find((tab) => tab.key === key);
              if (category) {
                return {
                  title: category.name,
                  unreadSection: `label:Category ${category.name}`,
                };
              }
              return { title: "Inbox", unreadSection: toPrimaryCategorySection() };
            }
            if (filter) {
              const label = labelsState.labels.find((candidate) => candidate.id === filter);
              if (label) {
                return { title: label.name, unreadSection: `label:${label.name}` };
              }
            }
            if (settings.enableCategories) {
              return { title: "Inbox", unreadSection: toPrimaryCategorySection() };
            }
            return { title: "Inbox", unreadSection: "INBOX", fallbackFolder: "Inbox" };
          };

          const currentMailbox = (): { title: string; unreadSection: string | null; fallbackFolder?: string } | null => {
            const path = location.pathname;
            if (path === "/") {
              const params = new URLSearchParams(location.search);
              const filter = params.get("filter");
              return resolveInboxFilterContext(filter);
            }
            if (path.startsWith("/folder/")) {
              const raw = decodeURIComponent(path.slice("/folder/".length));
              return {
                title: toTitleCase(raw),
                unreadSection: raw,
                fallbackFolder: toTitleCase(raw),
              };
            }
            if (path.startsWith("/email/")) {
              const params = new URLSearchParams(location.search);
              const folder = params.get("folder");
              if (folder) {
                return {
                  title: toTitleCase(folder),
                  unreadSection: folder,
                  fallbackFolder: toTitleCase(folder),
                };
              }
              return resolveInboxFilterContext(null);
            }
            return null;
          };

          const sectionContext = createMemo(() => currentMailbox());
          const [activeUnreadCount, setActiveUnreadCount] = createSignal<number | null>(null);

          createEffect(() => {
            const context = sectionContext();
            const unreadSection = context?.unreadSection;
            setActiveUnreadCount(null);
            if (!unreadSection) return;

            let cancelled = false;
            void getUnreadCountForSection(unreadSection)
              .then((value) => {
                if (!cancelled) setActiveUnreadCount(Math.max(0, Number(value) || 0));
              })
              .catch(() => {
                if (!cancelled) setActiveUnreadCount(0);
              });

            onCleanup(() => {
              cancelled = true;
            });
          });

          createEffect(() => {
            if (typeof document === "undefined") return;
            const context = sectionContext();
            if (!context) {
              document.title = "Homerow";
              return;
            }
            const fallbackUnread = context.fallbackFolder ? (folderCounts()?.[context.fallbackFolder]?.unread ?? 0) : 0;
            const unread = activeUnreadCount() ?? fallbackUnread;
            const unreadPrefix = unread > 0 ? `(${unread}) ` : "";
            document.title = `${unreadPrefix}${context.title} - Homerow`;
          });

          const isAuthPage = () => location.pathname === "/login";
          const globalBannerCount = () => Number(shouldShowImportBanner()) + Number(shouldShowAutoReplyBanner());
          const headerRowStart = () => globalBannerCount() + 1;
          const contentRowStart = () => globalBannerCount() + 2;
          const gridTemplateRows = () => {
            const count = globalBannerCount();
            if (count === 0) return "64px 1fr";
            if (count === 1) return "58px 64px 1fr";
            return "58px 58px 64px 1fr";
          };

          return (
            <Show
              when={!isAuthPage()}
              fallback={<Suspense>{props.children}</Suspense>}
            >
              <div
                class="grid h-screen bg-[var(--background)] overflow-hidden"
                style={{
                  "grid-template-columns": sidebarCollapsed() ? "0 1fr" : "256px 1fr",
                  "grid-template-rows": gridTemplateRows(),
                }}
              >
                <Show when={shouldShowImportBanner()}>
                  <div class="col-span-full row-start-1 border-b border-[#cfe7d6] bg-gradient-to-r from-[#ecf8ef] via-[#f3fbf5] to-[#e9f7ff] px-4">
                    <div class="mx-auto w-full max-w-6xl">
                      <div class="h-[58px] py-2.5 flex flex-col gap-1.5">
                        <div class="flex items-center justify-between gap-4 text-sm">
                          <div class="flex items-center gap-3 min-w-0">
                            <span class="px-2 py-0.5 rounded-full bg-[#d4f0dc] text-[#186238] text-[11px] font-bold uppercase tracking-wider shrink-0">
                              Gmail Import
                            </span>
                            <span class="px-2 py-0.5 rounded-full bg-white text-[#186238] text-[10px] font-semibold uppercase tracking-wide shrink-0 border border-[#cfe3d5]">
                              {bannerModeLabel()}
                            </span>
                            <span class="text-[#1f5134] font-medium truncate">
                              {currentImportPhaseLabel()}
                              {` · ${bannerProgressPercent()}%`}
                              <Show when={importEtaLabel()}>
                                {` · ETA ${importEtaLabel()}`}
                              </Show>
                            </span>
                          </div>
                          <div class="flex items-center gap-2 shrink-0">
                            <button
                              onClick={() => navigate("/settings?tab=import")}
                              class="px-3 py-1 rounded-md text-xs font-semibold text-[#165a33] bg-white border border-[#b8dfc5] cursor-pointer hover:bg-[#f6fff9]"
                            >
                              Open Import Details
                            </button>
                          </div>
                        </div>
                        <div class="h-1.5 rounded-full bg-[#d9ebde] overflow-hidden">
                          <Show when={bannerProgressPercent() > 0} fallback={
                            <div class="h-full w-1/3 bg-[#2a8c50] animate-pulse" />
                          }>
                            <div class="h-full bg-[#2a8c50] transition-all duration-500" style={{ width: `${bannerProgressPercent()}%` }} />
                          </Show>
                        </div>
                      </div>
                    </div>
                  </div>
                </Show>

                <Show when={shouldShowAutoReplyBanner()}>
                  <div data-testid="page-auto-reply-banner" class="col-span-full border-b border-[#bfd8ff]" style={{ "grid-row-start": shouldShowImportBanner() ? 2 : 1 }}>
                    <div class="bg-gradient-to-r from-[#eaf3ff] via-[#f2f8ff] to-[#e8f4ff] px-4">
                      <div class="mx-auto w-full max-w-6xl">
                        <div class="h-[58px] py-2.5 flex items-center justify-between gap-4 text-sm">
                          <div class="flex items-center gap-3 min-w-0">
                            <span class="inline-flex items-center justify-center w-6 h-6 rounded-full bg-[#d7e9ff] text-[#1f5fae] shrink-0">
                              <IconSend size={13} />
                            </span>
                            <span class="px-2 py-0.5 rounded-full bg-[#d7e9ff] text-[#1f5fae] text-[11px] font-bold uppercase tracking-wider shrink-0">
                              Auto Reply
                            </span>
                            <span class="text-[#1f4f86] font-medium truncate">
                              {autoReplyBannerMessage()}
                            </span>
                          </div>
                          <div class="flex items-center gap-2 shrink-0">
                            <button
                              onClick={() => navigate("/settings?tab=auto-reply")}
                              class="px-3 py-1 rounded-md text-xs font-semibold text-[#1f5fae] bg-white border border-[#b9d6ff] cursor-pointer hover:bg-[#f3f9ff]"
                            >
                              Open Auto-Reply Settings
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </Show>

                <div class="col-span-full" style={{ "grid-row-start": headerRowStart() }}>
                  <Header
                    searchTerm={searchTerm}
                    setSearchTerm={setSearchTerm}
                    onSearch={handleSearch}
                    onOpenSettings={() => setQuickSettingsOpen(true)}
                    sidebarCollapsed={sidebarCollapsed()}
                    onToggleSidebar={() => {
                      const nextCollapsed = !sidebarCollapsed();
                      setSidebarCollapsed(nextCollapsed);
                      if (!nextCollapsed) {
                        queueMicrotask(() => {
                          const panel = document.querySelector<HTMLElement>('[data-shortcut-left-menu="true"]');
                          const first = panel?.querySelector<HTMLElement>("a[href], button");
                          first?.focus();
                        });
                      }
                    }}
                  />
                </div>

                <div class="col-start-1 min-w-0 h-full overflow-hidden mt-1" style={{ "grid-row-start": contentRowStart() }}>
                  <Show when={!sidebarCollapsed()}>
                    <Suspense fallback={<aside class="bg-[var(--card)] border-r border-[var(--border-light)] w-full h-full" />}>
                      <Sidebar />
                    </Suspense>
                  </Show>
                </div>
                <main class="col-start-2 overflow-hidden flex flex-col relative mt-1" style={{ "grid-row-start": contentRowStart() }}>
                  <Suspense
                    fallback={
                      <div class="p-8 flex flex-col gap-3">
                        <div class="skeleton h-10 w-full" />
                        <div class="skeleton h-10 w-full" />
                        <div class="skeleton h-10 w-full" />
                        <div class="skeleton h-10 w-3/4" />
                      </div>
                    }
                  >
                    {props.children}
                  </Suspense>
                </main>

                <ComposeModal />
                <CommandPalette />

                <QuickSettings
                  isOpen={quickSettingsOpen()}
                  onClose={() => setQuickSettingsOpen(false)}
                />

                <ToastContainer />
              </div>
            </Show>
          );
        }}
      >
        <FileRoutes />
      </Router>
    </MetaProvider>
  );
}
