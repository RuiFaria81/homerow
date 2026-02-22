// src/lib/reply-utils.ts
import { FullEmail } from "./mail-client";

const CURRENT_USER =
  (typeof process !== "undefined" ? process.env?.ADMIN_EMAIL : undefined) ||
  "admin@local";

export function formatReplySubject(subject: string): string {
  if (subject.toLowerCase().startsWith("re:")) return subject;
  return `Re: ${subject}`;
}

export function formatForwardSubject(subject: string): string {
  if (subject.toLowerCase().startsWith("fwd:")) return subject;
  return `Fwd: ${subject}`;
}

export function createQuoteHeader(email: FullEmail): string {
  const date = new Date(email.date).toLocaleString();
  return `\n\n\nOn ${date}, ${email.from} wrote:\n`;
}

export function htmlToText(html: string): string {
  const temp = html.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
                   .replace(/<br\s*\/?>/gi, "\n")
                   .replace(/<\/p>/gi, "\n\n")
                   .replace(/<[^>]+>/g, "");
  return temp.trim();
}

export function quoteBody(text: string): string {
  return text.split("\n").map(line => `> ${line}`).join("\n");
}

export function generateReplyBody(email: FullEmail): string {
  const originalContent = email.text || (email.html ? htmlToText(email.html) : "");
  return createQuoteHeader(email) + quoteBody(originalContent);
}

export function generateForwardBody(email: FullEmail): string {
  const originalContent = email.text || (email.html ? htmlToText(email.html) : "");
  return `\n\n\n---------- Forwarded message ---------\nFrom: ${email.from}\nDate: ${new Date(email.date).toLocaleString()}\nSubject: ${email.subject}\n\n${originalContent}`;
}

export interface QuotedEmailParts {
  headerHtml: string;
  rawHtml: string;
}

export function getForwardQuoteParts(email: FullEmail): QuotedEmailParts {
  const date = new Date(email.date).toLocaleString();
  const escapedFrom = (email.from || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const escapedSubject = (email.subject || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

  const headerHtml =
    `<p style="margin: 0 0 4px; font-size: 13px; color: #777;">---------- Forwarded message ---------</p>` +
    `<p style="margin: 0; font-size: 13px;"><b>From:</b> ${escapedFrom}</p>` +
    `<p style="margin: 0; font-size: 13px;"><b>Date:</b> ${date}</p>` +
    `<p style="margin: 0 0 8px; font-size: 13px;"><b>Subject:</b> ${escapedSubject}</p>`;

  const rawHtml = email.html || textToHtml(email.text || "");

  return { headerHtml, rawHtml };
}

export function getReplyQuoteParts(email: FullEmail): QuotedEmailParts {
  const date = new Date(email.date).toLocaleString();
  const escapedFrom = (email.from || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

  const headerHtml =
    `<p style="margin: 0 0 8px; font-size: 13px; color: #777;">On ${date}, ${escapedFrom} wrote:</p>`;

  const rawHtml = email.html || textToHtml(email.text || "");

  return { headerHtml, rawHtml };
}

function textToHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\n/g, "<br>");
}

export interface ReplyAllRecipients {
  to: string[];
  cc: string[];
}

export function getReplyRecipients(email: FullEmail, currentUserEmail?: string): string[] {
  const currentUser = (currentUserEmail || email.accountEmail || CURRENT_USER).toLowerCase();
  const recipients = new Map<string, string>();

  const addRecipient = (addr?: string) => {
    if (!addr) return;
    const key = addr.toLowerCase();
    if (!key || key === currentUser) return;
    recipients.set(key, addr);
  };

  const sender = email.fromAddress || email.from;
  const senderIsCurrentUser = !!sender && sender.toLowerCase() === currentUser;
  const replyTo = email.replyTo || [];

  if (senderIsCurrentUser) {
    for (const addr of email.to || []) addRecipient(addr);
    if (recipients.size === 0) {
      for (const addr of email.cc || []) addRecipient(addr);
    }
    if (recipients.size === 0) {
      for (const addr of replyTo) addRecipient(addr);
    }
  } else {
    if (replyTo.length > 0) {
      for (const addr of replyTo) addRecipient(addr);
    } else {
      addRecipient(sender);
    }
  }

  return Array.from(recipients.values());
}

export function getReplyAllRecipients(email: FullEmail, currentUserEmail?: string): ReplyAllRecipients {
  const currentUser = (currentUserEmail || email.accountEmail || CURRENT_USER).toLowerCase();
  const toMap = new Map<string, string>();
  const ccMap = new Map<string, string>();

  const addTo = (addr?: string) => {
    if (!addr) return;
    const key = addr.toLowerCase();
    if (!key || key === currentUser) return;
    toMap.set(key, addr);
  };

  const addCc = (addr?: string) => {
    if (!addr) return;
    const key = addr.toLowerCase();
    if (!key || key === currentUser) return;
    if (toMap.has(key)) return;
    ccMap.set(key, addr);
  };

  // To field: original sender + original To recipients, excluding current user.
  addTo(email.fromAddress || email.from);
  for (const addr of email.to || []) addTo(addr);

  // Cc field: original Cc recipients, excluding current user and To list.
  for (const addr of email.cc || []) addCc(addr);

  return {
    to: Array.from(toMap.values()),
    cc: Array.from(ccMap.values()),
  };
}
