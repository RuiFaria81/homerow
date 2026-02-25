import type {
  AutoReplySettings,
  BlockedSender,
  ContactEntry,
  EmailAttachment,
  EmailMessage,
  FullEmail,
  SendEmailOptions,
  SendEmailResult,
} from "./mail-client";
import { DEMO_USER_PROFILE } from "./demo-user";

const DEMO_USER_EMAIL = DEMO_USER_PROFILE.email;

interface DemoMessage extends FullEmail {
  threadId?: string;
}

interface DemoState {
  messages: DemoMessage[];
  blockedSenders: BlockedSender[];
  contacts: ContactEntry[];
  autoReplySettings: AutoReplySettings;
  nextSeq: number;
  nextBlockedSenderId: number;
}

const now = Date.now();
const minutesAgo = (minutes: number) => new Date(now - minutes * 60_000).toISOString();

function cloneMessage(message: DemoMessage): DemoMessage {
  return {
    ...message,
    flags: [...(message.flags || [])],
    to: message.to ? [...message.to] : undefined,
    cc: message.cc ? [...message.cc] : undefined,
    bcc: message.bcc ? [...message.bcc] : undefined,
    replyTo: message.replyTo ? [...message.replyTo] : undefined,
    attachments: message.attachments
      ? message.attachments.map((attachment) => ({ ...attachment }))
      : undefined,
    references: message.references ? [...message.references] : undefined,
  };
}

