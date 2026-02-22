import DOMPurify from "dompurify";

/**
 * Sanitize HTML email content to prevent XSS attacks while preserving
 * legitimate email formatting (tables, images, styles, etc).
 */
export function sanitizeEmailHtml(dirty: string): string {
  if (typeof window === "undefined") return dirty;

  return DOMPurify.sanitize(dirty, {
    // Allow common email HTML elements
    ALLOWED_TAGS: [
      // Structure
      "html", "head", "body", "div", "span", "p", "br", "hr",
      // Headings
      "h1", "h2", "h3", "h4", "h5", "h6",
      // Text formatting
      "b", "i", "u", "s", "em", "strong", "small", "sub", "sup",
      "blockquote", "pre", "code", "mark",
      // Lists
      "ul", "ol", "li", "dl", "dt", "dd",
      // Tables (common in email templates)
      "table", "thead", "tbody", "tfoot", "tr", "td", "th", "caption", "colgroup", "col",
      // Links & media
      "a", "img",
      // Style (inline styles are critical for email rendering)
      "style",
      // Misc
      "center", "font", "address", "section", "article", "header", "footer", "nav", "aside",
      "figure", "figcaption", "details", "summary",
    ],
    ALLOWED_ATTR: [
      // Global attributes
      "class", "id", "style", "dir", "lang", "title",
      // Link attributes
      "href", "target", "rel",
      // Image attributes
      "src", "alt", "width", "height",
      // Table attributes
      "colspan", "rowspan", "cellpadding", "cellspacing", "border",
      "align", "valign", "bgcolor", "background",
      // Font attributes (legacy email support)
      "color", "face", "size",
    ],
    // Force all links to open in new tab
    ADD_ATTR: ["target"],
    // Allow data URIs for embedded images
    ALLOW_DATA_ATTR: false,
    // Allow safe URI schemes
    ALLOWED_URI_REGEXP: /^(?:(?:https?|mailto|cid|data):|[^a-z]|[a-z+.-]+(?:[^a-z+.\-:]|$))/i,
  });
}
