import { onMount, onCleanup, createSignal, Show, For } from "solid-js";
import { createEditor, $getRoot, $insertNodes, $createParagraphNode, $getSelection, $isRangeSelection, FORMAT_TEXT_COMMAND, LexicalEditor as LexicalEditorType } from "lexical";
import { registerRichText } from "@lexical/rich-text";
import { $generateHtmlFromNodes, $generateNodesFromDOM } from "@lexical/html";
import { ListNode, ListItemNode, INSERT_ORDERED_LIST_COMMAND, INSERT_UNORDERED_LIST_COMMAND, REMOVE_LIST_COMMAND, $isListNode } from "@lexical/list";
import { registerList } from "@lexical/list";
import { LinkNode, $createLinkNode, $isLinkNode, TOGGLE_LINK_COMMAND } from "@lexical/link";
import { registerLink } from "@lexical/link";
import { $setBlocksType } from "@lexical/selection";
import { QuoteNode, HeadingNode, $createQuoteNode, $isQuoteNode, $createHeadingNode } from "@lexical/rich-text";
import { CodeNode, $createCodeNode, $isCodeNode } from "@lexical/code";
import { $getNearestNodeOfType } from "@lexical/utils";
import { A, useNavigate } from "@solidjs/router";
import { EmailQuoteNode, $createEmailQuoteNode, type QuoteType } from "./EmailQuoteNode";
import { SignatureNode, $createSignatureNode, $isSignatureNode } from "./SignatureNode";
import { InlineImageNode, $createInlineImageNode } from "./InlineImageNode";
import { getSignatureById, signatureState } from "~/lib/signature-store";
import { composeState, toggleMinimize } from "~/lib/compose-store";
import { IconChevronDown, IconSignature } from "./Icons";

export interface QuotedEmail {
  rawHtml: string;
  headerHtml: string;
  quoteType: QuoteType;
}

interface LexicalEditorProps {
  initialContent?: string;
  placeholder?: string;
  onChange?: (html: string) => void;
  class?: string;
  autofocus?: boolean;
  minimal?: boolean;
  fullHeight?: boolean;
  /** Pass the original email HTML to render as a quoted block via iframe */
  quotedEmail?: QuotedEmail;
  signatureEnabled?: boolean;
  initialSignatureId?: string | null;
  onSignatureChange?: (signatureId: string | null) => void;
  onManageSignatures?: () => void;
  onDropAttachments?: (files: File[]) => void;
  onDropHandled?: () => void;
  toolbarPosition?: "top" | "bottom";
}