function createInitialState(): DemoState {
  const baseMessages: DemoMessage[] = [
    {
      id: 1201,
      seq: 1201,
      threadId: "thread-demo-welcome",
      subject: "Welcome to Homerow demo mode",
      from: "Homerow Team",
      fromAddress: "team@homerow.dev",
      to: [DEMO_USER_EMAIL],
      cc: [],
      date: minutesAgo(12),
      flags: [],
      snippet: "This inbox is running entirely on mocked data, with no backend required.",
      hasAttachments: false,
      folderPath: "INBOX",
      html: "<p>This inbox is running entirely on <strong>mocked data</strong>, with no backend required.</p>",
      text: "This inbox is running entirely on mocked data, with no backend required.",
      accountEmail: DEMO_USER_EMAIL,
      messageId: "<demo-welcome@homerow.dev>",
    },
    {
      id: 1202,
      seq: 1202,
      threadId: "thread-demo-welcome",
      subject: "Re: Welcome to Homerow demo mode",
      from: "You",
      fromAddress: DEMO_USER_EMAIL,
      to: ["team@homerow.dev"],
      date: minutesAgo(6),
      flags: ["\\Seen"],
      snippet: "Looks great. We can show this in docs as a live demo.",
      hasAttachments: false,
      folderPath: "Sent",
      html: "<p>Looks great. We can show this in docs as a live demo.</p>",
      text: "Looks great. We can show this in docs as a live demo.",
      accountEmail: DEMO_USER_EMAIL,
      messageId: "<demo-reply@homerow.dev>",
      inReplyTo: "<demo-welcome@homerow.dev>",
      references: ["<demo-welcome@homerow.dev>"],
    },
    {
      id: 1203,
      seq: 1203,
      threadId: "thread-billing",
      subject: "Invoice for February",
      from: "Billing",
      fromAddress: "billing@example.com",
      to: [DEMO_USER_EMAIL],
      date: minutesAgo(40),
      flags: ["\\Seen", "Category Finance", "Important"],
      snippet: "Your February invoice is available. Payment due in 7 days.",
      hasAttachments: false,
      folderPath: "INBOX",
      html: "<p>Your February invoice is available. Payment due in 7 days.</p>",
      text: "Your February invoice is available. Payment due in 7 days.",
      accountEmail: DEMO_USER_EMAIL,
      messageId: "<demo-billing@homerow.dev>",
    },
    {
      id: 1204,
      seq: 1204,
      threadId: "thread-promotions",
      subject: "20% off your next order",
      from: "Acme Store",
      fromAddress: "promo@acme-store.dev",
      to: [DEMO_USER_EMAIL],
      date: minutesAgo(95),
      flags: ["Category Promotions"],
      snippet: "Limited time offer for demo users.",
      hasAttachments: false,
      folderPath: "INBOX",
      html: "<p>Limited time offer for demo users.</p>",
      text: "Limited time offer for demo users.",
      accountEmail: DEMO_USER_EMAIL,
      messageId: "<demo-promo@homerow.dev>",
    },
    {
      id: 1205,
      seq: 1205,
      threadId: "thread-social",
      subject: "Someone mentioned you",
      from: "Social Network",
      fromAddress: "notify@social.example",
      to: [DEMO_USER_EMAIL],
      date: minutesAgo(180),
      flags: ["\\Seen", "Category Social"],
      snippet: "You have new activity waiting.",
      hasAttachments: false,
      folderPath: "INBOX",
      html: "<p>You have new activity waiting.</p>",
      text: "You have new activity waiting.",
      accountEmail: DEMO_USER_EMAIL,
      messageId: "<demo-social@homerow.dev>",
    },
    {
      id: 1206,
      seq: 1206,
      threadId: "thread-draft",
      subject: "Draft: Product launch notes",
      from: "You",
      fromAddress: DEMO_USER_EMAIL,
      to: ["team@homerow.dev"],
      date: minutesAgo(260),
      flags: ["\\Draft", "\\Seen"],
      snippet: "Draft content for launch notes.",
      hasAttachments: false,
      folderPath: "Drafts",
      html: "<p>Draft content for launch notes.</p>",
      text: "Draft content for launch notes.",
      accountEmail: DEMO_USER_EMAIL,
      messageId: "<demo-draft@homerow.dev>",
    },
    {
      id: 1207,
      seq: 1207,
      threadId: "thread-archive",
      subject: "Architecture review notes",
      from: "Engineering",
      fromAddress: "eng@homerow.dev",
      to: [DEMO_USER_EMAIL],
      date: minutesAgo(520),
      flags: ["\\Seen"],
      snippet: "Notes from last architecture review.",
      hasAttachments: false,
      folderPath: "Archive",
      html: "<p>Notes from last architecture review.</p>",
      text: "Notes from last architecture review.",
      accountEmail: DEMO_USER_EMAIL,
      messageId: "<demo-archive@homerow.dev>",
    },
    {
      id: 1208,
      seq: 1208,
      threadId: "thread-snoozed",
      subject: "Reminder: Follow up next week",
      from: "Project Tracker",
      fromAddress: "tracker@example.dev",
      to: [DEMO_USER_EMAIL],
      date: minutesAgo(700),
      flags: ["\\Seen"],
      snippet: "This item is snoozed for later.",
      hasAttachments: false,
      folderPath: "Snoozed",
      snoozedUntil: new Date(now + 2 * 24 * 60 * 60 * 1000).toISOString(),
      html: "<p>This item is snoozed for later.</p>",
      text: "This item is snoozed for later.",
      accountEmail: DEMO_USER_EMAIL,
      messageId: "<demo-snoozed@homerow.dev>",
    },
    {
      id: 1209,
      seq: 1209,
      threadId: "thread-scheduled",
      subject: "Scheduled: Launch announcement",
      from: "To: team@homerow.dev",
      fromAddress: DEMO_USER_EMAIL,
      to: ["team@homerow.dev"],
      date: new Date(now + 5 * 60 * 60 * 1000).toISOString(),
      flags: ["\\Seen", "__scheduled"],
      snippet: "Scheduled on demo mailbox",
      hasAttachments: false,
      folderPath: "Scheduled",
      scheduledFor: new Date(now + 5 * 60 * 60 * 1000).toISOString(),
      html: "<p>Scheduled launch announcement</p>",
      text: "Scheduled launch announcement",
      accountEmail: DEMO_USER_EMAIL,
      messageId: "<demo-scheduled@homerow.dev>",
    },
    {
      id: 1210,
      seq: 1210,
      threadId: "thread-product-update",
      subject: "Platform update: keyboard shortcuts",
      from: "Homerow Product",
      fromAddress: "product@homerow.dev",
      to: [DEMO_USER_EMAIL],
      date: minutesAgo(28),
      flags: ["Category Updates", "Important"],
      snippet: "New command palette and keyboard flow improvements.",
      hasAttachments: false,
      folderPath: "INBOX",
      html: "<p>New command palette and keyboard flow improvements.</p>",
      text: "New command palette and keyboard flow improvements.",
      accountEmail: DEMO_USER_EMAIL,
      messageId: "<demo-product-update@homerow.dev>",
    },
    {
      id: 1211,
      seq: 1211,
      threadId: "thread-support",
      subject: "Ticket #4312 has been resolved",
      from: "Support",
      fromAddress: "support@service.dev",
      to: [DEMO_USER_EMAIL],
      date: minutesAgo(65),
      flags: ["\\Seen", "Category Updates"],
      snippet: "Your support ticket has been marked resolved.",
      hasAttachments: false,
      folderPath: "INBOX",
      html: "<p>Your support ticket has been marked resolved.</p>",
      text: "Your support ticket has been marked resolved.",
      accountEmail: DEMO_USER_EMAIL,
      messageId: "<demo-support@service.dev>",
    },
    {
      id: 1212,
      seq: 1212,
      threadId: "thread-standup",
      subject: "Daily standup notes",
      from: "You",
      fromAddress: DEMO_USER_EMAIL,
      to: ["eng@homerow.dev"],
      date: minutesAgo(85),
      flags: ["\\Seen"],
      snippet: "Sent from demo mailbox.",
      hasAttachments: false,
      folderPath: "Sent",
      html: "<p>Sent from demo mailbox.</p>",
      text: "Sent from demo mailbox.",
      accountEmail: DEMO_USER_EMAIL,
      messageId: "<demo-standup@homerow.dev>",
    },
    {
      id: 1213,
      seq: 1213,
      threadId: "thread-weekly",
      subject: "Weekly report (starred)",
      from: "Analytics",
      fromAddress: "analytics@homerow.dev",
      to: [DEMO_USER_EMAIL],
      date: minutesAgo(110),
      flags: ["\\Seen", "\\Flagged", "Category Updates"],
      snippet: "KPI summary for this week.",
      hasAttachments: false,
      folderPath: "INBOX",
      html: "<p>KPI summary for this week.</p>",
      text: "KPI summary for this week.",
      accountEmail: DEMO_USER_EMAIL,
      messageId: "<demo-weekly@homerow.dev>",
    },
    {
      id: 1214,
      seq: 1214,
      threadId: "thread-promo-2",
      subject: "Weekend sale starts now",
      from: "Acme Store",
      fromAddress: "promo@acme-store.dev",
      to: [DEMO_USER_EMAIL],
      date: minutesAgo(145),
      flags: ["\\Seen", "Category Promotions"],
      snippet: "Top offers for this weekend.",
      hasAttachments: false,
      folderPath: "INBOX",
      html: "<p>Top offers for this weekend.</p>",
      text: "Top offers for this weekend.",
      accountEmail: DEMO_USER_EMAIL,
      messageId: "<demo-promo-2@acme-store.dev>",
    },
    {
      id: 1215,
      seq: 1215,
      threadId: "thread-social-2",
      subject: "New followers this week",
      from: "Social Network",
      fromAddress: "notify@social.example",
      to: [DEMO_USER_EMAIL],
      date: minutesAgo(210),
      flags: ["Category Social"],
      snippet: "You gained 12 followers.",
      hasAttachments: false,
      folderPath: "INBOX",
      html: "<p>You gained 12 followers.</p>",
      text: "You gained 12 followers.",
      accountEmail: DEMO_USER_EMAIL,
      messageId: "<demo-social-2@social.example>",
    },
    {
      id: 1216,
      seq: 1216,
      threadId: "thread-spam",
      subject: "You won a mystery prize",
      from: "Unknown Sender",
      fromAddress: "prize@spam.example",
      to: [DEMO_USER_EMAIL],
      date: minutesAgo(400),
      flags: [],
      snippet: "This message is in spam for demo purposes.",
      hasAttachments: false,
      folderPath: "Spam",
      html: "<p>This message is in spam for demo purposes.</p>",
      text: "This message is in spam for demo purposes.",
      accountEmail: DEMO_USER_EMAIL,
      messageId: "<demo-spam@spam.example>",
    },
    {
      id: 1217,
      seq: 1217,
      threadId: "thread-trash",
      subject: "Old notification",
      from: "System",
      fromAddress: "system@homerow.dev",
      to: [DEMO_USER_EMAIL],
      date: minutesAgo(900),
      flags: ["\\Seen"],
      snippet: "Moved to trash in demo dataset.",
      hasAttachments: false,
      folderPath: "Trash",
      html: "<p>Moved to trash in demo dataset.</p>",
      text: "Moved to trash in demo dataset.",
      accountEmail: DEMO_USER_EMAIL,
      messageId: "<demo-trash@homerow.dev>",
    },
  ];

  return {
    messages: baseMessages.map(cloneMessage),
    blockedSenders: [],
    contacts: [
      {
        id: "demo-contact-1",
        email: "team@homerow.dev",
        displayName: "Homerow Team",
        frequency: 7,
        lastContactedAt: minutesAgo(20),
        source: "manual",
      },
      {
        id: "demo-contact-2",
        email: "billing@example.com",
        displayName: "Billing",
        frequency: 3,
        lastContactedAt: minutesAgo(40),
        source: "import",
      },
    ],
    autoReplySettings: {
      enabled: false,
      subject: "",
      bodyHtml: "",
      bodyText: "",
      startDate: null,
      endDate: null,
    },
    nextSeq: 2000,
    nextBlockedSenderId: 1,
  };
}

