// ---------------------------------------------------------------------------
// MIME parsing & HTML sanitization.
// Converts raw RFC 5322 buffers into structured data ready for the DB.
// ---------------------------------------------------------------------------

import PostalMime from 'postal-mime';
import sanitizeHtml from 'sanitize-html';
import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { log } from './logger.js';

export interface ParsedEmail {
  messageId: string | null;
  inReplyTo: string | null;
  references: string[];
  subject: string;
  from: { name: string; address: string };
  to: Array<{ name: string; address: string }>;
  cc: Array<{ name: string; address: string }>;
  bcc: Array<{ name: string; address: string }>;
  replyTo: Array<{ name: string; address: string }>;
  date: Date | null;
  textBody: string | null;
  htmlBody: string | null;
  snippet: string;
  headers: Record<string, string>;
  attachments: ParsedAttachment[];
  hasAttachments: boolean;
  spamScore: number | null;
}

export interface ParsedAttachment {
  filename: string | null;
  contentType: string;
  size: number;
  contentId: string | null;
  disposition: string;
  content: Uint8Array;
  checksum: string;
}

// ---------------------------------------------------------------------------
// Sanitization config — strips scripts, event handlers, tracking pixels, etc.
// ---------------------------------------------------------------------------
const SANITIZE_OPTIONS: sanitizeHtml.IOptions = {
  allowedTags: sanitizeHtml.defaults.allowedTags.concat([
    'img', 'style', 'span', 'div', 'table', 'thead', 'tbody', 'tfoot',
    'tr', 'th', 'td', 'caption', 'colgroup', 'col', 'center',
    'header', 'footer', 'section', 'article', 'aside', 'nav',
    'figure', 'figcaption', 'details', 'summary',
  ]),
  allowedAttributes: {
    ...sanitizeHtml.defaults.allowedAttributes,
    '*': ['style', 'class', 'id', 'dir', 'lang'],
    img: ['src', 'alt', 'width', 'height', 'title'],
    a: ['href', 'title', 'target', 'rel'],
    td: ['colspan', 'rowspan', 'align', 'valign', 'width', 'height', 'style'],
    th: ['colspan', 'rowspan', 'align', 'valign', 'width', 'height', 'style'],
    table: ['cellpadding', 'cellspacing', 'border', 'width', 'align', 'style'],
  },
  allowedSchemes: ['http', 'https', 'mailto', 'cid'],
  // Block tracking pixels: 1x1 images with external URLs
  exclusiveFilter: (frame) => {
    if (frame.tag === 'img') {
      const src = frame.attribs.src || '';
      const w = parseInt(frame.attribs.width || '0', 10);
      const h = parseInt(frame.attribs.height || '0', 10);
      // Strip 1x1 tracking pixels
      if (w <= 1 && h <= 1 && (src.startsWith('http://') || src.startsWith('https://'))) {
        return true;
      }
    }
    return false;
  },
  // Strip all script-related content
  disallowedTagsMode: 'discard',
  // Email HTML legitimately uses <style> for layout; acknowledge the risk
  allowVulnerableTags: true,
};

function sanitize(html: string): string {
  return sanitizeHtml(html, SANITIZE_OPTIONS);
}

function makeSnippet(text: string | null, maxLen = 200): string {
  if (!text) return '';
  return text
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maxLen);
}

function parseAddresses(
  addrs: Array<{ name?: string; address?: string }> | undefined,
): Array<{ name: string; address: string }> {
  if (!addrs) return [];
  return addrs
    .filter((a) => a.address)
    .map((a) => ({ name: a.name || '', address: a.address! }));
}

function extractReferences(refHeader: string | undefined): string[] {
  if (!refHeader) return [];
  // References header is space-separated list of Message-IDs
  return refHeader.match(/<[^>]+>/g) || [];
}

/**
 * Parse the rspamd (or SpamAssassin-compatible) spam score from email headers.
 * Rspamd adds:  X-Spamd-Result: default: False [2.10 / 15.00]
 * SA-style:     X-Spam-Score: 2.1
 */
