import { createSignal } from "solid-js";

export type ToastType = "success" | "error" | "info";

export interface Toast {
  id: string;
  message: string;
  type: ToastType;
  actionLabel?: string;
  onAction?: () => void;
}

const [toasts, setToasts] = createSignal<Toast[]>([]);

export { toasts };

let counter = 0;
const toastTimers = new Map<string, ReturnType<typeof setTimeout>>();

export function showToast(
  message: string,
  type: ToastType = "info",
  duration = 4000,
  action?: { label: string; onClick: () => void }
): string {
  const id = `toast-${++counter}`;
  setToasts((prev) => [
    ...prev,
    { id, message, type, actionLabel: action?.label, onAction: action?.onClick },
  ]);
  if (duration > 0) {
    const timer = setTimeout(() => {
      dismissToast(id);
    }, duration);
    toastTimers.set(id, timer);
  }
  return id;
}

export function updateToast(id: string, patch: Partial<Omit<Toast, "id">>) {
  setToasts((prev) =>
    prev.map((toast) => (toast.id === id ? { ...toast, ...patch } : toast)),
  );
}

export function dismissToast(id: string) {
  const timer = toastTimers.get(id);
  if (timer) {
    clearTimeout(timer);
    toastTimers.delete(id);
  }
  setToasts((prev) => prev.filter((t) => t.id !== id));
}