let demoState: DemoState = createInitialState();

export function resetDemoState(): void {
  demoState = createInitialState();
}

function folderKey(folder: string): string {
  const normalized = folder.trim().toLowerCase();
  if (normalized === "inbox") return "inbox";
  if (normalized === "sent" || normalized === "sent items" || normalized === "sent mail") return "sent";
  if (normalized === "draft" || normalized === "drafts") return "drafts";
  if (normalized === "archive" || normalized === "all mail") return "archive";
  if (normalized === "spam" || normalized === "junk") return "spam";
  if (normalized === "trash" || normalized === "bin") return "trash";
  if (normalized === "snoozed") return "snoozed";
  if (normalized === "scheduled" || normalized === "scheduled send" || normalized === "scheduled sends") return "scheduled";
  return normalized;
}

function hasFlag(message: DemoMessage, flag: string): boolean {
  return message.flags.some((value) => value.toLowerCase() === flag.toLowerCase());
}

function isInFolder(message: DemoMessage, folder: string): boolean {
  const target = folderKey(folder);
  return folderKey(message.folderPath || "INBOX") === target;
}

function isInPrimaryInbox(message: DemoMessage, excludedFlags: string[]): boolean {
  if (!isInFolder(message, "INBOX")) return false;
  if (excludedFlags.length === 0) return true;
  const excluded = excludedFlags.map((flag) => flag.toLowerCase());
  return !message.flags.some((flag) => excluded.includes(flag.toLowerCase()));
}

