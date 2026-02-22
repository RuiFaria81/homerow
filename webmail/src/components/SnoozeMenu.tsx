import { For, Show, createSignal } from "solid-js";
import { IconClock } from "./Icons";
import { getSnoozePresets, toDateTimeLocalValue } from "~/lib/snooze-utils";

interface SnoozeMenuProps {
  position: { x: number; y: number } | null;
  onClose: () => void;
  onSelect: (until: Date) => void;
}

function clampPosition(position: { x: number; y: number }) {
  if (typeof window === "undefined") return position;
  const width = 340;
  const height = 360;
  return {
    x: Math.max(12, Math.min(position.x, window.innerWidth - width - 12)),
    y: Math.max(12, Math.min(position.y, window.innerHeight - height - 12)),
  };
}

export default function SnoozeMenu(props: SnoozeMenuProps) {
  const [showCustomPicker, setShowCustomPicker] = createSignal(false);
  const [customValue, setCustomValue] = createSignal("");
  const [validationError, setValidationError] = createSignal<string | null>(null);

  const defaultCustomValue = () => toDateTimeLocalValue(new Date(Date.now() + 60 * 60 * 1000));

  return (
    <Show when={props.position}>
      {(position) => {
        const p = clampPosition(position());
        const presets = getSnoozePresets();
        return (
          <>
            <div class="fixed inset-0 z-[110]" onClick={props.onClose} />
            <div
              class="fixed z-[120] w-[340px] rounded-xl border border-[var(--border)] bg-[var(--card)] shadow-xl overflow-hidden"
              style={{ left: `${p.x}px`, top: `${p.y}px` }}
            >
              <div class="px-5 pt-4 pb-2 text-lg font-semibold text-[var(--text-secondary)]">
                Snooze until...
              </div>
              <div class="px-3 pb-2">
                <For each={presets}>
                  {(preset) => (
                    <button
                      class="w-full border-none bg-transparent cursor-pointer px-3 py-3 rounded-lg text-left hover:bg-[var(--hover-bg)] flex items-center justify-between gap-3"
                      onClick={() => {
                        setValidationError(null);
                        setShowCustomPicker(false);
                        props.onSelect(preset.until);
                        props.onClose();
                      }}
                    >
                      <span class="text-[16px] text-[var(--foreground)]">{preset.label}</span>
                      <span class="text-[15px] text-[var(--text-muted)]">{preset.display}</span>
                    </button>
                  )}
                </For>
              </div>
              <div class="h-px bg-[var(--border-light)]" />
              <button
                class="w-full border-none bg-transparent cursor-pointer px-5 py-4 text-left hover:bg-[var(--hover-bg)] flex items-center gap-3 text-[16px] text-[var(--foreground)]"
                onClick={() => {
                  setValidationError(null);
                  if (!showCustomPicker()) {
                    setCustomValue(customValue() || defaultCustomValue());
                  }
                  setShowCustomPicker(!showCustomPicker());
                }}
              >
                <IconClock size={18} />
                <span>Select date and time</span>
              </button>
              <Show when={showCustomPicker()}>
                <div class="px-5 pb-4 pt-2 border-t border-[var(--border-light)]">
                  <input
                    type="datetime-local"
                    value={customValue()}
                    class="w-full border border-[var(--border)] rounded-lg px-3 py-2 bg-transparent text-sm text-[var(--foreground)]"
                    onInput={(e) => {
                      setCustomValue(e.currentTarget.value);
                      setValidationError(null);
                    }}
                  />
                  <Show when={validationError()}>
                    <div class="text-xs text-[var(--destructive)] mt-2">{validationError()}</div>
                  </Show>
                  <div class="mt-3 flex items-center justify-end gap-2">
                    <button
                      class="px-3 py-1.5 rounded-md border border-[var(--border)] bg-transparent text-sm cursor-pointer"
                      onClick={() => {
                        setShowCustomPicker(false);
                        setValidationError(null);
                      }}
                    >
                      Cancel
                    </button>
                    <button
                      class="px-3 py-1.5 rounded-md border-none bg-[var(--primary)] text-white text-sm cursor-pointer"
                      onClick={() => {
                        const value = customValue();
                        if (!value) {
                          setValidationError("Pick a date and time.");
                          return;
                        }
                        const until = new Date(value);
                        if (Number.isNaN(until.getTime())) {
                          setValidationError("Invalid date and time.");
                          return;
                        }
                        if (until.getTime() <= Date.now()) {
                          setValidationError("Choose a time in the future.");
                          return;
                        }
                        props.onSelect(until);
                        props.onClose();
                      }}
                    >
                      Confirm
                    </button>
                  </div>
                </div>
              </Show>
            </div>
          </>
        );
      }}
    </Show>
  );
}
