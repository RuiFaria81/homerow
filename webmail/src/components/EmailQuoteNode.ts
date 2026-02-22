import {
  DecoratorNode,
  DOMExportOutput,
  LexicalNode,
  NodeKey,
  SerializedLexicalNode,
  Spread,
} from "lexical";

export type QuoteType = "forward" | "reply";

export type SerializedEmailQuoteNode = Spread<
  {
    rawHtml: string;
    headerHtml: string;
    quoteType: QuoteType;
  },
  SerializedLexicalNode
>;

/**
 * A custom Lexical DecoratorNode that renders quoted email HTML
 * inside a sandboxed, non-editable block within the editor.
 * The original email HTML is preserved exactly as-is using an iframe.
 */
export class EmailQuoteNode extends DecoratorNode<null> {
  __rawHtml: string;
  __headerHtml: string;
  __quoteType: QuoteType;

  static getType(): string {
    return "email-quote";
  }

  static clone(node: EmailQuoteNode): EmailQuoteNode {
    return new EmailQuoteNode(
      node.__rawHtml,
      node.__headerHtml,
      node.__quoteType,
      node.__key
    );
  }

  constructor(
    rawHtml: string,
    headerHtml: string,
    quoteType: QuoteType,
    key?: NodeKey
  ) {
    super(key);
    this.__rawHtml = rawHtml;
    this.__headerHtml = headerHtml;
    this.__quoteType = quoteType;
  }

  // --- Serialization ---

  static importJSON(json: SerializedEmailQuoteNode): EmailQuoteNode {
    return new EmailQuoteNode(json.rawHtml, json.headerHtml, json.quoteType);
  }

  exportJSON(): SerializedEmailQuoteNode {
    return {
      type: "email-quote",
      version: 1,
      rawHtml: this.__rawHtml,
      headerHtml: this.__headerHtml,
      quoteType: this.__quoteType,
    };
  }

  // --- DOM export (used by $generateHtmlFromNodes for sending) ---

  exportDOM(): DOMExportOutput {
    const container = document.createElement("div");
    container.setAttribute("data-email-quote", "true");
    container.style.borderLeft = "1px solid #ccc";
    container.style.paddingLeft = "12px";
    container.style.marginLeft = "0";
    container.style.color = "#555";

    // Add the header
    container.innerHTML = this.__headerHtml + this.__rawHtml;

    return { element: container };
  }

  // --- Rendering in the editor ---

