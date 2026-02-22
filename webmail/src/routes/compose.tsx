import { createSignal, Show, onMount, onCleanup } from "solid-js";
import { A, useNavigate } from "@solidjs/router";
import { sendEmail } from "~/lib/mail-client";
import { contacts, loadContacts, addContact } from "~/lib/contacts-store";
import { IconBack, IconSend, IconPaperclip } from "~/components/Icons";
import TipTapEditor from "~/components/TipTapEditor";
import EmailChipInput from "~/components/EmailChipInput";
import { getSignatureHtml } from "~/lib/signature-store";
import { showToast } from "~/lib/toast-store";
import { authClient } from "~/lib/auth-client";
import { startDelayedSendWithUndo, type DelayedSendController } from "~/lib/delayed-send";

export default function Compose() {
  const navigate = useNavigate();
  const session = authClient.useSession();
  const [loading, setLoading] = createSignal(false);
  const [bodyHtml, setBodyHtml] = createSignal("");
  const [toEmails, setToEmails] = createSignal<string[]>([]);
  const [ccEmails, setCcEmails] = createSignal<string[]>([]);
  const [bccEmails, setBccEmails] = createSignal<string[]>([]);
  const [showCc, setShowCc] = createSignal(false);
  const [showBcc, setShowBcc] = createSignal(false);
  const [subject, setSubject] = createSignal("");
  let delayedSendController: DelayedSendController | null = null;

  onMount(() => {
    loadContacts();
    // Append default signature if available
    const sig = getSignatureHtml();
    if (sig) setBodyHtml(sig);
  });

  const handleSubmit = async (e: Event) => {
    e.preventDefault();
    if (toEmails().length === 0) return;
    setLoading(true);

    const toStr = toEmails().join(", ");
    const ccStr = ccEmails().length > 0 ? ccEmails().join(", ") : undefined;
    const bccStr = bccEmails().length > 0 ? bccEmails().join(", ") : undefined;
    const senderDisplayName = session().data?.user?.name?.trim() || undefined;

    delayedSendController?.cancel(false);
    delayedSendController = startDelayedSendWithUndo({
      onCommit: async () => {
        delayedSendController = null;
        try {
          await sendEmail(toStr, subject(), bodyHtml(), ccStr, bccStr, undefined, undefined, senderDisplayName);
          for (const email of [...toEmails(), ...ccEmails(), ...bccEmails()]) {
            addContact(email);
          }
          showToast("Message sent!", "success");
          navigate("/");
        } catch {
          showToast("Failed to send email", "error");
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

  return (
    <div class="flex flex-col flex-1 h-full bg-[var(--card)]">
      {/* Header */}
      <div class="flex items-center gap-3 px-4 py-3 border-b border-[var(--border-light)] shrink-0">
        <A
          href="/"
          class="w-9 h-9 rounded-full flex items-center justify-center text-[var(--text-secondary)] transition-colors hover:bg-[var(--hover-bg)] no-underline"
        >
          <IconBack size={18} />
        </A>
        <h1 class="text-lg font-semibold text-[var(--foreground)]">Compose Email</h1>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit} class="flex flex-col flex-1 min-h-0">
        {/* To */}
        <div class="flex items-center">
          <div class="flex-1">
            <EmailChipInput
              emails={toEmails()}
              onChange={setToEmails}
              placeholder="recipient@example.com"
              label="To"
              contacts={contacts()}
              autofocus
            />
          </div>
          <div class="flex gap-1 pr-4 text-xs">
            <Show when={!showCc()}>
              <button type="button" onClick={() => setShowCc(true)} class="text-[var(--text-muted)] hover:text-[var(--foreground)] border-none bg-transparent cursor-pointer font-medium">Cc</button>
            </Show>
            <Show when={!showBcc()}>
              <button type="button" onClick={() => setShowBcc(true)} class="text-[var(--text-muted)] hover:text-[var(--foreground)] border-none bg-transparent cursor-pointer font-medium">Bcc</button>
            </Show>
          </div>
        </div>

        {/* CC */}
        <Show when={showCc()}>
          <EmailChipInput
            emails={ccEmails()}
            onChange={setCcEmails}
            placeholder="Cc recipients"
            label="Cc"
            contacts={contacts()}
          />
        </Show>

        {/* BCC */}
        <Show when={showBcc()}>
          <EmailChipInput
            emails={bccEmails()}
            onChange={setBccEmails}
            placeholder="Bcc recipients"
            label="Bcc"
            contacts={contacts()}
          />
        </Show>

        <div class="flex items-center px-4 py-3 border-b border-[var(--border-light)] text-sm">
          <label class="text-[var(--text-muted)] font-medium min-w-[56px] text-[13px]">Subject</label>
          <input
            type="text"
            value={subject()}
            onInput={(e) => setSubject(e.currentTarget.value)}
            placeholder="What's this about?"
            class="flex-1 border-none outline-none text-sm text-[var(--foreground)] bg-transparent placeholder:text-[var(--text-muted)]"
          />
        </div>

        <div class="flex-1 overflow-y-auto min-h-0">
          <TipTapEditor
            initialContent={bodyHtml()}
            placeholder="Write your message..."
            onChange={setBodyHtml}
          />
        </div>

        <div class="flex items-center justify-between px-6 py-3 border-t border-[var(--border-light)]">
          <button
            type="submit"
            disabled={loading() || toEmails().length === 0}
            class="inline-flex items-center gap-2 px-7 py-2.5 border-none rounded-full bg-[var(--primary)] text-white text-sm font-semibold cursor-pointer transition-all duration-200 hover:brightness-110 hover:shadow-md disabled:opacity-50 active:scale-[0.97]"
          >
            <IconSend size={16} />
            {loading() ? "Sending..." : "Send"}
          </button>
          <div class="flex gap-1">
            <button
              type="button"
              class="w-9 h-9 rounded-full border-none bg-transparent cursor-pointer flex items-center justify-center text-[var(--text-secondary)] transition-colors hover:bg-[var(--hover-bg)]"
              title="Attach file"
            >
              <IconPaperclip size={18} />
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
