import { createResource, Show, Suspense, createSignal, createMemo, For } from "solid-js";
import { useParams, A, useNavigate, useSearchParams } from "@solidjs/router";
import { getEmail, deleteEmail, archiveEmails, markAsRead } from "~/lib/mail-client";
import { sanitizeEmailHtml } from "~/lib/sanitize-html";
import { linkifyPlainText } from "~/lib/plain-text-links";
import { IconBack, IconTrash, IconArchive, IconPaperclip } from "~/components/Icons";
import InlineComposer from "~/components/InlineComposer";
import { showToast } from "~/lib/toast-store";
import { refreshCounts } from "~/lib/sidebar-store";
import { authClient } from "~/lib/auth-client";
import { isCurrentUserSender } from "~/lib/sender-utils";

/** Render email HTML in a sandboxed iframe with auto-height and a minimal base font. */
function EmailIframe(props: { html: string }) {
  const [height, setHeight] = createSignal(300);

  // Inject a minimal base font style at the very start of <head> so the email's
  // own styles always take precedence — prevents browser UA serif default.
  const srcdoc = createMemo(() => {
    const baseStyle =
      "<style>html,body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;font-size:14px;line-height:1.5;margin:0;padding:8px 0;}</style>";
    const html = props.html;
    if (/<head[^>]*>/i.test(html)) {
      return html.replace(/(<head[^>]*>)/i, `$1${baseStyle}`);
    }
    return baseStyle + html;
  });

  return (
    <iframe
      srcdoc={srcdoc()}
      class="w-full border-none block"
      style={{ height: `${height()}px` }}
      sandbox="allow-same-origin allow-popups allow-popups-to-escape-sandbox"
      onLoad={(e) => {
        try {
          const doc = (e.currentTarget as HTMLIFrameElement).contentDocument;
          if (!doc) return;
          const h = Math.max(100, doc.body?.scrollHeight ?? 0, doc.documentElement?.scrollHeight ?? 0);
          setHeight(h);
          // Second pass for late-loading images / web fonts
          setTimeout(() => {
            try {
              const h2 = Math.max(100, doc.body?.scrollHeight ?? 0, doc.documentElement?.scrollHeight ?? 0);
              setHeight(h2);
            } catch { /* cross-origin guard */ }
          }, 600);
        } catch { /* cross-origin guard */ }
      }}
      title="Email Content"
    />
  );
}