  createDOM(): HTMLElement {
    const wrapper = document.createElement("div");
    wrapper.style.marginTop = "12px";
    wrapper.style.marginBottom = "6px";
    wrapper.setAttribute("contenteditable", "false");
    wrapper.classList.add("email-quote-block");

    // Collapsed control row (always visible)
    const toggleRow = document.createElement("div");
    toggleRow.style.display = "flex";
    toggleRow.style.alignItems = "center";
    toggleRow.style.gap = "0";
    toggleRow.style.marginBottom = "8px";
    toggleRow.style.cursor = "pointer";
    toggleRow.style.userSelect = "none";
    toggleRow.style.width = "22px";
    toggleRow.style.height = "22px";
    toggleRow.style.justifyContent = "center";
    toggleRow.style.padding = "0";
    toggleRow.style.borderRadius = "12px";
    toggleRow.style.border = "1px solid #dadce0";
    toggleRow.style.background = "#f8f9fa";
    toggleRow.style.color = "#202124";
    toggleRow.style.fontSize = "14px";
    toggleRow.style.fontFamily = "Arial, sans-serif";
    toggleRow.style.fontWeight = "500";
    toggleRow.style.lineHeight = "18px";
    toggleRow.setAttribute("role", "button");
    toggleRow.setAttribute("tabindex", "0");

    const dots = document.createElement("span");
    dots.textContent = "...";
    dots.style.letterSpacing = "0.5px";
    dots.style.fontWeight = "700";
    dots.style.fontSize = "13px";
    dots.style.color = "#5f6368";

    toggleRow.appendChild(dots);
    wrapper.appendChild(toggleRow);

    const quoteContainer = document.createElement("div");
    quoteContainer.style.display = "none";
    quoteContainer.style.borderLeft = "2px solid #dadce0";
    quoteContainer.style.paddingLeft = "10px";
    quoteContainer.style.overflow = "hidden";

    // Header section (From, Date, Subject)
    const header = document.createElement("div");
    header.style.padding = "8px 12px";
    header.style.fontSize = "13px";
    header.style.color = "#777";
    header.style.lineHeight = "1.6";
    header.style.background = "#fff";
    header.innerHTML = this.__headerHtml;
    quoteContainer.appendChild(header);

    // Iframe for the original email body (lazy rendered on first expand)
    const iframe = document.createElement("iframe");
    iframe.style.width = "100%";
    iframe.style.border = "none";
    iframe.style.display = "block";
    iframe.style.minHeight = "24px";
    iframe.style.overflow = "hidden";
    iframe.setAttribute("sandbox", "allow-same-origin");
    iframe.setAttribute("title", "Quoted email content");
    iframe.setAttribute("referrerpolicy", "no-referrer");
    quoteContainer.appendChild(iframe);
    wrapper.appendChild(quoteContainer);

    let rendered = false;
    const renderIframe = () => {
      if (rendered) return;
      const doc = iframe.contentDocument;
      if (!doc) return;

      doc.open();
      doc.write(`<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    * { box-sizing: border-box; }
    body {
      margin: 0;
      padding: 8px 12px;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      font-size: 14px;
      line-height: 1.5;
      color: #333;
      overflow: hidden;
      word-wrap: break-word;
      overflow-wrap: break-word;
    }
    img { max-width: 100%; height: auto; }
    table { max-width: 100% !important; }
    pre { white-space: pre-wrap; overflow-x: auto; }
    a { color: #1a73e8; }
  </style>
</head>
<body>${this.__rawHtml}</body>
</html>`);
      doc.close();

      const resize = () => {
        if (!doc.body) return;
        const h = Math.max(doc.body.scrollHeight, 24);
        iframe.style.height = h + "px";
      };
      resize();
      setTimeout(resize, 100);
      setTimeout(resize, 500);

      const observer = new MutationObserver(resize);
      observer.observe(doc.body, {
        childList: true,
        subtree: true,
        attributes: true,
      });

      // Also resize when images load
      doc.querySelectorAll("img").forEach((img) => {
        if (!img.complete) {
          img.addEventListener("load", resize);
          img.addEventListener("error", resize);
        }
      });

      rendered = true;
    };

    const expand = () => {
      quoteContainer.style.display = "block";
      dots.textContent = "\u2212";
      toggleRow.setAttribute("aria-label", "Hide trimmed content");
      renderIframe();
    };

    const collapse = () => {
      quoteContainer.style.display = "none";
      dots.textContent = "...";
      toggleRow.setAttribute("aria-label", "Show trimmed content");
    };

    let expanded = false;
    toggleRow.addEventListener("mouseenter", () => {
      toggleRow.style.background = "#f1f3f4";
      toggleRow.style.borderColor = "#c7c9cc";
    });
    toggleRow.addEventListener("mouseleave", () => {
      toggleRow.style.background = "#f8f9fa";
      toggleRow.style.borderColor = "#dadce0";
    });
    const toggle = (event?: Event) => {
      if (event) {
        event.preventDefault();
        event.stopPropagation();
      }
      expanded = !expanded;
      if (expanded) expand();
      else collapse();
    };
    toggleRow.addEventListener("click", (event) => {
      toggle(event);
    });
    toggleRow.addEventListener("keydown", (event) => {
      if (event.key !== "Enter" && event.key !== " ") return;
      event.preventDefault();
      toggle(event);
    });

    return wrapper;
  }

  updateDOM(): boolean {
    // Always re-create (content is immutable for quoted emails)
    return false;
  }

  // DecoratorNode requires this but we handle rendering in createDOM
  decorate(): null {
    return null;
  }

  isInline(): boolean {
    return false;
  }

  // Make the node non-editable — users can't type into the quoted block
  isKeyboardSelectable(): boolean {
    return true;
  }
}

// --- Helper to create the node ---

export function $createEmailQuoteNode(
  rawHtml: string,
  headerHtml: string,
  quoteType: QuoteType
): EmailQuoteNode {
  return new EmailQuoteNode(rawHtml, headerHtml, quoteType);
}

export function $isEmailQuoteNode(
  node: LexicalNode | null | undefined
): node is EmailQuoteNode {
  return node instanceof EmailQuoteNode;
}
