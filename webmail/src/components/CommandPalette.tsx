import { For, Show, createSignal, createMemo, createEffect } from "solid-js";
import { useLocation, useNavigate } from "@solidjs/router";
import { IconSearch } from "./Icons";
import { commandPaletteOpen, closeCommandPalette } from "~/lib/command-palette-store";
import { composeState } from "~/lib/compose-store";
import {
  SHORTCUT_ACTIONS,
  type ShortcutActionId,
  getEffectiveActionShortcuts,
  splitShortcutSteps,
  formatShortcut,
} from "~/lib/keyboard-shortcuts-store";

interface CommandItem {
  id: string;
  label: string;
  description: string;
  section: string;
  shortcut?: string;
  action: () => void;
}

const NAVIGATION_COMMANDS: { label: string; description: string; path: string }[] = [
  { label: "Go to Inbox", description: "Navigate to Inbox", path: "/" },
  { label: "Go to Starred", description: "Navigate to Starred", path: "/?filter=starred" },
  { label: "Go to Important", description: "Navigate to Important", path: "/?filter=important" },
  { label: "Go to Drafts", description: "Navigate to Drafts", path: "/folder/Drafts" },
  { label: "Go to Sent", description: "Navigate to Sent", path: "/folder/Sent" },
  { label: "Go to Scheduled", description: "Navigate to Scheduled", path: "/folder/Scheduled" },
  { label: "Go to Archive", description: "Navigate to Archive", path: "/folder/Archive" },
  { label: "Go to Snoozed", description: "Navigate to Snoozed", path: "/folder/Snoozed" },
  { label: "Go to Trash", description: "Navigate to Trash", path: "/folder/Trash" },
  { label: "Go to Spam", description: "Navigate to Spam", path: "/folder/Spam" },
  { label: "Go to Contacts", description: "Open contacts page", path: "/contacts" },
  { label: "Go to Settings", description: "Open settings page", path: "/settings" },
];

const SETTINGS_TAB_COMMANDS: { label: string; description: string; tab: string }[] = [
  { label: "Go to Settings > General", description: "Open general settings", tab: "general" },
  { label: "Go to Settings > Keyboard Shortcuts", description: "Open keyboard shortcuts settings", tab: "shortcuts" },
  { label: "Go to Settings > Appearance", description: "Open appearance settings", tab: "appearance" },
  { label: "Go to Settings > Theme", description: "Open theme settings", tab: "appearance" },
  { label: "Go to Settings > Labels", description: "Open label settings", tab: "labels" },
  { label: "Go to Settings > Categories", description: "Open category settings", tab: "categories" },
  { label: "Go to Settings > Signature", description: "Open signature settings", tab: "signature" },
  { label: "Go to Settings > Import", description: "Open import settings", tab: "import" },
  { label: "Go to Settings > Accounts", description: "Open account settings", tab: "accounts" },
  { label: "Go to Settings > Blocked Senders", description: "Open blocked sender settings", tab: "blocked" },
  { label: "Go to Settings > Auto Reply", description: "Open auto-reply settings", tab: "auto-reply" },
];

// Actions that don't make sense in the command palette (menu internals, compose internals)
const EXCLUDED_ACTION_IDS: Set<ShortcutActionId> = new Set([
  "menuNextItem",
  "menuPreviousItem",
  "menuActivateItem",
  "openCommandPalette",
  "sendCompose",
  "composeMinimize",
  "composeToggleFullscreen",
  "composeClose",
  "composeSaveDraft",
  "composeToggleSchedule",
  "composeAttachFiles",
]);

// Actions that overlap with NAVIGATION_COMMANDS (handled by navigate)
const NAVIGATION_ACTION_IDS: Set<ShortcutActionId> = new Set([
  "gotoInbox",
  "gotoStarred",
  "gotoDrafts",
  "gotoSent",
]);

const MAILBOX_PAGE_ACTIONS: ShortcutActionId[] = [
  "compose",
  "focusSearch",
  "refreshEmails",
  "nextConversation",
  "previousConversation",
  "openConversation",
  "returnToList",
  "archiveConversation",
  "deleteConversation",
  "toggleStar",
  "markUnread",
  "markImportant",
  "reportSpam",
  "reply",
  "replyAll",
  "forward",
  "openActionsMenu",
  "openSnoozeMenu",
  "clearSelection",
];

const COMPOSE_PAGE_ACTIONS: ShortcutActionId[] = [
  "sendCompose",
  "composeSaveDraft",
  "composeToggleSchedule",
  "composeAttachFiles",
  "composeToggleFullscreen",
  "composeMinimize",
  "composeClose",
];

