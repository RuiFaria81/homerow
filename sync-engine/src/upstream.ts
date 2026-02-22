// ---------------------------------------------------------------------------
// Upstream operations — write-path for actions initiated by the frontend.
// These modify IMAP state (flags, moves, deletes) and update Postgres to
// match, so the UI stays consistent.
// ---------------------------------------------------------------------------

import { ImapFlow } from 'imapflow';
import type { Config } from './config.js';
import { query, queryOne } from './db.js';
import { log } from './logger.js';
import { refreshThreadCounts } from './threading.js';

export class UpstreamHandler {
  constructor(private readonly config: Config) {}

  private async createClient(): Promise<ImapFlow> {
    const client = new ImapFlow({
      host: this.config.imap.host,
      port: this.config.imap.port,
      secure: this.config.imap.tls,
      auth: {
        user: this.config.imap.user,
        pass: this.config.imap.pass,
      },
      tls: { rejectUnauthorized: false },
      logger: false,
    });
    await client.connect();
    return client;
  }

  // -------------------------------------------------------------------------
  // Flag operations
  // -------------------------------------------------------------------------

  async markAsRead(messageId: string): Promise<void> {
    await this.setFlag(messageId, '\\Seen', true);
  }

  async markAsUnread(messageId: string): Promise<void> {
    await this.setFlag(messageId, '\\Seen', false);
  }

  async toggleStar(messageId: string, starred: boolean): Promise<void> {
    await this.setFlag(messageId, '\\Flagged', starred);
  }

  private async setFlag(
    messageId: string,
    flag: string,
    add: boolean,
  ): Promise<void> {
    const msg = await queryOne<{
      uid: number;
      folder_path: string;
      thread_id: string | null;
    }>(
      `SELECT m.uid, f.path AS folder_path, m.thread_id
       FROM messages m JOIN folders f ON m.folder_id = f.id
       WHERE m.id = $1`,
      [messageId],
    );

    if (!msg) {
      log.warn('Message not found for flag operation', { messageId });
      return;
    }

    const client = await this.createClient();
    try {
      const lock = await client.getMailboxLock(msg.folder_path);
      try {
        if (add) {
          await client.messageFlagsAdd({ uid: msg.uid }, [flag], { uid: true });
        } else {
          await client.messageFlagsRemove({ uid: msg.uid }, [flag], { uid: true });
        }
      } finally {
        lock.release();
      }
    } finally {
      await client.logout();
    }

    // Update local DB
    if (add) {
      await query(
        `UPDATE messages SET
           flags = array_append(flags, $2),
           updated_at = now()
         WHERE id = $1 AND NOT ($2 = ANY(flags))`,
        [messageId, flag],
      );
    } else {
      await query(
        `UPDATE messages SET
           flags = array_remove(flags, $2),
           updated_at = now()
         WHERE id = $1`,
        [messageId, flag],
      );
    }

    if (msg.thread_id) {
      await refreshThreadCounts(msg.thread_id);
    }

    log.info('Flag updated', { messageId, flag, add });
  }

  // -------------------------------------------------------------------------
  // Move / Delete / Archive
  // -------------------------------------------------------------------------

  async moveToFolder(
    messageId: string,
    targetFolder: string,
  ): Promise<void> {
    const msg = await queryOne<{
      uid: number;
      folder_id: string;
      folder_path: string;
      account_id: string;
    }>(
      `SELECT m.uid, m.folder_id, f.path AS folder_path, m.account_id
       FROM messages m JOIN folders f ON m.folder_id = f.id
       WHERE m.id = $1`,
      [messageId],
    );

    if (!msg) {
      log.warn('Message not found for move', { messageId });
      return;
    }

    const client = await this.createClient();
    try {
      // Ensure target folder exists
      const mailboxes = await client.list();
      if (!mailboxes.some((m) => m.path === targetFolder)) {
        await client.mailboxCreate(targetFolder);
      }

      const lock = await client.getMailboxLock(msg.folder_path);
      try {
        await client.messageMove({ uid: msg.uid }, targetFolder, { uid: true });
      } finally {
        lock.release();
      }
    } finally {
      await client.logout();
    }

    // Update local DB: get target folder ID and move the message
    const targetFolderRow = await queryOne<{ id: string }>(
      `SELECT id FROM folders WHERE account_id = $1 AND path = $2`,
      [msg.account_id, targetFolder],
    );

    if (targetFolderRow) {
      // The UID will change after move — mark both folders as stale
      // so the next poll picks up the correct UIDs
      await query(
        `UPDATE folders SET sync_state = 'stale', updated_at = now()
         WHERE id IN ($1, $2)`,
        [msg.folder_id, targetFolderRow.id],
      );

      // Delete the local message — it will be re-fetched with the new UID
      await query(`DELETE FROM messages WHERE id = $1`, [messageId]);
    }

    log.info('Message moved', { messageId, from: msg.folder_path, to: targetFolder });
  }

  async deleteMessage(messageId: string): Promise<void> {
    await this.moveToFolder(messageId, 'Trash');
  }

  async archiveMessage(messageId: string): Promise<void> {
    await this.moveToFolder(messageId, 'Archive');
  }

  // -------------------------------------------------------------------------
  // Batch operations
  // -------------------------------------------------------------------------

  async batchMarkAsRead(messageIds: string[]): Promise<void> {
    for (const id of messageIds) {
      await this.markAsRead(id);
    }
  }

  async batchDelete(messageIds: string[]): Promise<void> {
    for (const id of messageIds) {
      await this.deleteMessage(id);
    }
  }

  async batchArchive(messageIds: string[]): Promise<void> {
    for (const id of messageIds) {
      await this.archiveMessage(id);
    }
  }
}