function extractSpamScore(headers: Record<string, string>): number | null {
  // Rspamd: "X-Spamd-Result: default: False [2.10 / 15.00]"
  const rspamdResult = headers['x-spamd-result'];
  if (rspamdResult) {
    const match = rspamdResult.match(/\[\s*(-?[\d.]+)\s*\//);
    if (match) {
      const score = parseFloat(match[1]);
      if (Number.isFinite(score)) return score;
    }
  }

  // SpamAssassin / generic: "X-Spam-Score: 2.1"
  const spamScore = headers['x-spam-score'];
  if (spamScore) {
    const score = parseFloat(spamScore.trim());
    if (Number.isFinite(score)) return score;
  }

  return null;
}

// ---------------------------------------------------------------------------
// Main parse function
// ---------------------------------------------------------------------------

export async function parseEmail(source: Buffer | Uint8Array): Promise<ParsedEmail> {
  const parsed = await PostalMime.parse(source);

  // Build headers map from structured data
  const headers: Record<string, string> = {};
  if (parsed.headers) {
    for (const h of parsed.headers) {
      headers[h.key.toLowerCase()] = h.value;
    }
  }

  const messageId = parsed.messageId || headers['message-id'] || null;
  const inReplyTo = parsed.inReplyTo || headers['in-reply-to'] || null;
  const references = extractReferences(headers['references']);

  const htmlBody = parsed.html ? sanitize(parsed.html) : null;
  const textBody = parsed.text || null;
  const snippet = makeSnippet(textBody || (htmlBody ? stripHtml(htmlBody) : null));

  const attachments: ParsedAttachment[] = (parsed.attachments || []).map((att) => {
    const content = att.content instanceof Uint8Array
      ? att.content
      : new Uint8Array(att.content);
    const hash = crypto.createHash('sha256').update(content).digest('hex');

    return {
      filename: att.filename || null,
      contentType: att.mimeType || 'application/octet-stream',
      size: content.byteLength,
      contentId: att.contentId || null,
      disposition: att.disposition || 'attachment',
      content,
      checksum: hash,
    };
  });

  return {
    messageId,
    inReplyTo,
    references,
    subject: parsed.subject || '(No Subject)',
    from: {
      name: parsed.from?.name || '',
      address: parsed.from?.address || 'unknown',
    },
    to: parseAddresses(parsed.to),
    cc: parseAddresses(parsed.cc),
    bcc: parseAddresses(parsed.bcc),
    replyTo: parseAddresses(parsed.replyTo ? [parsed.replyTo] : []),
    date: parsed.date ? new Date(parsed.date) : null,
    textBody,
    htmlBody,
    snippet,
    headers,
    attachments,
    hasAttachments: attachments.some((a) => a.disposition !== 'inline'),
    spamScore: extractSpamScore(headers),
  };
}

function stripHtml(html: string): string {
  return html
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n\n')
    .replace(/<[^>]+>/g, '')
    .trim();
}

// ---------------------------------------------------------------------------
// Store attachment blob to disk, return the storage path.
// ---------------------------------------------------------------------------

export async function storeAttachment(
  attachmentDir: string,
  accountId: string,
  messageUuid: string,
  att: ParsedAttachment,
): Promise<string> {
  // Organize as: <attachmentDir>/<accountId>/<messageUuid>/<checksum>-<filename>
  const dir = path.join(attachmentDir, accountId, messageUuid);
  await fs.mkdir(dir, { recursive: true });

  const safeName = (att.filename || 'unnamed').replace(/[^a-zA-Z0-9._-]/g, '_');
  const filePath = path.join(dir, `${att.checksum.slice(0, 12)}-${safeName}`);

  // Skip if already stored (dedup via checksum)
  try {
    await fs.access(filePath);
    log.debug('Attachment already stored, skipping', { path: filePath });
  } catch {
    await fs.writeFile(filePath, att.content);
  }

  return filePath;
}
