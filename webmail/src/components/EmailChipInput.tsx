import { createSignal, For, Show, createEffect, onMount, onCleanup } from "solid-js";
import { IconClose } from "./Icons";

interface EmailChipInputProps {
  emails: string[];
  onChange: (emails: string[]) => void;
  placeholder?: string;
  label?: string;
  contacts?: unknown[];
  autofocus?: boolean;
  onTabNext?: () => void;
}

export default function EmailChipInput(props: EmailChipInputProps) {
  const [inputValue, setInputValue] = createSignal("");
  const [suggestions, setSuggestions] = createSignal<string[]>([]);
  const [selectedIndex, setSelectedIndex] = createSignal(-1);
  const [showSuggestions, setShowSuggestions] = createSignal(false);
  let inputRef: HTMLInputElement | undefined;
  let containerRef: HTMLDivElement | undefined;
  let didAutofocus = false;

  const isValidEmail = (email: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

  const addEmail = (email: string) => {
    const trimmed = email.trim().toLowerCase();
    if (!trimmed) return;
    if (props.emails.includes(trimmed)) return;
    if (isValidEmail(trimmed)) {
      props.onChange([...props.emails, trimmed]);
      setInputValue("");
      setSuggestions([]);
      setShowSuggestions(false);
    }
  };

  const removeEmail = (index: number) => {
    props.onChange(props.emails.filter((_, i) => i !== index));
  };

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === "Tab" && !e.shiftKey && props.onTabNext) {
      e.preventDefault();
      if (selectedIndex() >= 0 && suggestions().length > 0) {
        addEmail(suggestions()[selectedIndex()]);
      } else if (inputValue().trim()) {
        addEmail(inputValue());
      }
      props.onTabNext();
      return;
    }
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      if (selectedIndex() >= 0 && suggestions().length > 0) {
        addEmail(suggestions()[selectedIndex()]);
      } else if (inputValue().trim()) {
        addEmail(inputValue());
      }
      return;
    }
    if (e.key === "Backspace" && !inputValue() && props.emails.length > 0) {
      removeEmail(props.emails.length - 1);
      return;
    }
    if (e.key === "ArrowDown" && showSuggestions()) {
      e.preventDefault();
      setSelectedIndex(i => Math.min(i + 1, suggestions().length - 1));
      return;
    }
    if (e.key === "ArrowUp" && showSuggestions()) {
      e.preventDefault();
      setSelectedIndex(i => Math.max(i - 1, -1));
      return;
    }
    if (e.key === "Escape") {
      setShowSuggestions(false);
    }
  };

  const handleInput = (value: string) => {
    // Check if user pasted multiple emails separated by commas or spaces
    if (value.includes(",") || value.includes(";")) {
      const parts = value.split(/[,;]+/);
      for (const part of parts) {
        const trimmed = part.trim();
        if (trimmed && isValidEmail(trimmed)) {
          addEmail(trimmed);
        }
      }
      setInputValue("");
      return;
    }

    setInputValue(value);
    setSelectedIndex(-1);

    // Filter contacts for suggestions
    if (value.trim() && props.contacts && props.contacts.length > 0) {
      const term = value.toLowerCase();
      const filtered = props.contacts
        .filter((c): c is string => typeof c === "string")
        .map(c => c.trim().toLowerCase())
        .filter(c => c.length > 0)
        .filter(c => c.includes(term) && !props.emails.includes(c))
        .slice(0, 5);
      setSuggestions(filtered);
      setShowSuggestions(filtered.length > 0);
    } else {
      setSuggestions([]);
      setShowSuggestions(false);
    }
  };

  const handleBlur = () => {
    // Delay to allow click on suggestion
    setTimeout(() => {
      if (inputValue().trim()) {
        addEmail(inputValue());
      }
      setShowSuggestions(false);
    }, 200);
  };

  createEffect(() => {
    if (props.autofocus && inputRef && !didAutofocus) {
      didAutofocus = true;
      inputRef.focus();
    }
  });

  return (
    <div class="flex items-start px-4 py-2 border-b border-[var(--border-light)] text-sm relative" ref={containerRef}>
      <Show when={props.label}>
        <label class="text-[var(--text-muted)] font-medium min-w-[56px] text-[13px] pt-1">{props.label}</label>
      </Show>
      <div class="flex-1 flex flex-wrap items-center gap-1 min-h-[32px]">
        <For each={props.emails}>
          {(email, index) => (
            <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[var(--active-bg)] text-[var(--foreground)] text-xs font-medium max-w-[200px]">
              <span class="truncate">{email}</span>
              <button
                type="button"
                onClick={() => removeEmail(index())}
                class="w-4 h-4 rounded-full flex items-center justify-center hover:bg-[var(--hover-bg)] border-none bg-transparent cursor-pointer text-[var(--text-secondary)] shrink-0"
              >
                <IconClose size={10} />
              </button>
            </span>
          )}
        </For>
        <input
          ref={inputRef}
          type="text"
          value={inputValue()}
          onInput={(e) => handleInput(e.currentTarget.value)}
          onKeyDown={handleKeyDown}
          onBlur={handleBlur}
          onFocus={() => {
            if (inputValue().trim() && suggestions().length > 0) {
              setShowSuggestions(true);
            }
          }}
          placeholder={props.emails.length === 0 ? (props.placeholder || "Add recipients...") : ""}
          class="flex-1 min-w-[120px] border-none outline-none text-sm text-[var(--foreground)] bg-transparent placeholder:text-[var(--text-muted)] h-7"
        />
      </div>

      {/* Autocomplete dropdown */}
      <Show when={showSuggestions() && suggestions().length > 0}>
        <div class="absolute left-14 top-full mt-1 w-64 bg-[var(--card)] border border-[var(--border)] rounded-lg shadow-lg z-50 py-1 max-h-40 overflow-y-auto">
          <For each={suggestions()}>
            {(contact, index) => (
              <button
                type="button"
                class={`w-full text-left px-3 py-2 text-sm border-none cursor-pointer transition-colors ${
                  selectedIndex() === index()
                    ? "bg-[var(--active-bg)] text-[var(--foreground)]"
                    : "bg-transparent text-[var(--text-secondary)] hover:bg-[var(--hover-bg)]"
                }`}
                onMouseDown={(e) => {
                  e.preventDefault();
                  addEmail(contact);
                }}
              >
                {contact}
              </button>
            )}
          </For>
        </div>
      </Show>
    </div>
  );
}