function listByFolder(folder = "INBOX"): DemoMessage[] {
  const normalized = folder.trim();
  const lower = normalized.toLowerCase();

  let filtered: DemoMessage[];
  if (lower === "starred") {
    filtered = demoState.messages.filter((message) => hasFlag(message, "\\Flagged"));
  } else if (lower === "important") {
    filtered = demoState.messages.filter((message) => hasFlag(message, "Important"));
  } else if (lower === "inbox:primary") {
    filtered = demoState.messages.filter((message) => isInPrimaryInbox(message, []));
  } else if (lower.startsWith("inbox:primary:")) {
    const excluded = normalized
      .slice("inbox:primary:".length)
      .split("|")
      .map((value) => value.trim())
      .filter(Boolean);
    filtered = demoState.messages.filter((message) => isInPrimaryInbox(message, excluded));
  } else if (lower.startsWith("label:")) {
    const label = normalized.slice(6).trim();
    filtered = demoState.messages.filter((message) => hasFlag(message, label));
  } else {
    filtered = demoState.messages.filter((message) => isInFolder(message, normalized));
  }

  return [...filtered].sort((a, b) => Date.parse(b.date) - Date.parse(a.date));
}

function toEmailMessage(message: DemoMessage): EmailMessage {
  return {
    id: message.id,
    seq: message.seq,
    subject: message.subject,
    from: message.from,
    fromAddress: message.fromAddress,
    to: message.to ? [...message.to] : undefined,
    cc: message.cc ? [...message.cc] : undefined,
    deliveredTo: message.deliveredTo ? [...message.deliveredTo] : undefined,
    date: message.date,
    flags: [...message.flags],
    snippet: message.snippet,
    hasAttachments: message.hasAttachments,
    threadId: message.threadId,
    messageCount: message.messageCount,
    unreadCount: message.unreadCount,
    participants: message.participants ? [...message.participants] : undefined,
    isNew: message.isNew,
    syncStatus: message.syncStatus,
    folderPath: message.folderPath,
    snoozedUntil: message.snoozedUntil,
    scheduledFor: message.scheduledFor,
    spamScore: message.spamScore,
  };
}

