import { For, Show } from "solid-js";
import { IconClose } from "./Icons";
import { SHORTCUT_ACTIONS, getEffectiveActionShortcuts, splitShortcutSteps, formatShortcut } from "~/lib/keyboard-shortcuts-store";
import { settings, setSettings } from "~/lib/settings-store";

interface Props {
  open: boolean;
  onClose: () => void;
}

const SECTION_ORDER = ["Navigation", "Actions", "Compose", "Go to", "Search & Help"] as const;

export default function KeyboardShortcutsHelp(props: Props) {
  const grouped = () =>
    SECTION_ORDER.map((section) => ({
      section,
      actions: SHORTCUT_ACTIONS.filter((action) => action.section === section && getEffectiveActionShortcuts(action.id).length > 0),
    })).filter((item) => item.actions.length > 0);

  return (
    <Show when={props.open}>
      <div
        class="fixed inset-0 z-50 bg-black/40 backdrop-blur-[2px] flex items-center justify-center"
        onClick={props.onClose}
      >
        <div
          data-testid="keyboard-shortcuts-help"
          class="bg-[var(--card)] rounded-2xl shadow-2xl border border-[var(--border-light)] w-full max-w-3xl max-h-[82vh] overflow-y-auto m-4"
          onClick={(e) => e.stopPropagation()}
        >
          <div class="flex items-center justify-between px-6 py-4 border-b border-[var(--border-light)] bg-gradient-to-r from-[var(--search-bg)] to-transparent">
            <div>
              <h2 class="text-base font-semibold text-[var(--foreground)]">Keyboard shortcuts</h2>
              <p class="text-xs text-[var(--text-muted)] mt-0.5">Press <span class="font-mono">Shift+/</span> to open this panel.</p>
            </div>
            <button
              onClick={props.onClose}
              class="w-8 h-8 rounded-full border-none bg-transparent cursor-pointer flex items-center justify-center text-[var(--text-secondary)] hover:bg-[var(--hover-bg)] hover:text-[var(--foreground)]"
            >
              <IconClose size={16} />
            </button>
          </div>

          <div class="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-6 px-6 py-5">
            <For each={grouped()}>
              {(group) => (
                <div class="rounded-xl border border-[var(--border-light)] p-3 bg-[var(--search-bg)]/40">
                  <h3 class="text-[11px] font-bold uppercase tracking-widest text-[var(--text-muted)] mb-3">
                    {group.section}
                  </h3>
                  <div class="flex flex-col gap-2">
                    <For each={group.actions}>
                      {(action) => (
                        <div class="flex items-center justify-between gap-3 py-1">
                          <span class="text-sm text-[var(--foreground)]">{action.label}</span>
                          <div class="flex items-center gap-2 shrink-0">
                            <For each={getEffectiveActionShortcuts(action.id)}>
                              {(shortcut, idx) => (
                                <div class="flex items-center gap-1">
                                  <Show when={idx() > 0}>
                                    <span class="text-[10px] text-[var(--text-muted)]">or</span>
                                  </Show>
                                  <div class="flex items-center gap-1" title={formatShortcut(shortcut)}>
                                    <For each={splitShortcutSteps(shortcut)}>
                                      {(step, stepIdx) => (
                                        <>
                                          <Show when={stepIdx() > 0}>
                                            <span class="text-[10px] text-[var(--text-muted)]">then</span>
                                          </Show>
                                          <kbd class="inline-flex items-center justify-center px-2 py-0.5 rounded-md text-[11px] font-mono font-semibold bg-[var(--card)] text-[var(--foreground)] border border-[var(--border)] min-w-[1.5rem]">
                                            {formatShortcut(step)}
                                          </kbd>
                                        </>
                                      )}
                                    </For>
                                  </div>
                                </div>
                              )}
                            </For>
                          </div>
                        </div>
                      )}
                    </For>
                  </div>
                </div>
              )}
            </For>
          </div>

          <div class="px-6 py-3 border-t border-[var(--border-light)] flex items-center justify-between gap-3">
            <div class="text-[11px] text-[var(--text-muted)]">
              Shortcuts are inactive when typing in input fields. Configure them in Settings &gt; Keyboard Shortcuts.
            </div>
            <div class="flex items-center gap-2 shrink-0">
              <span class="text-[11px] text-[var(--text-muted)]">Track keys/actions</span>
              <button
                type="button"
                data-testid="help-shortcut-feedback-on"
                onClick={() => setSettings("shortcutFeedback", true)}
                class={`px-2.5 py-1 rounded-md text-[11px] font-semibold border cursor-pointer ${
                  settings.shortcutFeedback
                    ? "bg-[var(--active-bg)] text-[var(--primary)] border-[var(--primary)]"
                    : "bg-transparent text-[var(--text-secondary)] border-[var(--border)] hover:bg-[var(--hover-bg)]"
                }`}
              >
                On
              </button>
              <button
                type="button"
                data-testid="help-shortcut-feedback-off"
                onClick={() => setSettings("shortcutFeedback", false)}
                class={`px-2.5 py-1 rounded-md text-[11px] font-semibold border cursor-pointer ${
                  !settings.shortcutFeedback
                    ? "bg-[var(--active-bg)] text-[var(--primary)] border-[var(--primary)]"
                    : "bg-transparent text-[var(--text-secondary)] border-[var(--border)] hover:bg-[var(--hover-bg)]"
                }`}
              >
                Off
              </button>
            </div>
          </div>
        </div>
      </div>
    </Show>
  );
}
