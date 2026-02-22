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

export type SerializedSignatureNode = Spread<
  {
    signatureId: string | null;
    signatureName: string;
    signatureHtml: string;
  },
  SerializedLexicalNode
>;

function convertSignatureElement(domNode: HTMLElement): DOMConversionOutput {
  const signatureId = domNode.getAttribute("data-signature-id");
  const signatureName = domNode.getAttribute("data-signature-name") || "Signature";
  const signatureHtml = domNode.innerHTML;
  return {
    node: new SignatureNode(signatureId, signatureName, signatureHtml),
  };
}

export class SignatureNode extends DecoratorNode<null> {
  __signatureId: string | null;
  __signatureName: string;
  __signatureHtml: string;

  static getType(): string {
    return "email-signature";
  }

  static clone(node: SignatureNode): SignatureNode {
    return new SignatureNode(node.__signatureId, node.__signatureName, node.__signatureHtml, node.__key);
  }

  static importJSON(serialized: SerializedSignatureNode): SignatureNode {
    return new SignatureNode(serialized.signatureId, serialized.signatureName, serialized.signatureHtml);
  }

  static importDOM(): DOMConversionMap | null {
    return {
      div: (domNode: HTMLElement) => {
        if (!domNode.hasAttribute("data-email-signature") && !domNode.hasAttribute("data-lexical-signature")) {
          return null;
        }
        return {
          conversion: convertSignatureElement,
          priority: 3,
        };
      },
    };
  }

  constructor(signatureId: string | null, signatureName: string, signatureHtml: string, key?: NodeKey) {
    super(key);
    this.__signatureId = signatureId;
    this.__signatureName = signatureName;
    this.__signatureHtml = signatureHtml;
  }

  exportJSON(): SerializedSignatureNode {
    return {
      type: "email-signature",
      version: 1,
      signatureId: this.__signatureId,
      signatureName: this.__signatureName,
      signatureHtml: this.__signatureHtml,
    };
  }

  exportDOM(): DOMExportOutput {
    const container = document.createElement("div");
    container.setAttribute("data-email-signature", "true");
    container.setAttribute("data-lexical-signature", "true");
    if (this.__signatureId) {
      container.setAttribute("data-signature-id", this.__signatureId);
    }
    container.setAttribute("data-signature-name", this.__signatureName);
    container.innerHTML = this.__signatureHtml;
    return { element: container };
  }

  createDOM(): HTMLElement {
    const container = document.createElement("div");
    container.setAttribute("data-lexical-signature", "true");
    container.setAttribute("contenteditable", "false");
    if (this.__signatureId) {
      container.setAttribute("data-signature-id", this.__signatureId);
    }
    container.setAttribute("data-signature-name", this.__signatureName);
    container.style.marginTop = "12px";
    container.style.opacity = "0.95";
    container.innerHTML = this.__signatureHtml;
    return container;
  }

  updateDOM(): boolean {
    return false;
  }

  decorate(): null {
    return null;
  }

  isInline(): boolean {
    return false;
  }

  getSignatureId(): string | null {
    return this.getLatest().__signatureId;
  }

  setSignature(signatureId: string | null, signatureName: string, signatureHtml: string): void {
    const writable = this.getWritable();
    writable.__signatureId = signatureId;
    writable.__signatureName = signatureName;
    writable.__signatureHtml = signatureHtml;
  }
}

export function $createSignatureNode(signatureId: string | null, signatureName: string, signatureHtml: string): SignatureNode {
  return new SignatureNode(signatureId, signatureName, signatureHtml);
}

export function $isSignatureNode(node: LexicalNode | null | undefined): node is SignatureNode {
  return node instanceof SignatureNode;
}