function toFullEmail(message: DemoMessage): FullEmail {
  return cloneMessage(message);
}

function parseSeq(input: string): number {
  return Number.parseInt(input, 10);
}

function getMessageBySeq(seq: string, folder?: string): DemoMessage | undefined {
  const value = parseSeq(seq);
  if (!Number.isFinite(value)) return undefined;
  const lowerFolder = folder ? folderKey(folder) : null;
  return demoState.messages.find((message) => {
    if (message.seq !== value) return false;
    if (!lowerFolder) return true;
    return folderKey(message.folderPath || "INBOX") === lowerFolder;
  });
}

function ensureSeenFlag(message: DemoMessage): void {
  if (!hasFlag(message, "\\Seen")) message.flags = [...message.flags, "\\Seen"];
}

function removeFlag(message: DemoMessage, flag: string): void {
  message.flags = message.flags.filter((value) => value.toLowerCase() !== flag.toLowerCase());
}

export async function demoRunSnoozeSweep(): Promise<void> {
  const nowIso = new Date().toISOString();
  for (const message of demoState.messages) {
    if (!message.snoozedUntil) continue;
    if (message.snoozedUntil <= nowIso) {
      message.snoozedUntil = undefined;
      message.folderPath = "INBOX";
    }
  }
}

export async function demoGetFolderCounts(
  folders: string[],
): Promise<Record<string, { unread: number; total: number }>> {
  const counts: Record<string, { unread: number; total: number }> = {};
  for (const folder of folders) {
    const items = listByFolder(folder);
    counts[folder] = {
      total: items.length,
      unread: items.filter((message) => !hasFlag(message, "\\Seen")).length,
    };
  }
  return counts;
}

export async function demoGetUnreadCountForSection(section: string): Promise<number> {
  return listByFolder(section).filter((message) => !hasFlag(message, "\\Seen")).length;
}

export async function demoFetchEmails(folder = "INBOX"): Promise<EmailMessage[]> {
  return listByFolder(folder).map(toEmailMessage);
}

export async function demoFetchEmailsPaginated(
  folder = "INBOX",
  page = 1,
  perPage = 50,
): Promise<{ emails: EmailMessage[]; total: number; nextCursor: string | null; hasMore: boolean }> {
  const all = listByFolder(folder);
  const safePage = Math.max(1, page);
  const safePerPage = Math.max(1, perPage);
  const start = (safePage - 1) * safePerPage;
  const pageItems = all.slice(start, start + safePerPage);

  return {
    emails: pageItems.map(toEmailMessage),
    total: all.length,
    nextCursor: null,
    hasMore: start + pageItems.length < all.length,
  };
}