export default function LexicalEditor(props: LexicalEditorProps) {
  const navigate = useNavigate();
  let editorRef: HTMLDivElement | undefined;
  let imageInputRef: HTMLInputElement | undefined;
  let editorInstance: LexicalEditorType | undefined;
  const [isBold, setIsBold] = createSignal(false);
  const [isItalic, setIsItalic] = createSignal(false);
  const [isUnderline, setIsUnderline] = createSignal(false);
  const [isStrike, setIsStrike] = createSignal(false);
  const [isBulletList, setIsBulletList] = createSignal(false);
  const [isOrderedList, setIsOrderedList] = createSignal(false);
  const [isBlockquote, setIsBlockquote] = createSignal(false);
  const [isCode, setIsCode] = createSignal(false);
  const [isLink, setIsLink] = createSignal(false);
  const [isSignatureMenuOpen, setIsSignatureMenuOpen] = createSignal(false);
  const [activeSignatureId, setActiveSignatureId] = createSignal<string | null>(null);
  let signatureMenuRef: HTMLDivElement | undefined;

  const createStaticSignal = <T,>(value: T) => ({
    peek: () => value,
    get value() {
      return value;
    },
  });

  const validateLinkUrl = (url: string) => {
    const candidate = url.includes("://") ? url : `https://${url}`;
    try {
      new URL(candidate);
      return true;
    } catch {
      return false;
    }
  };

  const closeSignatureMenu = () => setIsSignatureMenuOpen(false);

  const readFileAsDataUrl = (file: File) =>
    new Promise<{ dataUrl: string; width: number | null; height: number | null }>((resolve) => {
      const reader = new FileReader();
      reader.onload = () => {
        const dataUrl = typeof reader.result === "string" ? reader.result : "";
        if (!dataUrl) {
          resolve({ dataUrl: "", width: null, height: null });
          return;
        }
        const img = new Image();
        img.onload = () => resolve({ dataUrl, width: img.naturalWidth || null, height: img.naturalHeight || null });
        img.onerror = () => resolve({ dataUrl, width: null, height: null });
        img.src = dataUrl;
      };
      reader.onerror = () => resolve({ dataUrl: "", width: null, height: null });
      reader.readAsDataURL(file);
    });

  const insertInlineImage = async (file: File) => {
    if (!editorInstance) return;
    if (!file.type.startsWith("image/")) return;
    const { dataUrl, width, height } = await readFileAsDataUrl(file);
    if (!dataUrl) return;
    editorInstance.update(() => {
      const selection = $getSelection();
      if (!$isRangeSelection(selection)) {
        $getRoot().selectEnd();
      }
      $insertNodes([$createInlineImageNode(dataUrl, file.name, width, height), $createParagraphNode()]);
    });
  };

  const insertInlineImages = async (files: File[]) => {
    for (const file of files) {
      await insertInlineImage(file);
    }
  };

  const handleImageInputChange = (e: Event) => {
    const input = e.currentTarget as HTMLInputElement;
    if (!input.files || input.files.length === 0) return;
    const files = Array.from(input.files).filter((file) => file.type.startsWith("image/"));
    void insertInlineImages(files);
    input.value = "";
  };

  const promptImagePicker = () => imageInputRef?.click();

  const findSignatureNode = () => {
    const root = $getRoot();
    const stack = [...root.getChildren()];
    while (stack.length > 0) {
      const node = stack.shift()!;
      if ($isSignatureNode(node)) return node;
      if ("getChildren" in node && typeof node.getChildren === "function") {
        stack.push(...(node.getChildren() as any[]));
      }
    }
    return null;
  };

  const removeAllSignatureNodes = () => {
    const root = $getRoot();
    const stack = [...root.getChildren()];
    while (stack.length > 0) {
      const node = stack.shift()!;
      if ($isSignatureNode(node)) {
        node.remove();
        continue;
      }
      if ("getChildren" in node && typeof node.getChildren === "function") {
        stack.push(...(node.getChildren() as any[]));
      }
    }
  };

  const insertSignatureNodeAtEnd = (node: SignatureNode) => {
    const root = $getRoot();
    const children = root.getChildren();
    const quoteIdx = children.findIndex((child) => child.getType() === "email-quote");
    if (quoteIdx >= 0) {
      children[quoteIdx].insertBefore(node);
      return;
    }
    root.append(node);
  };

  const ensureLeadingParagraph = () => {
    const root = $getRoot();
    const first = root.getFirstChild();
    if (!first) {
      root.append($createParagraphNode());
      return;
    }
    if (first.getType() !== "paragraph") {
      first.insertBefore($createParagraphNode());
    }
  };

  const applySignatureSelection = (signatureId: string | null) => {
    if (!editorInstance) return;
    editorInstance.update(() => {
      removeAllSignatureNodes();
      if (!signatureId) {
        setActiveSignatureId(null);
        props.onSignatureChange?.(null);
        return;
      }

      const signature = getSignatureById(signatureId);
      if (!signature) return;

      insertSignatureNodeAtEnd($createSignatureNode(signature.id, signature.name, signature.html));

      setActiveSignatureId(signature.id);
      props.onSignatureChange?.(signature.id);
    });
    closeSignatureMenu();
  };

  const handleDocumentMouseDown = (event: MouseEvent) => {
    if (!isSignatureMenuOpen()) return;
    if (!signatureMenuRef?.contains(event.target as Node)) {
      closeSignatureMenu();
    }
  };

  const handleManageSignatures = (event: MouseEvent) => {
    event.preventDefault();
    closeSignatureMenu();
    if (props.onManageSignatures) {
      props.onManageSignatures();
      return;
    }
    if (composeState().isOpen) {
      toggleMinimize(true);
    }
    navigate("/settings?tab=signature");
  };

  const updateToolbar = () => {
    if (!editorInstance) return;
    editorInstance.getEditorState().read(() => {
      const signatureNode = findSignatureNode();
      setActiveSignatureId(signatureNode?.getSignatureId() ?? null);
      const selection = $getSelection();
      if (!$isRangeSelection(selection)) return;
      setIsBold(selection.hasFormat("bold"));
      setIsItalic(selection.hasFormat("italic"));
      setIsUnderline(selection.hasFormat("underline"));
      setIsStrike(selection.hasFormat("strikethrough"));

      const anchorNode = selection.anchor.getNode();
      const element = anchorNode.getKey() === "root" ? anchorNode : anchorNode.getTopLevelElementOrThrow();

      // Check list types
      const parentList = $getNearestNodeOfType(anchorNode, ListNode);
      setIsBulletList(parentList !== null && parentList.getListType() === "bullet");
      setIsOrderedList(parentList !== null && parentList.getListType() === "number");

      // Check blockquote
      setIsBlockquote($getNearestNodeOfType(anchorNode, QuoteNode) !== null);

      // Check code
      setIsCode($getNearestNodeOfType(anchorNode, CodeNode) !== null);

      // Check link
      const parent = anchorNode.getParent();
      setIsLink($isLinkNode(parent));
    });
  };

  onMount(() => {
    if (!editorRef) return;
    document.addEventListener("mousedown", handleDocumentMouseDown);

    const editor = createEditor({
      namespace: "EmailEditor",
      theme: {
        paragraph: "mb-1",
        text: {
          bold: "font-bold",
          italic: "italic",
          underline: "underline",
          strikethrough: "line-through",
          code: "bg-[var(--search-bg)] px-1 py-0.5 rounded text-sm font-mono",
        },
        list: {
          ul: "list-disc ml-4",
          ol: "list-decimal ml-4",
          listitem: "mb-0.5",
          nested: { listitem: "list-none" },
        },
        link: "text-[var(--primary)] underline cursor-pointer",
        quote: "border-l-4 border-[var(--border)] pl-4 italic text-[var(--text-secondary)]",
        code: "bg-[var(--search-bg)] p-3 rounded font-mono text-sm block",
        heading: {
          h1: "text-2xl font-bold",
          h2: "text-xl font-bold",
          h3: "text-lg font-bold",
        },
      },
      nodes: [ListNode, ListItemNode, LinkNode, QuoteNode, HeadingNode, CodeNode, EmailQuoteNode, SignatureNode, InlineImageNode],
      onError: (error) => console.error("[Lexical Error]:", error),
    });

    editorInstance = editor;
    editor.setRootElement(editorRef);

    // Register plugins
    const unregisterRichText = registerRichText(editor);
    const unregisterList = registerList(editor);
    const unregisterLink = registerLink(
      editor,
      {
        attributes: createStaticSignal(undefined),
        validateUrl: createStaticSignal(validateLinkUrl),
      } as any,
    );

    let isInitializing = true;

    // Update toolbar on selection changes
    const unregisterUpdate = editor.registerUpdateListener(({ editorState }) => {
      updateToolbar();
      // Skip emitting during initial content setup to avoid feedback loops
      if (isInitializing) return;
      // Emit HTML on change
      editorState.read(() => {
        const html = $generateHtmlFromNodes(editor);
        props.onChange?.(html);
      });
    });

    const pasteHandler = async (event: ClipboardEvent) => {
      const files = Array.from(event.clipboardData?.files ?? []).filter((file) => file.type.startsWith("image/"));
      if (files.length === 0) return;
      event.preventDefault();
      await insertInlineImages(files);
    };
    const dropHandler = async (event: DragEvent) => {
      const droppedFiles = Array.from(event.dataTransfer?.files ?? []);
      if (droppedFiles.length === 0) return;
      const imageFiles = droppedFiles.filter((file) => file.type.startsWith("image/"));
      const attachmentFiles = droppedFiles.filter((file) => !file.type.startsWith("image/"));
      if (imageFiles.length === 0 && attachmentFiles.length === 0) return;
      event.preventDefault();
      event.stopPropagation();
      if (imageFiles.length > 0) {
        await insertInlineImages(imageFiles);
      }
      if (attachmentFiles.length > 0) {
        props.onDropAttachments?.(attachmentFiles);
      }
      props.onDropHandled?.();
    };
    editorRef.addEventListener("paste", pasteHandler);
    editorRef.addEventListener("drop", dropHandler);

    // Set initial content
    if (props.initialContent || props.quotedEmail || (props.signatureEnabled && props.initialSignatureId)) {
      editor.update(() => {
        const root = $getRoot();
        root.clear();

        // Insert editable content (signature, etc.) first
        if (props.initialContent) {
          const parser = new DOMParser();
          const dom = parser.parseFromString(props.initialContent, "text/html");
          const nodes = $generateNodesFromDOM(editor, dom);
          root.selectEnd();
          $insertNodes(nodes);
        }

        // Append the quoted email as a non-editable decorated block
        if (props.quotedEmail) {
          const quoteNode = $createEmailQuoteNode(
            props.quotedEmail.rawHtml,
            props.quotedEmail.headerHtml,
            props.quotedEmail.quoteType
          );
          root.append(quoteNode);
          // Add an empty paragraph after so user can type below the quote
          root.append($createParagraphNode());
        }

        if (props.signatureEnabled && props.initialSignatureId && !findSignatureNode()) {
          const initialSignature = getSignatureById(props.initialSignatureId);
          if (initialSignature) {
            insertSignatureNodeAtEnd(
              $createSignatureNode(initialSignature.id, initialSignature.name, initialSignature.html)
            );
            setActiveSignatureId(initialSignature.id);
            props.onSignatureChange?.(initialSignature.id);
          }
        }

        ensureLeadingParagraph();

        // Place cursor at the very beginning
        root.selectStart();
      });
    }

    // Allow onChange emissions after initial content is set
    // Use queueMicrotask to ensure Lexical finishes processing the initial update
    queueMicrotask(() => { isInitializing = false; });

    if (props.autofocus) {
      setTimeout(() => editor.focus(), 50);
    }

    onCleanup(() => {
      document.removeEventListener("mousedown", handleDocumentMouseDown);
      editorRef?.removeEventListener("paste", pasteHandler);
      editorRef?.removeEventListener("drop", dropHandler);
      unregisterRichText();
      unregisterList();
      unregisterLink();
      unregisterUpdate();
      editor.setRootElement(null);
    });
  });

  // Note: No createEffect for content updates here.
  // The InlineComposer increments editorKey to re-mount a fresh editor
  // when switching between reply/forward modes, so onMount handles it.

  const toggleBold = () => editorInstance?.dispatchCommand(FORMAT_TEXT_COMMAND, "bold");
  const toggleItalic = () => editorInstance?.dispatchCommand(FORMAT_TEXT_COMMAND, "italic");
  const toggleUnderlineFn = () => editorInstance?.dispatchCommand(FORMAT_TEXT_COMMAND, "underline");
  const toggleStrike = () => editorInstance?.dispatchCommand(FORMAT_TEXT_COMMAND, "strikethrough");

  const toggleBulletList = () => {
    if (!editorInstance) return;
    if (isBulletList()) {
      editorInstance.dispatchCommand(REMOVE_LIST_COMMAND, undefined);
    } else {
      editorInstance.dispatchCommand(INSERT_UNORDERED_LIST_COMMAND, undefined);
    }
  };

  const toggleOrderedList = () => {
    if (!editorInstance) return;
    if (isOrderedList()) {
      editorInstance.dispatchCommand(REMOVE_LIST_COMMAND, undefined);
    } else {
      editorInstance.dispatchCommand(INSERT_ORDERED_LIST_COMMAND, undefined);
    }
  };

  const toggleBlockquote = () => {
    if (!editorInstance) return;
    editorInstance.update(() => {
      const selection = $getSelection();
      if (!$isRangeSelection(selection)) return;
      if (isBlockquote()) {
        $setBlocksType(selection, () => $createParagraphNode());
      } else {
        $setBlocksType(selection, () => $createQuoteNode());
      }
    });
  };

  const toggleCodeBlock = () => {
    if (!editorInstance) return;
    editorInstance.update(() => {
      const selection = $getSelection();
      if (!$isRangeSelection(selection)) return;
      if (isCode()) {
        $setBlocksType(selection, () => $createParagraphNode());
      } else {
        $setBlocksType(selection, () => $createCodeNode());
      }
    });
  };

  const toggleLinkFn = () => {
    if (!editorInstance) return;
    if (isLink()) {
      editorInstance.dispatchCommand(TOGGLE_LINK_COMMAND, null);
      return;
    }
    const url = prompt("Enter URL:");
    if (url) {
      editorInstance.dispatchCommand(TOGGLE_LINK_COMMAND, { url });
    }
  };

  const insertHorizontalRule = () => {
    if (!editorInstance) return;
    editorInstance.update(() => {
      const selection = $getSelection();
      if (!$isRangeSelection(selection)) return;
      const anchorNode = selection.anchor.getNode();
      const topLevel = anchorNode.getKey() === "root" ? anchorNode : anchorNode.getTopLevelElementOrThrow();
      const newParagraph = $createParagraphNode();
      topLevel.insertAfter(newParagraph);
      newParagraph.selectStart();
    });
  };

  const btnClass = (active: boolean) =>
    `w-7 h-7 rounded flex items-center justify-center border-none cursor-pointer transition-colors text-xs font-semibold ${
      active
        ? "bg-[var(--active-bg)] text-[var(--primary)]"
        : "bg-transparent text-[var(--text-secondary)] hover:bg-[var(--hover-bg)] hover:text-[var(--foreground)]"
    }`;

  const editorClass = () =>
    props.fullHeight
      ? "lexical-editor outline-none h-full max-h-none overflow-y-auto resize-none text-sm leading-relaxed text-[var(--foreground)] p-4"
      : "lexical-editor outline-none min-h-[100px] max-h-[40vh] overflow-y-auto resize-y text-sm leading-relaxed text-[var(--foreground)] p-4";
  const toolbarBorderClass = () => ((props.toolbarPosition ?? "top") === "bottom" ? "border-t" : "border-b");

  const toolbar = (
    <Show when={!props.minimal}>
      <div class={`lexical-toolbar flex items-center gap-0.5 px-3 py-1.5 ${toolbarBorderClass()} border-[var(--border-light)] flex-wrap`}>
        <button type="button" class={btnClass(isBold())} onClick={toggleBold} title="Bold (Ctrl+B)">B</button>
        <button type="button" class={btnClass(isItalic())} onClick={toggleItalic} title="Italic (Ctrl+I)" style={{ "font-style": "italic" }}>I</button>
        <button type="button" class={btnClass(isUnderline())} onClick={toggleUnderlineFn} title="Underline (Ctrl+U)" style={{ "text-decoration": "underline" }}>U</button>
        <button type="button" class={btnClass(isStrike())} onClick={toggleStrike} title="Strikethrough" style={{ "text-decoration": "line-through" }}>S</button>

        <div class="w-px h-5 bg-[var(--border-light)] mx-1" />

        <button type="button" class={btnClass(isBulletList())} onClick={toggleBulletList} title="Bullet list">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><circle cx="3.5" cy="6" r="1.5" fill="currentColor" stroke="none"/><circle cx="3.5" cy="12" r="1.5" fill="currentColor" stroke="none"/><circle cx="3.5" cy="18" r="1.5" fill="currentColor" stroke="none"/></svg>
        </button>
        <button type="button" class={btnClass(isOrderedList())} onClick={toggleOrderedList} title="Ordered list">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="10" y1="6" x2="21" y2="6"/><line x1="10" y1="12" x2="21" y2="12"/><line x1="10" y1="18" x2="21" y2="18"/><text x="1" y="8" font-size="8" fill="currentColor" stroke="none" font-family="sans-serif">1</text><text x="1" y="14" font-size="8" fill="currentColor" stroke="none" font-family="sans-serif">2</text><text x="1" y="20" font-size="8" fill="currentColor" stroke="none" font-family="sans-serif">3</text></svg>
        </button>

        <div class="w-px h-5 bg-[var(--border-light)] mx-1" />

        <button type="button" class={btnClass(isBlockquote())} onClick={toggleBlockquote} title="Blockquote">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="3" y1="4" x2="3" y2="20"/><line x1="8" y1="8" x2="20" y2="8"/><line x1="8" y1="12" x2="18" y2="12"/><line x1="8" y1="16" x2="16" y2="16"/></svg>
        </button>
        <button type="button" class={btnClass(isCode())} onClick={toggleCodeBlock} title="Code block">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/></svg>
        </button>

        <div class="w-px h-5 bg-[var(--border-light)] mx-1" />

        <button type="button" class={btnClass(isLink())} onClick={toggleLinkFn} title="Insert link">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>
        </button>
        <button
          type="button"
          class={btnClass(false)}
          onClick={promptImagePicker}
          title="Insert image"
          data-testid="editor-insert-image-button"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <rect x="3" y="4" width="18" height="16" rx="2" />
            <circle cx="9" cy="10" r="1.5" />
            <path d="M21 16 16 11l-4 4-2-2-7 7" />
          </svg>
        </button>

        <Show when={props.signatureEnabled && signatureState.signatures.length > 0}>
          <div class="w-px h-5 bg-[var(--border-light)] mx-1" />
          <div ref={signatureMenuRef} class="relative">
            <button
              type="button"
              class={btnClass(isSignatureMenuOpen())}
              onClick={() => setIsSignatureMenuOpen((open) => !open)}
              title="Signature"
            >
              <span class="flex items-center gap-1">
                <IconSignature size={12} />
                <IconChevronDown size={10} />
              </span>
            </button>

            <Show when={isSignatureMenuOpen()}>
              <div class="absolute top-full left-0 mt-1 w-56 bg-[var(--card)] border border-[var(--border)] rounded-lg shadow-lg z-50 py-1">
                <div class="px-3 py-1.5 text-[10px] font-semibold text-[var(--text-muted)] uppercase tracking-wider">
                  Signatures
                </div>
                <For each={signatureState.signatures}>
                  {(signature) => (
                    <button
                      type="button"
                      onClick={() => applySignatureSelection(signature.id)}
                      class={`w-full text-left px-3 py-2 text-sm border-none cursor-pointer transition-colors flex items-center gap-2 ${
                        activeSignatureId() === signature.id
                          ? "bg-[var(--active-bg)] text-[var(--primary)] font-medium"
                          : "bg-transparent text-[var(--foreground)] hover:bg-[var(--hover-bg)]"
                      }`}
                    >
                      <span class="truncate flex-1">{signature.name}</span>
                      <Show when={signatureState.defaultId === signature.id}>
                        <span class="text-[9px] font-semibold text-[var(--text-muted)] bg-[var(--search-bg)] px-1.5 py-0.5 rounded-full uppercase">default</span>
                      </Show>
                    </button>
                  )}
                </For>
                <div class="border-t border-[var(--border-light)] mt-1 pt-1">
                  <button
                    type="button"
                    onClick={() => applySignatureSelection(null)}
                    class="w-full text-left px-3 py-2 text-sm border-none bg-transparent text-[var(--text-muted)] cursor-pointer hover:bg-[var(--hover-bg)] transition-colors"
                  >
                    No signature
                  </button>
                  <A
                    href="/settings?tab=signature"
                    onClick={handleManageSignatures}
                    class="block px-3 py-2 text-sm text-[var(--primary)] hover:bg-[var(--hover-bg)] no-underline"
                  >
                    Manage signatures
                  </A>
                </div>
              </div>
            </Show>
          </div>
        </Show>
      </div>
    </Show>
  );

  return (
    <div class={`${props.class ?? ""}${props.fullHeight ? " h-full flex flex-col" : ""}`}>
      <Show when={(props.toolbarPosition ?? "top") === "top"}>{toolbar}</Show>

      <input
        ref={imageInputRef}
        type="file"
        accept="image/*"
        multiple
        class="hidden"
        data-testid="inline-image-upload-input"
        onChange={handleImageInputChange}
      />

      <div class={props.fullHeight ? "relative flex-1 min-h-0" : "relative"}>
        <div
          ref={editorRef}
          class={editorClass()}
          contentEditable={true}
          role="textbox"
          spellcheck={true}
        />
        <Show when={!props.initialContent}>
          <div class="lexical-placeholder absolute top-4 left-4 text-[var(--text-muted)] text-sm pointer-events-none select-none" />
        </Show>
      </div>
      <Show when={(props.toolbarPosition ?? "top") === "bottom"}>
        {toolbar}
      </Show>
    </div>
  );
}

export function getEditorHtml(editorRef: HTMLDivElement | undefined): string {
  return editorRef?.innerHTML || "";
}
