import { createSignal, Show, For, onCleanup } from "solid-js";
import { Portal } from "solid-js/web";
import { IconStar, IconArchive, IconTrash, IconLabel, IconEnvelope, IconEnvelopeOpen, IconImportant, IconClock, IconSpam, IconDrag, IconPaperclip } from "./Icons";
import { labelsState, IMPORTANT_LABEL_NAME, isCategoryLabelName } from "~/lib/labels-store";
import { settings, DENSITY_CONFIG } from "~/lib/settings-store";

export interface EmailLabel {
  name: string;
  color: string;
}

interface EmailRowProps {
  email: {
    seq: number;
    from: string;
    subject: string;
    date: string;
    flags: string[];
    messageCount?: number;
    unreadCount?: number;
    threadId?: string;
    hasAttachments?: boolean;
    isNew?: boolean;
    snoozedUntil?: string;
    scheduledFor?: string;
    syncStatus?: "staged" | "imap_syncing" | "imap_synced" | "sync_error";
    spamScore?: number;
  };
  onClick: () => void;
  onDelete?: (seq: number) => void;
  onArchive?: (seq: number) => void;
  onStar?: (seq: number, starred: boolean) => void;
  onImportantToggle?: (seq: number, important: boolean) => void;
  onLabelAdd?: (seq: number, label: string) => void;
  onLabelRemove?: (seq: number, label: string) => void;
  onToggleRead?: (seq: number, currentRead: boolean) => void;
  onPointerDragStart?: (seq: number, e: PointerEvent, suppressClick: () => void) => void;
  active?: boolean;
  checked?: boolean;
  onCheckedChange?: (seq: number, checked: boolean) => void;
  onContextMenu?: (e: MouseEvent) => void;
}