export async function demoFetchThreadsPaginated(
  folder = "INBOX",
  page = 1,
  perPage = 50,
): Promise<{ emails: EmailMessage[]; total: number; nextCursor: string | null; hasMore: boolean }> {
  const source = listByFolder(folder);
  const grouped = new Map<string, DemoMessage[]>();

  for (const message of source) {
    const key = message.threadId || `solo-${message.seq}`;
    const bucket = grouped.get(key);
    if (bucket) bucket.push(message);
    else grouped.set(key, [message]);
  }

  const threads = Array.from(grouped.entries())
    .map(([threadId, messages]) => {
      const latest = [...messages].sort((a, b) => Date.parse(b.date) - Date.parse(a.date))[0];
      const unreadCount = messages.filter((message) => !hasFlag(message, "\\Seen")).length;
      const participants = Array.from(
        new Set(messages.map((message) => message.from).filter(Boolean)),
      );
      return {
        ...latest,
        threadId: threadId.startsWith("solo-") ? undefined : threadId,
        messageCount: messages.length,
        unreadCount,
        participants,
      };
    })
    .sort((a, b) => Date.parse(b.date) - Date.parse(a.date));

  const safePage = Math.max(1, page);
  const safePerPage = Math.max(1, perPage);
  const start = (safePage - 1) * safePerPage;
  const pageItems = threads.slice(start, start + safePerPage);

  return {
    emails: pageItems.map(toEmailMessage),
    total: threads.length,
    nextCursor: null,
    hasMore: start + pageItems.length < threads.length,
  };
}

export async function demoGetEmail(seq: string, folder = "INBOX"): Promise<FullEmail | null> {
  const message = getMessageBySeq(seq, folder) || getMessageBySeq(seq);
  return message ? toFullEmail(message) : null;
}

export async function demoSearchEmails(query: string, folder = "INBOX"): Promise<EmailMessage[]> {
  const term = query.trim().toLowerCase();
  if (!term) return demoFetchEmails(folder);

  const source = listByFolder(folder);
  return source
    .filter((message) => {
      const haystack = [
        message.subject,
        message.from,
        message.fromAddress,
        message.snippet,
        message.text,
        message.html,
      ]
        .filter(Boolean)
        .join("\n")
        .toLowerCase();
      return haystack.includes(term);
    })
    .map(toEmailMessage);
}

export async function demoFetchSentContacts(): Promise<string[]> {
  return demoState.contacts.map((contact) => contact.email);
}

export async function demoFetchAllContacts(): Promise<ContactEntry[]> {
  return demoState.contacts.map((contact) => ({ ...contact }));
}

export async function demoAddContactToDb(email: string, displayName?: string): Promise<void> {
  const normalized = email.trim().toLowerCase();
  if (!normalized) return;

  const existing = demoState.contacts.find((contact) => contact.email.toLowerCase() === normalized);
  if (existing) {
    existing.displayName = displayName?.trim() || existing.displayName;
    existing.lastContactedAt = new Date().toISOString();
    existing.frequency = Math.max(1, existing.frequency);
    return;
  }

  demoState.contacts.unshift({
    id: `demo-contact-${demoState.nextSeq}`,
    email: normalized,
    displayName: displayName?.trim() || null,
    frequency: 1,
    lastContactedAt: new Date().toISOString(),
    source: "manual",
  });
}

export async function demoDeleteContact(contactId: string): Promise<void> {
  const idx = demoState.contacts.findIndex((contact) => contact.id === contactId);
  if (idx >= 0) demoState.contacts.splice(idx, 1);
}

export async function demoMarkAsRead(seq: string, folder = "INBOX"): Promise<void> {
  const message = getMessageBySeq(seq, folder) || getMessageBySeq(seq);
  if (!message) return;
  ensureSeenFlag(message);
}

export async function demoMarkAsUnread(seq: string, folder = "INBOX"): Promise<void> {
  const message = getMessageBySeq(seq, folder) || getMessageBySeq(seq);
  if (!message) return;
  removeFlag(message, "\\Seen");
}

export async function demoToggleStar(seq: string, starred: boolean, folder = "INBOX"): Promise<void> {
  const message = getMessageBySeq(seq, folder) || getMessageBySeq(seq);
  if (!message) return;
  if (starred) {
    if (!hasFlag(message, "\\Flagged")) message.flags = [...message.flags, "\\Flagged"];
    return;
  }
  removeFlag(message, "\\Flagged");
}

