import {
  demoAddContactToDb,
  demoAddEmailLabel,
  demoArchiveEmails,
  demoBlockSender,
  demoCancelScheduledEmail,
  demoCancelScheduledEmails,
  demoDeleteContact,
  demoDeleteEmail,
  demoDeleteEmailsBatch,
  demoFetchAllContacts,
  demoFetchEmails,
  demoFetchEmailsPaginated,
  demoFetchSentContacts,
  demoFetchThreadsPaginated,
  demoGetAutoReplySettings,
  demoGetBlockedSenders,
  demoGetEmail,
  demoGetFolderCounts,
  demoGetThreadIdForMessage,
  demoGetThreadMessages,
  demoGetUnreadCountForSection,
  demoMarkAsRead,
  demoMarkAsUnread,
  demoMoveToFolder,
  demoRemoveEmailLabel,
  demoRestoreFromTrash,
  demoRunSnoozeSweep,
  demoSaveAutoReplySettings,
  demoSaveDraft,
  demoSearchEmails,
  demoSendEmail,
  demoSnoozeEmails,
  demoToggleStar,
  demoUnblockSender,
} from "./demo-mail-data";
import { isDemoModeEnabled, isDemoStaticModeEnabled } from "./demo-mode";

export type MessageSyncStatus = "staged" | "imap_syncing" | "imap_synced" | "sync_error";

export interface EmailMessage {
  id: number;
  seq: number;
  subject: string;
  from: string;
  fromAddress?: string;
  to?: string[];
  cc?: string[];
  deliveredTo?: string[];
  date: string;
  flags: string[];
  snippet?: string;
  hasAttachments?: boolean;
  threadId?: string;
  messageCount?: number;
  unreadCount?: number;
  participants?: string[];
  isNew?: boolean;
  syncStatus?: MessageSyncStatus;
  folderPath?: string;
  snoozedUntil?: string;
  scheduledFor?: string;
  spamScore?: number;
}

export interface ReceivedEmailAttachment {
  id: string;
  filename: string;
  contentType?: string;
  sizeBytes?: number;
}

export interface FullEmail extends EmailMessage {
  html?: string;
  text?: string;
  to?: string[];
  cc?: string[];
  bcc?: string[];
  replyTo?: string[];
  fromAddress?: string;
  accountEmail?: string;
  folderPath?: string;
  messageId?: string;
  inReplyTo?: string;
  references?: string[];
  attachments?: ReceivedEmailAttachment[];
}

export interface ContactEntry {
  id: string;
  email: string;
  displayName: string | null;
  frequency: number;
  lastContactedAt: string | null;
  source: string;
}

export interface EmailAttachment {
  filename: string;
  contentType: string;
  content: string;
  cid?: string;
  contentDisposition?: "attachment" | "inline";
}

export interface SendEmailOptions {
  scheduledAt?: Date | string | null;
}

export type SendEmailResult =
  | { status: "sent" }
  | { status: "scheduled"; scheduledFor: string };

export interface BlockedSender {
  id: number;
  senderEmail: string;
  displayName: string | null;
  blockedAt: string;
}

export interface AutoReplySettings {
  enabled: boolean;
  subject: string;
  bodyHtml: string;
  bodyText: string;
  startDate: string | null;
  endDate: string | null;
}

export type DestinationMatchType = "exact" | "contains" | "regex";
export type DestinationTargetField =
  | "destinationAddress"
  | "destinationLocalPart"
  | "destinationPlusTag"
  | "originAddress"
  | "originLocalPart"
  | "emailSubject";
export type LabelResolutionMode = "fixed" | "template";

export interface AutomationLabelRule {
  id: string;
  enabled: boolean;
  priority: number;
  targetField: DestinationTargetField;
  matchType: DestinationMatchType;
  pattern: string;
  caseSensitive: boolean;
  labelMode: LabelResolutionMode;
  labelName: string;
  labelTemplate: string;
}

