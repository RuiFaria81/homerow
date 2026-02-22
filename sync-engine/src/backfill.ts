// ---------------------------------------------------------------------------
// Backfill — initial sync from IMAP into PostgreSQL.
//
// Strategy:
//   1. Fetch folder list from IMAP.
//   2. For each folder, compare UIDVALIDITY. If changed, nuke local cache.
//   3. Fetch messages in batches (newest-first) using UID ranges.
//   4. Parse each message and insert into DB.
//   5. After the first batch is done, the UI can already render.
// ---------------------------------------------------------------------------

import { ImapFlow, MailboxObject } from 'imapflow';
import type { Config } from './config.js';
import { query, queryOne, transaction } from './db.js';
import { log } from './logger.js';
import { parseEmail, storeAttachment } from './parser.js';
import { assignThread } from './threading.js';
import { RateLimitedQueue } from './queue.js';
import type pg from 'pg';

// ---------------------------------------------------------------------------
// Folder sync
// ---------------------------------------------------------------------------

interface ImapMailbox {
  path: string;
  name: string;
  delimiter: string;
  flags: Set<string>;
  specialUse?: string;
}

function isSameUidValidity(
  dbValue: string | number | null | undefined,
  serverValue: string | number | null | undefined,
): boolean {
  if (dbValue === null || dbValue === undefined || serverValue === null || serverValue === undefined) {
    return false;
  }
  return String(dbValue).trim() === String(serverValue).trim();
}

export async function syncFolders(
  client: ImapFlow,
  accountId: string,
): Promise<void> {
  const mailboxes = await client.list();
  log.info('Fetched IMAP folder list', { count: mailboxes.length });

  for (const mb of mailboxes) {
    const specialUse = (mb as any).specialUse || guessSpecialUse(mb.path);
    const flags = mb.flags ? Array.from(mb.flags) : [];

    await query(
      `INSERT INTO folders (account_id, path, name, delimiter, flags, special_use)
       VALUES ($1, $2, $3, $4, $5::jsonb, $6)
       ON CONFLICT (account_id, path) DO UPDATE SET
         name       = EXCLUDED.name,
         delimiter  = EXCLUDED.delimiter,
         flags      = EXCLUDED.flags,
         special_use= COALESCE(EXCLUDED.special_use, folders.special_use),
         updated_at = now()`,
      [accountId, mb.path, mb.name, mb.delimiter, JSON.stringify(flags), specialUse],
    );
  }

  // Remove folders that no longer exist on the server
  const serverPaths = mailboxes.map((m) => m.path);
  if (serverPaths.length > 0) {
    const placeholders = serverPaths.map((_, i) => `$${i + 2}`).join(',');
    await query(
      `DELETE FROM folders WHERE account_id = $1 AND path NOT IN (${placeholders})`,
      [accountId, ...serverPaths],
    );
  }
}

function guessSpecialUse(path: string): string | null {
  const lower = path.toLowerCase();
  const map: Record<string, string> = {
    inbox: '\\Inbox',
    sent: '\\Sent',
    drafts: '\\Drafts',
    trash: '\\Trash',
    junk: '\\Junk',
    spam: '\\Junk',
    archive: '\\Archive',
  };
  return map[lower] ?? null;
}

// ---------------------------------------------------------------------------
// Message backfill for a single folder
// ---------------------------------------------------------------------------

