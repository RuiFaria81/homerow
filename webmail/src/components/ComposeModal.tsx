// src/components/ComposeModal.tsx
import { createSignal, Show, createEffect, onMount, onCleanup, For } from "solid-js";
import { isServer } from "solid-js/web";
import { sendEmail, type EmailAttachment } from "~/lib/mail-client-browser";
import { composeState, closeCompose, toggleMinimize, toggleFullscreen, updateComposeField, toggleCc, toggleBcc, startAutoSave, stopAutoSave, addAttachments, removeAttachment, discardComposeDraft, saveComposeDraftNow } from "~/lib/compose-store";
import { contacts, loadContacts, addContact } from "~/lib/contacts-store";
import { IconClose, IconSend, IconPaperclip, IconMinimize, IconMaximize, IconWindowMinimize, IconTrash } from "./Icons";
import LexicalEditor from "./LexicalEditor";
import EmailChipInput from "./EmailChipInput";
import { signatureState } from "~/lib/signature-store";
import { showToast } from "~/lib/toast-store";
import { authClient } from "~/lib/auth-client";
import { refreshCounts } from "~/lib/sidebar-store";
import { startDelayedSendWithUndo, type DelayedSendController } from "~/lib/delayed-send";
import { getActionShortcutHint } from "~/lib/keyboard-shortcuts-store";
import { commandPaletteOpen } from "~/lib/command-palette-store";

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function ComposeModal() {
  const session = authClient.useSession();
  const [loading, setLoading] = createSignal(false);
  const [savingDraft, setSavingDraft] = createSignal(false);
  const [recipientError, setRecipientError] = createSignal("");
  const [showNoSubjectConfirm, setShowNoSubjectConfirm] = createSignal(false);
  const [showScheduleControls, setShowScheduleControls] = createSignal(false);
  const [scheduleValue, setScheduleValue] = createSignal("");
  const [scheduleError, setScheduleError] = createSignal("");
  const [pendingScheduleAt, setPendingScheduleAt] = createSignal<Date | null>(null);
  const [position, setPosition] = createSignal({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = createSignal(false);
  const [dragOffset, setDragOffset] = createSignal({ x: 0, y: 0 });
  const [isDragOver, setIsDragOver] = createSignal(false);
  let activeDragPointerId: number | null = null;
  let delayedSendController: DelayedSendController | null = null;

  let subjectInput: HTMLInputElement | undefined;
  let toFieldRef: HTMLDivElement | undefined;
  let ccFieldRef: HTMLDivElement | undefined;
  let bccFieldRef: HTMLDivElement | undefined;
  let editorContainerRef: HTMLDivElement | undefined;
  let panelRef: HTMLDivElement | undefined;
  let fileInputRef: HTMLInputElement | undefined;

  const focusSubject = () => subjectInput?.focus();
  const focusEditor = () => editorContainerRef?.querySelector<HTMLElement>('[contenteditable="true"]')?.focus();
  const focusCc = () => ccFieldRef?.querySelector<HTMLInputElement>('input')?.focus();
  const focusBcc = () => bccFieldRef?.querySelector<HTMLInputElement>('input')?.focus();

  const tabFromTo = () => {
    if (composeState().showCc) focusCc();
    else if (composeState().showBcc) focusBcc();
    else focusSubject();
  };
  const tabFromCc = () => {
    if (composeState().showBcc) focusBcc();
    else focusSubject();
  };

  const toDatetimeLocal = (date: Date): string => {
    const pad = (n: number) => n.toString().padStart(2, "0");
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
  };

  const defaultScheduleValue = () => {
    const next = new Date(Date.now() + 60 * 60 * 1000);
    next.setSeconds(0, 0);
    return toDatetimeLocal(next);
  };

  const minScheduleValue = () => {
    const min = new Date(Date.now() + 60 * 1000);
    min.setSeconds(0, 0);
    return toDatetimeLocal(min);
  };

  const parseScheduleInput = (): Date | null => {
    if (!showScheduleControls()) return null;
    const value = scheduleValue().trim();
    if (!value) {
      setScheduleError("Pick a date and time to schedule this email.");
      return null;
    }
    const parsed = new Date(value);
    if (!Number.isFinite(parsed.getTime())) {
      setScheduleError("Invalid date/time.");
      return null;
    }
    if (parsed.getTime() <= Date.now()) {
      setScheduleError("Scheduled send must be in the future.");
      return null;
    }
    setScheduleError("");
    return parsed;
  };

  const schedulePreview = () => {
    const value = scheduleValue().trim();
    if (!value) return "";
    const parsed = new Date(value);
    if (!Number.isFinite(parsed.getTime())) return "";
    const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || "local time";
    return `${parsed.toLocaleString()} (${timezone})`;
  };

  const secondaryActionButtonClass = "inline-flex items-center px-4 py-2 border rounded-full bg-transparent text-[var(--foreground)] text-sm font-semibold cursor-pointer transition-all duration-200 hover:bg-[var(--hover-bg)] disabled:opacity-50";

  // Load contacts when modal opens
  createEffect(() => {
    if (composeState().isOpen) {
      loadContacts();
      startAutoSave();
    } else {
      stopAutoSave();
    }
  });

  // Reset position when opening
  createEffect(() => {
    if (composeState().isOpen && !composeState().minimized) {
      setPosition({ x: 0, y: 0 });
    }
  });

  // Sync subject input when modal opens
  createEffect(() => {
    if (composeState().isOpen) {
      if (subjectInput) subjectInput.value = composeState().subject;
    } else {
      setRecipientError("");
      setShowNoSubjectConfirm(false);
      setShowScheduleControls(false);
      setScheduleValue("");
      setScheduleError("");
      setPendingScheduleAt(null);
    }
  });

  createEffect(() => {
    if (composeState().to.length > 0 && recipientError()) {
      setRecipientError("");
    }
  });

  const focusRecipientInput = () => {
    const input = toFieldRef?.querySelector<HTMLInputElement>("input");
    input?.focus();
  };

  // Drag handlers (window dragging)
  const stopDragging = () => {
    if (!isDragging()) return;
    setIsDragging(false);
    activeDragPointerId = null;
    if (typeof document !== "undefined") {
      document.body.style.removeProperty("cursor");
      document.body.style.removeProperty("user-select");
    }
  };

  const handleDragStart = (e: PointerEvent) => {
    if (composeState().fullscreen) return;
    if (e.button !== 0) return;
    const target = e.target as HTMLElement | null;
    if (target?.closest("button, input, textarea, select, a, [contenteditable='true']")) return;
    e.preventDefault();
    e.stopPropagation();
    activeDragPointerId = e.pointerId;
    setIsDragging(true);
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    const rect = panelRef?.getBoundingClientRect();
    if (rect) {
      setDragOffset({
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
      });
    }
    if (typeof document !== "undefined") {
      document.body.style.cursor = "grabbing";
      document.body.style.userSelect = "none";
    }
  };

  const handleDragMove = (e: PointerEvent) => {
    if (!isDragging()) return;
    if (activeDragPointerId !== null && e.pointerId !== activeDragPointerId) return;
    const newX = e.clientX - dragOffset().x;
    const newY = e.clientY - dragOffset().y;
    const defaultX = window.innerWidth - 560 - 24;
    const defaultY = window.innerHeight - 620 - 16;
    setPosition({
      x: newX - defaultX,
      y: newY - defaultY,
    });
  };

  onMount(() => {
    if (typeof window === "undefined") return;
    const handleEscapeClose = (e: KeyboardEvent) => {
      if (e.defaultPrevented) return;
      if (e.key !== "Escape") return;
      if (!composeState().isOpen) return;
      if (commandPaletteOpen()) return;

      const targetEl = e.target instanceof HTMLElement ? e.target : null;
      const isComposeEditableTarget =
        Boolean(targetEl) &&
        Boolean(panelRef?.contains(targetEl)) &&
        (targetEl!.tagName === "INPUT" ||
          targetEl!.tagName === "TEXTAREA" ||
          targetEl!.tagName === "SELECT" ||
          targetEl!.isContentEditable ||
          Boolean(targetEl!.closest('[contenteditable="true"]')));
      if (isComposeEditableTarget) {
        targetEl?.blur();
        e.preventDefault();
        e.stopPropagation();
        return;
      }

      if (delayedSendController?.isActive()) {
        delayedSendController.cancel(true);
        delayedSendController = null;
        setLoading(false);
        e.preventDefault();
        return;
      }
      if (showNoSubjectConfirm()) {
        setShowNoSubjectConfirm(false);
        e.preventDefault();
        return;
      }
      closeCompose();
      e.preventDefault();
    };
    document.addEventListener("keydown", handleEscapeClose);
    window.addEventListener("blur", stopDragging);
    onCleanup(() => {
      document.removeEventListener("keydown", handleEscapeClose);
    });
  });

  onCleanup(() => {
    if (isServer) return;
    delayedSendController?.cancel(false);
    delayedSendController = null;
    window.removeEventListener("blur", stopDragging);
    stopDragging();
  });

  // File drop handlers
  const handleFileDragOver = (e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(true);
  };

  const handleFileDragLeave = (e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  };

  const handleFileDrop = (e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
    if (e.dataTransfer?.files) {
      addAttachments(Array.from(e.dataTransfer.files));
    }
  };

  const handleFileSelect = () => {
    fileInputRef?.click();
  };

  const handleFileInputChange = (e: Event) => {
    const input = e.target as HTMLInputElement;
    if (input.files) {
      addAttachments(Array.from(input.files));
      input.value = "";
    }
  };

  const sendComposeMessage = async (scheduledAt?: Date | null) => {
    setLoading(true);
    const state = composeState();
    const toStr = state.to.join(", ");
    const ccStr = state.cc.length > 0 ? state.cc.join(", ") : undefined;
    const bccStr = state.bcc.length > 0 ? state.bcc.join(", ") : undefined;
    const bodyToSend = (() => {
      if (!state.quotedEmail) return state.body;
      if (state.body.includes('data-email-quote="true"')) return state.body;
      return `${state.body}<div data-email-quote="true" style="border-left: 1px solid #ccc; padding-left: 12px; margin-left: 0; color: #555;">${state.quotedEmail.headerHtml}${state.quotedEmail.rawHtml}</div>`;
    })();

    // Convert attachments to base64 format for server
    const attachments: EmailAttachment[] = state.attachments.map((att) => ({
      filename: att.name,
      contentType: att.type,
      content: att.dataUrl.split(",")[1] || "",
    }));

    try {
      const senderDisplayName = session().data?.user?.name?.trim() || undefined;
      const result = await sendEmail(
        toStr,
        state.subject,
        bodyToSend,
        ccStr,
        bccStr,
        attachments.length > 0 ? attachments : undefined,
        undefined,
        senderDisplayName,
        scheduledAt ? { scheduledAt } : undefined,
      );
      for (const email of [...state.to, ...state.cc, ...state.bcc]) {
        addContact(email);
      }
      discardComposeDraft();
      closeCompose({ save: false });
      if (result.status === "scheduled") {
        refreshCounts();
        showToast(`Message scheduled for ${new Date(result.scheduledFor).toLocaleString()}`, "success");
      } else {
        showToast("Message sent!", "success");
      }
    } catch {
      showToast(scheduledAt ? "Failed to schedule email" : "Failed to send email", "error");
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: Event) => {
    e.preventDefault();
    if (loading()) return;
    if (composeState().to.length === 0) {
      setRecipientError("Add at least one recipient.");
      focusRecipientInput();
      return;
    }
    const scheduledAt = parseScheduleInput();
    if (showScheduleControls() && !scheduledAt) return;
    if (!composeState().subject.trim()) {
      setPendingScheduleAt(scheduledAt);
      setShowNoSubjectConfirm(true);
      return;
    }
    if (scheduledAt) {
      await sendComposeMessage(scheduledAt);
      return;
    }

    delayedSendController?.cancel(false);
    setLoading(true);
    delayedSendController = startDelayedSendWithUndo({
      onCommit: async () => {
        delayedSendController = null;
        await sendComposeMessage(null);
      },
      onCanceled: () => {
        delayedSendController = null;
        setLoading(false);
      },
    });
  };

  const handleSaveDraft = async () => {
    if (savingDraft() || loading()) return;
    setSavingDraft(true);
    try {
      const saved = await saveComposeDraftNow();
      if (saved) showToast("Draft saved", "success");
      else showToast("Nothing to save", "info");
    } catch {
      showToast("Could not save draft", "error");
    } finally {
      setSavingDraft(false);
    }
  };

  const draftStatusText = () => {
    const state = composeState();
    if (state.draftSaved && state.lastSavedAt) {
      const d = new Date(state.lastSavedAt);
      return `Draft saved at ${d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}`;
    }
    return "";
  };

  return (
    <Show when={composeState().isOpen}>
      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        multiple
        class="hidden"
        onChange={handleFileInputChange}
      />

      {/* Minimized bar */}
      <Show when={composeState().minimized}>
        <div class="fixed bottom-0 right-6 z-50">
          <div
            onClick={() => toggleMinimize(false)}
            class="flex items-center gap-3 px-5 py-2.5 bg-[var(--foreground)] text-[var(--card)] rounded-t-xl border-none cursor-pointer text-sm font-semibold shadow-lg hover:opacity-90 transition-opacity min-w-[280px]"
            data-testid="compose-minimized-bar"
          >
            <span class="flex-1 text-left">New Message</span>
            <button
              onClick={(e) => { e.stopPropagation(); closeCompose(); }}
              class="w-6 h-6 border-none bg-transparent text-white/70 cursor-pointer rounded flex items-center justify-center hover:text-white"
            >
              <IconClose size={14} />
            </button>
          </div>
        </div>
      </Show>

      {/* Floating compose panel */}
      <Show when={!composeState().minimized}>
        {/* Fullscreen backdrop */}
        <Show when={composeState().fullscreen}>
          <div
            class="compose-overlay-enter fixed inset-0 bg-black/30 backdrop-blur-[2px] z-40"
            onClick={closeCompose}
          />
        </Show>

        <div
          ref={panelRef}
          class={`compose-panel-enter fixed z-50 bg-[var(--card)] shadow-2xl flex flex-col overflow-hidden border border-[var(--border-light)] ${
            composeState().fullscreen
              ? "inset-4 rounded-2xl"
              : "rounded-xl"
          } ${isDragOver() ? "ring-2 ring-[var(--primary)] ring-offset-2" : ""}`}
          style={
            composeState().fullscreen
              ? undefined
              : {
                  right: `${24 - position().x}px`,
                  bottom: `${16 - position().y}px`,
                  width: "540px",
                  height: "580px",
                  cursor: isDragging() ? "grabbing" : undefined,
                }
          }
          onDragOver={handleFileDragOver}
          onDragLeave={handleFileDragLeave}
          onDrop={handleFileDrop}
        >
          {/* Drag overlay */}
          <Show when={isDragOver()}>
            <div class="absolute inset-0 z-50 bg-[var(--primary)]/10 border-2 border-dashed border-[var(--primary)] rounded-xl flex items-center justify-center pointer-events-none">
              <div class="flex flex-col items-center gap-2 text-[var(--primary)]">
                <IconPaperclip size={32} />
                <span class="text-sm font-semibold">Drop files to attach</span>
              </div>
            </div>
          </Show>

          {/* Header - draggable */}
          <div
            class={`flex items-center justify-between px-4 py-2.5 bg-[var(--foreground)] text-[var(--card)] cursor-grab active:cursor-grabbing select-none shrink-0 ${
              composeState().fullscreen ? "rounded-t-2xl" : "rounded-t-xl"
            }`}
            onPointerDown={handleDragStart}
            onPointerMove={handleDragMove}
            onPointerUp={stopDragging}
            onPointerCancel={stopDragging}
          >
            <h3 class="text-[13px] font-semibold">New Message</h3>
            <div class="flex gap-0.5">
              <button
                onPointerDown={(e) => e.stopPropagation()}
                onClick={(e) => { e.stopPropagation(); toggleMinimize(true); }}
                class="w-7 h-7 border-none bg-transparent text-white/70 cursor-pointer rounded-lg flex items-center justify-center transition-colors hover:text-white hover:bg-white/15"
                data-testid="compose-minimize"
                title={`Minimize${getActionShortcutHint("composeMinimize")}`}
              >
                <IconWindowMinimize size={14} />
              </button>
              <button
                onPointerDown={(e) => e.stopPropagation()}
                onClick={(e) => { e.stopPropagation(); toggleFullscreen(); setPosition({ x: 0, y: 0 }); }}
                class="w-7 h-7 border-none bg-transparent text-white/70 cursor-pointer rounded-lg flex items-center justify-center transition-colors hover:text-white hover:bg-white/15"
                data-testid="compose-toggle-fullscreen"
                title={`${composeState().fullscreen ? "Exit fullscreen" : "Fullscreen"}${getActionShortcutHint("composeToggleFullscreen")}`}
              >
                {composeState().fullscreen ? <IconMinimize size={14} /> : <IconMaximize size={14} />}
              </button>
              <button
                onPointerDown={(e) => e.stopPropagation()}
                onClick={(e) => { e.stopPropagation(); closeCompose(); }}
                class="w-7 h-7 border-none bg-transparent text-white/70 cursor-pointer rounded-lg flex items-center justify-center transition-colors hover:text-white hover:bg-white/15"
                data-testid="compose-close"
                title={`Close${getActionShortcutHint("composeClose")}`}
              >
                <IconClose size={14} />
              </button>
            </div>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} class="flex flex-col flex-1 min-h-0">
            {/* To */}
            <div ref={toFieldRef}>
              <div class="flex items-center">
                <div class="flex-1">
                  <EmailChipInput
                    emails={composeState().to}
                    onChange={(emails) => updateComposeField("to", emails)}
                    placeholder="Recipients"
                    label="To"
                    contacts={contacts()}
                    autofocus={!composeState().to.length}
                    onTabNext={tabFromTo}
                  />
                </div>
                <div class="flex gap-1 pr-3 text-xs">
                  <Show when={!composeState().showCc}>
                    <button type="button" onClick={toggleCc} class="text-[var(--text-muted)] hover:text-[var(--foreground)] border-none bg-transparent cursor-pointer font-medium">Cc</button>
                  </Show>
                  <Show when={!composeState().showBcc}>
                    <button type="button" onClick={toggleBcc} class="text-[var(--text-muted)] hover:text-[var(--foreground)] border-none bg-transparent cursor-pointer font-medium">Bcc</button>
                  </Show>
                </div>
              </div>
              <Show when={recipientError()}>
                <div class="px-4 pb-2 text-xs text-red-600" data-testid="compose-recipient-error">
                  {recipientError()}
                </div>
              </Show>
            </div>

            {/* CC */}
            <Show when={composeState().showCc}>
              <div ref={ccFieldRef}>
                <EmailChipInput
                  emails={composeState().cc}
                  onChange={(emails) => updateComposeField("cc", emails)}
                  placeholder="Cc recipients"
                  label="Cc"
                  contacts={contacts()}
                  onTabNext={tabFromCc}
                />
              </div>
            </Show>

            {/* BCC */}
            <Show when={composeState().showBcc}>
              <div ref={bccFieldRef}>
                <EmailChipInput
                  emails={composeState().bcc}
                  onChange={(emails) => updateComposeField("bcc", emails)}
                  placeholder="Bcc recipients"
                  label="Bcc"
                  contacts={contacts()}
                  onTabNext={focusSubject}
                />
              </div>
            </Show>

            {/* Subject */}
            <div class="flex items-center px-4 py-2.5 border-b border-[var(--border-light)] text-sm">
              <label class="text-[var(--text-muted)] font-medium min-w-[56px] text-[13px]">Subject</label>
              <input
                ref={subjectInput}
                type="text"
                value={composeState().subject}
                onInput={(e) => updateComposeField("subject", e.currentTarget.value)}
                onKeyDown={(e) => { if (e.key === "Tab" && !e.shiftKey) { e.preventDefault(); focusEditor(); } }}
                placeholder="What's this about?"
                class="flex-1 border-none outline-none text-sm text-[var(--foreground)] bg-transparent placeholder:text-[var(--text-muted)]"
              />
            </div>

            {/* Rich Text Editor */}
            <div class="flex-1 overflow-y-auto min-h-0" ref={editorContainerRef}>
              <LexicalEditor
                initialContent={composeState().body}
                quotedEmail={composeState().quotedEmail}
                placeholder="Write your message..."
                onChange={(html) => updateComposeField("body", html)}
                onDropAttachments={(files) => addAttachments(files)}
                onDropHandled={() => setIsDragOver(false)}
                autofocus={!!composeState().to.length}
                fullHeight
                toolbarPosition="bottom"
                signatureEnabled
                initialSignatureId={signatureState.defaultId}
              />
            </div>

            <Show when={showScheduleControls()}>
              <div class="px-4 py-2 border-t border-[var(--border-light)]">
                <div class="flex items-center gap-2">
                <label class="text-xs text-[var(--text-muted)] font-medium" for="compose-schedule-at">Send at</label>
                <input
                  id="compose-schedule-at"
                  data-testid="compose-schedule-input"
                  type="datetime-local"
                  value={scheduleValue()}
                  min={minScheduleValue()}
                  onInput={(e) => {
                    setScheduleValue(e.currentTarget.value);
                    if (scheduleError()) setScheduleError("");
                  }}
                  class="h-8 px-2 border border-[var(--border)] rounded-md bg-transparent text-sm text-[var(--foreground)] outline-none focus:border-[var(--primary)]"
                />
                <Show when={scheduleError()}>
                  <span class="text-xs text-red-600" data-testid="compose-schedule-error">{scheduleError()}</span>
                </Show>
                </div>
                <Show when={schedulePreview()}>
                  <div class="mt-1 text-[11px] text-[var(--text-muted)]" data-testid="compose-schedule-preview">
                    {schedulePreview()}
                  </div>
                </Show>
              </div>
            </Show>

            {/* Attachments list */}
            <Show when={composeState().attachments.length > 0}>
              <div class="px-4 py-2 border-t border-[var(--border-light)] flex flex-wrap gap-2 max-h-24 overflow-y-auto">
                <For each={composeState().attachments}>
                  {(att) => (
                    <div class="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-[var(--search-bg)] text-sm group">
                      <IconPaperclip size={14} class="text-[var(--text-muted)] shrink-0" />
                      <span class="text-[var(--foreground)] truncate max-w-[140px]">{att.name}</span>
                      <span class="text-[var(--text-muted)] text-xs">{formatFileSize(att.size)}</span>
                      <button
                        type="button"
                        onClick={() => removeAttachment(att.id)}
                        class="w-5 h-5 rounded-full border-none bg-transparent cursor-pointer flex items-center justify-center text-[var(--text-muted)] hover:text-[var(--destructive)] hover:bg-[var(--hover-bg)] transition-colors opacity-0 group-hover:opacity-100"
                      >
                        <IconClose size={12} />
                      </button>
                    </div>
                  )}
                </For>
              </div>
            </Show>

            {/* Footer */}
            <div class="flex items-center justify-between px-4 py-2.5 border-t border-[var(--border-light)] shrink-0">
              <div class="flex items-center gap-3">
                <button
                  type="submit"
                  disabled={loading()}
                  title={`Send${getActionShortcutHint("sendCompose")}`}
                  class="inline-flex items-center gap-2 px-6 py-2 border-none rounded-full bg-[var(--primary)] text-white text-sm font-semibold cursor-pointer transition-all duration-200 hover:brightness-110 hover:shadow-md disabled:opacity-50 active:scale-[0.97]"
                >
                  <IconSend size={15} />
                  {loading() ? (showScheduleControls() ? "Scheduling..." : "Sending...") : (showScheduleControls() ? "Schedule send" : "Send")}
                </button>
                <button
                  type="button"
                  data-testid="compose-toggle-schedule"
                  onClick={() => {
                    setShowScheduleControls((prev) => {
                      const next = !prev;
                      if (next && !scheduleValue()) setScheduleValue(defaultScheduleValue());
                      if (!next) {
                        setScheduleError("");
                        setPendingScheduleAt(null);
                      }
                      return next;
                    });
                  }}
                  class={`${secondaryActionButtonClass} ${showScheduleControls() ? "border-[var(--primary)] text-[var(--primary)]" : "border-[var(--border)]"}`}
                  title={`Schedule${getActionShortcutHint("composeToggleSchedule")}`}
                >
                  {showScheduleControls() ? "Cancel schedule" : "Schedule"}
                </button>
                <button
                  type="button"
                  data-testid="compose-save-draft"
                  onClick={handleSaveDraft}
                  disabled={savingDraft() || loading()}
                  class={`${secondaryActionButtonClass} border-[var(--border)]`}
                  title={`Save draft${getActionShortcutHint("composeSaveDraft")}`}
                >
                  {savingDraft() ? "Saving..." : "Save draft"}
                </button>
                <Show when={draftStatusText()}>
                  <span class="text-xs text-[var(--text-muted)]">{draftStatusText()}</span>
                </Show>
              </div>
              <div class="flex gap-0.5 items-center">
                <button
                  type="button"
                  data-testid="compose-attach-files"
                  onClick={handleFileSelect}
                  class="w-8 h-8 rounded-full border-none bg-transparent cursor-pointer flex items-center justify-center text-[var(--text-secondary)] hover:bg-[var(--hover-bg)]"
                  title={`Attach files${getActionShortcutHint("composeAttachFiles")}`}
                >
                  <IconPaperclip size={17} />
                </button>
              </div>
            </div>
          </form>
        </div>
      </Show>
      <Show when={showNoSubjectConfirm()}>
        <div class="fixed inset-0 z-[70] bg-black/30 backdrop-blur-[1px] flex items-center justify-center">
          <div class="w-[min(420px,90vw)] bg-[var(--card)] border border-[var(--border)] rounded-xl shadow-2xl p-5">
            <h4 class="text-base font-semibold text-[var(--foreground)]">Send without subject?</h4>
            <p class="mt-2 text-sm text-[var(--text-secondary)]">
              Your email has no subject. Do you want to send it anyway?
            </p>
            <div class="mt-5 flex justify-end gap-2">
              <button
                type="button"
                class="px-4 py-2 text-sm rounded-lg border border-[var(--border)] bg-transparent text-[var(--foreground)] cursor-pointer hover:bg-[var(--hover-bg)]"
                onClick={() => setShowNoSubjectConfirm(false)}
              >
                Cancel
              </button>
              <button
                type="button"
                class="px-4 py-2 text-sm rounded-lg border-none bg-[var(--primary)] text-white cursor-pointer hover:brightness-110 disabled:opacity-60"
                disabled={loading()}
                onClick={async () => {
                  setShowNoSubjectConfirm(false);
                  const scheduledAt = pendingScheduleAt();
                  if (scheduledAt) {
                    await sendComposeMessage(scheduledAt);
                    return;
                  }
                  delayedSendController?.cancel(false);
                  setLoading(true);
                  delayedSendController = startDelayedSendWithUndo({
                    onCommit: async () => {
                      delayedSendController = null;
                      await sendComposeMessage(null);
                    },
                    onCanceled: () => {
                      delayedSendController = null;
                      setLoading(false);
                    },
                  });
                }}
              >
                Send anyway
              </button>
            </div>
          </div>
        </div>
      </Show>
    </Show>
  );
}