export interface AutomationWebhookRule {
  id: string;
  enabled: boolean;
  priority: number;
  targetField: DestinationTargetField;
  matchType: DestinationMatchType;
  pattern: string;
  caseSensitive: boolean;
  endpointUrl: string;
}

export interface AutomationRulesPayload {
  labelRules: AutomationLabelRule[];
  webhookRules: AutomationWebhookRule[];
  labelSettings: {
    stopAfterFirstMatch: boolean;
    autoCreateLabelsFromTemplate: boolean;
  };
  webhookSettings: {
    stopAfterFirstMatch: boolean;
  };
}

export interface WebhookDeliveryHistoryItem {
  id: number;
  createdAt: string;
  endpointUrl: string;
  status: "success" | "http_error" | "network_error";
  httpStatus: number | null;
  errorMessage: string | null;
  responsePreview: string | null;
  requestBodyPreview: string;
  folder: string;
  ruleId: string;
  rulePriority: number;
  targetField: string;
  matchType: string;
  matchedValue: string;
  emailSubject: string;
  emailFromAddress: string | null;
}

type ServerMailClient = typeof import("./mail-client");
let serverMailClientPromise: Promise<ServerMailClient> | null = null;

function useStaticDemoClient(): boolean {
  return isDemoModeEnabled() && isDemoStaticModeEnabled();
}

async function getServerMailClient(): Promise<ServerMailClient> {
  if (!serverMailClientPromise) {
    serverMailClientPromise = import("./mail-client");
  }
  return serverMailClientPromise;
}

export async function runSnoozeSweep(): Promise<void> {
  if (useStaticDemoClient()) return demoRunSnoozeSweep();
  const server = await getServerMailClient();
  return server.runSnoozeSweep();
}

export async function getFolderCounts(folders: string[]): Promise<Record<string, { unread: number; total: number }>> {
  if (useStaticDemoClient()) return demoGetFolderCounts(folders);
  const server = await getServerMailClient();
  return server.getFolderCounts(folders);
}

export async function getUnreadCountForSection(section: string): Promise<number> {
  if (useStaticDemoClient()) return demoGetUnreadCountForSection(section);
  const server = await getServerMailClient();
  return server.getUnreadCountForSection(section);
}

export async function fetchEmails(folder = "INBOX"): Promise<EmailMessage[]> {
  if (useStaticDemoClient()) return demoFetchEmails(folder);
  const server = await getServerMailClient();
  return server.fetchEmails(folder);
}

export async function fetchEmailsPaginated(
  folder = "INBOX",
  page = 1,
  perPage = 50,
): Promise<{ emails: EmailMessage[]; total: number; nextCursor: string | null; hasMore: boolean }> {
  if (useStaticDemoClient()) return demoFetchEmailsPaginated(folder, page, perPage);
  const server = await getServerMailClient();
  return server.fetchEmailsPaginated(folder, page, perPage);
}

export async function fetchThreadsPaginated(
  folder = "INBOX",
  page = 1,
  perPage = 50,
): Promise<{ emails: EmailMessage[]; total: number; nextCursor: string | null; hasMore: boolean }> {
  if (useStaticDemoClient()) return demoFetchThreadsPaginated(folder, page, perPage);
  const server = await getServerMailClient();
  return server.fetchThreadsPaginated(folder, page, perPage);
}

export async function getEmail(seq: string, folder = "INBOX"): Promise<FullEmail | null> {
  if (useStaticDemoClient()) return demoGetEmail(seq, folder);
  const server = await getServerMailClient();
  return server.getEmail(seq, folder);
}

export async function searchEmails(query: string, folder = "INBOX"): Promise<EmailMessage[]> {
  if (useStaticDemoClient()) return demoSearchEmails(query, folder);
  const server = await getServerMailClient();
  return server.searchEmails(query, folder);
}

export async function fetchSentContacts(): Promise<string[]> {
  if (useStaticDemoClient()) return demoFetchSentContacts();
  const server = await getServerMailClient();
  return server.fetchSentContacts();
}