export default function EmailRow(props: EmailRowProps) {
  const [showLabelMenu, setShowLabelMenu] = createSignal(false);
  const [menuPos, setMenuPos] = createSignal({ top: 0, left: 0 });
  let labelBtnRef: HTMLButtonElement | undefined;
  let menuRef: HTMLDivElement | undefined;
  let suppressClickUntil = 0;
  const density = () => DENSITY_CONFIG[settings.density];
  const DRAG_CLICK_SUPPRESS_MS = 600;

  const openLabelMenu = (e: MouseEvent) => {
    e.stopPropagation();
    if (showLabelMenu()) {
      setShowLabelMenu(false);
      return;
    }
    if (labelBtnRef) {
      const rect = labelBtnRef.getBoundingClientRect();
      setMenuPos({ top: rect.bottom + 4, left: rect.right - 160 });
    }
    setShowLabelMenu(true);
  };

  // Close menu on outside click
  const handleOutsideClick = (e: MouseEvent) => {
    const target = e.target as Node;
    if (
      showLabelMenu() &&
      labelBtnRef &&
      !labelBtnRef.contains(target) &&
      !(menuRef && menuRef.contains(target))
    ) {
      setShowLabelMenu(false);
    }
  };

  if (typeof document !== "undefined") {
    document.addEventListener("mousedown", handleOutsideClick);
    onCleanup(() => document.removeEventListener("mousedown", handleOutsideClick));
  }

  const flags = () => (Array.isArray(props.email?.flags) ? props.email.flags : []);
  const isUnread = () => !flags().includes("\\Seen");
  const isStarred = () => flags().includes("\\Flagged");
  const isImportant = () => flags().includes(IMPORTANT_LABEL_NAME);
  const isDraft = () => flags().includes("\\Draft");
  const needsSyncIndicator = () => props.email.syncStatus && props.email.syncStatus !== "imap_synced";
  const syncTooltip = () => {
    if (props.email.syncStatus === "sync_error") return "Sync error with IMAP";
    return "Still syncing to IMAP";
  };

  const emailLabels = () => {
    return labelsState.labels.filter(l =>
      l.name !== IMPORTANT_LABEL_NAME && !isCategoryLabelName(l.name) && flags().includes(l.name)
    );
  };

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return "N/A";
    const now = new Date();
    const diff = now.getTime() - d.getTime();
    const oneDay = 86400000;

    if (diff < oneDay && d.getDate() === now.getDate()) {
      return d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
    }
    if (diff < 7 * oneDay) {
      return d.toLocaleDateString([], { weekday: "short" });
    }
    return d.toLocaleDateString([], { month: "short", day: "numeric" });
  };
  /** Returns a CSS colour class and label for rspamd scores */
  const spamBadge = (score: number) => {
    if (score >= 6)  return { cls: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300",    label: `Spam ${score.toFixed(1)}` };
    if (score >= 4)  return { cls: "bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300", label: `Suspicious ${score.toFixed(1)}` };
    return null; // no badge for clean mail
  };

  const formatSnoozedUntil = (value?: string) => {
    if (!value) return "";
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return "";
    return d.toLocaleString([], {
      weekday: "short",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  /** Returns true when the pointer target is an interactive child we should NOT drag from */
  const isInteractiveTarget = (target: EventTarget | null): boolean => {
    if (!target || !(target instanceof HTMLElement)) return false;
    const tag = target.tagName;
    if (tag === "INPUT" || tag === "BUTTON" || tag === "A") return true;
    if (target.closest("button, input, a, .hover-actions")) return true;
    return false;
  };

  return (
    <div
      data-testid="row-drag-handle"
      class={`email-row group grid grid-cols-[auto_200px_1fr_auto] items-center pl-2 pr-4 ${density().rowHeight} cursor-pointer transition-all duration-150 relative border-b border-transparent select-none touch-none ${
        props.active ? "email-row-active" : props.checked ? "bg-[var(--active-bg)]" : isUnread() ? "bg-white dark:bg-[var(--card)]" : ""
      } hover:bg-[var(--hover-bg)] hover:shadow-[inset_3px_0_0_var(--primary)]`}
      style={{ "z-index": undefined }}
      onPointerDown={(e) => {
        if (e.button !== 0 || !props.onPointerDragStart) return;
        if (isInteractiveTarget(e.target)) return;
        // Record for potential drag — click suppression happens only if drag actually activates
        props.onPointerDragStart(props.email.seq, e, () => {
          suppressClickUntil = Date.now() + DRAG_CLICK_SUPPRESS_MS;
        });
      }}
      onClick={(e) => {
        if (Date.now() < suppressClickUntil) {
          e.preventDefault();
          e.stopPropagation();
          return;
        }
        props.onClick();
      }}
      onContextMenu={(e) => {
        if (props.onContextMenu) {
          e.preventDefault();
          e.stopPropagation();
          props.onContextMenu(e);
        }
      }}
    >
      {/* Drag indicator + Checkbox + Star */}
      <div class="flex items-center gap-1 pr-3">
        <Show when={props.onPointerDragStart}>
          <div class="w-3 flex items-center justify-center text-[var(--text-muted)] opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
            <IconDrag size={12} />
          </div>
        </Show>
        <Show when={props.onCheckedChange}>
          <input
            type="checkbox"
            class="mail-checkbox cursor-pointer"
            checked={props.checked ?? false}
            onClick={(e) => e.stopPropagation()}
            onChange={(e) => {
              props.onCheckedChange?.(props.email.seq, e.currentTarget.checked);
            }}
          />
        </Show>
        <Show when={props.onStar}>
          <button
            class={`border-none bg-transparent p-0 cursor-pointer transition-colors flex items-center justify-center ${
              isStarred() ? "text-[#fbbc04]" : "text-[var(--text-muted)] hover:text-[#fbbc04]"
            }`}
            onClick={(e) => {
              e.stopPropagation();
              props.onStar?.(props.email.seq, !isStarred());
            }}
          >
            <IconStar size={16} strokeWidth={1.75} filled={isStarred()} />
          </button>
        </Show>
        <Show when={props.onImportantToggle}>
          <button
            class={`border-none bg-transparent p-0 cursor-pointer transition-colors flex items-center justify-center ${
              isImportant() ? "text-[#f29900]" : "text-[var(--text-muted)] hover:text-[#f29900]"
            }`}
            onClick={(e) => {
              e.stopPropagation();
              props.onImportantToggle?.(props.email.seq, !isImportant());
            }}
            title={isImportant() ? "Remove important" : "Mark as important"}
          >
            <IconImportant size={16} strokeWidth={1.75} filled={isImportant()} />
          </button>
        </Show>
      </div>

      {/* From */}
      <div
        class={`flex items-center gap-1.5 ${density().fontSize} whitespace-nowrap overflow-hidden pr-3 ${
          isUnread() ? "font-bold text-[var(--foreground)]" : "font-medium text-[var(--text-secondary)]"
        }`}
      >
        <span class="overflow-hidden text-ellipsis">{props.email.from}</span>
        <Show when={props.email.messageCount && props.email.messageCount > 1}>
          <span class="inline-flex items-center justify-center min-w-[20px] h-[18px] px-1 rounded-full text-[11px] font-semibold bg-[var(--text-muted)] text-white shrink-0 leading-none">
            {props.email.messageCount}
          </span>
        </Show>
      </div>

      {/* Subject + Labels */}
      <div class="flex items-center gap-1.5 min-w-0 overflow-hidden">
        <span
          class={`${density().fontSize} whitespace-nowrap overflow-hidden text-ellipsis ${
            isUnread() ? "font-semibold text-[var(--foreground)]" : "font-medium text-[var(--foreground)]"
          }`}
        >
          {props.email.subject}
        </span>
        <Show when={isDraft()}>
          <span class="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold shrink-0 bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-200">
            Draft
          </span>
        </Show>
        <Show when={props.email.spamScore != null && spamBadge(props.email.spamScore!)}>
          {() => {
            const badge = spamBadge(props.email.spamScore!)!;
            return (
              <span
                class={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold shrink-0 ${badge.cls}`}
                title={`Rspamd score: ${props.email.spamScore}`}
              >
                {badge.label}
              </span>
            );
          }}
        </Show>
        <Show when={props.email.isNew}>
          <span class="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold shrink-0 bg-emerald-100 text-emerald-700">
            New
          </span>
        </Show>
        <Show when={needsSyncIndicator()}>
          <span
            class={`inline-flex items-center justify-center w-4 h-4 shrink-0 ${
              props.email.syncStatus === "sync_error" ? "text-amber-600" : "text-gray-400"
            }`}
            title={syncTooltip()}
          >
            <Show when={props.email.syncStatus === "sync_error"} fallback={<IconClock size={13} />}>
              <IconSpam size={13} />
            </Show>
          </span>
        </Show>
        <For each={emailLabels()}>
          {(label) => (
            <span
              class="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium text-white shrink-0"
              style={{ background: label.color }}
            >
              {label.name}
            </span>
          )}
        </For>
        <Show when={props.email.snoozedUntil}>
          <span class="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium shrink-0 bg-[var(--active-bg)] text-[var(--primary)]">
            {`Snoozed until ${formatSnoozedUntil(props.email.snoozedUntil)}`}
          </span>
        </Show>
        <Show when={props.email.scheduledFor}>
          <span class="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium shrink-0 bg-[var(--active-bg)] text-[var(--primary)]">
            {`Scheduled for ${formatSnoozedUntil(props.email.scheduledFor)}`}
          </span>
        </Show>
      </div>

      {/* Date + hover actions */}
      <div class="flex items-center gap-2 pl-3 shrink-0">
        <Show when={props.email.hasAttachments}>
          <span
            class="inline-flex items-center justify-center text-[var(--text-muted)]"
            title="Has attachments"
            aria-label="Has attachments"
          >
            <IconPaperclip size={13} />
          </span>
        </Show>
        <span
          class={`email-date-text text-[13px] whitespace-nowrap min-w-[60px] text-right ${
            isUnread() ? "text-[var(--foreground)] font-semibold" : "text-[var(--text-muted)]"
          }`}
        >
          {formatDate(props.email.date)}
        </span>

        {/* Hover actions */}
        <div class="hover-actions absolute right-4 top-1/2 -translate-y-1/2 gap-0.5 bg-[var(--hover-bg)] rounded-lg p-0.5">
          <Show when={props.onArchive}>
            <button
              class="w-8 h-8 rounded-lg border-none bg-transparent cursor-pointer flex items-center justify-center text-[var(--text-secondary)] transition-colors hover:bg-[var(--active-bg)] hover:text-[var(--primary)]"
              title="Archive"
              onClick={(e) => {
                e.stopPropagation();
                props.onArchive?.(props.email.seq);
              }}
            >
              <IconArchive size={16} />
            </button>
          </Show>
          <Show when={props.onToggleRead}>
            <button
              class="w-8 h-8 rounded-lg border-none bg-transparent cursor-pointer flex items-center justify-center text-[var(--text-secondary)] transition-colors hover:bg-[var(--active-bg)] hover:text-[var(--foreground)]"
              title={isUnread() ? "Mark as read" : "Mark as unread"}
              onClick={(e) => {
                e.stopPropagation();
                props.onToggleRead?.(props.email.seq, !isUnread());
              }}
            >
              <Show when={isUnread()} fallback={<IconEnvelope size={16} />}>
                <IconEnvelopeOpen size={16} />
              </Show>
            </button>
          </Show>
          <Show when={props.onDelete}>
            <button
              class="w-8 h-8 rounded-lg border-none bg-transparent cursor-pointer flex items-center justify-center text-[var(--text-secondary)] transition-colors hover:bg-[var(--active-bg)] hover:text-[var(--destructive)]"
              title="Delete"
              onClick={(e) => {
                e.stopPropagation();
                props.onDelete?.(props.email.seq);
              }}
            >
              <IconTrash size={16} />
            </button>
          </Show>
          <Show when={props.onLabelAdd || props.onLabelRemove}>
            <button
              ref={labelBtnRef}
              class="w-8 h-8 rounded-lg border-none bg-transparent cursor-pointer flex items-center justify-center text-[var(--text-secondary)] transition-colors hover:bg-[var(--active-bg)] hover:text-[var(--primary)]"
              title="Label"
              onClick={openLabelMenu}
            >
              <IconLabel size={16} />
            </button>
          </Show>
          <Show when={showLabelMenu()}>
            <Portal>
              <div
                ref={menuRef}
                class="fixed w-40 bg-[var(--card)] border border-[var(--border)] rounded-lg shadow-lg py-1"
                style={{ top: `${menuPos().top}px`, left: `${menuPos().left}px`, "z-index": 9999 }}
                onClick={(e) => e.stopPropagation()}
                onMouseDown={(e) => e.stopPropagation()}
              >
                <For each={labelsState.labels.filter((label) => label.name !== IMPORTANT_LABEL_NAME && !isCategoryLabelName(label.name))}>
                  {(label) => {
                    const hasLabel = () => flags().includes(label.name);
                    return (
                      <button
                        class="w-full flex items-center gap-2 px-3 py-1.5 text-sm text-[var(--foreground)] border-none bg-transparent cursor-pointer hover:bg-[var(--hover-bg)] text-left"
                        onClick={() => {
                          if (hasLabel()) {
                            props.onLabelRemove?.(props.email.seq, label.name);
                          } else {
                            props.onLabelAdd?.(props.email.seq, label.name);
                          }
                          setShowLabelMenu(false);
                        }}
                      >
                        <span
                          class="w-3 h-3 rounded-full shrink-0"
                          style={{ background: label.color }}
                        />
                        <span class="flex-1">{label.name}</span>
                        <Show when={hasLabel()}>
                          <span class="text-[var(--primary)] text-xs font-bold">&#10003;</span>
                        </Show>
                      </button>
                    );
                  }}
                </For>
              </div>
            </Portal>
          </Show>
        </div>
      </div>
    </div>
  );
}
