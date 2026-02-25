import { createEffect, createMemo, For, Show } from "solid-js";
import { createVirtualizer } from "@tanstack/solid-virtual";
import { settings, DENSITY_CONFIG } from "~/lib/settings-store";
import EmailRow from "./EmailRow";
import type { EmailMessage } from "~/lib/mail-client-browser";

/** Pixel heights for each density setting, matching the Tailwind h-* classes in DENSITY_CONFIG */
const ROW_HEIGHT: Record<string, number> = {
  compact: 36,
  default: 44,
  comfortable: 56,
};

interface VirtualEmailListProps {
  emails: EmailMessage[];
  selectedEmail: number | null;
  selectedEmails: Set<number>;
  onEmailClick: (seq: number) => void;
  onCheckedChange: (seq: number, checked: boolean) => void;
  onDelete?: (seq: number) => void;
  onArchive?: (seq: number) => void;
  onStar?: (seq: number, starred: boolean) => void;
  onImportantToggle?: (seq: number, important: boolean) => void;
  onLabelAdd?: (seq: number, label: string) => void;
  onLabelRemove?: (seq: number, label: string) => void;
  onToggleRead?: (seq: number, makeRead: boolean) => void;
  onContextMenu?: (seq: number, flags: string[], e: MouseEvent) => void;
  onPointerDragStart?: (seq: number, e: PointerEvent, suppressClick: () => void) => void;
}

export default function VirtualEmailList(props: VirtualEmailListProps) {
  let scrollRef: HTMLDivElement | undefined;

  const rowHeight = createMemo(() => ROW_HEIGHT[settings.density] || 44);

  const virtualizer = createVirtualizer({
    get count() {
      return props.emails.length;
    },
    getScrollElement: () => scrollRef ?? null,
    estimateSize: () => rowHeight(),
    overscan: 10,
  });
  const virtualItems = createMemo(() => virtualizer.getVirtualItems());
  const shouldRenderFallbackRows = createMemo(
    () => props.emails.length > 0 && virtualItems().length === 0,
  );

  // Re-measure after route transitions and cached responses so the virtualizer
  // picks up the current scroll container before we paint rows.
  createEffect(() => {
    const count = props.emails.length;
    if (!scrollRef || count === 0) return;
    queueMicrotask(() => {
      virtualizer.measure();
    });
  });

  // Safety net for rare race conditions where virtual items are empty despite
  // having data. We retry on the next frame and fall back to plain rows.
  createEffect(() => {
    if (!shouldRenderFallbackRows()) return;
    if (typeof window === "undefined") return;
    window.requestAnimationFrame(() => {
      virtualizer.measure();
    });
  });

  const renderEmailRow = (email: EmailMessage) => (
    <EmailRow
      email={email}
      active={props.selectedEmail === email.seq}
      checked={props.selectedEmails.has(email.seq)}
      onCheckedChange={props.onCheckedChange}
      onClick={() => props.onEmailClick(email.seq)}
      onDelete={props.onDelete}
      onArchive={props.onArchive}
      onStar={props.onStar}
      onImportantToggle={props.onImportantToggle}
      onLabelAdd={props.onLabelAdd}
      onLabelRemove={props.onLabelRemove}
      onToggleRead={props.onToggleRead}
      onPointerDragStart={props.onPointerDragStart}
      onContextMenu={
        props.onContextMenu
          ? (e: MouseEvent) => props.onContextMenu!(email.seq, email.flags || [], e)
          : undefined
      }
    />
  );

  return (
    <Show
      when={!shouldRenderFallbackRows()}
      fallback={
        <div class="flex-1 overflow-y-auto">
          <For each={props.emails}>{(email) => renderEmailRow(email)}</For>
        </div>
      }
    >
      <div ref={scrollRef} class="flex-1 overflow-y-auto" style={{ contain: "strict" }}>
        <div
          style={{
            height: `${virtualizer.getTotalSize()}px`,
            width: "100%",
            position: "relative",
          }}
        >
          <For each={virtualItems()}>
            {(virtualRow) => {
              const email = () => props.emails[virtualRow.index];
              const hasEmail = () => {
                const current = email();
                return Boolean(current && typeof current.seq === "number");
              };
              return (
                <div
                  style={{
                    position: "absolute",
                    top: 0,
                    left: 0,
                    width: "100%",
                    height: `${virtualRow.size}px`,
                    transform: `translateY(${virtualRow.start}px)`,
                  }}
                >
                  <Show when={hasEmail()}>
                    {() => renderEmailRow(email()!)}
                  </Show>
                </div>
              );
            }}
          </For>
        </div>
      </div>
    </Show>
  );
}