export async function demoDeleteEmail(seq: string, currentFolder = "INBOX"): Promise<void> {
  const message = getMessageBySeq(seq, currentFolder) || getMessageBySeq(seq);
  if (!message) return;
  const current = folderKey(message.folderPath || "INBOX");
  if (current === "trash") {
    demoState.messages = demoState.messages.filter((entry) => entry.seq !== message.seq);
    return;
  }
  message.folderPath = "Trash";
}

export async function demoDeleteEmailsBatch(seqs: string[], currentFolder = "INBOX"): Promise<void> {
  await Promise.all(seqs.map((seq) => demoDeleteEmail(seq, currentFolder)));
}

export async function demoArchiveEmails(seqs: string[], currentFolder = "INBOX"): Promise<void> {
  for (const seq of seqs) {
    const message = getMessageBySeq(seq, currentFolder) || getMessageBySeq(seq);
    if (message) message.folderPath = "Archive";
  }
}

export async function demoAddEmailLabel(seq: string, label: string, folder = "INBOX"): Promise<void> {
  const message = getMessageBySeq(seq, folder) || getMessageBySeq(seq);
  if (!message) return;
  if (!hasFlag(message, label)) message.flags = [...message.flags, label];
}

export async function demoRemoveEmailLabel(seq: string, label: string, folder = "INBOX"): Promise<void> {
  const message = getMessageBySeq(seq, folder) || getMessageBySeq(seq);
  if (!message) return;
  removeFlag(message, label);
}

export async function demoCancelScheduledEmail(seq: string): Promise<void> {
  const message = getMessageBySeq(seq, "Scheduled") || getMessageBySeq(seq);
  if (!message) return;
  demoState.messages = demoState.messages.filter((entry) => entry.seq !== message.seq);
}

export async function demoCancelScheduledEmails(seqs: string[]): Promise<void> {
  await Promise.all(seqs.map((seq) => demoCancelScheduledEmail(seq)));
}

export async function demoSendEmail(
  to: string,
  subject: string,
  body: string,
  cc?: string,
  bcc?: string,
  attachments?: EmailAttachment[],
  threading?: { inReplyTo?: string; references?: string[] },
  fromName?: string,
  options?: SendEmailOptions,
): Promise<SendEmailResult> {
  const scheduledAt = options?.scheduledAt ? new Date(options.scheduledAt) : null;
  const seq = demoState.nextSeq;
  demoState.nextSeq += 1;

  const parsedTo = to
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);
  const parsedCc = (cc || "")
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);
  const parsedBcc = (bcc || "")
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);

  const message: DemoMessage = {
    id: seq,
    seq,
    subject: subject || "(No Subject)",
    from: fromName?.trim() || "You",
    fromAddress: DEMO_USER_EMAIL,
    to: parsedTo,
    cc: parsedCc,
    bcc: parsedBcc,
    date: (scheduledAt && Number.isFinite(scheduledAt.getTime()) ? scheduledAt : new Date()).toISOString(),
    flags: ["\\Seen"],
    snippet: body.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().slice(0, 180),
    hasAttachments: Boolean(attachments && attachments.length > 0),
    folderPath: "Sent",
    html: body,
    text: body.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim(),
    accountEmail: DEMO_USER_EMAIL,
    messageId: `<demo-${seq}@homerow.dev>`,
    inReplyTo: threading?.inReplyTo,
    references: threading?.references,
  };

  if (scheduledAt && Number.isFinite(scheduledAt.getTime()) && scheduledAt.getTime() > Date.now()) {
    message.folderPath = "Scheduled";
    message.scheduledFor = scheduledAt.toISOString();
    message.flags.push("__scheduled");
    demoState.messages.push(message);
    return { status: "scheduled", scheduledFor: scheduledAt.toISOString() };
  }

  demoState.messages.push(message);
  return { status: "sent" };
}

