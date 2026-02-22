import { For, Show } from "solid-js";
import { toasts, dismissToast, type Toast } from "~/lib/toast-store";
import { IconClose } from "./Icons";

function ToastItem(props: { toast: Toast }) {
  const styleClass = () => {
    switch (props.toast.type) {
      case "success":
        return {
          panel: "bg-[var(--card)] border-emerald-200/80",
          icon: "bg-emerald-100 text-emerald-700",
          title: "text-emerald-700",
          label: "Success",
        };
      case "error":
        return {
          panel: "bg-[var(--card)] border-rose-200/80",
          icon: "bg-rose-100 text-rose-700",
          title: "text-rose-700",
          label: "Error",
        };
      default:
        return {
          panel: "bg-[var(--card)] border-[var(--border)]",
          icon: "bg-[var(--active-bg)] text-[var(--primary)]",
          title: "text-[var(--primary)]",
          label: "Notice",
        };
    }
  };
  const styles = () => styleClass();

  return (
    <div
      class={`flex items-start gap-3 px-3.5 py-3 rounded-xl border shadow-[0_10px_28px_rgba(0,0,0,0.14)] text-sm min-w-[300px] max-w-[460px] animate-in slide-in-from-bottom-2 fade-in duration-200 ${styles().panel}`}
      role="status"
    >
      <div class={`mt-0.5 w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${styles().icon}`}>
        {props.toast.type === "success" ? "✓" : props.toast.type === "error" ? "!" : "i"}
      </div>
      <div class="flex-1 min-w-0">
        <div class={`text-[11px] uppercase tracking-wide font-semibold ${styles().title}`}>{styles().label}</div>
        <div class="text-[var(--foreground)] leading-relaxed">{props.toast.message}</div>
      </div>
      <Show when={props.toast.actionLabel && props.toast.onAction}>
        <button
          onClick={() => {
            props.toast.onAction?.();
            dismissToast(props.toast.id);
          }}
          class="px-2 py-1 rounded-lg border border-[var(--border)] bg-transparent text-[var(--foreground)] cursor-pointer text-xs font-semibold hover:bg-[var(--hover-bg)] shrink-0"
        >
          {props.toast.actionLabel}
        </button>
      </Show>
      <button
        onClick={() => dismissToast(props.toast.id)}
        class="w-6 h-6 rounded-full flex items-center justify-center border-none bg-transparent cursor-pointer text-[var(--text-muted)] hover:text-[var(--foreground)] hover:bg-[var(--hover-bg)] shrink-0"
      >
        <IconClose size={12} />
      </button>
    </div>
  );
}

export default function ToastContainer() {
  return (
    <Show when={toasts().length > 0}>
      <div class="fixed bottom-6 left-1/2 -translate-x-1/2 z-[100] flex flex-col gap-2.5 items-center pointer-events-none">
        <For each={toasts()}>
          {(toast) => (
            <div class="pointer-events-auto">
              <ToastItem toast={toast} />
            </div>
          )}
        </For>
      </div>
    </Show>
  );
}
