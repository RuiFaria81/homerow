import { createSignal, Show, createEffect, For, onCleanup } from "solid-js";
import { useNavigate } from "@solidjs/router";
import { sendEmail, type EmailAttachment, type FullEmail } from "~/lib/mail-client-browser";
import { formatReplySubject, formatForwardSubject, getForwardQuoteParts, getReplyQuoteParts, getReplyAllRecipients, getReplyRecipients } from "~/lib/reply-utils";
import type { QuotedEmail } from "./LexicalEditor";
import { openCompose, toggleMinimize, type AttachmentFile } from "~/lib/compose-store";
import { addContact } from "~/lib/contacts-store";
import { contacts, loadContacts } from "~/lib/contacts-store";
import { IconReply, IconReplyAll, IconForward, IconSend, IconTrash, IconPaperclip, IconPopOut, IconClose } from "./Icons";
import LexicalEditor from "./LexicalEditor";
import EmailChipInput from "./EmailChipInput";
import { signatureState } from "~/lib/signature-store";
import { showToast } from "~/lib/toast-store";
import { authClient } from "~/lib/auth-client";
import { startDelayedSendWithUndo, type DelayedSendController } from "~/lib/delayed-send";
import { getActionShortcutHint } from "~/lib/keyboard-shortcuts-store";

interface InlineComposerProps {
  email: FullEmail;
  onSent?: (sentEmail?: FullEmail) => void;
}