export async function demoSaveDraft(
  to: string,
  subject: string,
  body: string,
  cc?: string,
  bcc?: string,
): Promise<void> {
  const parsedTo = to
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);
  const parsedCc = (cc || "")
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);
  const parsedBcc = (bcc || "")
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);

  const draft = demoState.messages.find(
    (message) =>
      folderKey(message.folderPath || "INBOX") === "drafts" &&
      hasFlag(message, "\\Draft") &&
      (message.fromAddress || "").toLowerCase() === DEMO_USER_EMAIL.toLowerCase(),
  );

  if (draft) {
    draft.to = parsedTo;
    draft.cc = parsedCc;
    draft.bcc = parsedBcc;
    draft.subject = subject || "(No Subject)";
    draft.html = body;
    draft.text = body.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
    draft.snippet = draft.text.slice(0, 180);
    draft.date = new Date().toISOString();
    return;
  }

  const seq = demoState.nextSeq;
  demoState.nextSeq += 1;
  const text = body.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
  demoState.messages.push({
    id: seq,
    seq,
    subject: subject || "(No Subject)",
    from: "You",
    fromAddress: DEMO_USER_EMAIL,
    to: parsedTo,
    cc: parsedCc,
    bcc: parsedBcc,
    date: new Date().toISOString(),
    flags: ["\\Seen", "\\Draft"],
    snippet: text.slice(0, 180),
    hasAttachments: false,
    folderPath: "Drafts",
    html: body,
    text,
    accountEmail: DEMO_USER_EMAIL,
    messageId: `<demo-draft-${seq}@homerow.dev>`,
  });
}

export async function demoGetThreadMessages(threadId: string): Promise<FullEmail[]> {
  return demoState.messages
    .filter((message) => message.threadId === threadId)
    .sort((a, b) => Date.parse(a.date) - Date.parse(b.date))
    .map(toFullEmail);
}

export async function demoGetThreadIdForMessage(uid: number, folder: string): Promise<string | null> {
  const message = getMessageBySeq(String(uid), folder) || getMessageBySeq(String(uid));
  return message?.threadId || null;
}

export async function demoSnoozeEmails(
  seqs: string[],
  currentFolder = "INBOX",
  untilISO: string,
): Promise<void> {
  for (const seq of seqs) {
    const message = getMessageBySeq(seq, currentFolder) || getMessageBySeq(seq);
    if (!message) continue;
    message.folderPath = "Snoozed";
    message.snoozedUntil = untilISO;
    ensureSeenFlag(message);
  }
}

export async function demoMoveToFolder(seq: string, fromFolder: string, toFolder: string): Promise<void> {
  const message = getMessageBySeq(seq, fromFolder) || getMessageBySeq(seq);
  if (!message) return;
  message.folderPath = toFolder;
  if (folderKey(toFolder) !== "snoozed") {
    message.snoozedUntil = undefined;
  }
}

export async function demoRestoreFromTrash(seq: string): Promise<string> {
  const message = getMessageBySeq(seq, "Trash") || getMessageBySeq(seq);
  if (!message) return "Inbox";
  message.folderPath = "INBOX";
  return "Inbox";
}

export async function demoGetBlockedSenders(): Promise<BlockedSender[]> {
  return demoState.blockedSenders.map((entry) => ({ ...entry }));
}

export async function demoBlockSender(senderEmail: string, displayName: string): Promise<void> {
  const normalized = senderEmail.trim().toLowerCase();
  if (!normalized) return;
  const existing = demoState.blockedSenders.find((sender) => sender.senderEmail === normalized);
  if (existing) {
    existing.displayName = displayName?.trim() || null;
    existing.blockedAt = new Date().toISOString();
    return;
  }

  demoState.blockedSenders.unshift({
    id: demoState.nextBlockedSenderId,
    senderEmail: normalized,
    displayName: displayName?.trim() || null,
    blockedAt: new Date().toISOString(),
  });
  demoState.nextBlockedSenderId += 1;
}

export async function demoUnblockSender(senderEmail: string): Promise<void> {
  const normalized = senderEmail.trim().toLowerCase();
  demoState.blockedSenders = demoState.blockedSenders.filter(
    (sender) => sender.senderEmail !== normalized,
  );
}

export async function demoGetAutoReplySettings(): Promise<AutoReplySettings> {
  return { ...demoState.autoReplySettings };
}

export async function demoSaveAutoReplySettings(settings: AutoReplySettings): Promise<void> {
  demoState.autoReplySettings = { ...settings };
}
