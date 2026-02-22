import { createEffect } from "solid-js";
import { createStore } from "solid-js/store";

export type ShortcutActionId =
  | "openLeftMenu"
  | "openRightMenu"
  | "menuNextItem"
  | "menuPreviousItem"
  | "menuActivateItem"
  | "previousPage"
  | "nextPage"
  | "nextConversation"
  | "previousConversation"
  | "openConversation"
  | "returnToList"
  | "archiveConversation"
  | "deleteConversation"
  | "toggleStar"
  | "toggleSelection"
  | "markUnread"
  | "markImportant"
  | "reportSpam"
  | "archivePrevious"
  | "archiveNext"
  | "compose"
  | "sendCompose"
  | "composeMinimize"
  | "composeToggleFullscreen"
  | "composeClose"
  | "composeSaveDraft"
  | "composeToggleSchedule"
  | "composeAttachFiles"
  | "reply"
  | "replyAll"
  | "forward"
  | "openActionsMenu"
  | "openSnoozeMenu"
  | "refreshEmails"
  | "focusSearch"
  | "gotoInbox"
  | "gotoStarred"
  | "gotoDrafts"
  | "gotoSent"
  | "clearSelection"
  | "toggleHelp"
  | "openCommandPalette";

export interface ShortcutActionDef {
  id: ShortcutActionId;
  section: "Navigation" | "Actions" | "Compose" | "Go to" | "Search & Help";
  label: string;
  description: string;
  defaultPrimary: string;
}

export interface ShortcutBinding {
  primary: string;
}

export type ShortcutBindings = Record<ShortcutActionId, ShortcutBinding>;

interface ShortcutRef {
  actionId: ShortcutActionId;
}

