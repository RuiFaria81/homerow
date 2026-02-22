import {
  DecoratorNode,
  DOMConversionMap,
  DOMConversionOutput,
  DOMExportOutput,
  LexicalNode,
  NodeKey,
  SerializedLexicalNode,
  Spread,
} from "lexical";

export type SerializedInlineImageNode = Spread<
  {
    src: string;
    altText: string;
    width: number | null;
    height: number | null;
  },
  SerializedLexicalNode
>;

function convertImageElement(domNode: HTMLElement): DOMConversionOutput | null {
  if (domNode.tagName.toLowerCase() !== "img") return null;
  const src = domNode.getAttribute("src");
  if (!src) return null;
  const altText = domNode.getAttribute("alt") || "";
  const width = domNode.hasAttribute("width") ? Number(domNode.getAttribute("width")) : null;
  const height = domNode.hasAttribute("height") ? Number(domNode.getAttribute("height")) : null;
  return {
    node: new InlineImageNode(src, altText, Number.isFinite(width) ? width : null, Number.isFinite(height) ? height : null),
  };
}

export class InlineImageNode extends DecoratorNode<null> {
  __src: string;
  __altText: string;
  __width: number | null;
  __height: number | null;

  static getType(): string {
    return "inline-image";
  }

  static clone(node: InlineImageNode): InlineImageNode {
    return new InlineImageNode(node.__src, node.__altText, node.__width, node.__height, node.__key);
  }

  static importJSON(serialized: SerializedInlineImageNode): InlineImageNode {
    return new InlineImageNode(serialized.src, serialized.altText, serialized.width, serialized.height);
  }

  static importDOM(): DOMConversionMap | null {
    return {
      img: () => ({
        conversion: convertImageElement,
        priority: 2,
      }),
    };
  }

  constructor(src: string, altText: string, width?: number | null, height?: number | null, key?: NodeKey) {
    super(key);
    this.__src = src;
    this.__altText = altText;
    this.__width = width ?? null;
    this.__height = height ?? null;
  }

  exportJSON(): SerializedInlineImageNode {
    return {
      type: "inline-image",
      version: 1,
      src: this.__src,
      altText: this.__altText,
      width: this.__width,
      height: this.__height,
    };
  }

  exportDOM(): DOMExportOutput {
    const img = document.createElement("img");
    img.setAttribute("src", this.__src);
    if (this.__altText) img.setAttribute("alt", this.__altText);
    if (this.__width != null) img.setAttribute("width", String(this.__width));
    if (this.__height != null) img.setAttribute("height", String(this.__height));
    img.style.maxWidth = "100%";
    img.style.height = "auto";
    return { element: img };
  }

  createDOM(): HTMLElement {
    const img = document.createElement("img");
    img.setAttribute("src", this.__src);
    if (this.__altText) img.setAttribute("alt", this.__altText);
    if (this.__width != null) img.setAttribute("width", String(this.__width));
    if (this.__height != null) img.setAttribute("height", String(this.__height));
    img.style.maxWidth = "100%";
    img.style.height = "auto";
    img.style.verticalAlign = "middle";
    return img;
  }

  updateDOM(): boolean {
    return false;
  }

  decorate(): null {
    return null;
  }

  isInline(): boolean {
    return true;
  }
}

export function $createInlineImageNode(src: string, altText = "", width?: number | null, height?: number | null): InlineImageNode {
  return new InlineImageNode(src, altText, width, height);
}

export function $isInlineImageNode(node: LexicalNode | null | undefined): node is InlineImageNode {
  return node instanceof InlineImageNode;
}
