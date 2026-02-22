import { dismissToast, showToast, updateToast } from "./toast-store";

export interface DelayedSendController {
  cancel: (announce?: boolean) => void;
  isActive: () => boolean;
}

interface DelayedSendOptions {
  seconds?: number;
  onCommit: () => Promise<void> | void;
  onCanceled?: () => void;
  cancelMessage?: string;
}

export function startDelayedSendWithUndo(options: DelayedSendOptions): DelayedSendController {
  const totalSeconds = Math.max(1, Math.floor(options.seconds ?? 5));
  let remaining = totalSeconds;
  let active = true;

  const toastId = showToast(
    `Sending in ${remaining}...`,
    "info",
    (totalSeconds + 2) * 1000,
    {
      label: "Undo",
      onClick: () => cancel(true),
    },
  );

  const clearTimers = (intervalId: ReturnType<typeof setInterval>, timeoutId: ReturnType<typeof setTimeout>) => {
    clearInterval(intervalId);
    clearTimeout(timeoutId);
  };

  const intervalId = setInterval(() => {
    if (!active) return;
    remaining -= 1;
    if (remaining > 0) {
      updateToast(toastId, { message: `Sending in ${remaining}...` });
    }
  }, 1000);

  const timeoutId = setTimeout(() => {
    if (!active) return;
    active = false;
    clearTimers(intervalId, timeoutId);
    dismissToast(toastId);
    void Promise.resolve(options.onCommit()).catch((error) => {
      console.error("[Delayed Send] Commit failed:", error);
    });
  }, totalSeconds * 1000);

  const cancel = (announce = true) => {
    if (!active) return;
    active = false;
    clearTimers(intervalId, timeoutId);
    dismissToast(toastId);
    if (announce) {
      showToast(options.cancelMessage || "Send canceled", "info");
    }
    options.onCanceled?.();
  };

  return {
    cancel,
    isActive: () => active,
  };
}