function matchesQuery(text: string, query: string): boolean {
  const lower = text.toLowerCase();
  const q = query.toLowerCase();
  // Check if all characters in query appear in order
  let qi = 0;
  for (let i = 0; i < lower.length && qi < q.length; i++) {
    if (lower[i] === q[qi]) qi++;
  }
  return qi === q.length;
}

export default function CommandPalette() {
  const navigate = useNavigate();
  const location = useLocation();
  let inputRef: HTMLInputElement | undefined;
  let listRef: HTMLDivElement | undefined;

  const [query, setQuery] = createSignal("");
  const [selectedIndex, setSelectedIndex] = createSignal(0);

  const dispatchAction = (actionId: ShortcutActionId) => {
    document.dispatchEvent(
      new CustomEvent<{ actionId: ShortcutActionId }>("command-palette-action", { detail: { actionId } }),
    );
  };

  const allCommands = createMemo((): CommandItem[] => {
    const items: CommandItem[] = [];
    const pathname = location.pathname;
    const currentPageActionIds = new Set<ShortcutActionId>();

    // Navigation commands
    for (const nav of NAVIGATION_COMMANDS) {
      // Find matching shortcut action for shortcut display
      const matchingAction = SHORTCUT_ACTIONS.find(
        (a) => NAVIGATION_ACTION_IDS.has(a.id) && a.label === nav.label,
      );
      const shortcut = matchingAction
        ? getEffectiveActionShortcuts(matchingAction.id)[0]
        : undefined;

      items.push({
        id: `nav:${nav.path}`,
        label: nav.label,
        description: nav.description,
        section: "Navigation",
        shortcut,
        action: () => {
          navigate(nav.path);
        },
      });
    }

    // Settings tab commands
    for (const tab of SETTINGS_TAB_COMMANDS) {
      items.push({
        id: `settings:${tab.tab}:${tab.label}`,
        label: tab.label,
        description: tab.description,
        section: "Settings",
        action: () => {
          navigate(`/settings?tab=${encodeURIComponent(tab.tab)}`);
        },
      });
    }

    // Current page object tasks
    const isComposeContext = composeState().isOpen;
    const isMailboxLikePage =
      pathname === "/" ||
      pathname.startsWith("/folder/") ||
      pathname.startsWith("/search") ||
      pathname.startsWith("/email/");

    const currentPageActions = isComposeContext
      ? COMPOSE_PAGE_ACTIONS
      : (isMailboxLikePage ? MAILBOX_PAGE_ACTIONS : []);
    for (const actionId of currentPageActions) {
        const action = SHORTCUT_ACTIONS.find((item) => item.id === actionId);
        if (!action) continue;
        const shortcut = getEffectiveActionShortcuts(action.id)[0];
        currentPageActionIds.add(action.id);
        items.push({
          id: `current-page:${action.id}`,
          label: action.label,
          description: action.description,
          section: "Current Page",
          shortcut,
          action: () => {
            dispatchAction(action.id);
          },
        });
    }

    // Shortcut actions (excluding navigation dupes and internals)
    for (const action of SHORTCUT_ACTIONS) {
      if (EXCLUDED_ACTION_IDS.has(action.id)) continue;
      if (NAVIGATION_ACTION_IDS.has(action.id)) continue;
      if (currentPageActionIds.has(action.id)) continue;
      if (isComposeContext && MAILBOX_PAGE_ACTIONS.includes(action.id)) continue;

      const shortcuts = getEffectiveActionShortcuts(action.id);
      items.push({
        id: `action:${action.id}`,
        label: action.label,
        description: action.description,
        section: action.section,
        shortcut: shortcuts[0],
        action: () => {
          dispatchAction(action.id);
        },
      });
    }

    return items;
  });

  const filtered = createMemo(() => {
    const q = query().trim();
    if (!q) return allCommands();
    return allCommands().filter(
      (item) => matchesQuery(item.label, q) || matchesQuery(item.description, q),
    );
  });

  // Group filtered results by section
  const SECTION_ORDER = ["Current Page", "Navigation", "Settings", "Go to", "Actions", "Compose", "Search & Help"];
  const grouped = createMemo(() => {
    const items = filtered();
    return SECTION_ORDER
      .map((section) => ({
        section,
        items: items.filter((item) => item.section === section),
      }))
      .filter((g) => g.items.length > 0);
  });

  // Flat list for keyboard navigation
  const flatItems = createMemo(() => grouped().flatMap((g) => g.items));

  // Reset selected index when query changes
  createEffect(() => {
    query();
    setSelectedIndex(0);
  });

  // Auto-focus input when opened
  createEffect(() => {
    if (commandPaletteOpen()) {
      setQuery("");
      setSelectedIndex(0);
      queueMicrotask(() => inputRef?.focus());
    }
  });

  // Scroll selected item into view
  createEffect(() => {
    const idx = selectedIndex();
    const items = flatItems();
    if (!listRef || items.length === 0) return;
    const itemEl = listRef.querySelector(`[data-command-index="${idx}"]`) as HTMLElement | null;
    itemEl?.scrollIntoView({ block: "nearest" });
  });

  const executeSelected = () => {
    const items = flatItems();
    const item = items[selectedIndex()];
    if (!item) return;
    closeCommandPalette();
    // Delay action slightly so modal closes first
    queueMicrotask(() => item.action());
  };

  const handleKeyDown = (e: KeyboardEvent) => {
    const items = flatItems();
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex((i) => (i + 1) % Math.max(items.length, 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex((i) => (i - 1 + items.length) % Math.max(items.length, 1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      executeSelected();
    } else if (e.key === "Escape") {
      e.preventDefault();
      closeCommandPalette();
    }
  };

  return (
    <Show when={commandPaletteOpen()}>
      <div
        data-testid="command-palette-overlay"
        class="fixed inset-0 z-50 bg-black/40 backdrop-blur-[2px] flex items-start justify-center pt-[15vh]"
        onClick={closeCommandPalette}
      >
        <div
          data-testid="command-palette"
          class="bg-[var(--card)] rounded-2xl shadow-2xl border border-[var(--border-light)] w-full max-w-xl m-4 overflow-hidden flex flex-col max-h-[60vh]"
          onClick={(e) => e.stopPropagation()}
          onKeyDown={handleKeyDown}
        >
          {/* Search input */}
          <div class="flex items-center gap-3 px-4 py-3 border-b border-[var(--border-light)]">
            <IconSearch size={18} class="text-[var(--text-muted)] shrink-0" />
            <input
              data-testid="command-palette-input"
              ref={inputRef}
              type="text"
              placeholder="Type a command..."
              value={query()}
              onInput={(e) => setQuery(e.currentTarget.value)}
              class="flex-1 bg-transparent border-none outline-none text-sm text-[var(--foreground)] placeholder:text-[var(--text-muted)]"
            />
            <kbd class="hidden sm:inline-flex items-center justify-center px-1.5 py-0.5 rounded text-[10px] font-mono text-[var(--text-muted)] border border-[var(--border)] bg-[var(--search-bg)]">
              Esc
            </kbd>
          </div>

          {/* Command list */}
          <div ref={listRef} class="overflow-y-auto py-2 flex-1">
            <Show
              when={flatItems().length > 0}
              fallback={
                <div class="px-4 py-8 text-center text-sm text-[var(--text-muted)]">
                  No commands found
                </div>
              }
            >
              <For each={grouped()}>
                {(group) => (
                  <div>
                    <div class="px-4 pt-2 pb-1">
                      <span class="text-[10px] font-bold uppercase tracking-widest text-[var(--text-muted)]">
                        {group.section}
                      </span>
                    </div>
                    <For each={group.items}>
                      {(item) => {
                        const globalIndex = () => flatItems().indexOf(item);
                        const isSelected = () => selectedIndex() === globalIndex();
                        return (
                          <button
                            data-command-index={globalIndex()}
                            class={`w-full flex items-center gap-3 px-4 py-2 text-left border-none cursor-pointer transition-colors duration-75 ${
                              isSelected()
                                ? "bg-[var(--active-bg)] text-[var(--primary)]"
                                : "bg-transparent text-[var(--foreground)] hover:bg-[var(--hover-bg)]"
                            }`}
                            onMouseEnter={() => setSelectedIndex(globalIndex())}
                            onClick={() => {
                              setSelectedIndex(globalIndex());
                              executeSelected();
                            }}
                          >
                            <div class="flex-1 min-w-0">
                              <div class="text-sm font-medium truncate">{item.label}</div>
                              <div class="text-xs text-[var(--text-muted)] truncate">{item.description}</div>
                            </div>
                            <Show when={item.shortcut}>
                              <div class="flex items-center gap-1 shrink-0">
                                <For each={splitShortcutSteps(item.shortcut!)}>
                                  {(step, stepIdx) => (
                                    <>
                                      <Show when={stepIdx() > 0}>
                                        <span class="text-[10px] text-[var(--text-muted)]">then</span>
                                      </Show>
                                      <kbd class="inline-flex items-center justify-center px-1.5 py-0.5 rounded text-[10px] font-mono font-semibold bg-[var(--search-bg)] text-[var(--text-secondary)] border border-[var(--border)] min-w-[1.25rem]">
                                        {formatShortcut(step)}
                                      </kbd>
                                    </>
                                  )}
                                </For>
                              </div>
                            </Show>
                          </button>
                        );
                      }}
                    </For>
                  </div>
                )}
              </For>
            </Show>
          </div>
        </div>
      </div>
    </Show>
  );
}
