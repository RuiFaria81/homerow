// ---------------------------------------------------------------------------
// Message threading — groups related messages by References / In-Reply-To.
// Uses the JWZ algorithm simplified: match by Message-ID chains.
// ---------------------------------------------------------------------------

import { query, queryOne, transaction } from './db.js';
import { log } from './logger.js';

/** Normalize subject by stripping Re:/Fwd:/Fw: prefixes */
export function normalizeSubject(subject: string): string {
  return subject
    .replace(/^(\s*(re|fwd?|aw|wg)\s*(\[\d+\])?\s*:\s*)+/i, '')
    .trim();
}

/**
 * Find or create a thread for a message.
 *
 * Strategy:
 * 1. Look for existing messages whose message_id appears in our References
 *    or In-Reply-To. If found, reuse their thread_id.
 * 2. Otherwise, check if any existing message references *our* message_id.
 * 3. If neither, create a new thread.
 */
export async function assignThread(
  accountId: string,
  messageId: string | null,
  inReplyTo: string | null,
  references: string[],
  subject: string,
  from: { name: string; address: string },
  date: Date | null,
  hasAttachments: boolean,
  snippet: string,
): Promise<string> {
  // Collect all related Message-IDs to search for
  const relatedIds = new Set<string>();
  if (inReplyTo) relatedIds.add(inReplyTo);
  for (const ref of references) relatedIds.add(ref);

  let threadId: string | null = null;

  // 1) Check if any existing message has a message_id in our references
  if (relatedIds.size > 0) {
    const placeholders = Array.from(relatedIds)
      .map((_, i) => `$${i + 2}`)
      .join(',');
    const result = await queryOne<{ thread_id: string }>(
      `SELECT thread_id FROM messages
       WHERE account_id = $1 AND thread_id IS NOT NULL
         AND message_id IN (${placeholders})
       LIMIT 1`,
      [accountId, ...relatedIds],
    );
    if (result) threadId = result.thread_id;
  }

  // 2) Check if anyone references *us*
  if (!threadId && messageId) {
    const result = await queryOne<{ thread_id: string }>(
      `SELECT thread_id FROM messages
       WHERE account_id = $1 AND thread_id IS NOT NULL
         AND ($2 = ANY("references") OR in_reply_to = $2)
       LIMIT 1`,
      [accountId, messageId],
    );
    if (result) threadId = result.thread_id;
  }

  // 3) Create a new thread if no match
  if (!threadId) {
    const normalized = normalizeSubject(subject);
    const result = await queryOne<{ id: string }>(
      `INSERT INTO threads (account_id, subject, snippet, last_message_at, message_count, has_attachments, participants)
       VALUES ($1, $2, $3, $4, 1, $5, $6::jsonb)
       RETURNING id`,
      [
        accountId,
        normalized,
        snippet,
        date ?? new Date(),
        hasAttachments,
        JSON.stringify([from]),
      ],
    );
    threadId = result!.id;
    log.debug('Created new thread', { threadId, subject: normalized });
    return threadId;
  }

  // Update existing thread stats
  await query(
    `UPDATE threads SET
       last_message_at = GREATEST(last_message_at, $2),
       message_count = message_count + 1,
       snippet = CASE WHEN $2 > last_message_at THEN $3 ELSE snippet END,
       has_attachments = has_attachments OR $4,
       updated_at = now()
     WHERE id = $1`,
    [threadId, date ?? new Date(), snippet, hasAttachments],
  );

  return threadId;
}

/**
 * Rebuild thread counts (message_count, unread_count) from messages table.
 * Call this after bulk operations.
 */
export async function refreshThreadCounts(threadId: string): Promise<void> {
  await query(
    `UPDATE threads SET
       message_count = (SELECT count(*) FROM messages WHERE thread_id = $1),
       unread_count  = (SELECT count(*) FROM messages WHERE thread_id = $1 AND NOT ('\\Seen' = ANY(flags))),
       updated_at = now()
     WHERE id = $1`,
    [threadId],
  );
}
