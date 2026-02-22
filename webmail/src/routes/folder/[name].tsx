import { createResource, For, Show, createSignal, createMemo, createEffect, onMount, onCleanup } from "solid-js";
import { isServer } from "solid-js/web";
import { useParams, useNavigate } from "@solidjs/router";
import { fetchEmailsPaginated, fetchThreadsPaginated, getEmail, deleteEmail, deleteEmailsBatch, archiveEmails, addEmailLabel, removeEmailLabel, toggleStar, markAsRead, markAsUnread, moveToFolder, restoreFromTrash, snoozeEmails, cancelScheduledEmail, cancelScheduledEmails, type EmailMessage } from "~/lib/mail-client";
import { settings } from "~/lib/settings-store";
import { refreshCounts } from "~/lib/sidebar-store";
import { labelsState, addLabel, LABEL_COLORS, getVisibleLabels } from "~/lib/labels-store";
import { autoLabelRulesState } from "~/lib/auto-label-rules-store";
import { buildPaginationNamespace, getCachedPage, setCachedPage } from "~/lib/pagination-cache";
import VirtualEmailList from "~/components/VirtualEmailList";
import ReadingPane from "~/components/ReadingPane";
import ContextMenu, { type ContextMenuItem } from "~/components/ContextMenu";
import SnoozeMenu from "~/components/SnoozeMenu";
import { IconRefresh, IconArchive, IconTrash, IconChevronLeft, IconChevronRight, IconEnvelope, IconEnvelopeOpen, IconReply, IconFolder, IconSpam, IconLabel, IconClock } from "~/components/Icons";
import { openCompose } from "~/lib/compose-store";
import { showToast } from "~/lib/toast-store";
import { useMailEvents } from "~/lib/mail-events";