export async function fetchAllContacts(): Promise<ContactEntry[]> {
  if (useStaticDemoClient()) return demoFetchAllContacts();
  const server = await getServerMailClient();
  return server.fetchAllContacts();
}

export async function addContactToDb(email: string, displayName?: string): Promise<void> {
  if (useStaticDemoClient()) return demoAddContactToDb(email, displayName);
  const server = await getServerMailClient();
  return server.addContactToDb(email, displayName);
}

export async function deleteContact(contactId: string): Promise<void> {
  if (useStaticDemoClient()) return demoDeleteContact(contactId);
  const server = await getServerMailClient();
  return server.deleteContact(contactId);
}

export async function markAsRead(seq: string, folder = "INBOX"): Promise<void> {
  if (useStaticDemoClient()) return demoMarkAsRead(seq, folder);
  const server = await getServerMailClient();
  return server.markAsRead(seq, folder);
}

export async function markAsUnread(seq: string, folder = "INBOX"): Promise<void> {
  if (useStaticDemoClient()) return demoMarkAsUnread(seq, folder);
  const server = await getServerMailClient();
  return server.markAsUnread(seq, folder);
}

export async function toggleStar(seq: string, starred: boolean, folder = "INBOX"): Promise<void> {
  if (useStaticDemoClient()) return demoToggleStar(seq, starred, folder);
  const server = await getServerMailClient();
  return server.toggleStar(seq, starred, folder);
}

export async function deleteEmail(seq: string, currentFolder = "INBOX"): Promise<void> {
  if (useStaticDemoClient()) return demoDeleteEmail(seq, currentFolder);
  const server = await getServerMailClient();
  return server.deleteEmail(seq, currentFolder);
}

export async function deleteEmailsBatch(seqs: string[], currentFolder = "INBOX"): Promise<void> {
  if (useStaticDemoClient()) return demoDeleteEmailsBatch(seqs, currentFolder);
  const server = await getServerMailClient();
  return server.deleteEmailsBatch(seqs, currentFolder);
}

export async function archiveEmails(seqs: string[], currentFolder = "INBOX"): Promise<void> {
  if (useStaticDemoClient()) return demoArchiveEmails(seqs, currentFolder);
  const server = await getServerMailClient();
  return server.archiveEmails(seqs, currentFolder);
}

export async function addEmailLabel(seq: string, label: string, folder = "INBOX"): Promise<void> {
  if (useStaticDemoClient()) return demoAddEmailLabel(seq, label, folder);
  const server = await getServerMailClient();
  return server.addEmailLabel(seq, label, folder);
}

export async function removeEmailLabel(seq: string, label: string, folder = "INBOX"): Promise<void> {
  if (useStaticDemoClient()) return demoRemoveEmailLabel(seq, label, folder);
  const server = await getServerMailClient();
  return server.removeEmailLabel(seq, label, folder);
}

export async function cancelScheduledEmail(seq: string): Promise<void> {
  if (useStaticDemoClient()) return demoCancelScheduledEmail(seq);
  const server = await getServerMailClient();
  return server.cancelScheduledEmail(seq);
}

export async function cancelScheduledEmails(seqs: string[]): Promise<void> {
  if (useStaticDemoClient()) return demoCancelScheduledEmails(seqs);
  const server = await getServerMailClient();
  return server.cancelScheduledEmails(seqs);
}

export async function sendEmail(
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
  if (useStaticDemoClient()) {
    return demoSendEmail(to, subject, body, cc, bcc, attachments, threading, fromName, options);
  }
  const server = await getServerMailClient();
  return server.sendEmail(to, subject, body, cc, bcc, attachments, threading, fromName, options);
}

export async function getThreadMessages(threadId: string): Promise<FullEmail[]> {
  if (useStaticDemoClient()) return demoGetThreadMessages(threadId);
  const server = await getServerMailClient();
  return server.getThreadMessages(threadId);
}