export async function backfillFolder(
  client: ImapFlow,
  accountId: string,
  folderPath: string,
  batchSize: number,
  attachmentDir: string,
  queue: RateLimitedQueue,
): Promise<void> {
  // Mark folder as syncing
  await query(
    `UPDATE folders SET sync_state = 'syncing', updated_at = now()
     WHERE account_id = $1 AND path = $2`,
    [accountId, folderPath],
  );

  const lock = await client.getMailboxLock(folderPath);

  try {
    const mailbox = client.mailbox;
    if (!mailbox) {
      log.warn('Could not open mailbox', { folder: folderPath });
      return;
    }

    // ImapFlow may expose these as bigint; normalize to number for DB/log JSON.
    const serverUidValidity = Number(mailbox.uidValidity);
    const serverUidNext = Number(mailbox.uidNext);
    const totalMessages = mailbox.exists;

    // Get stored folder state
    const folder = await queryOne<{
      id: string;
      uid_validity: string | number | null;
      uid_next: number | null;
    }>(
      `SELECT id, uid_validity, uid_next FROM folders
       WHERE account_id = $1 AND path = $2`,
      [accountId, folderPath],
    );

    if (!folder) {
      log.error('Folder not found in DB', { folder: folderPath });
      return;
    }

    // -----------------------------------------------------------------------
    // UIDVALIDITY check — if changed, the server has reset. Nuke local cache.
    // -----------------------------------------------------------------------
    const sameUidValidity = isSameUidValidity(folder.uid_validity, serverUidValidity);
    if (folder.uid_validity !== null && !sameUidValidity) {
      log.warn('UIDVALIDITY changed — resyncing folder', {
        folder: folderPath,
        old: folder.uid_validity,
        new: serverUidValidity,
      });
      await nukeFolder(folder.id, accountId);

      await query(
        `INSERT INTO sync_log (account_id, folder_id, event_type, details)
         VALUES ($1, $2, 'uid_reset', $3::jsonb)`,
        [
          accountId,
          folder.id,
          JSON.stringify({
            oldValidity: folder.uid_validity,
            newValidity: serverUidValidity,
          }),
        ],
      );
    }

    // Update UIDVALIDITY
    await query(
      `UPDATE folders SET uid_validity = $2, total_messages = $3, updated_at = now()
       WHERE id = $1`,
      [folder.id, serverUidValidity, totalMessages],
    );

    // Determine what we need to fetch
    // folders.uid_next stores the next UID, so last synced UID is uid_next - 1.
    const lastSyncedUid = sameUidValidity
      ? Math.max((folder.uid_next ?? 1) - 1, 0)
      : 0;

    if (totalMessages === 0) {
      log.info('Folder is empty, nothing to sync', { folder: folderPath });
      await markFolderSynced(folder.id, serverUidNext);
      return;
    }

    // Fetch in batches, newest first (highest UID first)
    // Use UID FETCH with ranges
    const uidRange = lastSyncedUid > 0
      ? `${lastSyncedUid + 1}:*`   // Incremental: only new messages
      : '1:*';                   // Full backfill

    log.info('Starting backfill', {
      folder: folderPath,
      uidRange,
      totalMessages,
      incremental: lastSyncedUid > 0,
    });

    await query(
      `INSERT INTO sync_log (account_id, folder_id, event_type, details)
       VALUES ($1, $2, 'backfill_start', $3::jsonb)`,
      [
        accountId,
        folder.id,
        JSON.stringify({ uidRange, totalMessages }),
      ],
    );

    let synced = 0;
    const batchBuffer: Array<{
      uid: number;
      source: Buffer;
      flags: Set<string>;
    }> = [];

    for await (const msg of client.fetch(uidRange, {
      source: true,
      flags: true,
      uid: true,
      envelope: true,
    })) {
      // Skip messages we already have (for incremental syncs, the range may
      // include the last UID we already stored)
      if (lastSyncedUid > 0 && msg.uid <= lastSyncedUid) continue;

      batchBuffer.push({
        uid: msg.uid,
        source: msg.source as Buffer,
        flags: msg.flags || new Set(),
      });

      // Process in batches
      if (batchBuffer.length >= batchSize) {
        await queue.run(() =>
          processBatch(batchBuffer.splice(0), accountId, folder.id, attachmentDir),
        );
        synced += batchSize;
        log.info('Backfill progress', {
          folder: folderPath,
          synced,
          total: totalMessages,
        });
      }
    }

    // Process remaining messages
    if (batchBuffer.length > 0) {
      await queue.run(() =>
        processBatch(batchBuffer, accountId, folder.id, attachmentDir),
      );
      synced += batchBuffer.length;
    }

    await markFolderSynced(folder.id, serverUidNext);
    await updateFolderCounts(folder.id);

    log.info('Backfill complete', { folder: folderPath, synced });

    await query(
      `INSERT INTO sync_log (account_id, folder_id, event_type, details)
       VALUES ($1, $2, 'backfill_complete', $3::jsonb)`,
      [accountId, folder.id, JSON.stringify({ synced })],
    );
  } catch (err) {
    log.error('Backfill failed', {
      folder: folderPath,
      error: String(err),
    });
    await query(
      `UPDATE folders SET sync_state = 'error', updated_at = now()
       WHERE account_id = $1 AND path = $2`,
      [accountId, folderPath],
    );
    throw err;
  } finally {
    lock.release();
  }
}