export default function FolderView() {
  const params = useParams();
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = createSignal("");
  const [selectedEmail, setSelectedEmail] = createSignal<number | null>(null);
  const [selectedThreadId, setSelectedThreadId] = createSignal<string | null>(null);
  const [selectedEmails, setSelectedEmails] = createSignal<Set<number>>(new Set());
  const [paneSize, setPaneSize] = createSignal(600);
  const [isResizing, setIsResizing] = createSignal(false);
  const [currentPage, setCurrentPage] = createSignal(1);
  const [pendingPage, setPendingPage] = createSignal<number | null>(null);
  const [networkLoadingPage, setNetworkLoadingPage] = createSignal<number | null>(null);
  const [currentCursor, setCurrentCursor] = createSignal<string | null>(null);
  const [pageCursors, setPageCursors] = createSignal<Map<number, string | null>>(new Map([[1, null]]));
  const [pageCache, setPageCache] = createSignal<Map<string, Awaited<ReturnType<typeof fetchEmailsPaginated>>>>(new Map());
  const [lastPageNavAt, setLastPageNavAt] = createSignal(0);
  const [hasOpenedPane, setHasOpenedPane] = createSignal(false);
  const [newConversationKeys, setNewConversationKeys] = createSignal<Set<string>>(new Set());
  const attemptedAutoLabelKeys = new Set<string>();
  let autoLabelQueue: Promise<void> = Promise.resolve();
  let activeResizePointerId: number | null = null;
  const prefetchInFlight = new Set<number>();

  // Context menu state
  const [contextMenu, setContextMenu] = createSignal<{ x: number; y: number; seq: number; flags: string[] } | null>(null);
  const [snoozeMenuPosition, setSnoozeMenuPosition] = createSignal<{ x: number; y: number } | null>(null);
  const [pendingSnoozeSeqs, setPendingSnoozeSeqs] = createSignal<number[]>([]);

  const perPage = () => parseInt(settings.emailsPerPage) || 50;
  const isScheduledFolder = () => {
    const n = (params.name || "").toLowerCase();
    return n === "scheduled" || n === "scheduled send" || n === "scheduled sends";
  };
  // Folder route should always render direct message lists.
  // Threaded view is handled on Inbox/Home and can leak confusing cross-folder results here.
  const threadedViewEnabled = createMemo(() => false);
  const cacheNamespace = createMemo(() =>
    buildPaginationNamespace({
      folder: params.name || "INBOX",
      threaded: threadedViewEnabled(),
      perPage: perPage(),
    })
  );
  const getPageCacheKey = (namespace: string, page: number) => `${namespace}::${page}`;
  const pageCacheKey = (page: number) => getPageCacheKey(cacheNamespace(), page);

  const storePageData = (
    page: number,
    data: Awaited<ReturnType<typeof fetchEmailsPaginated>>,
    threaded: boolean,
    namespace = cacheNamespace(),
  ) => {
    setPageCache((prev) => {
      const next = new Map(prev);
      next.set(getPageCacheKey(namespace, page), data);
      return next;
    });
    if (!threaded) {
      setPageCursors((prev) => {
        const next = new Map(prev);
        if (data.nextCursor) next.set(page + 1, data.nextCursor);
        else next.delete(page + 1);
        return next;
      });
    }
    void setCachedPage(namespace, page, data).catch(() => {});
  };

  onMount(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("paneSize");
      if (saved) setPaneSize(parseInt(saved));
    }
  });

  const [paginatedData, { refetch, mutate }] = createResource(
    () => ({ name: params.name, page: currentPage(), pp: perPage(), threaded: threadedViewEnabled(), cursor: currentCursor(), namespace: cacheNamespace() }),
    async ({ name, page, pp, threaded, cursor, namespace }, info) => {
      const forceNetwork = Boolean((info as { refetching?: unknown })?.refetching);
      if (!forceNetwork) {
        const cached = pageCache().get(getPageCacheKey(namespace, page));
        if (cached) return cached;
        let cachedDisk: Awaited<ReturnType<typeof fetchEmailsPaginated>> | null = null;
        try {
          cachedDisk = await getCachedPage(namespace, page) as Awaited<ReturnType<typeof fetchEmailsPaginated>> | null;
        } catch {
          cachedDisk = null;
        }
        if (cachedDisk) {
          storePageData(page, cachedDisk, threaded, namespace);
          return cachedDisk;
        }
      }
      setNetworkLoadingPage(page);
      try {
        const data = threaded
          ? await fetchThreadsPaginated(name, page, pp)
          : await fetchEmailsPaginated(name, page, pp, cursor);
        storePageData(page, data, threaded, namespace);
        return data;
      } finally {
        setNetworkLoadingPage(null);
      }
    }
  );

  const totalEmails = () => paginatedData()?.total ?? 0;
  const totalPages = () => Math.max(1, Math.ceil(totalEmails() / perPage()));
  const canGoNextPage = () => Boolean(paginatedData()?.hasMore);
  const isPageTransitionLoading = () => pendingPage() !== null && paginatedData.loading;
  const showListLoadingOverlay = () => networkLoadingPage() !== null || isPageTransitionLoading();
  const conversationKey = (email: { seq: number; threadId?: string }) =>
    email.threadId ? `t:${email.threadId}` : `u:${email.seq}`;

  const clearNewBadgeForSeq = (seq: number) => {
    const email = (paginatedData()?.emails || []).find((e) => e.seq === seq);
    if (!email) return;
    const key = conversationKey(email);
    setNewConversationKeys((prev) => {
      if (!prev.has(key)) return prev;
      const next = new Set(prev);
      next.delete(key);
      return next;
    });
  };

  const shouldSkipAutoLabelingForFolder = () => {
    const normalized = (params.name || "").toLowerCase();
    return normalized === "drafts" || normalized === "draft" || normalized === "sent" || normalized === "sent items" || normalized === "sent mail" || normalized === "sent messages" || normalized === "trash" || normalized === "bin" || normalized === "deleted items" || normalized === "deleted messages";
  };

  const normalizeDestinationAddress = (input: string) => input.trim().toLowerCase();

  const getDestinationAddresses = (email: EmailMessage) => {
    const all = [...(email.deliveredTo || []), ...(email.to || []), ...(email.cc || [])]
      .map(normalizeDestinationAddress)
      .filter((v) => v.includes("@"));
    return Array.from(new Set(all));
  };

  const getDestinationValues = (
    email: EmailMessage,
    targetField: "destinationAddress" | "destinationLocalPart" | "destinationPlusTag",
  ) => {
    const addresses = getDestinationAddresses(email);
    if (targetField === "destinationAddress") return addresses;

    if (targetField === "destinationLocalPart") {
      const values = addresses.map((addr) => addr.split("@")[0] || "").filter(Boolean);
      return Array.from(new Set(values));
    }

    const plusTags = addresses
      .map((addr) => {
        const local = addr.split("@")[0] || "";
        const plusIdx = local.indexOf("+");
        return plusIdx >= 0 ? local.slice(plusIdx + 1).trim() : "";
      })
      .filter(Boolean);
    return Array.from(new Set(plusTags));
  };

  const matchDestinationRule = (
    values: string[],
    pattern: string,
    matchType: "exact" | "contains" | "regex",
    caseSensitive: boolean,
  ): { candidate: string; regexMatch: RegExpExecArray | null } | null => {
    if (!pattern || values.length === 0) return null;
    if (matchType === "regex") {
      try {
        const regex = new RegExp(pattern, caseSensitive ? "" : "i");
        for (const value of values) {
          const match = regex.exec(value);
          if (match) return { candidate: value, regexMatch: match };
        }
      } catch {
        return null;
      }
      return null;
    }

    const needle = caseSensitive ? pattern : pattern.toLowerCase();
    for (const value of values) {
      const haystack = caseSensitive ? value : value.toLowerCase();
      if (matchType === "exact" && haystack === needle) return { candidate: value, regexMatch: null };
      if (matchType === "contains" && haystack.includes(needle)) return { candidate: value, regexMatch: null };
    }
    return null;
  };

  const renderLabelTemplate = (
    template: string,
    candidate: string,
    regexMatch: RegExpExecArray | null,
  ) => template
    .replace(/\$0/g, candidate)
    .replace(/\$(\d+)/g, (_, num) => {
      const idx = Number(num);
      if (!Number.isFinite(idx) || idx < 1) return "";
      return regexMatch?.[idx] ?? "";
    })
    .trim();

  const findLabelByNameInsensitive = (name: string) =>
    labelsState.labels.find((label) => label.name.trim().toLowerCase() === name.trim().toLowerCase());

  const enqueueAutoLabeling = (emails: EmailMessage[], folder: string) => {
    autoLabelQueue = autoLabelQueue
      .then(async () => {
        if (shouldSkipAutoLabelingForFolder()) return;
        if (!emails.length) return;
        const rules = [...autoLabelRulesState.rules]
          .filter((rule) => rule.enabled && rule.pattern.trim().length > 0)
          .sort((a, b) => a.priority - b.priority);
        if (!rules.length) return;

        let appliedAny = false;

        for (const email of emails) {
          let mutableFlags = [...email.flags];
          for (const rule of rules) {
            const values = getDestinationValues(email, rule.targetField);
            const match = matchDestinationRule(values, rule.pattern, rule.matchType, rule.caseSensitive);
            if (!match) continue;

            let labelName = "";
            if (rule.labelMode === "fixed") {
              const fixedLabel = labelsState.labels.find((l) => l.id === rule.labelId);
              if (!fixedLabel) continue;
              labelName = fixedLabel.name;
            } else {
              labelName = renderLabelTemplate(rule.labelTemplate, match.candidate, match.regexMatch);
              if (!labelName) continue;
            }

            if (mutableFlags.includes(labelName)) {
              if (autoLabelRulesState.stopAfterFirstMatch) break;
              continue;
            }

            let label = findLabelByNameInsensitive(labelName);
            if (!label) {
              if (!autoLabelRulesState.autoCreateLabelsFromTemplate) continue;
              const createdId = addLabel(labelName, LABEL_COLORS[0]);
              label = labelsState.labels.find((l) => l.id === createdId) || findLabelByNameInsensitive(labelName);
            }
            if (!label) continue;

            const attemptKey = `${folder.toLowerCase()}::${email.seq}::${rule.id}::${label.name}`;
            if (attemptedAutoLabelKeys.has(attemptKey)) continue;
            attemptedAutoLabelKeys.add(attemptKey);

            try {
              await addEmailLabel(String(email.seq), label.name, folder);
              appliedAny = true;
              mutableFlags = [...mutableFlags, label.name];
              mutate((prev) => {
                if (!prev) return prev;
                return {
                  ...prev,
                  emails: prev.emails.map((row) =>
                    row.seq === email.seq && !row.flags.includes(label.name)
                      ? { ...row, flags: [...row.flags, label.name] }
                      : row
                  ),
                };
              });
              if (autoLabelRulesState.stopAfterFirstMatch) break;
            } catch (err) {
              console.error("[AutoLabel Error] Failed to apply label:", err);
            }
          }
        }

        if (appliedAny) {
          refreshCounts();
        }
      })
      .catch((err) => {
        console.error("[AutoLabel Error] Queue failure:", err);
      });
  };

  const filteredEmails = createMemo(() => {
    const term = searchTerm().toLowerCase();
    const list = (paginatedData()?.emails || [])
      .filter((email) => Boolean(email))
      .map((email) => ({ ...email, flags: Array.isArray(email.flags) ? email.flags : [] }));
    const withNew = list.map((e) => ({ ...e, isNew: newConversationKeys().has(conversationKey(e)) }));
    if (!term) return withNew;
    return withNew.filter(
      (e) =>
        e.subject.toLowerCase().includes(term) ||
        e.from.toLowerCase().includes(term)
    );
  });

  const isDraftFolder = () => {
    const n = (params.name || "").toLowerCase();
    return n === "drafts" || n === "draft";
  };
  const isSentFolder = () => {
    const n = (params.name || "").toLowerCase();
    return n === "sent" || n === "sent items" || n === "sent mail" || n === "sent messages";
  };
  const isTrashFolder = () => {
    const n = (params.name || "").toLowerCase();
    return n === "trash" || n === "bin" || n === "deleted items" || n === "deleted messages";
  };
  const isSnoozedFolder = () => {
    const n = (params.name || "").toLowerCase();
    return n === "snoozed" || n === "snooze";
  };

  const markOpenedEmailAsRead = (seq: number) => {
    if (isDraftFolder() || isSentFolder() || isScheduledFolder()) return;
    const current = paginatedData();
    if (!current) return;
    const email = current.emails.find((e) => e.seq === seq);
    if (!email || email.flags.includes("\\Seen")) return;
    const previousFlags = Array.isArray(email.flags) ? [...email.flags] : [];
    mutate((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        emails: prev.emails.map((item) =>
          item.seq === seq && !item.flags.includes("\\Seen")
            ? { ...item, flags: [...item.flags, "\\Seen"] }
          : item
        ),
      };
    });
    clearNewBadgeForSeq(seq);
    // Keep reader opening local-first: sync remote read flag in background without
    // forcing an immediate global counts refresh/reconcile on click.
    void markAsRead(String(seq), params.name)
      .then(() => {
        setTimeout(() => refreshCounts(), 250);
      })
      .catch((err) => {
        console.error("[UI Warning] markOpenedEmailAsRead sync failed:", err);
        mutate((prev) => {
          if (!prev) return prev;
          return {
            ...prev,
            emails: prev.emails.map((item) =>
              item.seq === seq ? { ...item, flags: previousFlags } : item
            ),
          };
        });
        refreshCounts();
      });
  };

  const handleEmailClick = async (seq: number) => {
    if (isScheduledFolder()) {
      setSelectedEmail(null);
      setSelectedThreadId(null);
      return;
    }
    const clicked = filteredEmails().find((e) => e.seq === seq);
    const isDraftMessage = Boolean(clicked?.flags?.includes("\\Draft"));
    if (isDraftFolder() || (isTrashFolder() && isDraftMessage)) {
      const draft = await getEmail(String(seq), params.name);
      if (!draft) return;
      openCompose({
        to: draft.to || [],
        cc: draft.cc || [],
        bcc: draft.bcc || [],
        subject: draft.subject === "(No Subject)" ? "" : draft.subject,
        body: draft.html || draft.text || "",
        showCc: Boolean(draft.cc && draft.cc.length > 0),
        showBcc: Boolean(draft.bcc && draft.bcc.length > 0),
      });
      return;
    }

    if (settings.readingPane === "none") {
      navigate(`/email/${seq}?folder=${params.name}`);
      return;
    }

    // Always open reader immediately; do ancillary updates after.
    setSelectedEmail(seq);

    try {
      const email = filteredEmails().find(e => e.seq === seq);
      setSelectedThreadId(email?.threadId ?? null);
    } catch (err) {
      console.error("[UI Error] handleEmailClick thread selection:", err);
      setSelectedThreadId(null);
    }

    queueMicrotask(() => {
      try {
        clearNewBadgeForSeq(seq);
        void markOpenedEmailAsRead(seq);
      } catch (err) {
        console.error("[UI Error] handleEmailClick post actions:", err);
      }
    });
  };

  // --- Context menu ---
  const handleContextMenu = (seq: number, flags: string[], e: MouseEvent) => {
    e.preventDefault();
    setContextMenu({ x: e.clientX, y: e.clientY, seq, flags });
  };

  const contextMenuItems = (): ContextMenuItem[] => {
    const ctx = contextMenu();
    if (!ctx) return [];
    if (isScheduledFolder()) {
      return [
        {
          label: "Cancel scheduled send",
          icon: IconTrash,
          action: async () => {
            await handleDeleteFromList(ctx.seq);
          },
          danger: true,
        },
      ];
    }
    if (isDraftFolder()) {
      return [
        {
          label: "Delete",
          icon: IconTrash,
          action: async () => {
            await handleDeleteFromList(ctx.seq);
          },
          danger: true,
        },
      ];
    }
    if (isTrashFolder()) {
      return [
        {
          label: "Restore",
          icon: IconFolder,
          action: async () => {
            await handleRestoreFromTrash(ctx.seq);
          },
          divider: true,
        },
        {
          label: "Delete Permanently",
          icon: IconTrash,
          action: async () => {
            await handleDeleteFromList(ctx.seq);
          },
          danger: true,
        },
      ];
    }
    if (isSentFolder()) {
      return [
        {
          label: "Delete",
          icon: IconTrash,
          action: async () => {
            await handleDeleteFromList(ctx.seq);
          },
          danger: true,
        },
      ];
    }
    const isRead = ctx.flags.includes("\\Seen");
    const items: ContextMenuItem[] = [
      { label: "Reply", icon: IconReply, action: () => {
        navigate(`/email/${ctx.seq}?folder=${params.name}`);
      }},
      { label: isRead ? "Mark as Unread" : "Mark as Read", icon: isRead ? IconEnvelope : IconEnvelopeOpen, action: async () => {
        await handleToggleRead(ctx.seq, !isRead);
      }},
    ];
    if (params.name !== "Archive" && !isSentFolder() && !isScheduledFolder()) {
      items.push({ label: "Archive", icon: IconArchive, action: async () => {
        await handleArchiveFromList(ctx.seq);
      }, divider: true });
    }
    if (!isSnoozedFolder() && !isDraftFolder() && !isSentFolder() && !isTrashFolder() && !isScheduledFolder()) {
      items.push({ label: "Snooze", icon: IconClock, action: () => {
        setPendingSnoozeSeqs([ctx.seq]);
        setSnoozeMenuPosition({ x: ctx.x, y: ctx.y });
      }});
    }
    if (params.name !== "INBOX" && params.name !== "Inbox" && !isSentFolder() && !isScheduledFolder()) {
      items.push({ label: "Move to Inbox", icon: IconFolder, action: async () => {
        await moveToFolder(String(ctx.seq), params.name, "INBOX");
        refetch();
        refreshCounts();
      }});
    }
    items.push({ label: "Delete", icon: IconTrash, action: async () => {
      await handleDeleteFromList(ctx.seq);
    }, danger: true, divider: true });

    const labels = getVisibleLabels();
    items.push({
      label: "Labels",
      icon: IconLabel,
      children:
        labels.length > 0
          ? labels.map((label) => {
              const hasLabel = ctx.flags.includes(label.name);
              return {
              label: label.name,
              color: label.color,
              checked: hasLabel,
              action: async () => {
                if (hasLabel) {
                  await handleLabelRemove(ctx.seq, label.name);
                } else {
                  await handleLabelAdd(ctx.seq, label.name);
                }
              },
            };
          })
          : [{ label: "No labels available", disabled: true }],
    });

    return items;
  };

  const allSelected = () => { const list = filteredEmails(); return list.length > 0 && selectedEmails().size === list.length; };
  const someSelected = () => { const sel = selectedEmails(); return sel.size > 0 && sel.size < filteredEmails().length; };
  const toggleSelectAll = () => { if (allSelected()) setSelectedEmails(new Set()); else setSelectedEmails(new Set(filteredEmails().map(e => e.seq))); };
  const handleCheckedChange = (seq: number, checked: boolean) => { setSelectedEmails(prev => { const next = new Set(prev); if (checked) next.add(seq); else next.delete(seq); return next; }); };
  const getActionSeqs = () => {
    const selected = Array.from(selectedEmails());
    if (selected.length > 0) return selected;
    const active = selectedEmail();
    return active !== null ? [active] : [];
  };

  const handleBatchDelete = async () => {
    const seqs = getActionSeqs();
    if (!seqs.length) return;
    if (isScheduledFolder()) {
      await cancelScheduledEmails(seqs.map(String));
      if (selectedEmail() && seqs.includes(selectedEmail()!)) setSelectedEmail(null);
      setSelectedEmails(new Set());
      refetch();
      refreshCounts();
      showToast(`${seqs.length > 1 ? `${seqs.length} scheduled emails` : "Scheduled email"} canceled`, "success");
      return;
    }
    await deleteEmailsBatch(seqs.map(String), params.name);
    if (selectedEmail() && seqs.includes(selectedEmail()!)) setSelectedEmail(null);
    setSelectedEmails(new Set());
    refetch();
    refreshCounts();
    if (!isTrashFolder()) {
      const undoSeq = seqs[0];
      showToast(
        `${seqs.length > 1 ? `${seqs.length} messages` : "Message"} moved to Trash`,
        "info",
        7000,
        {
          label: "Undo",
          onClick: () => {
            void restoreFromTrash(String(undoSeq), "Trash").then(() => {
              refetch();
              refreshCounts();
            });
          },
        }
      );
    }
  };
  const handleBatchArchive = async () => {
    const seqs = getActionSeqs();
    if (!seqs.length) return;
    await archiveEmails(seqs.map(String), params.name);
    if (selectedEmail() && seqs.includes(selectedEmail()!)) setSelectedEmail(null);
    setSelectedEmails(new Set());
    refetch();
    refreshCounts();
  };
  const handleDeleteFromList = async (seq: number) => {
    if (isScheduledFolder()) {
      await cancelScheduledEmail(String(seq));
      if (selectedEmail() === seq) setSelectedEmail(null);
      refetch();
      refreshCounts();
      showToast("Scheduled email canceled", "success");
      return;
    }
    await deleteEmail(String(seq), params.name);
    if (selectedEmail() === seq) setSelectedEmail(null);
    refetch();
    refreshCounts();
    if (!isTrashFolder()) {
      showToast("Message moved to Trash", "info", 7000, {
        label: "Undo",
        onClick: () => {
          void restoreFromTrash(String(seq), "Trash").then(() => {
            refetch();
            refreshCounts();
          });
        },
      });
    }
  };
  const handleRestoreFromTrash = async (seq: number) => {
    const restoredTo = await restoreFromTrash(String(seq), params.name);
    if (selectedEmail() === seq) setSelectedEmail(null);
    setSelectedEmails((prev) => {
      const next = new Set(prev);
      next.delete(seq);
      return next;
    });
    refetch();
    refreshCounts();
    showToast(`Restored to ${restoredTo}`, "success");
  };
  const handleArchiveFromList = async (seq: number) => { await archiveEmails([String(seq)], params.name); if (selectedEmail() === seq) setSelectedEmail(null); refetch(); refreshCounts(); };
  const handleLabelAdd = async (seq: number, label: string) => { await addEmailLabel(String(seq), label, params.name); refetch(); refreshCounts(); };
  const handleStar = async (seq: number, starred: boolean) => { await toggleStar(String(seq), starred, params.name); refetch(); refreshCounts(); };
  const handleLabelRemove = async (seq: number, label: string) => { await removeEmailLabel(String(seq), label, params.name); refetch(); refreshCounts(); };
  const handleToggleRead = async (seq: number, makeRead: boolean) => {
    if (makeRead) await markAsRead(String(seq), params.name);
    else await markAsUnread(String(seq), params.name);
    refetch();
    refreshCounts();
    if (makeRead) clearNewBadgeForSeq(seq);
  };
  const handleBatchMarkRead = async (read: boolean) => {
    const seqs = getActionSeqs();
    if (!seqs.length) return;
    for (const seq of seqs) {
      if (read) await markAsRead(String(seq), params.name);
      else await markAsUnread(String(seq), params.name);
    }
    refetch();
    refreshCounts();
  };
  const handleBatchMoveToSpam = async () => {
    const seqs = getActionSeqs();
    if (!seqs.length) return;
    for (const seq of seqs) {
      await moveToFolder(String(seq), params.name, "Spam");
    }
    if (selectedEmail() && seqs.includes(selectedEmail()!)) setSelectedEmail(null);
    setSelectedEmails(new Set());
    refetch();
    refreshCounts();
  };
  const handleSnoozeSeqs = async (seqs: number[], until: Date) => {
    if (!seqs.length) {
      showToast("No email selected to snooze", "error");
      return;
    }
    try {
      await snoozeEmails(seqs.map(String), params.name, until.toISOString());
      if (selectedEmail() && seqs.includes(selectedEmail()!)) setSelectedEmail(null);
      setSelectedEmails(new Set());
      refetch();
      refreshCounts();
      showToast("Email snoozed", "success");
    } catch (err) {
      console.error("[UI Error] snooze failed:", err);
      showToast("Could not snooze email", "error");
    }
    setPendingSnoozeSeqs([]);
  };
  const openSnoozeMenuAtElement = (anchor: HTMLElement | null, seqs: number[]) => {
    if (!anchor || !seqs.length) return;
    setPendingSnoozeSeqs(seqs);
    const rect = anchor.getBoundingClientRect();
    setSnoozeMenuPosition({ x: rect.left, y: rect.bottom + 8 });
  };
  const openSnoozeMenu = (e: MouseEvent) => {
    const seqs = getActionSeqs();
    const button = e.currentTarget as HTMLElement | null;
    openSnoozeMenuAtElement(button, seqs);
  };
  const handlePaneSnooze = (seq: number, e: MouseEvent) => {
    const button = e.currentTarget as HTMLElement | null;
    openSnoozeMenuAtElement(button, [seq]);
  };
  const handleMoveToSpamFromPane = async (seq: number) => {
    await moveToFolder(String(seq), params.name, "Spam");
    if (selectedEmail() === seq) setSelectedEmail(null);
    await silentRefresh();
    refreshCounts();
  };
  const handleBatchMoveToInbox = async () => {
    const seqs = getActionSeqs();
    if (!seqs.length) return;
    for (const seq of seqs) {
      await moveToFolder(String(seq), params.name, "INBOX");
    }
    if (selectedEmail() && seqs.includes(selectedEmail()!)) setSelectedEmail(null);
    setSelectedEmails(new Set());
    refetch();
    refreshCounts();
  };
  const handleDeletedFromPane = () => { setSelectedEmail(null); setSelectedThreadId(null); refetch(); refreshCounts(); };

  const actionSelectionCount = () => {
    const selected = selectedEmails().size;
    if (selected > 0) return selected;
    return selectedEmail() === null ? 0 : 1;
  };
  const hasActionSelection = () => actionSelectionCount() > 0;

  const currentIndex = createMemo(() => (selectedEmail() === null ? -1 : filteredEmails().findIndex(e => e.seq === selectedEmail())));
  const hasPrevious = () => currentIndex() > 0;
  const hasNext = () => currentIndex() >= 0 && currentIndex() < filteredEmails().length - 1;
  const goToPrevious = () => {
    if (!hasPrevious()) return;
    void handleEmailClick(filteredEmails()[currentIndex() - 1].seq);
  };
  const goToNext = () => {
    if (!hasNext()) return;
    void handleEmailClick(filteredEmails()[currentIndex() + 1].seq);
  };

  // Pagination
  const goToPage = (page: number) => {
    if (page < 1) return;
    if (threadedViewEnabled() && page > totalPages()) return;
    if (!threadedViewEnabled()) {
      const isCursorlessPaginationFolder = isScheduledFolder();
      if (page === 1) {
        setCurrentCursor(null);
      } else {
        if (isCursorlessPaginationFolder) {
          setCurrentCursor(null);
        } else {
          const cursor = pageCursors().get(page);
          if (!cursor) return;
          setCurrentCursor(cursor);
        }
      }
    }
    const cached = pageCache().get(pageCacheKey(page));
    if (cached) mutate(cached);
    setLastPageNavAt(Date.now());
    setPendingPage(page);
    setCurrentPage(page);
    setSelectedEmail(null);
    setSelectedEmails(new Set());
  };

  const pageRangeText = () => {
    const total = totalEmails();
    if (total === 0) return "0 of 0";
    const start = (currentPage() - 1) * perPage() + 1;
    const end = Math.min(currentPage() * perPage(), total);
    return `${start}\u2013${end} of ${total}`;
  };

  const stopResizing = () => {
    if (!isResizing()) return;
    setIsResizing(false);
    activeResizePointerId = null;
    if (typeof window !== "undefined") {
      localStorage.setItem("paneSize", String(paneSize()));
      document.body.style.removeProperty("cursor");
      document.body.style.removeProperty("user-select");
    }
  };

  const handleResizePointerDown = (e: PointerEvent) => {
    if (e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();
    activeResizePointerId = e.pointerId;
    setIsResizing(true);
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    if (typeof document !== "undefined") {
      document.body.style.cursor = isVertical() ? "row-resize" : "col-resize";
      document.body.style.userSelect = "none";
    }
  };

  const handleResizePointerMove = (e: PointerEvent) => {
    if (!isResizing()) return;
    if (activeResizePointerId !== null && e.pointerId !== activeResizePointerId) return;
    if (settings.readingPane === "right") {
      const minSize = 300;
      const maxSize = window.innerWidth - 300;
      const newWidth = window.innerWidth - e.clientX;
      setPaneSize(Math.max(minSize, Math.min(newWidth, maxSize)));
    } else if (settings.readingPane === "bottom") {
      const minSize = 200;
      const maxSize = window.innerHeight - 200;
      const newHeight = window.innerHeight - e.clientY;
      setPaneSize(Math.max(minSize, Math.min(newHeight, maxSize)));
    }
  };

  // Real-time updates via SSE (instant push from sync engine)
  const { trigger: mailEventTrigger, lastEvent } = useMailEvents();

  createEffect(() => {
    const t = mailEventTrigger();
    if (t === 0) return; // Skip initial value
    const evt = lastEvent();
    void (async () => {
      const data = await refetch();
      const selectedFolder = (params.name || "").toUpperCase();
      const eventFolder = (evt?.folder || "").toUpperCase();
      if (evt?.type !== "new_message" || !evt.uid || selectedFolder !== eventFolder) return;
      const found = data?.emails?.find((e: any) => e.seq === evt.uid);
      if (!found) return;
      enqueueAutoLabeling([found], params.name || "INBOX");
      const key = conversationKey(found);
      setNewConversationKeys((prev) => {
        const next = new Set(prev);
        next.add(key);
        return next;
      });
    })();
    refreshCounts();
  });

  createEffect(() => {
    const folder = params.name || "INBOX";
    const rulesSignature = autoLabelRulesState.rules
      .map((r) => `${r.id}:${r.enabled ? 1 : 0}:${r.priority}:${r.targetField}:${r.matchType}:${r.caseSensitive ? 1 : 0}:${r.labelMode}:${r.labelId}:${r.labelTemplate}:${r.pattern}`)
      .join("|") + `|stop=${autoLabelRulesState.stopAfterFirstMatch ? 1 : 0}|create=${autoLabelRulesState.autoCreateLabelsFromTemplate ? 1 : 0}`;
    void rulesSignature;
    const data = paginatedData();
    if (!data?.emails?.length) return;
    enqueueAutoLabeling(data.emails, folder);
  });

  createEffect(() => {
    if (!paginatedData.loading && pendingPage() !== null && Boolean(paginatedData())) {
      setPendingPage(null);
    }
  });

  createEffect(() => {
    const folder = params.name;
    const threaded = threadedViewEnabled();
    const pp = perPage();
    void folder;
    void threaded;
    void pp;
    setCurrentPage(1);
    setCurrentCursor(null);
    setPageCursors(new Map([[1, null]]));
    setPageCache(new Map());
    setSelectedEmail(null);
    setSelectedEmails(new Set());
  });

  const adaptivePrefetchDepth = () => {
    if (typeof window === "undefined") return 2;
    if (document.visibilityState !== "visible") return 1;
    const conn = (navigator as Navigator & { connection?: { saveData?: boolean; effectiveType?: string; downlink?: number } }).connection;
    if (conn?.saveData) return 1;
    const effective = (conn?.effectiveType || "").toLowerCase();
    if (effective.includes("2g")) return 1;
    if (effective === "3g") return 2;
    const downlink = Number(conn?.downlink || 0);
    const recentlyPaging = Date.now() - lastPageNavAt() < 12000;
    if (downlink >= 10) return recentlyPaging ? 5 : 3;
    if (downlink >= 3) return recentlyPaging ? 4 : 2;
    return recentlyPaging ? 3 : 2;
  };

  // Hidden prefetch: warm upcoming pages in cache for faster page navigation.
  createEffect(() => {
    const threaded = threadedViewEnabled();
    const folder = params.name;
    const page = currentPage();
    const pp = perPage();
    const data = paginatedData();
    if (!data?.hasMore) return;
    const depth = Math.min(5, Math.max(1, adaptivePrefetchDepth()));
    let cancelled = false;
    onCleanup(() => {
      cancelled = true;
    });

    void (async () => {
      let prevData = data;
      for (let step = 1; step <= depth; step += 1) {
        if (cancelled || !prevData?.hasMore) return;
        const targetPage = page + step;
        const cachedTarget = pageCache().get(pageCacheKey(targetPage));
        if (cachedTarget) {
          prevData = cachedTarget;
          continue;
        }

        const cursor = pageCursors().get(targetPage);
        if (!threaded && !cursor) return;
        if (prefetchInFlight.has(targetPage)) return;

        prefetchInFlight.add(targetPage);
        try {
          const nextData = threaded
            ? await fetchThreadsPaginated(folder, targetPage, pp)
            : await fetchEmailsPaginated(folder, targetPage, pp, cursor);

          if (cancelled) return;
          storePageData(targetPage, nextData, threaded);
          prevData = nextData;
        } finally {
          prefetchInFlight.delete(targetPage);
        }
      }
    })();
  });

  onMount(() => {
    window.addEventListener("blur", stopResizing);
    window.addEventListener("pointerup", stopResizing);
    window.addEventListener("pointercancel", stopResizing);
  });
  onCleanup(() => {
    if (isServer) return;
    window.removeEventListener("blur", stopResizing);
    window.removeEventListener("pointerup", stopResizing);
    window.removeEventListener("pointercancel", stopResizing);
    stopResizing();
  });

  const isVertical = () => settings.readingPane === "bottom";
  const isNone = () => settings.readingPane === "none";
  const showPane = () => !isNone() && selectedEmail() !== null;
  createEffect(() => {
    if (!showPane() || hasOpenedPane()) return;
    queueMicrotask(() => setHasOpenedPane(true));
  });

  return (
    <div
      class={`flex flex-1 h-full overflow-hidden ${isVertical() ? "flex-col" : "flex-row"}`}
      style={{ cursor: isResizing() ? (isVertical() ? "row-resize" : "col-resize") : undefined }}
    >
      <div
        class={`flex flex-col overflow-hidden ${isResizing() || !hasOpenedPane() ? "" : "transition-[width,height] duration-75 ease-out"}`}
        style={{
          width: !isVertical() && showPane() ? `calc(100% - ${paneSize()}px)` : "100%",
          height: isVertical() && showPane() ? `calc(100% - ${paneSize()}px)` : "100%",
          "flex-shrink": 0,
        }}
      >
        <div class="flex items-center justify-between px-6 py-4 border-b border-[var(--border-light)] bg-[var(--card)] shrink-0">
          <div>
            <h1 class="text-xl font-semibold capitalize text-[var(--foreground)]">{params.name}</h1>
            <Show when={isTrashFolder()}>
              <p class="mt-1 text-xs text-[var(--text-muted)]">
                Messages in Trash older than 30 days are deleted automatically.
              </p>
            </Show>
          </div>
          <div class="flex items-center gap-2">
            <div class="relative">
              <svg class="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)] pointer-events-none" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" /></svg>
              <input type="text" placeholder={`Search in ${params.name}...`} value={searchTerm()} onInput={(e) => setSearchTerm(e.currentTarget.value)} class="h-9 pl-10 pr-4 border border-[var(--border)] rounded-full bg-transparent text-sm text-[var(--foreground)] outline-none transition-all focus:border-[var(--primary)] focus:shadow-sm placeholder:text-[var(--text-muted)]" />
            </div>
            <button onClick={() => refetch()} class="w-9 h-9 rounded-full border-none bg-transparent cursor-pointer flex items-center justify-center text-[var(--text-secondary)] hover:bg-[var(--hover-bg)]" title="Refresh"><IconRefresh size={18} /></button>
          </div>
        </div>

        {/* Toolbar */}
        <div class="flex items-center gap-1 px-4 py-2 border-b border-[var(--border-light)] bg-[var(--card)] min-h-10 shrink-0">
          <div class="flex items-center gap-0.5 mr-2">
            <input type="checkbox" class="w-[18px] h-[18px] accent-[var(--primary)] cursor-pointer" checked={allSelected()} ref={(el) => { createMemo(() => { el.indeterminate = someSelected(); }); }} onChange={toggleSelectAll} />
          </div>
          <Show when={hasActionSelection()}>
            <div data-testid="mail-list-bulk-actions" class="flex items-center gap-1">
              <Show when={actionSelectionCount() > 1}>
                <span class="text-xs text-[var(--primary)] font-medium mr-1">{actionSelectionCount()} selected</span>
              </Show>
              <Show when={!isDraftFolder() && !isSentFolder() && !isTrashFolder() && !isScheduledFolder()}>
                <button class="w-9 h-9 rounded-full border-none bg-transparent cursor-pointer flex items-center justify-center text-[var(--text-muted)] hover:bg-[var(--hover-bg)] hover:text-[var(--primary)] transition-colors" title="Archive" onClick={handleBatchArchive}><IconArchive size={18} /></button>
              </Show>
              <Show when={!isDraftFolder() && !isSentFolder() && !isTrashFolder() && !isSnoozedFolder() && !isScheduledFolder()}>
                <button class="w-9 h-9 rounded-full border-none bg-transparent cursor-pointer flex items-center justify-center text-[var(--text-muted)] hover:bg-[var(--hover-bg)] hover:text-[var(--primary)] transition-colors" title="Snooze" onClick={openSnoozeMenu}><IconClock size={18} /></button>
              </Show>
              <Show when={isTrashFolder()}>
                <button
                  class="w-9 h-9 rounded-full border-none bg-transparent cursor-pointer flex items-center justify-center text-[var(--text-muted)] hover:bg-[var(--hover-bg)] hover:text-[var(--primary)] transition-colors"
                  title="Restore"
                  onClick={async () => {
                    const seqs = getActionSeqs();
                    if (!seqs.length) return;
                    for (const seq of seqs) {
                      await handleRestoreFromTrash(seq);
                    }
                    setSelectedEmails(new Set());
                  }}
                >
                  <IconFolder size={18} />
                </button>
              </Show>
              <Show when={!isScheduledFolder()}>
                <button class="w-9 h-9 rounded-full border-none bg-transparent cursor-pointer flex items-center justify-center text-[var(--text-muted)] hover:bg-[var(--hover-bg)] hover:text-[var(--destructive)] transition-colors" title={isTrashFolder() ? "Delete permanently" : "Delete"} onClick={handleBatchDelete}><IconTrash size={18} /></button>
              </Show>
              <Show when={isScheduledFolder()}>
                <button class="w-9 h-9 rounded-full border-none bg-transparent cursor-pointer flex items-center justify-center text-[var(--text-muted)] hover:bg-[var(--hover-bg)] hover:text-[var(--destructive)] transition-colors" title="Cancel schedule" onClick={handleBatchDelete}><IconTrash size={18} /></button>
              </Show>
              <Show when={params.name !== "Spam" && !isDraftFolder() && !isSentFolder() && !isTrashFolder() && !isScheduledFolder()}>
                <button class="w-9 h-9 rounded-full border-none bg-transparent cursor-pointer flex items-center justify-center text-[var(--text-muted)] hover:bg-[var(--hover-bg)] hover:text-[var(--primary)] transition-colors" title="Mark as spam" onClick={handleBatchMoveToSpam}><IconSpam size={18} /></button>
              </Show>
              <Show when={!isDraftFolder() && !isSentFolder() && !isTrashFolder() && !isScheduledFolder()}>
                <button class="w-9 h-9 rounded-full border-none bg-transparent cursor-pointer flex items-center justify-center text-[var(--text-muted)] hover:bg-[var(--hover-bg)] hover:text-[var(--primary)] transition-colors" title="Mark as read" onClick={() => handleBatchMarkRead(true)}><IconEnvelopeOpen size={18} /></button>
                <button class="w-9 h-9 rounded-full border-none bg-transparent cursor-pointer flex items-center justify-center text-[var(--text-muted)] hover:bg-[var(--hover-bg)] hover:text-[var(--primary)] transition-colors" title="Mark as unread" onClick={() => handleBatchMarkRead(false)}><IconEnvelope size={18} /></button>
              </Show>
            </div>
          </Show>
          <div class="ml-auto flex items-center gap-1">
            <Show when={isPageTransitionLoading()}>
              <span class="inline-flex items-center gap-1.5 mr-2 text-[12px] text-[var(--text-muted)]">
                <IconRefresh size={12} class="animate-spin" />
                {`Loading page ${pendingPage()}...`}
              </span>
            </Show>
            <span class="text-[13px] text-[var(--text-muted)]">{pageRangeText()}</span>
            <button class="w-8 h-8 rounded-full border-none bg-transparent cursor-pointer flex items-center justify-center text-[var(--text-secondary)] hover:bg-[var(--hover-bg)] disabled:opacity-30" title="Previous page" onClick={() => goToPage(currentPage() - 1)} disabled={currentPage() <= 1 || isPageTransitionLoading()}><IconChevronLeft size={18} /></button>
            <button class="w-8 h-8 rounded-full border-none bg-transparent cursor-pointer flex items-center justify-center text-[var(--text-secondary)] hover:bg-[var(--hover-bg)] disabled:opacity-30" title="Next page" onClick={() => goToPage(currentPage() + 1)} disabled={!canGoNextPage() || isPageTransitionLoading()}><IconChevronRight size={18} /></button>
          </div>
        </div>

        <Show when={networkLoadingPage() !== null}>
          <div class="px-4 py-2 border-b border-[var(--border-light)] bg-[var(--hover-bg)] text-[12px] text-[var(--text-muted)] inline-flex items-center gap-2">
            <IconRefresh size={12} class="animate-spin" />
            {`Fetching page ${networkLoadingPage()} from server...`}
          </div>
        </Show>

        {/* Email List (Virtualized) */}
        <div class="relative flex-1 min-h-0 flex flex-col">
          <Show when={showListLoadingOverlay()}>
            <div class="absolute inset-0 z-20 bg-[var(--card)]/75 backdrop-blur-[1px] flex items-center justify-center pointer-events-none">
              <div class="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-[var(--border)] bg-[var(--card)] text-[13px] text-[var(--text-secondary)] shadow-sm">
                <IconRefresh size={14} class="animate-spin" />
                {`Fetching page ${networkLoadingPage() ?? pendingPage() ?? currentPage()}...`}
              </div>
            </div>
          </Show>
          <Show
            when={!paginatedData.loading || paginatedData()}
            fallback={
              <div class="flex-1 p-4 flex flex-col gap-2">
                <div class="text-[12px] text-[var(--text-muted)] inline-flex items-center gap-2">
                  <IconRefresh size={12} class="animate-spin" />
                  {`Loading page ${pendingPage() ?? networkLoadingPage() ?? currentPage()}...`}
                </div>
                <For each={Array(5)}>{() => <div class="skeleton h-11 w-full" />}</For>
              </div>
            }
          >
            <Show when={filteredEmails().length > 0} fallback={
              <div class="flex-1 flex flex-col items-center justify-center py-20 text-center text-[var(--text-muted)]">
                <h3 class="text-lg font-semibold text-[var(--text-secondary)] mb-1">No results found</h3>
                <p class="text-sm">This folder is empty</p>
              </div>
            }>
              <VirtualEmailList
                emails={filteredEmails()}
                selectedEmail={selectedEmail()}
                selectedEmails={selectedEmails()}
                onEmailClick={handleEmailClick}
                onCheckedChange={handleCheckedChange}
                onDelete={handleDeleteFromList}
                onArchive={!isDraftFolder() && !isSentFolder() && !isTrashFolder() && !isScheduledFolder() ? handleArchiveFromList : undefined}
                onStar={!isDraftFolder() && !isTrashFolder() && !isScheduledFolder() ? handleStar : undefined}
                onLabelAdd={!isDraftFolder() && !isSentFolder() && !isTrashFolder() && !isScheduledFolder() ? handleLabelAdd : undefined}
                onLabelRemove={!isDraftFolder() && !isSentFolder() && !isTrashFolder() && !isScheduledFolder() ? handleLabelRemove : undefined}
                onToggleRead={!isDraftFolder() && !isSentFolder() && !isTrashFolder() && !isScheduledFolder() ? handleToggleRead : undefined}
                onContextMenu={handleContextMenu}
              />
            </Show>
          </Show>
        </div>
      </div>

      {/* Resize Handle */}
      <Show when={showPane()}>
        <div
          class={`relative group shrink-0 transition-colors z-20 ${
            isVertical()
              ? "h-1 w-full cursor-row-resize border-t border-[var(--border-light)] hover:bg-[var(--primary)] hover:h-1.5"
              : "w-1 h-full cursor-col-resize border-l border-[var(--border-light)] hover:bg-[var(--primary)] hover:w-1.5"
          }`}
          onPointerDown={handleResizePointerDown}
          onPointerMove={handleResizePointerMove}
          onPointerUp={stopResizing}
          onPointerCancel={stopResizing}
          onLostPointerCapture={stopResizing}
          style={{ "background-color": isResizing() ? "var(--primary)" : undefined }}
        >
          <div class={`absolute ${isVertical() ? "-top-2 -bottom-2 left-0 right-0" : "top-0 bottom-0 -left-2 -right-2"}`} />
        </div>
      </Show>

      {/* Reading Pane */}
      <Show when={showPane()}>
        <div
          class="flex-shrink-0 min-w-0 overflow-hidden"
          style={{
            width: !isVertical() ? `${paneSize()}px` : "100%",
            height: isVertical() ? `${paneSize()}px` : "100%"
          }}
        >
          <ReadingPane
            emailSeq={selectedEmail()}
            folder={params.name}
            threadId={selectedThreadId()}
            onClose={() => { setSelectedEmail(null); setSelectedThreadId(null); }}
            onDeleted={handleDeletedFromPane}
            onNext={hasNext() ? goToNext : undefined}
            onPrevious={hasPrevious() ? goToPrevious : undefined}
            currentIndex={currentIndex() + 1}
            totalCount={filteredEmails().length}
            onSnooze={!isTrashFolder() && !isSnoozedFolder() && !isScheduledFolder() && !isDraftFolder() && !isSentFolder() ? handlePaneSnooze : undefined}
            onMoveToSpam={params.name !== "Spam" && !isTrashFolder() && !isScheduledFolder() && !isDraftFolder() && !isSentFolder() ? handleMoveToSpamFromPane : undefined}
            onToggleRead={!isTrashFolder() && !isScheduledFolder() && !isDraftFolder() && !isSentFolder() ? handleToggleRead : undefined}
          />
        </div>
      </Show>

      {/* Context Menu */}
      <SnoozeMenu
        position={snoozeMenuPosition()}
        onClose={() => {
          setSnoozeMenuPosition(null);
          setPendingSnoozeSeqs([]);
        }}
        onSelect={(until) => {
          void handleSnoozeSeqs(pendingSnoozeSeqs(), until);
        }}
      />
      <Show when={contextMenu()}>
        <ContextMenu
          items={contextMenuItems()}
          x={contextMenu()!.x}
          y={contextMenu()!.y}
          onClose={() => setContextMenu(null)}
        />
      </Show>
    </div>
  );
}