export default function EmailView() {
  const params = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [deleting, setDeleting] = createSignal(false);
  const session = authClient.useSession();

  const folder = () => {
    const f = searchParams.folder;
    return Array.isArray(f) ? f[0] : f || "INBOX";
  };

  const [email] = createResource(() => ({ id: params.id, f: folder() }), async ({ id, f }) => {
    const data = await getEmail(id || "", f);
    if (data && !data.flags?.includes("\\Seen")) {
      void markAsRead(id || "", f).then(() => {
        refreshCounts();
      });
      return { ...data, flags: [...(data.flags || []), "\\Seen"] };
    }
    return data;
  });

  const handleDelete = async () => {
    if (!confirm("Move this email to Trash?")) return;
    setDeleting(true);
    try {
      await deleteEmail(params.id || "", folder());
      navigate(folder() === "INBOX" ? "/" : `/folder/${folder()}`);
    } catch (err) {
      showToast("Could not move to trash", "error");
      setDeleting(false);
    }
  };

  const handleArchive = async () => {
    if (!confirm("Move this email to Archive?")) return;
    try {
      await archiveEmails([params.id || ""], folder());
      navigate(folder() === "INBOX" ? "/" : `/folder/${folder()}`);
    } catch (err) {
      showToast("Could not archive email", "error");
    }
  };

  const backPath = () => folder() === "INBOX" ? "/" : `/folder/${folder()}`;
  const formatFullDate = (dateStr: string) => {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return "N/A";
    return d.toLocaleString(undefined, { weekday: "short", year: "numeric", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
  };
  const getInitial = (from: string) => (from.charAt(0) || "?").toUpperCase();
  const avatarColor = (from: string) => {
    const colors = ["#1967d2", "#c5221f", "#137333", "#b05a00", "#7c4dff", "#ea4335", "#00897b", "#6d4c41"];
    return colors[from.charCodeAt(0) % colors.length];
  };
  const userAvatarImage = () => session().data?.user?.image || "";
  const isCurrentUserMessage = (from?: string, fromAddress?: string, accountEmail?: string) =>
    isCurrentUserSender({
      from,
      fromAddress,
      currentUserEmail: session().data?.user?.email || accountEmail || "",
    });
  const formatAttachmentSize = (bytes?: number) => {
    if (typeof bytes !== "number" || !Number.isFinite(bytes) || bytes < 0) return "";
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <div class="flex flex-col flex-1 h-full bg-[var(--card)]">
      {/* Toolbar */}
      <div class="flex items-center gap-1 px-4 py-2 border-b border-[var(--border-light)] shrink-0 h-14">
        <A href={backPath()} class="w-9 h-9 rounded-lg border-none bg-transparent cursor-pointer flex items-center justify-center text-[var(--text-secondary)] transition-colors hover:bg-[var(--hover-bg)] hover:text-[var(--foreground)] no-underline"><IconBack size={18} /></A>
        <div class="w-[1px] h-5 bg-[var(--border-light)] mx-1" />
        <button onClick={handleArchive} disabled={email.loading} class="w-9 h-9 rounded-lg border-none bg-transparent cursor-pointer flex items-center justify-center text-[var(--text-secondary)] transition-colors hover:bg-[var(--hover-bg)] hover:text-[var(--foreground)] disabled:opacity-50"><IconArchive size={18} /></button>
        <Show when={folder() !== "Trash"}>
          <button onClick={handleDelete} disabled={deleting() || email.loading} class="w-9 h-9 rounded-lg border-none bg-transparent cursor-pointer flex items-center justify-center text-[var(--text-secondary)] transition-colors hover:bg-[var(--hover-bg)] hover:text-[var(--destructive)] disabled:opacity-50"><IconTrash size={18} /></button>
        </Show>
      </div>

      {/* Content */}
      <div class="flex-1 overflow-y-auto">
        <Suspense fallback={<div class="p-6 flex flex-col gap-3 max-w-4xl mx-auto w-full"><div class="skeleton h-8 w-3/4" /><div class="skeleton h-4 w-1/2" /><div class="skeleton h-40 w-full mt-4" /></div>}>
          <Show when={email()} fallback={<div class="flex items-center justify-center h-full text-[var(--text-muted)] text-sm">Email not found</div>}>
            {(data) => (
              <div class="max-w-4xl mx-auto w-full flex flex-col min-h-full">
                <div class="px-6 pt-6 pb-3">
                  <h1 class="text-2xl font-bold text-[var(--foreground)] leading-snug">{data().subject}</h1>
                </div>
                <div class="flex items-start gap-3 px-6 pb-4 border-b border-[var(--border-light)]">
                  <Show
                    when={isCurrentUserMessage(data().from, data().fromAddress, data().accountEmail) && userAvatarImage()}
                    fallback={
                      <div class="w-11 h-11 rounded-full flex items-center justify-center text-white font-semibold text-base shrink-0" style={{ background: avatarColor(data().from) }}>{getInitial(data().from)}</div>
                    }
                  >
                    <img src={userAvatarImage()!} alt="Your avatar" class="w-11 h-11 rounded-full object-cover shrink-0" />
                  </Show>
                  <div class="flex-1 min-w-0">
                    <div class="flex items-center gap-2"><span class="font-semibold text-sm text-[var(--foreground)]">{data().from}</span></div>
                    <div class="flex items-center gap-2 mt-0.5">
                      <span class="text-xs text-[var(--text-muted)] inline-flex items-center gap-1.5">
                        <Show when={(data().attachments?.length || 0) > 0}>
                          <span
                            class="inline-flex items-center justify-center"
                            title="Has attachments"
                            aria-label="Has attachments"
                          >
                            <IconPaperclip size={12} />
                          </span>
                        </Show>
                        <span>{formatFullDate(data().date)}</span>
                      </span>
                      <Show when={data().spamScore != null && (data().spamScore! >= 4)}>
                        <span
                          class={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold ${
                            data().spamScore! >= 6
                              ? "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300"
                              : "bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300"
                          }`}
                          title="Rspamd spam score"
                        >
                          {data().spamScore! >= 6 ? "Spam" : "Suspicious"} {data().spamScore!.toFixed(1)}
                        </span>
                      </Show>
                    </div>
                  </div>
                </div>
                <div class="px-6 py-6 flex-1">
                  <Show when={(data().attachments?.length || 0) > 0}>
                    <div class="mb-4 border border-[var(--border-light)] rounded-lg bg-[var(--surface)] p-3" data-testid="received-attachments">
                      <div class="text-xs font-semibold text-[var(--text-muted)] mb-2">Attachments</div>
                      <div class="flex flex-wrap gap-2">
                        <For each={data().attachments}>
                          {(att) => (
                            <a
                              href={`/api/attachments/${encodeURIComponent(att.id)}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              download={att.filename}
                              class="inline-flex items-center gap-2 rounded-md border border-[var(--border-light)] bg-white px-2 py-1 text-xs text-[var(--foreground)] no-underline hover:bg-[var(--hover-bg)]"
                            >
                              <IconPaperclip size={12} class="text-[var(--text-muted)]" />
                              <span class="max-w-[280px] truncate">{att.filename}</span>
                              <Show when={formatAttachmentSize(att.sizeBytes)}>
                                <span class="text-[var(--text-muted)]">({formatAttachmentSize(att.sizeBytes)})</span>
                              </Show>
                            </a>
                          )}
                        </For>
                      </div>
                    </div>
                  </Show>
                  <Show
                    when={data().html}
                    fallback={
                      <pre
                        class="whitespace-pre-wrap text-sm text-[var(--foreground)] leading-relaxed"
                        style={{ "font-family": "var(--font-ui)" }}
                        innerHTML={linkifyPlainText(data().text)}
                      />
                    }
                  >
                    <EmailIframe html={sanitizeEmailHtml(data().html!)} />
                  </Show>
                </div>
                
                {/* Inline Composer */}
                <div class="border-t border-[var(--border-light)] mt-auto">
                  <InlineComposer email={data()} />
                </div>
              </div>
            )}
          </Show>
        </Suspense>
      </div>
    </div>
  );
}