// ---------------------------------------------------------------------------
// Process a batch of raw messages
// ---------------------------------------------------------------------------

async function processBatch(
  batch: Array<{ uid: number; source: Buffer; flags: Set<string> }>,
  accountId: string,
  folderId: string,
  attachmentDir: string,
): Promise<void> {
  for (const msg of batch) {
    try {
      const parsed = await parseEmail(msg.source);
      const flags = Array.from(msg.flags);

      // Assign to thread
      const threadId = await assignThread(
        accountId,
        parsed.messageId,
        parsed.inReplyTo,
        parsed.references,
        parsed.subject,
        parsed.from,
        parsed.date,
        parsed.hasAttachments,
        parsed.snippet,
      );

      // Insert message
      const inserted = await queryOne<{ id: string }>(
        `INSERT INTO messages (
           account_id, folder_id, thread_id, uid, message_id,
           in_reply_to, "references", subject, from_address,
           to_addresses, cc_addresses, bcc_addresses, reply_to,
           date, flags, text_body, html_body, snippet, headers,
           has_attachments, size_bytes, spam_score
         ) VALUES (
           $1, $2, $3, $4, $5,
           $6, $7, $8, $9,
           $10, $11, $12, $13,
           $14, $15, $16, $17, $18, $19,
           $20, $21, $22
         )
         ON CONFLICT (folder_id, uid) DO UPDATE SET
           thread_id  = EXCLUDED.thread_id,
           message_id = EXCLUDED.message_id,
           in_reply_to = EXCLUDED.in_reply_to,
           "references" = EXCLUDED."references",
           subject = EXCLUDED.subject,
           from_address = EXCLUDED.from_address,
           to_addresses = EXCLUDED.to_addresses,
           cc_addresses = EXCLUDED.cc_addresses,
           bcc_addresses = EXCLUDED.bcc_addresses,
           reply_to = EXCLUDED.reply_to,
           date = EXCLUDED.date,
           flags = EXCLUDED.flags,
           text_body = EXCLUDED.text_body,
           html_body = EXCLUDED.html_body,
           snippet = EXCLUDED.snippet,
           headers = EXCLUDED.headers,
           has_attachments = EXCLUDED.has_attachments,
           size_bytes = EXCLUDED.size_bytes,
           spam_score = EXCLUDED.spam_score,
           updated_at = now()
         RETURNING id`,
        [
          accountId,
          folderId,
          threadId,
          msg.uid,
          parsed.messageId,
          parsed.inReplyTo,
          parsed.references,
          parsed.subject,
          JSON.stringify(parsed.from),
          JSON.stringify(parsed.to),
          JSON.stringify(parsed.cc),
          JSON.stringify(parsed.bcc),
          JSON.stringify(parsed.replyTo),
          parsed.date,
          flags,
          parsed.textBody,
          parsed.htmlBody,
          parsed.snippet,
          JSON.stringify(parsed.headers),
          parsed.hasAttachments,
          msg.source.byteLength,
          parsed.spamScore,
        ],
      );

      // Store attachments
      if (inserted && parsed.attachments.length > 0) {
        for (const att of parsed.attachments) {
          const storagePath = await storeAttachment(
            attachmentDir,
            accountId,
            inserted.id,
            att,
          );

          await query(
            `INSERT INTO attachments (
               message_id, filename, content_type, size_bytes,
               content_id, content_disposition, storage_path, checksum
             ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
            [
              inserted.id,
              att.filename,
              att.contentType,
              att.size,
              att.contentId,
              att.disposition,
              storagePath,
              att.checksum,
            ],
          );
        }
      }

      // Extract contacts
      await upsertContacts(accountId, parsed);
    } catch (err) {
      log.error('Failed to process message', {
        uid: msg.uid,
        error: String(err),
      });
      // Continue with next message — don't let one bad email break the sync
    }
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function upsertContacts(
  accountId: string,
  parsed: Awaited<ReturnType<typeof parseEmail>>,
): Promise<void> {
  const addresses = [
    ...parsed.to.map((a) => ({ ...a, source: 'sent' })),
    ...parsed.cc.map((a) => ({ ...a, source: 'sent' })),
    { ...parsed.from, source: 'received' },
  ];

  for (const addr of addresses) {
    if (!addr.address || addr.address === 'unknown') continue;
    await query(
      `INSERT INTO contacts (account_id, email, display_name, source, last_contacted_at)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (account_id, email) DO UPDATE SET
         display_name = CASE
           WHEN EXCLUDED.display_name != '' THEN EXCLUDED.display_name
           ELSE contacts.display_name
         END,
         frequency = contacts.frequency + 1,
         last_contacted_at = GREATEST(contacts.last_contacted_at, EXCLUDED.last_contacted_at),
         updated_at = now()`,
      [accountId, addr.address.toLowerCase(), addr.name, addr.source, parsed.date],
    );
  }
}

async function nukeFolder(folderId: string, accountId: string): Promise<void> {
  log.warn('Nuking all messages for folder due to UIDVALIDITY reset', {
    folderId,
  });
  // Cascading delete handles attachments
  await query(`DELETE FROM messages WHERE folder_id = $1`, [folderId]);
}

async function markFolderSynced(
  folderId: string,
  uidNext: number | undefined,
): Promise<void> {
  await query(
    `UPDATE folders SET
       sync_state   = 'synced',
       uid_next     = $2,
       last_sync_at = now(),
       updated_at   = now()
     WHERE id = $1`,
    [folderId, uidNext ?? null],
  );
}

async function updateFolderCounts(folderId: string): Promise<void> {
  await query(
    `UPDATE folders SET
       total_messages = (SELECT count(*) FROM messages WHERE folder_id = $1),
       unread_count   = (SELECT count(*) FROM messages WHERE folder_id = $1 AND NOT ('\\Seen' = ANY(flags))),
       updated_at     = now()
     WHERE id = $1`,
    [folderId],
  );
}

// ---------------------------------------------------------------------------
// Full backfill orchestrator — syncs all folders for an account.
// Prioritizes INBOX first so the UI can render immediately.
// ---------------------------------------------------------------------------

export async function runBackfill(
  client: ImapFlow,
  accountId: string,
  config: Config,
  queue: RateLimitedQueue,
): Promise<void> {
  // 1. Sync folder list
  await syncFolders(client, accountId);

  // 2. Get folders ordered: INBOX first, then others
  const { rows: folders } = await query<{ id: string; path: string }>(
    `SELECT id, path FROM folders
     WHERE account_id = $1
     ORDER BY
       CASE WHEN path = 'INBOX' THEN 0 ELSE 1 END,
       path`,
    [accountId],
  );

  // 3. Backfill each folder
  for (const folder of folders) {
    try {
      await backfillFolder(
        client,
        accountId,
        folder.path,
        config.backfillBatchSize,
        config.attachmentDir,
        queue,
      );
    } catch (err) {
      log.error('Folder backfill failed, continuing with next', {
        folder: folder.path,
        error: String(err),
      });
    }
  }

  // Update account last_sync_at
  await query(
    `UPDATE accounts SET last_sync_at = now(), updated_at = now() WHERE id = $1`,
    [accountId],
  );

  log.info('Full backfill complete for account', { accountId });
}