export const SHORTCUT_ACTIONS: ShortcutActionDef[] = [
  { id: "openLeftMenu", section: "Navigation", label: "Toggle left menu", description: "Open or collapse the left sidebar menu", defaultPrimary: "m" },
  { id: "openRightMenu", section: "Navigation", label: "Toggle right menu", description: "Open or close quick settings menu", defaultPrimary: "shift+m" },
  { id: "menuNextItem", section: "Navigation", label: "Menu next item", description: "Move focus to the next menu item", defaultPrimary: "down" },
  { id: "menuPreviousItem", section: "Navigation", label: "Menu previous item", description: "Move focus to the previous menu item", defaultPrimary: "up" },
  { id: "menuActivateItem", section: "Navigation", label: "Menu select item", description: "Activate focused menu item", defaultPrimary: "enter" },
  { id: "previousPage", section: "Navigation", label: "Previous page", description: "Go to previous page in list", defaultPrimary: "shift+left" },
  { id: "nextPage", section: "Navigation", label: "Next page", description: "Go to next page in list", defaultPrimary: "shift+right" },
  { id: "nextConversation", section: "Navigation", label: "Next conversation", description: "Move to the next conversation", defaultPrimary: "j" },
  { id: "previousConversation", section: "Navigation", label: "Previous conversation", description: "Move to the previous conversation", defaultPrimary: "k" },
  { id: "openConversation", section: "Navigation", label: "Open selected conversation", description: "Open the selected conversation in full view", defaultPrimary: "o" },
  { id: "returnToList", section: "Navigation", label: "Return to conversation list", description: "Close reading pane selection", defaultPrimary: "u" },
  { id: "archiveConversation", section: "Actions", label: "Archive", description: "Archive selected conversation(s)", defaultPrimary: "e" },
  { id: "deleteConversation", section: "Actions", label: "Delete", description: "Delete selected conversation(s)", defaultPrimary: "#" },
  { id: "toggleStar", section: "Actions", label: "Star / unstar", description: "Toggle star on selected conversation", defaultPrimary: "s" },
  { id: "toggleSelection", section: "Actions", label: "Select / deselect", description: "Toggle checkbox selection for selected conversation", defaultPrimary: "x" },
  { id: "markUnread", section: "Actions", label: "Mark as unread", description: "Mark selected conversation(s) as unread", defaultPrimary: "shift+u" },
  { id: "markImportant", section: "Actions", label: "Mark as important", description: "Toggle important label on selected conversation", defaultPrimary: "shift+i" },
  { id: "reportSpam", section: "Actions", label: "Report as spam", description: "Move selected conversation(s) to spam", defaultPrimary: "!" },
  { id: "archivePrevious", section: "Actions", label: "Archive and previous", description: "Archive selected and move to previous conversation", defaultPrimary: "[" },
  { id: "archiveNext", section: "Actions", label: "Archive and next", description: "Archive selected and move to next conversation", defaultPrimary: "]" },
  { id: "compose", section: "Compose", label: "Compose new message", description: "Open compose window", defaultPrimary: "c" },
  { id: "sendCompose", section: "Compose", label: "Send message", description: "Send compose message from editor", defaultPrimary: "ctrl+enter" },
  { id: "composeMinimize", section: "Compose", label: "Minimize compose", description: "Minimize compose window", defaultPrimary: "ctrl+shift+m" },
  { id: "composeToggleFullscreen", section: "Compose", label: "Toggle compose fullscreen", description: "Expand or restore compose window", defaultPrimary: "ctrl+shift+f" },
  { id: "composeClose", section: "Compose", label: "Close compose", description: "Close compose window", defaultPrimary: "ctrl+shift+w" },
  { id: "composeSaveDraft", section: "Compose", label: "Save draft", description: "Save compose draft", defaultPrimary: "ctrl+s" },
  { id: "composeToggleSchedule", section: "Compose", label: "Toggle schedule send", description: "Open or close schedule send controls", defaultPrimary: "ctrl+shift+s" },
  { id: "composeAttachFiles", section: "Compose", label: "Attach files", description: "Open file picker for attachments", defaultPrimary: "ctrl+shift+a" },
  { id: "reply", section: "Compose", label: "Reply", description: "Reply to selected conversation", defaultPrimary: "r" },
  { id: "replyAll", section: "Compose", label: "Reply all", description: "Reply all to selected conversation", defaultPrimary: "a" },
  { id: "forward", section: "Compose", label: "Forward", description: "Forward selected conversation", defaultPrimary: "f" },
  { id: "openActionsMenu", section: "Actions", label: "Toggle actions menu", description: "Open or close context actions menu for selected conversation", defaultPrimary: "." },
  { id: "openSnoozeMenu", section: "Actions", label: "Toggle snooze menu", description: "Open or close snooze options for selected conversation(s)", defaultPrimary: "z" },
  { id: "refreshEmails", section: "Navigation", label: "Refresh emails", description: "Refresh inbox and counts", defaultPrimary: "shift+r" },
  { id: "focusSearch", section: "Search & Help", label: "Focus search", description: "Move focus to search input", defaultPrimary: "/" },
  { id: "gotoInbox", section: "Go to", label: "Go to Inbox", description: "Navigate to Inbox", defaultPrimary: "g i" },
  { id: "gotoStarred", section: "Go to", label: "Go to Starred", description: "Navigate to Starred", defaultPrimary: "g s" },
  { id: "gotoDrafts", section: "Go to", label: "Go to Drafts", description: "Navigate to Drafts", defaultPrimary: "g d" },
  { id: "gotoSent", section: "Go to", label: "Go to Sent", description: "Navigate to Sent", defaultPrimary: "g t" },
  { id: "clearSelection", section: "Search & Help", label: "Clear selection / close", description: "Clear selected email and close reading pane", defaultPrimary: "escape" },
  { id: "toggleHelp", section: "Search & Help", label: "Show keyboard shortcuts", description: "Toggle shortcuts help modal", defaultPrimary: "shift+/" },
  { id: "openCommandPalette", section: "Search & Help", label: "Open command palette", description: "Search and execute any command", defaultPrimary: "meta+k" },
];

const storageKey = "keyboardShortcuts";

const buildDefaults = (): ShortcutBindings =>
  SHORTCUT_ACTIONS.reduce((acc, action) => {
    acc[action.id] = { primary: action.defaultPrimary };
    return acc;
  }, {} as ShortcutBindings);

const normalizeToken = (token: string): string => {
  const trimmed = token.trim().toLowerCase();
  if (!trimmed) return "";
  if (trimmed === "esc") return "escape";
  if (trimmed === "return") return "enter";
  return trimmed;
};

export const normalizeShortcut = (value: string): string => {
  const compact = value.trim().replace(/\s+/g, " ");
  if (!compact) return "";
  const steps = compact.split(" ").map((step) => {
    const parts = step.split("+").map((part) => normalizeToken(part));
    if (parts.length === 1) return parts[0];
    const key = parts[parts.length - 1];
    const mods = parts
      .slice(0, -1)
      .filter(Boolean)
      .map((mod) => {
        if (mod === "control") return "ctrl";
        if (mod === "command" || mod === "cmd") return "meta";
        if (mod === "option") return "alt";
        return mod;
      });
    const uniqueMods = Array.from(new Set(mods));
    const orderedMods = ["ctrl", "alt", "shift", "meta"].filter((mod) => uniqueMods.includes(mod));
    const allParts = key ? [...orderedMods, key] : orderedMods;
    return allParts.join("+");
  });
  return steps.filter(Boolean).join(" ");
};