type Mode = "reply" | "reply-all" | "forward" | null;

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function InlineComposer(props: InlineComposerProps) {
  const navigate = useNavigate();
  const session = authClient.useSession();
  let containerRef: HTMLDivElement | undefined;
  const [mode, setMode] = createSignal<Mode>(null);
  const [loading, setLoading] = createSignal(false);
  const [recipients, setRecipients] = createSignal<string[]>([]);
  const [ccRecipients, setCcRecipients] = createSignal<string[]>([]);
  const [showCc, setShowCc] = createSignal(false);
  const [subject, setSubject] = createSignal("");
  const [bodyHtml, setBodyHtml] = createSignal("");
  const [quotedEmail, setQuotedEmail] = createSignal<QuotedEmail | undefined>(undefined);
  const [editorKey, setEditorKey] = createSignal(0);
  const [attachments, setAttachments] = createSignal<AttachmentFile[]>([]);
  const [isDragOver, setIsDragOver] = createSignal(false);
  let delayedSendController: DelayedSendController | null = null;

  let fileInputRef: HTMLInputElement | undefined;

  createEffect(() => {
    if (props.email) {
      discard();
    }
  });

  createEffect(() => {
    if (mode() !== null) {
      loadContacts();
    }
  });

  createEffect(() => {
    const currentMode = mode();
    if (!currentMode) return;

    const timeout = setTimeout(() => {
      const root = containerRef;
      if (!root) return;
      const editable = root.querySelector<HTMLElement>(".lexical-editor[contenteditable='true']");
      if (!editable) return;
      editable.scrollTop = 0;
      editable.focus();
      const sel = window.getSelection();
      if (!sel) return;
      const range = document.createRange();
      range.selectNodeContents(editable);
      range.collapse(true);
      sel.removeAllRanges();
      sel.addRange(range);
    }, 100);

    onCleanup(() => clearTimeout(timeout));
  });

  const initReply = () => {
    setMode("reply");
    const currentUser = props.email.accountEmail || ((typeof process !== "undefined" ? process.env?.ADMIN_EMAIL : undefined) || "admin@local");
    setRecipients(getReplyRecipients(props.email, currentUser));
    setCcRecipients([]);
    setShowCc(false);
    setSubject(formatReplySubject(props.email.subject));
    setBodyHtml("");
    const parts = getReplyQuoteParts(props.email);
    setQuotedEmail({ rawHtml: parts.rawHtml, headerHtml: parts.headerHtml, quoteType: "reply" });
    setEditorKey(k => k + 1);
    setAttachments([]);
  };

  const initReplyAll = () => {
    setMode("reply-all");
    const currentUser = props.email.accountEmail || ((typeof process !== "undefined" ? process.env?.ADMIN_EMAIL : undefined) || "admin@local");
    const { to, cc } = getReplyAllRecipients(props.email, currentUser);
    setRecipients(to);
    setCcRecipients(cc);
    setShowCc(cc.length > 0);
    setSubject(formatReplySubject(props.email.subject));
    setBodyHtml("");
    const parts = getReplyQuoteParts(props.email);
    setQuotedEmail({ rawHtml: parts.rawHtml, headerHtml: parts.headerHtml, quoteType: "reply" });
    setEditorKey(k => k + 1);
    setAttachments([]);
  };

  const initForward = () => {
    setMode("forward");
    setRecipients([]);
    setCcRecipients([]);
    setShowCc(false);
    setSubject(formatForwardSubject(props.email.subject));
    setBodyHtml("");
    const parts = getForwardQuoteParts(props.email);
    setQuotedEmail({ rawHtml: parts.rawHtml, headerHtml: parts.headerHtml, quoteType: "forward" });
    setEditorKey(k => k + 1);
    setAttachments([]);
  };

  const discard = () => {
    setMode(null);
    setRecipients([]);
    setCcRecipients([]);
    setShowCc(false);
    setSubject("");
    setBodyHtml("");
    setQuotedEmail(undefined);
    setAttachments([]);
  };

  const detach = () => {
    const detachedBody = (() => {
      if (typeof window === "undefined") return bodyHtml();
      try {
        const parser = new DOMParser();
        const doc = parser.parseFromString(bodyHtml(), "text/html");
        doc.querySelectorAll("[data-email-quote='true']").forEach((node) => node.remove());
        return doc.body.innerHTML;
      } catch {
        return bodyHtml();
      }
    })();

    openCompose({
      to: recipients(),
      cc: ccRecipients(),
      subject: subject(),
      body: detachedBody,
      quotedEmail: quotedEmail(),
      showCc: showCc(),
    });
    discard();
  };

  const handleManageSignatures = () => {
    const detachedBody = (() => {
      if (typeof window === "undefined") return bodyHtml();
      try {
        const parser = new DOMParser();
        const doc = parser.parseFromString(bodyHtml(), "text/html");
        doc.querySelectorAll("[data-email-quote='true']").forEach((node) => node.remove());
        return doc.body.innerHTML;
      } catch {
        return bodyHtml();
      }
    })();

    openCompose({
      to: recipients(),
      cc: ccRecipients(),
      subject: subject(),
      body: detachedBody,
      quotedEmail: quotedEmail(),
      showCc: showCc(),
    });
    toggleMinimize(true);
    navigate("/settings?tab=signature");
  };

  const handleFileSelect = () => fileInputRef?.click();

  const addAttachmentFiles = (files: File[]) => {
    if (files.length === 0) return;
    const promises = files.map((file) => {
      return new Promise<AttachmentFile>((resolve) => {
        const reader = new FileReader();
        reader.onload = () => {
          resolve({
            id: crypto.randomUUID(),
            name: file.name,
            size: file.size,
            type: file.type,
            dataUrl: reader.result as string,
          });
        };
        reader.readAsDataURL(file);
      });
    });
    Promise.all(promises).then((newAttachments) => {
      setAttachments((prev) => [...prev, ...newAttachments]);
    });
  };

  const handleFileInputChange = (e: Event) => {
    const input = e.target as HTMLInputElement;
    if (input.files) {
      addAttachmentFiles(Array.from(input.files));
      input.value = "";
    }
  };

  const removeAttachment = (id: string) => {
    setAttachments((prev) => prev.filter((a) => a.id !== id));
  };

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
    const files = Array.from(e.dataTransfer?.files ?? []);
    if (files.length === 0) return;
    addAttachmentFiles(files);
  };

  const handleSubmit = async (e: Event) => {
    e.preventDefault();
    if (recipients().length === 0) return;
    delayedSendController?.cancel(false);
    setLoading(true);
    delayedSendController = startDelayedSendWithUndo({
      onCommit: async () => {
        delayedSendController = null;
        try {
          const toStr = recipients().join(", ");
          const ccStr = ccRecipients().length > 0 ? ccRecipients().join(", ") : undefined;

          const emailAttachments: EmailAttachment[] = attachments().map((att) => ({
            filename: att.name,
            contentType: att.type,
            content: att.dataUrl.split(",")[1] || "",
          }));

          const senderDisplayName = session().data?.user?.name?.trim() || undefined;
          await sendEmail(
            toStr,
            subject(),
            bodyHtml(),
            ccStr,
            undefined,
            emailAttachments.length > 0 ? emailAttachments : undefined,
            {
              inReplyTo: props.email.messageId,
              references: props.email.references,
            },
            senderDisplayName,
          );
          for (const email of [...recipients(), ...ccRecipients()]) {
            addContact(email);
          }
          const nowIso = new Date().toISOString();
          const me = props.email.accountEmail || "admin@local";
          const optimistic: FullEmail = {
            id: Date.now(),
            seq: Date.now(),
            subject: subject() || "(No Subject)",
            from: senderDisplayName || "Me",
            date: nowIso,
            flags: ["\\Seen"],
            html: bodyHtml(),
            text: bodyHtml(),
            to: recipients(),
            cc: ccRecipients(),
            snippet: bodyHtml().replace(/<[^>]+>/g, "").slice(0, 200),
            fromAddress: me,
            accountEmail: me,
            folderPath: "Sent",
          };
          discard();
          props.onSent?.(optimistic);
          showToast("Message sent!", "success");
        } catch {
          showToast("Failed to send", "error");
        } finally {
          setLoading(false);
        }
      },
      onCanceled: () => {
        delayedSendController = null;
        setLoading(false);
      },
    });
  };

  onCleanup(() => {
    delayedSendController?.cancel(false);
    delayedSendController = null;
  });

  const avatarColor = () => "#1a73e8";
  const canReplyAll = () => {
    const currentUser = (props.email.accountEmail || ((typeof process !== "undefined" ? process.env?.ADMIN_EMAIL : undefined) || "admin@local")).toLowerCase();
    const participants = new Set<string>();
    const sender = (props.email.fromAddress || "").toLowerCase();
    if (sender && sender !== currentUser) participants.add(sender);
    for (const addr of props.email.to || []) {
      const normalized = addr.toLowerCase();
      if (normalized && normalized !== currentUser) participants.add(normalized);
    }
    for (const addr of props.email.cc || []) {
      const normalized = addr.toLowerCase();
      if (normalized && normalized !== currentUser) participants.add(normalized);
    }
    return participants.size > 1;
  };

  return (
    <div ref={containerRef} class="px-6 pb-8 pt-4" data-testid="inline-composer">
      <input
        ref={fileInputRef}
        type="file"
        multiple
        class="hidden"
        onChange={handleFileInputChange}
      />

      <Show when={mode() === null}>
        <div class="flex gap-3">
          <button
            onClick={initReply}
            title={`Reply${getActionShortcutHint("reply")}`}
            class="flex items-center gap-2 px-6 py-3 rounded-full border border-[var(--border-light)] bg-[var(--card)] text-[var(--text-secondary)] font-medium text-sm transition-all hover:bg-[var(--hover-bg)] hover:text-[var(--foreground)] hover:border-[var(--border)] shadow-sm cursor-pointer"
          >
            <IconReply size={18} />
            Reply
          </button>
          <Show when={canReplyAll()}>
            <button
              onClick={initReplyAll}
              title={`Reply all${getActionShortcutHint("replyAll")}`}
              class="flex items-center gap-2 px-6 py-3 rounded-full border border-[var(--border-light)] bg-[var(--card)] text-[var(--text-secondary)] font-medium text-sm transition-all hover:bg-[var(--hover-bg)] hover:text-[var(--foreground)] hover:border-[var(--border)] shadow-sm cursor-pointer"
            >
              <IconReplyAll size={18} />
              Reply All
            </button>
          </Show>
          <button
            onClick={initForward}
            title={`Forward${getActionShortcutHint("forward")}`}
            class="flex items-center gap-2 px-6 py-3 rounded-full border border-[var(--border-light)] bg-[var(--card)] text-[var(--text-secondary)] font-medium text-sm transition-all hover:bg-[var(--hover-bg)] hover:text-[var(--foreground)] hover:border-[var(--border)] shadow-sm cursor-pointer"
          >
            <IconForward size={18} />
            Forward
          </button>
        </div>
      </Show>

      <Show when={mode() !== null}>
        <div class="flex gap-4">
          <div
            class="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-sm shrink-0"
            style={{ background: avatarColor() }}
          >
            M
          </div>

          <form
            data-testid="inline-composer-form"
            onSubmit={handleSubmit}
            onDragOver={handleFileDragOver}
            onDragLeave={handleFileDragLeave}
            onDrop={handleFileDrop}
            class={`relative flex-1 bg-[var(--card)] border border-[var(--border)] rounded-lg shadow-lg overflow-hidden animate-in fade-in zoom-in-95 duration-200 ${
              isDragOver() ? "ring-2 ring-[var(--primary)] ring-offset-2" : ""
            }`}
          >
            <Show when={isDragOver()}>
              <div class="absolute inset-0 z-50 bg-[var(--primary)]/10 border-2 border-dashed border-[var(--primary)] rounded-lg flex items-center justify-center pointer-events-none">
                <div class="flex flex-col items-center gap-2 text-[var(--primary)]">
                  <IconPaperclip size={28} />
                  <span class="text-sm font-semibold">Drop files to attach</span>
                </div>
              </div>
            </Show>

            {/* Header: Recipients + Detach */}
            <div class="flex items-center gap-2 border-b border-[var(--border-light)]">
              <div class="flex-1">
                <EmailChipInput
                  emails={recipients()}
                  onChange={setRecipients}
                  placeholder="Recipients"
                  label="To"
                  contacts={contacts()}
                  autofocus={mode() === 'forward'}
                />
              </div>
              <div class="flex items-center gap-1 pr-2">
                <Show when={!showCc()}>
                  <button
                    type="button"
                    onClick={() => setShowCc(true)}
                    class="text-xs text-[var(--text-muted)] hover:text-[var(--foreground)] border-none bg-transparent cursor-pointer font-medium"
                  >
                    Cc
                  </button>
                </Show>
                <button
                  type="button"
                  onClick={detach}
                  class="p-1.5 text-[var(--text-secondary)] hover:text-[var(--foreground)] hover:bg-[var(--hover-bg)] rounded border-none bg-transparent cursor-pointer transition-colors"
                  title="Pop out"
                >
                  <IconPopOut size={16} />
                </button>
              </div>
            </div>

            {/* CC row */}
            <Show when={showCc()}>
              <EmailChipInput
                emails={ccRecipients()}
                onChange={setCcRecipients}
                placeholder="Cc recipients"
                label="Cc"
                contacts={contacts()}
              />
            </Show>

            {/* Rich Text Editor */}
            {(() => {
              const _key = editorKey();
              return (
                <LexicalEditor
                  initialContent={bodyHtml()}
                  quotedEmail={quotedEmail()}
                  placeholder="Write your reply..."
                  onChange={setBodyHtml}
                  autofocus={mode() === 'reply' || mode() === 'reply-all'}
                  toolbarPosition="bottom"
                  signatureEnabled
                  initialSignatureId={signatureState.defaultId}
                  onManageSignatures={handleManageSignatures}
                  onDropAttachments={(files) => addAttachmentFiles(files)}
                  onDropHandled={() => setIsDragOver(false)}
                />
              );
            })()}

            {/* Attachments list */}
            <Show when={attachments().length > 0}>
              <div class="px-4 py-2 border-t border-[var(--border-light)] flex flex-wrap gap-2">
                <For each={attachments()}>
                  {(att) => (
                    <div class="flex items-center gap-1.5 px-2 py-1 rounded bg-[var(--search-bg)] text-xs group">
                      <IconPaperclip size={12} class="text-[var(--text-muted)]" />
                      <span class="truncate max-w-[100px]">{att.name}</span>
                      <span class="text-[var(--text-muted)]">{formatFileSize(att.size)}</span>
                      <button
                        type="button"
                        onClick={() => removeAttachment(att.id)}
                        class="w-4 h-4 rounded-full border-none bg-transparent cursor-pointer flex items-center justify-center text-[var(--text-muted)] hover:text-[var(--destructive)] opacity-0 group-hover:opacity-100"
                      >
                        <IconClose size={10} />
                      </button>
                    </div>
                  )}
                </For>
              </div>
            </Show>

            {/* Toolbar */}
            <div class="flex items-center justify-between px-4 py-3 bg-[var(--search-bg)] border-t border-[var(--border-light)]">
              <div class="flex items-center gap-2">
                <button
                  type="submit"
                  disabled={loading() || recipients().length === 0}
                  class="flex items-center gap-2 px-5 py-2 bg-[var(--primary)] text-white rounded-md text-sm font-semibold border-none cursor-pointer transition-all hover:brightness-110 disabled:opacity-50 shadow-sm"
                >
                  <IconSend size={16} />
                  {loading() ? "Sending..." : "Send"}
                </button>
                <button
                  type="button"
                  onClick={handleFileSelect}
                  class="p-2 text-[var(--text-secondary)] hover:text-[var(--foreground)] hover:bg-[var(--hover-bg)] rounded border-none bg-transparent cursor-pointer transition-colors"
                  title="Attach files"
                >
                  <IconPaperclip size={18} />
                </button>
              </div>

              <button
                type="button"
                onClick={discard}
                class="p-2 text-[var(--text-secondary)] hover:text-[var(--destructive)] hover:bg-[var(--hover-bg)] rounded border-none bg-transparent cursor-pointer transition-colors"
                title="Discard draft"
              >
                <IconTrash size={18} />
              </button>
            </div>
          </form>
        </div>
      </Show>
    </div>
  );
}
