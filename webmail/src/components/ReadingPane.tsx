import { createResource, Show, createSignal, For, createMemo, createEffect, onCleanup } from "solid-js";
import { getEmail, getThreadMessages, getThreadIdForMessage, deleteEmail, archiveEmails, type FullEmail } from "~/lib/mail-client-browser";
import { refreshCounts } from "~/lib/sidebar-store";
import { labelsState, isCategoryLabelName } from "~/lib/labels-store";
import { settings, setSettings } from "~/lib/settings-store";
import { authClient } from "~/lib/auth-client";
import { isCurrentUserSender } from "~/lib/sender-utils";
import { linkifyPlainText } from "~/lib/plain-text-links";
import { getActionShortcutHint } from "~/lib/keyboard-shortcuts-store";
import { useIsMobile } from "~/hooks/use-mobile";
import InlineComposer from "~/components/InlineComposer";
import { IconClose, IconArchive, IconTrash, IconChevronLeft, IconChevronRight, IconExpand, IconCollapse, IconChevronDown, IconChevronUp, IconClock, IconSpam, IconBlock, IconPaperclip, IconEnvelope, IconEnvelopeOpen } from "./Icons";

interface ReadingPaneProps {
  emailSeq: number | null;
  folder: string;
  threadId?: string | null;
  onClose: () => void;
  onDeleted: () => void;
  onNext?: () => void;
  onPrevious?: () => void;
  currentIndex?: number;
  totalCount?: number;
  isFullSpace?: boolean;
  onToggleFullSpace?: () => void;
  onBlockSender?: (seq: number) => void;
  onSnooze?: (seq: number, e: MouseEvent) => void;
  onMoveToSpam?: (seq: number) => void;
  onToggleRead?: (seq: number, makeRead: boolean) => void;
}

