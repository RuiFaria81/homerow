import { createSignal, Show, For, onMount, onCleanup } from "solid-js";
import { isServer } from "solid-js/web";

export interface ContextMenuItem {
  label: string;
  icon?: any;
  color?: string;
  checked?: boolean;
  action?: () => void;
  children?: ContextMenuItem[];
  disabled?: boolean;
  danger?: boolean;
  divider?: boolean;
}

interface ContextMenuProps {
  items: ContextMenuItem[];
  x: number;
  y: number;
  onClose: () => void;
}

export default function ContextMenu(props: ContextMenuProps) {
  let menuRef: HTMLDivElement | undefined;
  const [openSubmenuKey, setOpenSubmenuKey] = createSignal<string | null>(null);
  const [submenuPositions, setSubmenuPositions] = createSignal<Record<string, { x: number; y: number }>>({});

  const adjustedPosition = () => {
    const menuWidth = 200;
    const menuHeight = props.items.length * 36;
    let x = props.x;
    let y = props.y;

    if (typeof window !== "undefined") {
      if (x + menuWidth > window.innerWidth) {
        x = window.innerWidth - menuWidth - 8;
      }
      if (y + menuHeight > window.innerHeight) {
        y = window.innerHeight - menuHeight - 8;
      }
    }

    return { x: Math.max(8, x), y: Math.max(8, y) };
  };

  const handleClickOutside = (e: MouseEvent) => {
    const target = e.target as HTMLElement | null;
    if (!target) return;
    if (target.closest('[data-context-menu-root="true"]')) return;
    if (target.closest('[data-context-submenu="true"]')) return;
    if (menuRef && !menuRef.contains(target)) {
      props.onClose();
    }
  };

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === "Escape") {
      props.onClose();
    }
  };

  onMount(() => {
    if (typeof document === "undefined") return;
    document.addEventListener("click", handleClickOutside);
    document.addEventListener("keydown", handleKeyDown);
    // Prevent default context menu on our menu
    document.addEventListener("contextmenu", handleClickOutside);
  });

  onCleanup(() => {
    if (isServer) return;
    document.removeEventListener("click", handleClickOutside);
    document.removeEventListener("keydown", handleKeyDown);
    document.removeEventListener("contextmenu", handleClickOutside);
  });

  const pos = adjustedPosition();
  const openSubmenuAtElement = (itemKey: string, element: HTMLElement) => {
    if (typeof window === "undefined") return;
    const rect = element.getBoundingClientRect();
    const submenuWidth = 220;
    const submenuHeight = 320;
    const canOpenRight = rect.right + submenuWidth + 8 <= window.innerWidth;
    const x = canOpenRight ? rect.right : Math.max(8, rect.left - submenuWidth);
    const y = Math.max(8, Math.min(rect.top, window.innerHeight - submenuHeight - 8));
    setSubmenuPositions((prev) => ({ ...prev, [itemKey]: { x, y } }));
    setOpenSubmenuKey(itemKey);
  };

  const renderItems = (items: ContextMenuItem[], level = 0, prefix = "root") => (
    <For each={items}>
      {(item, index) => {
        const itemKey = `${prefix}-${index()}`;
        const hasChildren = () => Boolean(item.children && item.children.length > 0);
        const isSubmenuOpen = () => openSubmenuKey() === itemKey;
        let itemRef: HTMLButtonElement | undefined;
        return (
          <>
            <Show when={item.divider}>
              <div class="h-px bg-[var(--border-light)] my-1" />
            </Show>
            <div class="relative">
              <button
                ref={itemRef}
                class={`w-full flex items-center gap-2.5 px-3 py-2 text-sm border-none bg-transparent transition-colors text-left ${
                  item.disabled
                    ? "cursor-not-allowed text-[var(--text-muted)] opacity-70"
                    : item.danger
                      ? "cursor-pointer text-[var(--destructive)] hover:bg-red-50 dark:hover:bg-red-500/10"
                      : "cursor-pointer text-[var(--foreground)] hover:bg-[var(--hover-bg)]"
                }`}
                onMouseEnter={() => {
                  if (!hasChildren() || !itemRef) return;
                  openSubmenuAtElement(itemKey, itemRef);
                }}
                onClick={() => {
                  if (item.disabled) return;
                  if (hasChildren()) {
                    if (!itemRef) return;
                    if (isSubmenuOpen()) {
                      setOpenSubmenuKey(null);
                    } else {
                      openSubmenuAtElement(itemKey, itemRef);
                    }
                    return;
                  }
                  item.action?.();
                  props.onClose();
                }}
              >
                <Show when={item.icon}>
                  {item.icon && <item.icon size={16} />}
                </Show>
                <Show when={item.color}>
                  <span
                    class="w-2.5 h-2.5 rounded-full shrink-0"
                    style={{ background: item.color }}
                  />
                </Show>
                <span class="flex-1">{item.label}</span>
                <Show when={item.checked}>
                  <span class="text-[var(--primary)] text-xs font-bold">✓</span>
                </Show>
                <Show when={hasChildren()}>
                  <span class="text-xs text-[var(--text-muted)]">{">"}</span>
                </Show>
              </button>
              <Show when={hasChildren() && isSubmenuOpen()}>
                <div
                  data-context-submenu="true"
                  class="fixed z-[110] bg-[var(--card)] border border-[var(--border)] rounded-lg shadow-xl py-1 min-w-[220px] max-h-[70vh] overflow-y-auto animate-in fade-in zoom-in-95 duration-100"
                  style={{
                    left: `${submenuPositions()[itemKey]?.x ?? pos.x}px`,
                    top: `${submenuPositions()[itemKey]?.y ?? pos.y}px`,
                  }}
                >
                  {renderItems(item.children || [], level + 1, itemKey)}
                </div>
              </Show>
            </div>
          </>
        );
      }}
    </For>
  );

  return (
    <div
      ref={menuRef}
      data-context-menu-root="true"
      class="fixed z-[100] bg-[var(--card)] border border-[var(--border)] rounded-lg shadow-xl py-1 min-w-[180px] animate-in fade-in zoom-in-95 duration-100"
      style={{ left: `${pos.x}px`, top: `${pos.y}px` }}
    >
      {renderItems(props.items)}
    </div>
  );
}
