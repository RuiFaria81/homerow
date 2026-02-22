import { Show, For } from "solid-js";
import { A } from "@solidjs/router";
import { settings, setSettings, THEMES, FONTS, type ThemeId, type FontId } from "~/lib/settings-store";
import { IconClose } from "./Icons";

interface QuickSettingsProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function QuickSettings(props: QuickSettingsProps) {
  return (
    <>
      {/* Backdrop */}
      <Show when={props.isOpen}>
        <div
          class="fixed inset-0 bg-black/20 z-40"
          onClick={props.onClose}
        />
      </Show>

      {/* Panel */}
      <div
        data-testid="quick-settings-panel"
        data-shortcut-right-menu="true"
        data-shortcut-right-menu-open={props.isOpen ? "true" : "false"}
        class={`fixed right-0 top-0 bottom-0 w-[320px] bg-[var(--card)] border-l border-[var(--border-light)] shadow-2xl z-50 transform transition-transform duration-300 cubic-bezier(0.4, 0, 0.2, 1) flex flex-col ${
          props.isOpen ? "translate-x-0" : "translate-x-full"
        }`}
      >
        <div class="flex items-center justify-between px-6 py-5 border-b border-[var(--border-light)] shrink-0">
          <h2 class="text-xl font-bold text-[var(--foreground)]">Quick settings</h2>
          <button
            onClick={props.onClose}
            class="w-8 h-8 flex items-center justify-center text-[var(--text-secondary)] hover:bg-[var(--hover-bg)] hover:text-[var(--foreground)] rounded-full transition-colors cursor-pointer border-none bg-transparent"
          >
            <IconClose size={20} />
          </button>
        </div>

        <div class="flex-1 overflow-y-auto p-6 flex flex-col gap-8">
          <button
            onClick={() => {}}
            class="w-full"
          >
            <A
              href="/settings"
              onClick={props.onClose}
              class="flex items-center justify-center w-full py-2.5 px-4 bg-[var(--primary)] text-white font-semibold rounded-full text-sm no-underline hover:brightness-110 transition-all shadow-sm active:scale-[0.98]"
            >
              See all settings
            </A>
          </button>

          {/* Layout */}
          <div class="flex flex-col gap-3">
            <span class="text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider">Layout</span>
            <div class="grid grid-cols-2 gap-3">
              <button
                class={`flex flex-col items-center gap-2 p-3 rounded-xl border-2 transition-all cursor-pointer bg-[var(--search-bg)] ${
                  settings.readingPane === "right"
                    ? "border-[var(--primary)] bg-[var(--active-bg)]"
                    : "border-transparent hover:bg-[var(--hover-bg)]"
                }`}
                onClick={() => setSettings("readingPane", "right")}
              >
                <div class="w-full h-12 rounded bg-[var(--card)] border border-[var(--border-light)] flex overflow-hidden shadow-sm">
                  <div class="w-1/3 border-r border-[var(--border-light)]" />
                  <div class="w-2/3" />
                </div>
                <span class={`text-sm font-medium ${settings.readingPane === "right" ? "text-[var(--primary)]" : "text-[var(--text-secondary)]"}`}>Column</span>
              </button>

              <button
                class={`flex flex-col items-center gap-2 p-3 rounded-xl border-2 transition-all cursor-pointer bg-[var(--search-bg)] ${
                  settings.readingPane === "bottom"
                    ? "border-[var(--primary)] bg-[var(--active-bg)]"
                    : "border-transparent hover:bg-[var(--hover-bg)]"
                }`}
                onClick={() => setSettings("readingPane", "bottom")}
              >
                <div class="w-full h-12 rounded bg-[var(--card)] border border-[var(--border-light)] flex flex-col overflow-hidden shadow-sm">
                  <div class="h-1/2 border-b border-[var(--border-light)]" />
                  <div class="h-1/2" />
                </div>
                <span class={`text-sm font-medium ${settings.readingPane === "bottom" ? "text-[var(--primary)]" : "text-[var(--text-secondary)]"}`}>Row</span>
              </button>
            </div>
          </div>

          {/* Message View */}
          <div class="flex flex-col gap-3">
            <span class="text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider">Message View</span>
            <div class="rounded-xl border border-[var(--border-light)] bg-[var(--search-bg)] p-1.5">
              <div class="flex items-center justify-between gap-3 rounded-lg px-2 py-1.5">
                <span class="text-sm text-[var(--text-secondary)]">Composer</span>
                <div class="relative">
                  <select
                    class="h-8 min-w-[124px] appearance-none rounded-lg border border-[var(--border-light)] bg-[var(--card)] pl-2.5 pr-8 text-sm font-medium text-[var(--foreground)] shadow-sm outline-none transition-colors focus:border-[var(--primary)]"
                    value={settings.composer}
                    onChange={(e) => setSettings("composer", e.currentTarget.value as "small" | "full")}
                  >
                    <option value="small">Small</option>
                    <option value="full">Full</option>
                  </select>
                  <span class="pointer-events-none absolute right-2.5 top-1/2 h-2 w-2 -translate-y-1/2 rotate-45 border-b-2 border-r-2 border-[var(--text-muted)]" />
                </div>
              </div>

              <div class="my-1 border-t border-[var(--border-light)]" />

              <div class="flex items-center justify-between gap-3 rounded-lg px-2 py-1.5">
                <span class="text-sm text-[var(--text-secondary)]">Conversation</span>
                <div class="relative">
                  <select
                    class="h-8 min-w-[124px] appearance-none rounded-lg border border-[var(--border-light)] bg-[var(--card)] pl-2.5 pr-8 text-sm font-medium text-[var(--foreground)] shadow-sm outline-none transition-colors focus:border-[var(--primary)]"
                    value={settings.conversationView ? "on" : "off"}
                    onChange={(e) => setSettings("conversationView", e.currentTarget.value === "on")}
                  >
                    <option value="on">On</option>
                    <option value="off">Off</option>
                  </select>
                  <span class="pointer-events-none absolute right-2.5 top-1/2 h-2 w-2 -translate-y-1/2 rotate-45 border-b-2 border-r-2 border-[var(--text-muted)]" />
                </div>
              </div>
            </div>
          </div>

          {/* Density */}
          <div class="flex flex-col gap-3">
            <span class="text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider">Density</span>
            <div class="flex flex-col gap-1">
              {(["compact", "default", "comfortable"] as const).map((d) => (
                <label class="flex items-center justify-between p-2 rounded-lg cursor-pointer hover:bg-[var(--hover-bg)] transition-colors">
                  <div class="flex items-center gap-3">
                    <span class={`text-sm ${settings.density === d ? "text-[var(--foreground)] font-medium" : "text-[var(--text-secondary)]"}`}>
                      {d.charAt(0).toUpperCase() + d.slice(1)}
                    </span>
                    <span class="text-[11px] text-[var(--text-muted)]">
                      {d === "compact" ? "More emails" : d === "comfortable" ? "More space" : "Balanced"}
                    </span>
                  </div>
                  <div class="relative flex items-center">
                    <input
                      type="radio"
                      name="density"
                      class="peer appearance-none w-5 h-5 rounded-full border border-[var(--text-muted)] checked:border-[var(--primary)] checked:bg-[var(--primary)] transition-all cursor-pointer"
                      checked={settings.density === d}
                      onChange={() => setSettings("density", d)}
                    />
                    <div class="absolute inset-0 flex items-center justify-center pointer-events-none opacity-0 peer-checked:opacity-100 text-white">
                      <div class="w-2 h-2 bg-white rounded-full"></div>
                    </div>
                  </div>
                </label>
              ))}
            </div>
          </div>

          {/* Font */}
          <div class="flex flex-col gap-3">
            <div class="flex items-center justify-between">
              <span class="text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider">Font</span>
              <A
                href="/settings?tab=appearance"
                onClick={props.onClose}
                class="text-xs font-medium text-[var(--primary)] hover:underline no-underline transition-colors"
              >
                All appearance →
              </A>
            </div>
            <div class="grid grid-cols-3 gap-2">
              {(Object.keys(FONTS) as FontId[]).map((id) => {
                const f = FONTS[id];
                const isActive = settings.font === id;
                return (
                  <button
                    class={`flex flex-col items-center gap-1.5 p-2.5 rounded-xl border-2 transition-all cursor-pointer ${
                      isActive
                        ? "border-[var(--primary)] bg-[var(--active-bg)]"
                        : "border-transparent bg-[var(--search-bg)] hover:bg-[var(--hover-bg)]"
                    }`}
                    onClick={() => setSettings("font", id)}
                  >
                    <span
                      class="text-lg font-medium leading-none text-[var(--foreground)]"
                      style={{ "font-family": f.family }}
                    >
                      Aa
                    </span>
                    <span class={`text-[10px] font-semibold leading-none ${isActive ? "text-[var(--primary)]" : "text-[var(--text-muted)]"}`}>
                      {f.name}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Theme */}
          <div class="flex flex-col gap-3">
            <span class="text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider">Theme</span>
            <div class="grid grid-cols-2 gap-2">
              {(Object.keys(THEMES) as ThemeId[]).map((id) => {
                const t = THEMES[id];
                const isActive = settings.theme === id;
                return (
                  <button
                    class={`flex flex-col gap-2 p-2.5 rounded-xl border-2 transition-all cursor-pointer text-left ${
                      isActive
                        ? "border-[var(--primary)] bg-[var(--active-bg)]"
                        : "border-transparent bg-[var(--search-bg)] hover:bg-[var(--hover-bg)]"
                    }`}
                    onClick={() => setSettings("theme", id)}
                  >
                    {/* Mini preview */}
                    <div
                      class="w-full h-10 rounded-lg overflow-hidden flex"
                      style={{ background: t.vars.background }}
                    >
                      {/* Sidebar strip */}
                      <div class="w-5 h-full shrink-0" style={{ background: t.vars.sidebar, "border-right": `1px solid ${t.vars.sidebarBorder}` }} />
                      {/* Content area */}
                      <div class="flex-1 flex flex-col justify-end p-1 gap-0.5">
                        <div class="rounded-full h-1.5 w-3/4" style={{ background: t.vars.foreground, opacity: "0.25" }} />
                        <div class="rounded-full h-1.5 w-1/2" style={{ background: t.vars.foreground, opacity: "0.15" }} />
                      </div>
                      {/* Primary accent dot */}
                      <div class="flex items-center pr-1.5">
                        <div class="w-3 h-3 rounded-full shrink-0" style={{ background: t.vars.primary }} />
                      </div>
                    </div>
                    <span class={`text-xs font-semibold ${isActive ? "text-[var(--primary)]" : "text-[var(--text-secondary)]"}`}>
                      {t.name}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