const ReadingPane = (props: ReadingPaneProps) => {
  const isMobile = useIsMobile();
  const session = authClient.useSession();
  const userEmail = () => session().data?.user?.email || "";
  const userAvatarImage = () => session().data?.user?.image || "";
  const isConversationView = () => settings.conversationView;
  const normalizeEmail = (email: FullEmail): FullEmail => ({
    ...email,
    flags: Array.isArray(email.flags) ? email.flags : [],
  });

  // -- Single email mode (non-conversation or fallback) --
  const [iframeHeight, setIframeHeight] = createSignal(600);
  const [singleEmail] = createResource(
    () => {
      return { seq: props.emailSeq, folder: props.folder };
    },
    async (params) => {
      if (!params || !params.seq) return null;
      return getEmail(params.seq, params.folder);
    }
  );

  const [lastSingleEmail, setLastSingleEmail] = createSignal<FullEmail | null>(null);

  // -- Thread/conversation mode --
  const [threadMessages, { mutate: mutateThreadMessages, refetch: refetchThreadMessages }] = createResource(
    () => {
      if (!isConversationView()) return null;
      // Use threadId from prop, or look it up
      if (props.threadId) return { threadId: props.threadId, seq: props.emailSeq };
      return props.emailSeq ? { seq: props.emailSeq, folder: props.folder, lookupThread: true } : null;
    },
    async (params) => {
      if (!params) return null;

      let threadId: string | null = null;
      if ('threadId' in params && params.threadId) {
        threadId = params.threadId;
      } else if ('lookupThread' in params && params.seq) {
        threadId = await getThreadIdForMessage(params.seq, params.folder!);
      }

      if (!threadId) {
        return [];
      }

      const messages = await getThreadMessages(threadId);
      const safeMessages = (messages || [])
        .filter((m): m is FullEmail => Boolean(m))
        .map((m) => ({
          ...m,
          flags: Array.isArray(m.flags) ? m.flags : [],
        }));
      return safeMessages;
    }
  );

  const latestSingleEmail = createMemo(() => {
    const current = singleEmail.latest;
    return current ? normalizeEmail(current) : null;
  });

  const safeSingleEmail = createMemo(() => {
    const current = latestSingleEmail();
    if (current) return current;
    return lastSingleEmail();
  });

  const visibleThreadMessages = createMemo(() => {
    const latest = threadMessages.latest;
    if (!Array.isArray(latest)) return [];
    return latest
      .filter((msg): msg is FullEmail => Boolean(msg))
      .map((msg) => normalizeEmail(msg));
  });

  createEffect(() => {
    const current = latestSingleEmail();
    if (!current) return;
    setLastSingleEmail(current);
  });

  createEffect(() => {
    if (props.emailSeq !== null) return;
    setLastSingleEmail(null);
  });

  // Track which messages are expanded in thread view
  const [expandedMessages, setExpandedMessages] = createSignal<Set<number>>(new Set());

  // When thread messages load, expand the latest message (and all if setting is on)
  createEffect(() => {
    const msgs = visibleThreadMessages();
    if (!msgs || msgs.length === 0) return;

    if (settings.expandAllThreadMessages) {
      setExpandedMessages(new Set(msgs.map(m => m.seq)));
    } else {
      // Expand only the last message
      const lastMsg = msgs[msgs.length - 1];
      setExpandedMessages(new Set([lastMsg.seq]));
    }
  });

  const toggleMessage = (seq: number) => {
    setExpandedMessages(prev => {
      const next = new Set(prev);
      if (next.has(seq)) {
        next.delete(seq);
      } else {
        next.add(seq);
      }
      return next;
    });
  };

  const [deleting, setDeleting] = createSignal(false);
  const [allowHeavyRender, setAllowHeavyRender] = createSignal(false);
  const [heavyRenderWarmed, setHeavyRenderWarmed] = createSignal(false);
  const [mobileReaderChromeVisible, setMobileReaderChromeVisible] = createSignal(true);
  let mobileReaderScrollContainer: HTMLDivElement | undefined;
  let lastMobileScrollTop = 0;
  let warmRafA: number | undefined;
  let warmRafB: number | undefined;

  createEffect(() => {
    const seq = props.emailSeq;
    if (seq === null) {
      setAllowHeavyRender(false);
      return;
    }
    if (heavyRenderWarmed()) {
      setAllowHeavyRender(true);
      return;
    }
    if (typeof window === "undefined") {
      setAllowHeavyRender(true);
      setHeavyRenderWarmed(true);
      return;
    }
    setAllowHeavyRender(false);
    if (warmRafA !== undefined) window.cancelAnimationFrame(warmRafA);
    if (warmRafB !== undefined) window.cancelAnimationFrame(warmRafB);
    warmRafA = window.requestAnimationFrame(() => {
      warmRafA = undefined;
      warmRafB = window.requestAnimationFrame(() => {
        warmRafB = undefined;
        setAllowHeavyRender(true);
        setHeavyRenderWarmed(true);
      });
    });
  });

  onCleanup(() => {
    if (typeof window === "undefined") return;
    if (warmRafA !== undefined) window.cancelAnimationFrame(warmRafA);
    if (warmRafB !== undefined) window.cancelAnimationFrame(warmRafB);
  });

  createEffect(() => {
    if (props.emailSeq === null) {
      setMobileReaderChromeVisible(true);
      lastMobileScrollTop = 0;
      return;
    }
    setMobileReaderChromeVisible(true);
    lastMobileScrollTop = 0;
    if (!isMobile()) return;
    const resetScroll = () => {
      if (!mobileReaderScrollContainer) return;
      mobileReaderScrollContainer.scrollTop = 0;
    };
    resetScroll();
    requestAnimationFrame(resetScroll);
  });

  const shouldHideMobileReaderChrome = createMemo(
    () => isMobile() && props.emailSeq !== null && !mobileReaderChromeVisible(),
  );

  const handleReaderScroll = (event: Event) => {
    if (!isMobile()) return;
    const container = event.currentTarget as HTMLDivElement | null;
    if (!container) return;
    const currentTop = Math.max(0, container.scrollTop);
    const delta = currentTop - lastMobileScrollTop;
    const hasMeaningfulDelta = Math.abs(delta) >= 6;

    if (hasMeaningfulDelta) {
      if (delta > 0 && currentTop > 16) {
        setMobileReaderChromeVisible(false);
      } else if (delta < 0) {
        setMobileReaderChromeVisible(true);
      }
      lastMobileScrollTop = currentTop;
    }
  };

  const handleComposerSent = (optimistic?: FullEmail) => {
    if (!optimistic) return;
    mutateThreadMessages((prev) => {
      if (!prev || prev.length === 0) return prev;
      const next = [...prev, optimistic].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
      return next;
    });
    setExpandedMessages((prev) => {
      const next = new Set(prev);
      next.add(optimistic.seq);
      return next;
    });
    setTimeout(() => {
      void refetchThreadMessages();
    }, 1200);
  };

  const handleDelete = async () => {
    if (!props.emailSeq) return;
    setDeleting(true);
    try {
      await deleteEmail(String(props.emailSeq), props.folder);
      props.onDeleted();
      refreshCounts();
    } catch (err) {
      console.error(err);
    } finally {
      setDeleting(false);
    }
  };

  const handleArchive = async () => {
    if (!props.emailSeq) return;
    try {
      await archiveEmails([String(props.emailSeq)], props.folder);
      props.onDeleted();
      refreshCounts();
    } catch (err) {
      console.error(err);
    }
  };

  const getInitial = (from: string) => (from.charAt(0) || "?").toUpperCase();

  const avatarColor = (from: string) => {
    const colors = [
      "bg-blue-500", "bg-green-500", "bg-yellow-500",
      "bg-red-500", "bg-indigo-500", "bg-purple-500", "bg-pink-500"
    ];
    let hash = 0;
    for (let i = 0; i < from.length; i++) {
      hash = from.charCodeAt(i) + ((hash << 5) - hash);
    }
    return colors[Math.abs(hash) % colors.length];
  };

  const avatarColorHex = (from: string) => {
    const colors = ["#3b82f6", "#22c55e", "#eab308", "#ef4444", "#6366f1", "#a855f7", "#ec4899"];
    let hash = 0;
    for (let i = 0; i < from.length; i++) {
      hash = from.charCodeAt(i) + ((hash << 5) - hash);
    }
    return colors[Math.abs(hash) % colors.length];
  };

  const canGoPrevious = () => !!props.onPrevious;
  const canGoNext = () => !!props.onNext;
  const selectedIsUnread = () => {
    const email = safeSingleEmail();
    const flags = Array.isArray(email?.flags) ? email!.flags : [];
    return !flags.includes("\\Seen");
  };

  const emailLabels = (email?: FullEmail | null) => {
    const flags = Array.isArray(email?.flags) ? email.flags : [];
    return labelsState.labels.filter(
      (label) => !isCategoryLabelName(label.name) && flags.includes(label.name)
    );
  };

  const resizeIframeToContent = (frame: HTMLIFrameElement) => {
    try {
      const doc = frame.contentDocument;
      if (!doc) return;
      const bodyHeight = doc.body?.scrollHeight ?? 0;
      const htmlHeight = doc.documentElement?.scrollHeight ?? 0;
      setIframeHeight(Math.max(600, bodyHeight, htmlHeight));
    } catch {
      // Ignore cross-document access failures.
    }
  };

  const formatFullDate = (dateStr: string) => {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return "N/A";
    return d.toLocaleString(undefined, {
      weekday: "short", month: "short", day: "numeric",
      hour: "numeric", minute: "2-digit"
    });
  };

  const formatRelativeDate = (dateStr: string) => {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return "N/A";
    const now = new Date();
    const diff = now.getTime() - d.getTime();
    const oneDay = 86400000;

    if (diff < oneDay && d.getDate() === now.getDate()) {
      return d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
    }
    return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  };

  const formatAttachmentSize = (bytes?: number) => {
    if (typeof bytes !== "number" || !Number.isFinite(bytes) || bytes < 0) return "";
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  // Determine which email to use for the composer (latest in thread or single email)
  const composerEmail = () => {
    if (isConversationView()) {
      const msgs = visibleThreadMessages();
      if (msgs && msgs.length > 0) return msgs[msgs.length - 1];
    }
    return safeSingleEmail() ?? null;
  };

  // Thread subject (from the first message, stripped of Re:/Fwd:)
  const threadSubject = () => {
    const msgs = visibleThreadMessages();
    if (msgs && msgs.length > 0) return msgs[0].subject;
    return safeSingleEmail()?.subject || "(No Subject)";
  };

  // Use thread view?
  const useThreadView = () => isConversationView() && Boolean(props.threadId);
  const isCurrentUserMessage = (email: Pick<FullEmail, "from" | "fromAddress" | "accountEmail">) =>
    isCurrentUserSender({
      from: email.from,
      fromAddress: email.fromAddress,
      currentUserEmail: userEmail() || email.accountEmail || "",
    });

  // Swipe left/right to navigate between emails on touch devices
  let swipeTouchStartX = 0;
  let swipeTouchStartY = 0;
  const SWIPE_COMMIT_THRESHOLD = 52;
  const SWIPE_PREVIEW_MAX = 34;
  const SWIPE_ANGLE_RATIO = 1.3;
  const [swipeAnimatingDirection, setSwipeAnimatingDirection] = createSignal<"next" | "previous" | null>(null);
  const [swipeDragOffset, setSwipeDragOffset] = createSignal(0);
  const [swipeDragging, setSwipeDragging] = createSignal(false);

  const handleSwipeTouchStart = (e: TouchEvent) => {
    swipeTouchStartX = e.touches[0].clientX;
    swipeTouchStartY = e.touches[0].clientY;
    setSwipeDragOffset(0);
    setSwipeDragging(false);
  };

  const animateSwipeTransition = (direction: "next" | "previous") => {
    setSwipeDragOffset(0);
    setSwipeDragging(false);
    setSwipeAnimatingDirection(direction);
    setTimeout(() => setSwipeAnimatingDirection(null), 240);
  };

  const canSwipeDirection = (dx: number) => {
    if (dx > 0) return Boolean(props.onPrevious);
    if (dx < 0) return Boolean(props.onNext);
    return false;
  };

  const handleSwipeTouchMove = (e: TouchEvent) => {
    if (!isMobile()) return;
    const touch = e.touches[0];
    if (!touch) return;
    const dx = touch.clientX - swipeTouchStartX;
    const dy = touch.clientY - swipeTouchStartY;
    if (!canSwipeDirection(dx)) {
      setSwipeDragOffset(0);
      return;
    }
    if (Math.abs(dx) < 8) {
      setSwipeDragOffset(0);
      return;
    }
    if (Math.abs(dx) <= Math.abs(dy) * 1.05) return;
    e.preventDefault();
    const preview = Math.max(-SWIPE_PREVIEW_MAX, Math.min(SWIPE_PREVIEW_MAX, dx * 0.26));
    setSwipeDragging(true);
    setSwipeDragOffset(preview);
  };

  const handleSwipeGesture = (dx: number, dy: number) => {
    // Only trigger on mostly-horizontal swipes
    if (Math.abs(dx) > SWIPE_COMMIT_THRESHOLD && Math.abs(dx) > Math.abs(dy) * SWIPE_ANGLE_RATIO) {
      if (dx > 0 && props.onPrevious) {
        animateSwipeTransition("previous");
        props.onPrevious();
      } else if (dx < 0 && props.onNext) {
        animateSwipeTransition("next");
        props.onNext();
      }
    }
  };

  const handleSwipeTouchEnd = (e: TouchEvent) => {
    const dx = e.changedTouches[0].clientX - swipeTouchStartX;
    const dy = e.changedTouches[0].clientY - swipeTouchStartY;
    setSwipeDragging(false);
    setSwipeDragOffset(0);
    handleSwipeGesture(dx, dy);
  };

  return (
    <div
      data-testid="reading-pane-root"
      class={`flex flex-col h-full bg-white border-l border-[var(--border)] overflow-x-hidden transition-transform duration-200 ease-out will-change-transform ${
        swipeDragging() ? "reading-pane-swipe-dragging" : ""
      } ${
        swipeAnimatingDirection() === "next"
          ? "reading-pane-swipe-next"
          : swipeAnimatingDirection() === "previous"
            ? "reading-pane-swipe-previous"
            : ""
      }`}
      style={
        swipeDragOffset() !== 0
          ? {
              transform: `translate3d(${swipeDragOffset()}px,0,0) rotate(${(swipeDragOffset() * 0.03).toFixed(2)}deg)`,
            }
          : undefined
      }
      onTouchStart={handleSwipeTouchStart}
      onTouchMove={handleSwipeTouchMove}
      onTouchEnd={handleSwipeTouchEnd}
    >
      {/* Toolbar */}
      <div
        data-testid="mobile-reader-toolbar"
        class={`overflow-hidden transition-[max-height,opacity,transform,border-color] duration-200 ${
          shouldHideMobileReaderChrome()
            ? "max-h-0 opacity-0 -translate-y-2 pointer-events-none border-b border-transparent"
            : "max-h-24 opacity-100 translate-y-0 border-b border-[var(--border)]"
        }`}
      >
      <div class="flex items-center px-4 py-2 min-h-[56px] bg-[var(--card)]">
        <div class="flex items-center gap-1">
          {/* Back button — mobile only */}
          <button
            data-testid="reading-pane-close"
            onClick={props.onClose}
            class="md:hidden h-8 px-2 rounded-lg border-none bg-transparent cursor-pointer flex items-center gap-1.5 text-[var(--text-secondary)] hover:bg-[var(--hover-bg)] hover:text-[var(--foreground)] transition-colors"
            aria-label="Back to email list"
          >
            <IconChevronLeft size={18} />
            <span class="text-sm font-medium">Back</span>
          </button>
          {/* Close (X) button — desktop only */}
          <button
            data-testid="reading-pane-close-desktop"
            onClick={props.onClose}
            class="hidden md:flex w-8 h-8 rounded-lg border-none bg-transparent cursor-pointer items-center justify-center text-[var(--text-secondary)] hover:bg-[var(--hover-bg)] hover:text-[var(--foreground)] transition-colors"
          >
            <IconClose size={18} />
          </button>
          <div class="w-[1px] h-5 bg-[var(--border)] mx-1" />
          <button onClick={handleArchive} class="w-8 h-8 rounded-lg border-none bg-transparent cursor-pointer flex items-center justify-center text-[var(--text-secondary)] hover:bg-[var(--hover-bg)] hover:text-[var(--foreground)] transition-colors" title={`Archive${getActionShortcutHint("archiveConversation")}`}>
            <IconArchive size={18} />
          </button>
          <Show when={props.onSnooze && props.emailSeq && props.folder !== "Trash" && props.folder !== "Spam"}>
            <button
              onClick={(e) => props.emailSeq && props.onSnooze?.(props.emailSeq, e)}
              class="w-8 h-8 rounded-lg border-none bg-transparent cursor-pointer flex items-center justify-center text-[var(--text-secondary)] hover:bg-[var(--hover-bg)] hover:text-[var(--primary)] transition-colors"
              title={`Snooze${getActionShortcutHint("openSnoozeMenu")}`}
            >
              <IconClock size={18} />
            </button>
          </Show>
          <Show when={props.onMoveToSpam && props.emailSeq && props.folder !== "Trash" && props.folder !== "Spam"}>
            <button
              onClick={() => props.emailSeq && props.onMoveToSpam?.(props.emailSeq)}
              class="w-8 h-8 rounded-lg border-none bg-transparent cursor-pointer flex items-center justify-center text-[var(--text-secondary)] hover:bg-[var(--hover-bg)] hover:text-[var(--primary)] transition-colors"
              title={`Mark as spam${getActionShortcutHint("reportSpam")}`}
            >
              <IconSpam size={18} />
            </button>
          </Show>
          <Show when={props.onToggleRead && props.emailSeq && props.folder !== "Trash"}>
            <button
              onClick={() => props.emailSeq && props.onToggleRead?.(props.emailSeq, selectedIsUnread())}
              class="w-8 h-8 rounded-lg border-none bg-transparent cursor-pointer flex items-center justify-center text-[var(--text-secondary)] hover:bg-[var(--hover-bg)] hover:text-[var(--foreground)] transition-colors"
              title={selectedIsUnread() ? "Mark as read" : `Mark as unread${getActionShortcutHint("markUnread")}`}
            >
              <Show when={selectedIsUnread()} fallback={<IconEnvelope size={18} />}>
                <IconEnvelopeOpen size={18} />
              </Show>
            </button>
          </Show>
          <Show when={props.folder !== "Trash"}>
            <button onClick={handleDelete} disabled={deleting()} class="w-8 h-8 rounded-lg border-none bg-transparent cursor-pointer flex items-center justify-center text-[var(--text-secondary)] hover:bg-[var(--hover-bg)] hover:text-[var(--destructive)] disabled:opacity-50 transition-colors" title={`Delete${getActionShortcutHint("deleteConversation")}`}>
              <IconTrash size={18} />
            </button>
          </Show>
          <Show when={props.onBlockSender && props.emailSeq && props.folder !== "Trash" && props.folder !== "Spam"}>
            <button
              onClick={() => props.emailSeq && props.onBlockSender?.(props.emailSeq)}
              class="w-8 h-8 rounded-lg border-none bg-transparent cursor-pointer flex items-center justify-center text-[var(--text-secondary)] hover:bg-[var(--hover-bg)] hover:text-[var(--destructive)] transition-colors"
              title="Block sender"
            >
              <IconBlock size={18} />
            </button>
          </Show>
          <div class="w-[1px] h-5 bg-[var(--border)] mx-1" />
          <Show when={typeof props.currentIndex === "number" && typeof props.totalCount === "number" && props.totalCount! > 0}>
            <span
              data-testid="reading-pane-position-counter"
              class="text-[9px] md:text-xs text-[var(--text-muted)] mr-1 whitespace-nowrap leading-none tabular-nums shrink-0"
            >
              {props.currentIndex} / {props.totalCount}
            </span>
          </Show>
          <button
            data-testid="reading-pane-prev"
            onClick={() => props.onPrevious?.()}
            disabled={!canGoPrevious()}
            class="hidden md:flex w-8 h-8 rounded-lg border-none bg-transparent cursor-pointer items-center justify-center text-[var(--text-secondary)] hover:bg-[var(--hover-bg)] hover:text-[var(--foreground)] disabled:opacity-40 transition-colors"
            title={`Previous email${getActionShortcutHint("previousConversation")}`}
          >
            <IconChevronLeft size={18} />
          </button>
          <button
            data-testid="reading-pane-next"
            onClick={() => props.onNext?.()}
            disabled={!canGoNext()}
            class="hidden md:flex w-8 h-8 rounded-lg border-none bg-transparent cursor-pointer items-center justify-center text-[var(--text-secondary)] hover:bg-[var(--hover-bg)] hover:text-[var(--foreground)] disabled:opacity-40 transition-colors"
            title={`Next email${getActionShortcutHint("nextConversation")}`}
          >
            <IconChevronRight size={18} />
          </button>
          <Show when={props.onToggleFullSpace}>
            <button
              data-testid="reading-pane-fullspace"
              onClick={() => props.onToggleFullSpace?.()}
              class="hidden md:flex w-8 h-8 rounded-lg border-none bg-transparent cursor-pointer items-center justify-center text-[var(--text-secondary)] hover:bg-[var(--hover-bg)] hover:text-[var(--foreground)] transition-colors"
              title={props.isFullSpace ? "Exit full space" : "Expand"}
            >
              <Show when={props.isFullSpace} fallback={<IconExpand size={16} />}>
                <IconCollapse size={16} />
              </Show>
            </button>
          </Show>
        </div>
      </div>
      </div>

      {/* Content area */}
      <Show
        when={useThreadView()}
        fallback={
          /* Single email fallback */
          <Show
            when={safeSingleEmail()}
            fallback={<div class="p-8 text-center text-gray-500">{props.emailSeq ? "Loading email..." : "Select an email to read"}</div>}
          >
            <div class="relative flex-1 overflow-hidden">
              <div
                data-testid="mobile-reader-scroll-container"
                class="h-full overflow-y-auto p-6 pb-28"
                ref={(el) => {
                  mobileReaderScrollContainer = el;
                }}
                onScroll={handleReaderScroll}
              >
                <SingleEmailView
                  email={safeSingleEmail()!}
                  emailLabels={emailLabels(safeSingleEmail()!)}
                  avatarColor={avatarColor}
                  getInitial={getInitial}
                  isCurrentUserMessage={isCurrentUserMessage}
                  userAvatarImage={userAvatarImage()}
                  iframeHeight={iframeHeight()}
                  resizeIframeToContent={resizeIframeToContent}
                  allowHeavyRender={allowHeavyRender()}
                  onSwipeTouchStart={handleSwipeTouchStart}
                  onSwipeTouchEnd={handleSwipeTouchEnd}
                  onSwipeGesture={handleSwipeGesture}
                />
              </div>
              <div class="absolute inset-x-0 bottom-0 z-20 pointer-events-none">
                <div
                  data-testid="mobile-reader-quick-reply"
                  class={`pointer-events-auto bg-[var(--card)] backdrop-blur border-t border-[var(--border)] shadow-[0_-8px_20px_rgba(0,0,0,0.08)] transition-[transform,opacity] duration-200 ${
                    shouldHideMobileReaderChrome() ? "translate-y-full opacity-0" : "translate-y-0 opacity-100"
                  }`}
                >
                  <Show when={allowHeavyRender()}>
                    <InlineComposer email={safeSingleEmail() as FullEmail} onSent={handleComposerSent} />
                  </Show>
                </div>
              </div>
            </div>
          </Show>
        }
      >
          {/* Thread / conversation view */}
          <div class="relative flex-1 overflow-hidden">
            <Show when={visibleThreadMessages().length > 0} fallback={<div class="h-full" />}>
            <div
              data-testid="mobile-reader-scroll-container"
              class="h-full overflow-y-auto pb-28"
              ref={(el) => {
                mobileReaderScrollContainer = el;
              }}
              onScroll={handleReaderScroll}
            >
              {/* Thread subject header */}
              <div class="px-6 pt-6 pb-3 border-b border-gray-100">
                <div class="flex items-center gap-2 flex-wrap">
                  <h1 class="text-2xl font-bold text-gray-900">{threadSubject()}</h1>
                  <span class="text-sm text-gray-400">{visibleThreadMessages().length} messages</span>
                  <Show when={visibleThreadMessages().length > 1}>
                    <button
                      onClick={() => setSettings("expandAllThreadMessages", !settings.expandAllThreadMessages)}
                      class="w-6 h-6 rounded-md border border-gray-200 bg-white cursor-pointer flex items-center justify-center text-gray-500 hover:bg-gray-50 hover:text-gray-900 transition-colors"
                      title={settings.expandAllThreadMessages ? "Collapse all messages" : "Expand all messages"}
                    >
                      <Show when={settings.expandAllThreadMessages} fallback={<IconChevronDown size={13} />}>
                        <IconChevronUp size={13} />
                      </Show>
                    </button>
                  </Show>
                </div>
              </div>

              {/* Stacked messages */}
              <div class="px-4 py-2">
                <For each={visibleThreadMessages()}>
                  {(msg, index) => {
                    const isExpanded = () => expandedMessages().has(msg.seq);
                    const isLast = () => index() === visibleThreadMessages().length - 1;

                    return (
                      <div class="border border-gray-200 rounded-lg mb-2 overflow-hidden bg-white">
                        {/* Message header — always visible, clickable to expand/collapse */}
                        <div
                          class={`flex items-center gap-3 px-4 py-3 cursor-pointer transition-colors ${
                            isExpanded() ? "border-b border-gray-100" : "hover:bg-gray-50"
                          }`}
                          onClick={() => toggleMessage(msg.seq)}
                        >
                          <Show
                            when={isCurrentUserMessage(msg) && userAvatarImage()}
                            fallback={
                              <div
                                class="w-8 h-8 rounded-full flex items-center justify-center text-white font-bold text-xs shrink-0"
                                style={{ background: avatarColorHex(msg.from || "") }}
                              >
                                {getInitial(msg.from || "")}
                              </div>
                            }
                          >
                            <img src={userAvatarImage()!} alt="Your avatar" class="w-8 h-8 rounded-full object-cover shrink-0" />
                          </Show>
                          <div class="flex-1 min-w-0">
                            <div class="flex items-center gap-2">
                              <span class={`text-sm truncate ${!msg?.flags?.includes("\\Seen") ? "font-bold text-gray-900" : "font-medium text-gray-700"}`}>
                                {msg.from}
                              </span>
                              <SyncStatusIcon status={msg.syncStatus} />
                              <Show when={msg.folderPath}>
                                <span class="text-[10px] px-1.5 py-0.5 rounded bg-gray-100 text-gray-500 shrink-0">
                                  {msg.folderPath === "INBOX" ? "Inbox" : msg.folderPath?.replace(/.*\//, '')}
                                </span>
                              </Show>
                            </div>
                            <Show when={!isExpanded()}>
                              <p class="text-xs text-gray-400 truncate mt-0.5">{msg.snippet}</p>
                            </Show>
                          </div>
                          <div class="flex items-center gap-2 shrink-0">
                            <Show when={(msg.attachments?.length || 0) > 0}>
                              <span
                                class="inline-flex items-center justify-center text-gray-400"
                                title="Has attachments"
                                aria-label="Has attachments"
                              >
                                <IconPaperclip size={12} />
                              </span>
                            </Show>
                            <span class="text-xs text-gray-400 whitespace-nowrap">
                              {formatRelativeDate(msg.date)}
                            </span>
                            <Show when={isExpanded()} fallback={<IconChevronDown size={14} class="text-gray-400" />}>
                              <IconChevronUp size={14} class="text-gray-400" />
                            </Show>
                          </div>
                        </div>

                        {/* Expanded message body */}
                        <Show when={isExpanded()}>
                          <div class="px-4 py-3">
                            {/* Recipients */}
                            <div class="text-xs text-gray-500 mb-3">
                              <span>to {msg.to?.join(", ") || "Unknown"}</span>
                              <Show when={msg.cc && msg.cc.length > 0}>
                                <span class="ml-2">cc {msg.cc!.join(", ")}</span>
                              </Show>
                              <span class="ml-2 text-gray-400">{formatFullDate(msg.date)}</span>
                            </div>

                            {/* Labels */}
                            <Show when={emailLabels(msg).length > 0}>
                              <div class="flex gap-1 mb-3">
                                <For each={emailLabels(msg)}>
                                  {(label) => (
                                    <span
                                      class="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium text-white"
                                      style={{ background: label.color }}
                                    >
                                      {label.name}
                                    </span>
                                  )}
                                </For>
                              </div>
                            </Show>

                            {/* Email body */}
                            <div class="prose max-w-none text-gray-800">
                              <Show
                                when={msg.html}
                                fallback={
                                  <pre
                                    class="whitespace-pre-wrap text-sm text-[var(--foreground)]"
                                    style={{ "font-family": "var(--font-ui)" }}
                                    innerHTML={linkifyPlainText(msg.text)}
                                  />
                                }
                              >
                                <Show
                                  when={allowHeavyRender()}
                                  fallback={<div class="h-28 rounded-md border border-[var(--border)] bg-[var(--search-bg)] animate-pulse" />}
                                >
                                  <ThreadMessageIframe
                                    html={msg.html!}
                                    allowHistoryCollapse={index() > 0}
                                    onSwipeTouchStart={handleSwipeTouchStart}
                                    onSwipeTouchEnd={handleSwipeTouchEnd}
                                    onSwipeGesture={handleSwipeGesture}
                                  />
                                </Show>
                              </Show>
                            </div>

                            <Show when={(msg.attachments?.length || 0) > 0}>
                              <div class="mt-4 border-t border-gray-100 pt-3" data-testid="received-attachments">
                                <div class="text-xs font-semibold text-gray-500 mb-2">Attachments</div>
                                <div class="flex flex-wrap gap-2">
                                  <For each={msg.attachments}>
                                    {(att) => (
                                      <a
                                        href={`/api/attachments/${encodeURIComponent(att.id)}`}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        download={att.filename}
                                        class="inline-flex items-center gap-2 rounded-md border border-gray-200 bg-gray-50 px-2 py-1 text-xs text-gray-700 no-underline hover:bg-gray-100"
                                      >
                                        <IconPaperclip size={12} class="text-gray-500" />
                                        <span class="max-w-[280px] truncate">{att.filename}</span>
                                        <Show when={formatAttachmentSize(att.sizeBytes)}>
                                          <span class="text-gray-400">({formatAttachmentSize(att.sizeBytes)})</span>
                                        </Show>
                                      </a>
                                    )}
                                  </For>
                                </div>
                              </div>
                            </Show>
                          </div>
                        </Show>
                      </div>
                    );
                  }}
                </For>
              </div>
            </div>

            {/* Reply composer at bottom */}
            <Show when={composerEmail() && allowHeavyRender()}>
              <div class="absolute inset-x-0 bottom-0 z-20 pointer-events-none">
                <div
                  data-testid="mobile-reader-quick-reply"
                  class={`pointer-events-auto bg-[var(--card)] backdrop-blur border-t border-[var(--border)] shadow-[0_-8px_20px_rgba(0,0,0,0.08)] transition-[transform,opacity] duration-200 ${
                    shouldHideMobileReaderChrome() ? "translate-y-full opacity-0" : "translate-y-0 opacity-100"
                  }`}
                >
                  <InlineComposer email={composerEmail() as FullEmail} onSent={handleComposerSent} />
                </div>
              </div>
            </Show>
            </Show>
          </div>
      </Show>
    </div>
  );
};

function buildCollapsibleReaderHtml(rawHtml: string, allowCollapse = true): string {
  if (typeof window === "undefined" || !rawHtml) return rawHtml;

  const parser = new DOMParser();
  const doc = parser.parseFromString(rawHtml, "text/html");
  const body = doc.body;
  if (!body) return rawHtml;

  // Inject a minimal base style as the very first child of <head> so the email's
  // own <style> blocks (which come after) can always override these defaults.
  // This prevents the browser's UA stylesheet from rendering text in serif when
  // the email doesn't declare a font-family.
  const baseStyle = doc.createElement("style");
  baseStyle.textContent =
    "html,body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;font-size:14px;line-height:1.5;margin:0;padding:8px 0;}";
  const head = doc.head ?? doc.body;
  head.insertBefore(baseStyle, head.firstChild);

  // Always open message links in a new tab instead of navigating inside the reader iframe.
  const anchors = Array.from(doc.querySelectorAll<HTMLAnchorElement>("a[href]"));
  for (const anchor of anchors) {
    anchor.setAttribute("target", "_blank");
    const rel = new Set(
      (anchor.getAttribute("rel") || "")
        .split(/\s+/)
        .map((token) => token.trim().toLowerCase())
        .filter(Boolean),
    );
    rel.add("noopener");
    rel.add("noreferrer");
    anchor.setAttribute("rel", Array.from(rel).join(" "));
  }

  const selector = [
    ".gmail_quote",
    ".protonmail_quote",
    ".yahoo_quoted",
    "div[type='cite']",
    "blockquote[type='cite']",
    "[data-quoted='true']",
  ].join(",");

  const quoteRoot = body.querySelector<HTMLElement>(selector);
  // Even when there's no collapsible quote, still return the base-style-injected HTML
  if (!quoteRoot || !allowCollapse) return doc.documentElement.outerHTML;
  const parent = quoteRoot.parentNode;
  if (!parent) return doc.documentElement.outerHTML;

  const details = doc.createElement("details");
  details.className = "codex-trimmed-history";
  details.setAttribute("style", "margin:8px 0;");

  const summary = doc.createElement("summary");
  summary.setAttribute(
    "style",
    "display:inline-flex;align-items:center;justify-content:center;list-style:none;cursor:pointer;" +
      "width:22px;height:22px;border:1px solid #dadce0;border-radius:9999px;background:#f8f9fa;color:#5f6368;" +
      "font:700 13px/1 Arial,sans-serif;letter-spacing:0.5px;user-select:none;"
  );
  summary.textContent = "...";
  details.appendChild(summary);

  const content = doc.createElement("div");
  content.setAttribute("style", "margin-top:8px;");
  details.appendChild(content);

  // Insert wrapper before moving the quote node, so the reference node is valid.
  parent.insertBefore(details, quoteRoot);
  content.appendChild(quoteRoot);

  const style = doc.createElement("style");
  style.textContent = `
    .codex-trimmed-history > summary::-webkit-details-marker { display: none; }
    .codex-trimmed-history > summary { outline: none; }
    .codex-trimmed-history > summary:hover { background: #f1f3f4 !important; border-color: #c7c9cc !important; }
  `;
  (doc.head || doc.body).appendChild(style);

  return doc.documentElement.outerHTML;
}

function bindIframeAutoResize(frame: HTMLIFrameElement, resize: () => void) {
  if (frame.dataset.resizeBound === "1") return;
  frame.dataset.resizeBound = "1";
  try {
    const doc = frame.contentDocument;
    if (!doc) return;

    const scheduleResize = () => {
      requestAnimationFrame(resize);
      setTimeout(resize, 60);
    };

    doc.addEventListener("load", scheduleResize, true);
    doc.addEventListener("error", scheduleResize, true);
    doc.addEventListener("transitionend", scheduleResize, true);
    doc.addEventListener("animationend", scheduleResize, true);

    const mutationObserver = new MutationObserver(scheduleResize);
    mutationObserver.observe(doc.documentElement, {
      subtree: true,
      childList: true,
      attributes: true,
      characterData: true,
    });

    if (typeof ResizeObserver !== "undefined" && doc.body) {
      const resizeObserver = new ResizeObserver(() => scheduleResize());
      resizeObserver.observe(doc.documentElement);
      resizeObserver.observe(doc.body);
    }

    // Late-loading newsletter assets can shift layout well after iframe load.
    setTimeout(resize, 250);
    setTimeout(resize, 800);
    setTimeout(resize, 1500);
    setTimeout(resize, 2500);
  } catch {
    // Ignore
  }
}

function bindIframeSwipeBridge(frame: HTMLIFrameElement, onSwipe: (dx: number, dy: number) => void) {
  try {
    const doc = frame.contentDocument;
    if (!doc) return;
    let startX = 0;
    let startY = 0;

    doc.addEventListener(
      "touchstart",
      (event) => {
        const touch = event.touches?.[0];
        if (!touch) return;
        startX = touch.clientX;
        startY = touch.clientY;
      },
      { passive: true },
    );

    doc.addEventListener(
      "touchend",
      (event) => {
        const touch = event.changedTouches?.[0];
        if (!touch) return;
        onSwipe(touch.clientX - startX, touch.clientY - startY);
      },
      { passive: true },
    );
  } catch {
    // Ignore
  }
}

/** Iframe wrapper for individual thread messages — auto-sizes independently */
function ThreadMessageIframe(props: {
  html: string;
  allowHistoryCollapse?: boolean;
  onSwipeTouchStart?: (e: TouchEvent) => void;
  onSwipeTouchEnd?: (e: TouchEvent) => void;
  onSwipeGesture?: (dx: number, dy: number) => void;
}) {
  const [height, setHeight] = createSignal(200);
  const srcdoc = createMemo(() =>
    buildCollapsibleReaderHtml(props.html, props.allowHistoryCollapse !== false)
  );

  const resize = (frame: HTMLIFrameElement) => {
    try {
      const doc = frame.contentDocument;
      if (!doc) return;
      const bodyHeight = doc.body?.scrollHeight ?? 0;
      const htmlHeight = doc.documentElement?.scrollHeight ?? 0;
      setHeight(Math.max(40, bodyHeight, htmlHeight));
    } catch {
      // Ignore
    }
  };

  const bindHistoryToggleResize = (frame: HTMLIFrameElement) => {
    if (frame.dataset.historyToggleBound === "1") return;
    try {
      const doc = frame.contentDocument;
      if (!doc) return;
      const details = Array.from(doc.querySelectorAll<HTMLDetailsElement>("details.codex-trimmed-history"));
      if (details.length === 0) return;
      for (const item of details) {
        const summary = item.querySelector("summary");
        const updateIcon = () => {
          if (summary) summary.textContent = item.open ? "\u2212" : "...";
        };
        updateIcon();
        item.addEventListener("toggle", () => {
          updateIcon();
          if (!item.open) {
            // Help the iframe shrink immediately when collapsing history.
            setHeight(40);
          }
          requestAnimationFrame(() => resize(frame));
          setTimeout(() => resize(frame), 50);
          setTimeout(() => resize(frame), 150);
        });
      }
      frame.dataset.historyToggleBound = "1";
    } catch {
      // Ignore
    }
  };

  return (
    <iframe
      srcdoc={srcdoc()}
      class="w-full border-none block"
      style={{ height: `${height()}px` }}
      sandbox="allow-same-origin allow-popups allow-popups-to-escape-sandbox"
      onTouchStart={props.onSwipeTouchStart}
      onTouchEnd={props.onSwipeTouchEnd}
      onLoad={(e) => {
        const frame = e.currentTarget as HTMLIFrameElement;
        bindHistoryToggleResize(frame);
        bindIframeAutoResize(frame, () => resize(frame));
        if (props.onSwipeGesture) bindIframeSwipeBridge(frame, props.onSwipeGesture);
        resize(frame);
        setTimeout(() => resize(frame), 150);
        setTimeout(() => resize(frame), 700);
      }}
      title="Email Content"
    />
  );
}

/** Single email display (non-conversation mode) */
function SingleEmailView(props: {
  email: FullEmail;
  emailLabels: Array<{ name: string; color: string }>;
  avatarColor: (from: string) => string;
  getInitial: (from: string) => string;
  isCurrentUserMessage: (email: Pick<FullEmail, "from" | "fromAddress" | "accountEmail">) => boolean;
  userAvatarImage: string;
  iframeHeight: number;
  resizeIframeToContent: (frame: HTMLIFrameElement) => void;
  allowHeavyRender: boolean;
  onSwipeTouchStart?: (e: TouchEvent) => void;
  onSwipeTouchEnd?: (e: TouchEvent) => void;
  onSwipeGesture?: (dx: number, dy: number) => void;
}) {
  const srcdoc = createMemo(() => buildCollapsibleReaderHtml(props.email.html || ""));
  const bindHistoryToggleResize = (frame: HTMLIFrameElement) => {
    if (frame.dataset.historyToggleBound === "1") return;
    try {
      const doc = frame.contentDocument;
      if (!doc) return;
      const details = Array.from(doc.querySelectorAll<HTMLDetailsElement>("details.codex-trimmed-history"));
      if (details.length === 0) return;
      for (const item of details) {
        const summary = item.querySelector("summary");
        const updateIcon = () => {
          if (summary) summary.textContent = item.open ? "\u2212" : "...";
        };
        updateIcon();
        item.addEventListener("toggle", () => {
          updateIcon();
          requestAnimationFrame(() => props.resizeIframeToContent(frame));
          setTimeout(() => props.resizeIframeToContent(frame), 50);
        });
      }
      frame.dataset.historyToggleBound = "1";
    } catch {
      // Ignore
    }
  };

  return (
    <>
      <div class="mb-6">
        <div class="mb-4 flex items-center gap-2 flex-wrap">
          <h1 class="text-2xl font-bold text-gray-900">{props.email.subject || "(No Subject)"}</h1>
          <For each={props.emailLabels}>
            {(label) => (
              <span
                class="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium text-white"
                style={{ background: label.color }}
              >
                {label.name}
              </span>
            )}
          </For>
        </div>
        <div class="flex items-start gap-3">
          <Show
            when={props.isCurrentUserMessage(props.email) && props.userAvatarImage}
            fallback={
              <div class={`w-10 h-10 rounded-full flex items-center justify-center text-white font-bold shrink-0 ${props.avatarColor(props.email.from || "")}`}>
                {props.getInitial(props.email.from || "")}
              </div>
            }
          >
            <img src={props.userAvatarImage} alt="Your avatar" class="w-10 h-10 rounded-full object-cover shrink-0" />
          </Show>
          <div class="min-w-0 flex-1">
            <div class="flex items-center justify-between">
              <div class="min-w-0 flex items-center gap-1.5">
                <span class="font-semibold text-gray-900 truncate">{props.email.from}</span>
                <SyncStatusIcon status={props.email.syncStatus} />
              </div>
              <span class="text-sm text-gray-500 whitespace-nowrap ml-2">
                <span class="inline-flex items-center gap-1.5">
                  <Show when={(props.email.attachments?.length || 0) > 0}>
                    <span
                      class="inline-flex items-center justify-center text-gray-400"
                      title="Has attachments"
                      aria-label="Has attachments"
                    >
                      <IconPaperclip size={12} />
                    </span>
                  </Show>
                  <span>{new Date(props.email.date).toLocaleString()}</span>
                </span>
              </span>
            </div>
            <div class="text-sm text-gray-500 truncate">to {props.email.to}</div>
          </div>
        </div>
      </div>
      <div class="prose max-w-none text-gray-800 border-t border-gray-100 pt-6">
        <Show
          when={props.email.html}
          fallback={
            <pre
              class="whitespace-pre-wrap text-sm text-[var(--foreground)] leading-relaxed"
              style={{ "font-family": "var(--font-ui)" }}
              innerHTML={linkifyPlainText(props.email.text)}
            />
          }
        >
          <Show
            when={props.allowHeavyRender}
            fallback={<div class="h-28 rounded-md border border-[var(--border)] bg-[var(--search-bg)] animate-pulse" />}
          >
            <iframe
              srcdoc={srcdoc()}
              class="w-full border-none block"
              style={{ height: `${props.iframeHeight}px` }}
              sandbox="allow-same-origin allow-popups allow-popups-to-escape-sandbox"
              onTouchStart={props.onSwipeTouchStart}
              onTouchEnd={props.onSwipeTouchEnd}
              onLoad={(e) => {
                const frame = e.currentTarget as HTMLIFrameElement;
                bindHistoryToggleResize(frame);
                bindIframeAutoResize(frame, () => props.resizeIframeToContent(frame));
                if (props.onSwipeGesture) bindIframeSwipeBridge(frame, props.onSwipeGesture);
                props.resizeIframeToContent(frame);
                setTimeout(() => props.resizeIframeToContent(frame), 150);
                setTimeout(() => props.resizeIframeToContent(frame), 700);
              }}
              title="Email Content"
            />
          </Show>
        </Show>
      </div>
      <Show when={(props.email.attachments?.length || 0) > 0}>
        <div class="mt-4 border-t border-gray-100 pt-4" data-testid="received-attachments">
          <div class="text-xs font-semibold text-gray-500 mb-2">Attachments</div>
          <div class="flex flex-wrap gap-2">
            <For each={props.email.attachments}>
              {(att) => (
                <a
                  href={`/api/attachments/${encodeURIComponent(att.id)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  download={att.filename}
                  class="inline-flex items-center gap-2 rounded-md border border-gray-200 bg-gray-50 px-2 py-1 text-xs text-gray-700 no-underline hover:bg-gray-100"
                >
                  <IconPaperclip size={12} class="text-gray-500" />
                  <span class="max-w-[280px] truncate">{att.filename}</span>
                  <Show when={typeof att.sizeBytes === "number"}>
                    <span class="text-gray-400">
                      ({att.sizeBytes! < 1024 ? `${att.sizeBytes} B` : att.sizeBytes! < 1024 * 1024 ? `${(att.sizeBytes! / 1024).toFixed(1)} KB` : `${(att.sizeBytes! / (1024 * 1024)).toFixed(1)} MB`})
                    </span>
                  </Show>
                </a>
              )}
            </For>
          </div>
        </div>
      </Show>
    </>
  );
}

function SyncStatusIcon(props: { status?: FullEmail["syncStatus"] }) {
  if (!props.status || props.status === "imap_synced") return null;
  const isError = props.status === "sync_error";
  const title = isError ? "Sync error with IMAP" : "Still syncing to IMAP";
  return (
    <span class={`inline-flex items-center justify-center ${isError ? "text-amber-600" : "text-gray-400"}`} title={title}>
      <Show when={isError} fallback={<IconClock size={13} />}>
        <IconSpam size={13} />
      </Show>
    </span>
  );
}

export default ReadingPane;