export async function getThreadIdForMessage(uid: number, folder: string): Promise<string | null> {
  if (useStaticDemoClient()) return demoGetThreadIdForMessage(uid, folder);
  const server = await getServerMailClient();
  return server.getThreadIdForMessage(uid, folder);
}

export async function saveDraft(to: string, subject: string, body: string, cc?: string, bcc?: string): Promise<void> {
  if (useStaticDemoClient()) return demoSaveDraft(to, subject, body, cc, bcc);
  const server = await getServerMailClient();
  return server.saveDraft(to, subject, body, cc, bcc);
}

export async function snoozeEmails(
  seqs: string[],
  currentFolder = "INBOX",
  untilISO: string,
): Promise<void> {
  if (useStaticDemoClient()) return demoSnoozeEmails(seqs, currentFolder, untilISO);
  const server = await getServerMailClient();
  return server.snoozeEmails(seqs, currentFolder, untilISO);
}

export async function moveToFolder(seq: string, fromFolder: string, toFolder: string): Promise<void> {
  if (useStaticDemoClient()) return demoMoveToFolder(seq, fromFolder, toFolder);
  const server = await getServerMailClient();
  return server.moveToFolder(seq, fromFolder, toFolder);
}

export async function restoreFromTrash(seq: string, folder = "Trash"): Promise<string> {
  if (useStaticDemoClient()) return demoRestoreFromTrash(seq) || folder;
  const server = await getServerMailClient();
  return server.restoreFromTrash(seq, folder);
}

export async function getBlockedSenders(): Promise<BlockedSender[]> {
  if (useStaticDemoClient()) return demoGetBlockedSenders();
  const server = await getServerMailClient();
  return server.getBlockedSenders();
}

export async function blockSender(senderEmail: string, displayName: string): Promise<void> {
  if (useStaticDemoClient()) return demoBlockSender(senderEmail, displayName);
  const server = await getServerMailClient();
  return server.blockSender(senderEmail, displayName);
}

export async function unblockSender(senderEmail: string): Promise<void> {
  if (useStaticDemoClient()) return demoUnblockSender(senderEmail);
  const server = await getServerMailClient();
  return server.unblockSender(senderEmail);
}

export function shouldResetAutoReplyDedup(wasEnabled: boolean, nextEnabled: boolean): boolean {
  return !wasEnabled && nextEnabled;
}

export async function getAutoReplySettings(): Promise<AutoReplySettings> {
  if (useStaticDemoClient()) return demoGetAutoReplySettings();
  const server = await getServerMailClient();
  return server.getAutoReplySettings();
}

export async function saveAutoReplySettings(settings: AutoReplySettings): Promise<void> {
  if (useStaticDemoClient()) return demoSaveAutoReplySettings(settings);
  const server = await getServerMailClient();
  return server.saveAutoReplySettings(settings);
}

export async function getAutomationRules(): Promise<AutomationRulesPayload> {
  if (useStaticDemoClient()) {
    return {
      labelRules: [],
      webhookRules: [],
      labelSettings: { stopAfterFirstMatch: false, autoCreateLabelsFromTemplate: true },
      webhookSettings: { stopAfterFirstMatch: false },
    };
  }
  const server = await getServerMailClient();
  return server.getAutomationRules();
}

export async function saveAutomationRules(payload: AutomationRulesPayload): Promise<void> {
  if (useStaticDemoClient()) return;
  const server = await getServerMailClient();
  return server.saveAutomationRules(payload);
}

export async function getWebhookDeliveryHistory(limit = 100): Promise<WebhookDeliveryHistoryItem[]> {
  if (useStaticDemoClient()) return [];
  const server = await getServerMailClient();
  return server.getWebhookDeliveryHistory(limit);
}

export async function clearWebhookDeliveryHistory(): Promise<void> {
  if (useStaticDemoClient()) return;
  const server = await getServerMailClient();
  return server.clearWebhookDeliveryHistory();
}