const defaults = buildDefaults();
export const [shortcutBindings, setShortcutBindings] = createStore<ShortcutBindings>(defaults);

if (typeof window !== "undefined") {
  try {
    const stored = localStorage.getItem(storageKey);
    if (stored) {
      const parsed = JSON.parse(stored) as Partial<Record<ShortcutActionId, Partial<ShortcutBinding> | string>>;
      for (const action of SHORTCUT_ACTIONS) {
        const current = parsed[action.id];
        const primaryValue =
          typeof current === "string"
            ? current
            : (current?.primary || defaults[action.id].primary);
        setShortcutBindings(action.id, "primary", normalizeShortcut(primaryValue));
      }
    }
  } catch {
    // Keep defaults on malformed persisted data.
  }
}

createEffect(() => {
  if (typeof window !== "undefined") {
    localStorage.setItem(storageKey, JSON.stringify(shortcutBindings));
  }
});

export const setShortcutBinding = (actionId: ShortcutActionId, value: string) => {
  setShortcutBindings(actionId, "primary", normalizeShortcut(value));
};

export const restoreDefaultShortcuts = () => {
  const next = buildDefaults();
  for (const action of SHORTCUT_ACTIONS) {
    setShortcutBindings(action.id, "primary", next[action.id].primary);
  }
};

export const getActionShortcuts = (actionId: ShortcutActionId): string[] => {
  const shortcut = normalizeShortcut(shortcutBindings[actionId].primary);
  return shortcut ? [shortcut] : [];
};

export const getPreferredActionShortcut = (actionId: ShortcutActionId): string | null => {
  const effective = getEffectiveActionShortcuts(actionId);
  if (effective.length > 0) return effective[0];
  const all = getActionShortcuts(actionId);
  return all.length > 0 ? all[0] : null;
};

const buildShortcutRefs = () => {
  const refs = new Map<string, ShortcutRef[]>();
  for (const action of SHORTCUT_ACTIONS) {
    const shortcut = normalizeShortcut(shortcutBindings[action.id].primary);
    if (!shortcut) continue;
    const current = refs.get(shortcut) || [];
    current.push({ actionId: action.id });
    refs.set(shortcut, current);
  }
  return refs;
};

export const getShortcutConflictMap = (): Map<string, ShortcutRef[]> => {
  const refs = buildShortcutRefs();
  const conflicts = new Map<string, ShortcutRef[]>();
  for (const [shortcut, entries] of refs.entries()) {
    if (entries.length > 1) conflicts.set(shortcut, entries);
  }
  return conflicts;
};

export const isShortcutConflicted = (shortcut: string): boolean => {
  const normalized = normalizeShortcut(shortcut);
  if (!normalized) return false;
  return (getShortcutConflictMap().get(normalized)?.length || 0) > 1;
};

export const getActionConflictShortcuts = (actionId: ShortcutActionId): string[] =>
  getActionShortcuts(actionId).filter((shortcut) => isShortcutConflicted(shortcut));

export const getEffectiveActionShortcuts = (actionId: ShortcutActionId): string[] =>
  getActionShortcuts(actionId).filter((shortcut) => !isShortcutConflicted(shortcut));

export const splitShortcutSteps = (shortcut: string): string[] => {
  const normalized = normalizeShortcut(shortcut);
  return normalized ? normalized.split(" ").filter(Boolean) : [];
};

export const formatShortcut = (shortcut: string): string => {
  const stepLabel = (step: string) =>
    step
      .split("+")
      .map((part) => {
        if (part === "ctrl") return "Ctrl";
        if (part === "alt") return "Alt";
        if (part === "shift") return "Shift";
        if (part === "meta") return "Meta";
        if (part === "escape") return "Esc";
        if (part === "enter") return "Enter";
        if (part === "space") return "Space";
        return part.length === 1 ? part.toUpperCase() : part[0].toUpperCase() + part.slice(1);
      })
      .join("+");
  return splitShortcutSteps(shortcut).map(stepLabel).join(" then ");
};

export const getActionShortcutHint = (actionId: ShortcutActionId): string => {
  const shortcut = getPreferredActionShortcut(actionId);
  return shortcut ? ` (${formatShortcut(shortcut)})` : "";
};
