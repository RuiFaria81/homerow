import { onMount, onCleanup, createSignal, createEffect, Show } from "solid-js";
import { Editor } from "@tiptap/core";
import StarterKit from "@tiptap/starter-kit";
import Link from "@tiptap/extension-link";
import Placeholder from "@tiptap/extension-placeholder";
import Underline from "@tiptap/extension-underline";

interface TipTapEditorProps {
  initialContent?: string;
  placeholder?: string;
  onChange?: (html: string) => void;
  class?: string;
  autofocus?: boolean;
  /** Minimal mode hides the toolbar (for inline reply) */
  minimal?: boolean;
}

export default function TipTapEditor(props: TipTapEditorProps) {
  let editorRef: HTMLDivElement | undefined;
  let editor: Editor | undefined;
  const [isBold, setIsBold] = createSignal(false);
  const [isItalic, setIsItalic] = createSignal(false);
  const [isUnderline, setIsUnderline] = createSignal(false);
  const [isStrike, setIsStrike] = createSignal(false);
  const [isBulletList, setIsBulletList] = createSignal(false);
  const [isOrderedList, setIsOrderedList] = createSignal(false);
  const [isBlockquote, setIsBlockquote] = createSignal(false);
  const [isCode, setIsCode] = createSignal(false);

  const updateActiveMarks = () => {
    if (!editor) return;
    setIsBold(editor.isActive("bold"));
    setIsItalic(editor.isActive("italic"));
    setIsUnderline(editor.isActive("underline"));
    setIsStrike(editor.isActive("strike"));
    setIsBulletList(editor.isActive("bulletList"));
    setIsOrderedList(editor.isActive("orderedList"));
    setIsBlockquote(editor.isActive("blockquote"));
    setIsCode(editor.isActive("codeBlock"));
  };

  onMount(() => {
    if (!editorRef) return;
    editor = new Editor({
      element: editorRef,
      extensions: [
        StarterKit.configure({
          heading: { levels: [1, 2, 3] },
        }),
        Link.configure({
          openOnClick: false,
          HTMLAttributes: { class: "text-[var(--primary)] underline" },
        }),
        Underline,
        Placeholder.configure({
          placeholder: props.placeholder || "Write your message...",
        }),
      ],
      content: props.initialContent || "",
      autofocus: props.autofocus ? "start" : false,
      editorProps: {
        attributes: {
          class: "tiptap-content outline-none min-h-[100px] max-h-[40vh] overflow-y-auto resize-y text-sm leading-relaxed text-[var(--foreground)]",
        },
      },
      onUpdate: ({ editor: e }) => {
        props.onChange?.(e.getHTML());
        updateActiveMarks();
      },
      onSelectionUpdate: () => {
        updateActiveMarks();
      },
    });
  });

  onCleanup(() => {
    editor?.destroy();
  });

  // Allow external content updates (e.g. switching between reply/forward)
  createEffect(() => {
    const content = props.initialContent;
    if (editor && content !== undefined) {
      const currentContent = editor.getHTML();
      if (content !== currentContent) {
        editor.commands.setContent(content);
      }
    }
  });

  const toggleLink = () => {
    if (!editor) return;
    if (editor.isActive("link")) {
      editor.chain().focus().unsetLink().run();
      return;
    }
    const url = prompt("Enter URL:");
    if (url) {
      editor.chain().focus().setLink({ href: url }).run();
    }
  };

  const btnClass = (active: boolean) =>
    `w-7 h-7 rounded flex items-center justify-center border-none cursor-pointer transition-colors text-xs font-semibold ${
      active
        ? "bg-[var(--active-bg)] text-[var(--primary)]"
        : "bg-transparent text-[var(--text-secondary)] hover:bg-[var(--hover-bg)] hover:text-[var(--foreground)]"
    }`;

  return (
    <div class={props.class}>
      <Show when={!props.minimal}>
        <div class="flex items-center gap-0.5 px-3 py-1.5 border-b border-[var(--border-light)] flex-wrap">
          <button
            type="button"
            class={btnClass(isBold())}
            onClick={() => { editor?.chain().focus().toggleBold().run(); }}
            title="Bold (Ctrl+B)"
          >
            B
          </button>
          <button
            type="button"
            class={btnClass(isItalic())}
            onClick={() => { editor?.chain().focus().toggleItalic().run(); }}
            title="Italic (Ctrl+I)"
            style={{ "font-style": "italic" }}
          >
            I
          </button>
          <button
            type="button"
            class={btnClass(isUnderline())}
            onClick={() => { editor?.chain().focus().toggleUnderline().run(); }}
            title="Underline (Ctrl+U)"
            style={{ "text-decoration": "underline" }}
          >
            U
          </button>
          <button
            type="button"
            class={btnClass(isStrike())}
            onClick={() => { editor?.chain().focus().toggleStrike().run(); }}
            title="Strikethrough"
            style={{ "text-decoration": "line-through" }}
          >
            S
          </button>

          <div class="w-px h-5 bg-[var(--border-light)] mx-1" />

          <button
            type="button"
            class={btnClass(isBulletList())}
            onClick={() => { editor?.chain().focus().toggleBulletList().run(); }}
            title="Bullet list"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><circle cx="3.5" cy="6" r="1.5" fill="currentColor" stroke="none"/><circle cx="3.5" cy="12" r="1.5" fill="currentColor" stroke="none"/><circle cx="3.5" cy="18" r="1.5" fill="currentColor" stroke="none"/></svg>
          </button>
          <button
            type="button"
            class={btnClass(isOrderedList())}
            onClick={() => { editor?.chain().focus().toggleOrderedList().run(); }}
            title="Ordered list"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="10" y1="6" x2="21" y2="6"/><line x1="10" y1="12" x2="21" y2="12"/><line x1="10" y1="18" x2="21" y2="18"/><text x="1" y="8" font-size="8" fill="currentColor" stroke="none" font-family="sans-serif">1</text><text x="1" y="14" font-size="8" fill="currentColor" stroke="none" font-family="sans-serif">2</text><text x="1" y="20" font-size="8" fill="currentColor" stroke="none" font-family="sans-serif">3</text></svg>
          </button>

          <div class="w-px h-5 bg-[var(--border-light)] mx-1" />

          <button
            type="button"
            class={btnClass(isBlockquote())}
            onClick={() => { editor?.chain().focus().toggleBlockquote().run(); }}
            title="Blockquote"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="3" y1="4" x2="3" y2="20"/><line x1="8" y1="8" x2="20" y2="8"/><line x1="8" y1="12" x2="18" y2="12"/><line x1="8" y1="16" x2="16" y2="16"/></svg>
          </button>
          <button
            type="button"
            class={btnClass(isCode())}
            onClick={() => { editor?.chain().focus().toggleCodeBlock().run(); }}
            title="Code block"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/></svg>
          </button>

          <div class="w-px h-5 bg-[var(--border-light)] mx-1" />

          <button
            type="button"
            class={btnClass(editor?.isActive("link") ?? false)}
            onClick={toggleLink}
            title="Insert link"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>
          </button>

          <button
            type="button"
            class={btnClass(false)}
            onClick={() => { editor?.chain().focus().setHorizontalRule().run(); }}
            title="Horizontal rule"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="2" y1="12" x2="22" y2="12"/></svg>
          </button>
        </div>
      </Show>

      {/* Editor content area */}
      <div ref={editorRef} class="p-4" />
    </div>
  );
}

/** Expose a helper to get the editor's HTML outside the component */
export function getEditorHtml(editorRef: HTMLDivElement | undefined): string {
  // The TipTap editor injects a .ProseMirror element
  const pm = editorRef?.querySelector(".ProseMirror");
  return pm?.innerHTML || "";
}
