// ---------------------------------------------------------------------------
// Google Takeout (Gmail) Import
//
// Streams a Google Takeout .tgz archive, parses the mbox inside, and
// imports each email into the Dovecot IMAP server via APPEND.
//
// Usage:
//   pnpm import:takeout <path-to-takeout.tgz> [--production] [--dry-run] [--limit N]
//
// Reads credentials from config.env automatically.
//   --production  Connect to the production Dovecot server (mail.DOMAIN:993)
//   --dry-run     Parse and preview without importing
//   --limit N     Only import first N messages
// ---------------------------------------------------------------------------

import { ImapFlow } from 'imapflow';
import fs from 'node:fs';
import path from 'node:path';
import { createGunzip } from 'node:zlib';
import { Readable } from 'node:stream';
import { createInterface } from 'node:readline';
import tar from 'tar-stream';

// ---------------------------------------------------------------------------
// CLI argument parsing
// ---------------------------------------------------------------------------

const args = process.argv.slice(2);
const tgzPath = args.find(a => !a.startsWith('--'));
const dryRun = args.includes('--dry-run');
const limitIdx = args.indexOf('--limit');
const limit = limitIdx !== -1 ? parseInt(args[limitIdx + 1], 10) : Infinity;

if (!tgzPath) {
  console.error('Usage: pnpm import:takeout <path-to-takeout.tgz> [--dry-run] [--limit N]');
  process.exit(1);
}

if (!fs.existsSync(tgzPath)) {
  console.error(`File not found: ${tgzPath}`);
  process.exit(1);
}

// ---------------------------------------------------------------------------
// IMAP connection config
//
// In dev (devenv), env vars are set automatically → uses GreenMail.
// With --production, config.env values override env vars → uses Dovecot.
// ---------------------------------------------------------------------------

function loadConfigEnv(): Record<string, string> {
  const configPath = path.resolve(
    path.dirname(new URL(import.meta.url).pathname),
    '../../config.env',
  );
  try {
    const content = fs.readFileSync(configPath, 'utf-8');
    const vars: Record<string, string> = {};
    for (const line of content.split('\n')) {
      const match = line.match(/^(\w+)="?([^"]*)"?$/);
      if (match) vars[match[1]] = match[2];
    }
    return vars;
  } catch {
    return {};
  }
}

const config = loadConfigEnv();
const useProduction = args.includes('--production');

// When --production is passed, config.env takes priority over devenv env vars
const IMAP_HOST = useProduction ? `mail.${config.DOMAIN}` : (process.env.IMAP_HOST || '127.0.0.1');
const IMAP_PORT = useProduction ? 993 : parseInt(process.env.IMAP_PORT || '3143', 10);
const IMAP_USER = useProduction ? config.EMAIL : (process.env.IMAP_USER || config.EMAIL || '');
const IMAP_PASS = useProduction ? config.MAIL_PASSWORD : (process.env.IMAP_PASS || config.MAIL_PASSWORD || '');
const IMAP_TLS = useProduction ? true : (process.env.IMAP_TLS === 'true');

if (!IMAP_USER || !IMAP_PASS) {
  console.error('Missing IMAP credentials. Set IMAP_USER/IMAP_PASS or ensure config.env exists.');
  process.exit(1);
}

// ---------------------------------------------------------------------------
// Gmail label → IMAP folder/flag mapping
// ---------------------------------------------------------------------------

interface LabelMapping {
  folder: string | null;  // null = skip as folder
  flag?: string;          // optional IMAP flag to add
}

const LABEL_MAP: Record<string, LabelMapping> = {
  'inbox':       { folder: 'INBOX' },
  'sent':        { folder: 'Sent' },
  'drafts':      { folder: 'Drafts' },
  'spam':        { folder: 'Junk' },
  'trash':       { folder: 'Trash' },
  'archived':    { folder: 'Archive' },
  'starred':     { folder: null, flag: '\\Flagged' },
  'important':   { folder: null },
  'unread':      { folder: null },  // handled by omitting \Seen
  'opened':      { folder: null },
  'chat':        { folder: null },
};

function mapLabel(label: string): LabelMapping {
  const lower = label.toLowerCase().trim();

  // Known labels
  if (LABEL_MAP[lower]) return LABEL_MAP[lower];

  // Category labels (Gmail virtual categories) — skip
  if (lower.startsWith('category ')) return { folder: null };

  // Custom labels → create as IMAP folder under Labels/
  return { folder: `Labels/${label.trim()}` };
}

function parseGmailLabels(raw: string): string[] {
  // X-Gmail-Labels can be comma-separated, with possible quoting
  // e.g.: "Inbox,Sent,\"My Custom Label\",Category promotions"
  const labels: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < raw.length; i++) {
    const ch = raw[i];
    if (ch === '"') {
      inQuotes = !inQuotes;
    } else if (ch === ',' && !inQuotes) {
      if (current.trim()) labels.push(current.trim());
      current = '';
    } else {
      current += ch;
    }
  }
  if (current.trim()) labels.push(current.trim());

  return labels;
}

function resolveLabels(labels: string[]): { folder: string; flags: string[] } {
  const flags: string[] = ['\\Seen']; // default: mark as read
  let folder: string | null = null;

  for (const label of labels) {
    const mapping = mapLabel(label);

    // Unread → remove \Seen flag
    if (label.toLowerCase().trim() === 'unread') {
      const idx = flags.indexOf('\\Seen');
      if (idx !== -1) flags.splice(idx, 1);
      continue;
    }

    // Collect flags
    if (mapping.flag && !flags.includes(mapping.flag)) {
      flags.push(mapping.flag);
    }

    // Pick the first real folder
    if (!folder && mapping.folder) {
      folder = mapping.folder;
    }
  }

  // Default to Archive if no folder was resolved (e.g. only "Archived" label)
  return { folder: folder || 'Archive', flags };
}

// ---------------------------------------------------------------------------
// Checkpoint for resume support
// ---------------------------------------------------------------------------

const CHECKPOINT_FILE = path.join(
  path.dirname(tgzPath),
  `.import-checkpoint-${path.basename(tgzPath, '.tgz')}.json`,
);

interface Checkpoint {
  importedMessageIds: string[];
  totalImported: number;
  lastImportedAt: string;
}

function loadCheckpoint(): Set<string> {
  try {
    const data = JSON.parse(fs.readFileSync(CHECKPOINT_FILE, 'utf-8')) as Checkpoint;
    console.log(`Loaded checkpoint: ${data.totalImported} previously imported messages`);
    return new Set(data.importedMessageIds);
  } catch {
    return new Set();
  }
}

function saveCheckpoint(imported: Set<string>): void {
  const checkpoint: Checkpoint = {
    importedMessageIds: Array.from(imported),
    totalImported: imported.size,
    lastImportedAt: new Date().toISOString(),
  };
  fs.writeFileSync(CHECKPOINT_FILE, JSON.stringify(checkpoint));
}

// ---------------------------------------------------------------------------
// Mbox streaming parser
//
// Mbox format: messages separated by lines starting with "From "
// We accumulate lines for each message, then yield the complete message.
// ---------------------------------------------------------------------------

async function* parseMbox(stream: Readable): AsyncGenerator<Buffer> {
  const rl = createInterface({ input: stream, crlfDelay: Infinity });
  let messageLines: string[] = [];

  for await (const line of rl) {
    if (line.startsWith('From ') && messageLines.length > 0) {
      // Yield the accumulated message
      yield Buffer.from(messageLines.join('\r\n'));
      messageLines = [];
    } else {
      // Undo mbox "From " escaping: lines starting with ">From " in the body
      // were escaped by prepending ">". Undo that.
      if (line.startsWith('>From ')) {
        messageLines.push(line.slice(1));
      } else {
        messageLines.push(line);
      }
    }
  }

  // Yield the last message
  if (messageLines.length > 0) {
    yield Buffer.from(messageLines.join('\r\n'));
  }
}

// ---------------------------------------------------------------------------
// Extract Message-ID from raw email bytes (quick header scan)
// ---------------------------------------------------------------------------

function extractMessageId(raw: Buffer): string | null {
  // Only scan the first 8KB for headers (performance)
  const headerSection = raw.subarray(0, 8192).toString('utf-8');
  const match = headerSection.match(/^Message-ID:\s*(.+)$/im);
  return match ? match[1].trim() : null;
}

// ---------------------------------------------------------------------------
// Extract X-Gmail-Labels from raw email bytes
// ---------------------------------------------------------------------------

function extractGmailLabels(raw: Buffer): string[] {
  const headerSection = raw.subarray(0, 4096).toString('utf-8');
  const match = headerSection.match(/^X-Gmail-Labels:\s*(.+)$/im);
  if (!match) return [];
  return parseGmailLabels(match[1]);
}

// ---------------------------------------------------------------------------
// Main import logic
// ---------------------------------------------------------------------------

async function main() {
  console.log('=== Google Takeout Gmail Import ===');
  console.log(`Archive: ${tgzPath}`);
  console.log(`IMAP: ${IMAP_USER}@${IMAP_HOST}:${IMAP_PORT} (TLS: ${IMAP_TLS})`);
  if (dryRun) console.log('MODE: DRY RUN (no IMAP writes)');
  if (limit < Infinity) console.log(`LIMIT: ${limit} messages`);
  console.log('');

  // Load checkpoint for resume
  const imported = loadCheckpoint();

  // Connect IMAP (unless dry run)
  let client: ImapFlow | null = null;
  const createdFolders = new Set<string>();

  if (!dryRun) {
    client = new ImapFlow({
      host: IMAP_HOST,
      port: IMAP_PORT,
      secure: IMAP_TLS,
      auth: { user: IMAP_USER, pass: IMAP_PASS },
      tls: { rejectUnauthorized: false },
      logger: false,
    });
    await client.connect();
    console.log('Connected to IMAP server');

    // Pre-load existing folders
    const mailboxes = await client.list();
    for (const mb of mailboxes) {
      createdFolders.add(mb.path);
    }
  }

  // Stats
  let count = 0;
  let skipped = 0;
  let errors = 0;
  const startTime = Date.now();
  const folderStats: Record<string, number> = {};

  // Stream the .tgz → find the .mbox entry → parse messages
  const mboxStream = await extractMboxFromTgz(tgzPath);

  for await (const rawMessage of parseMbox(mboxStream)) {
    if (count >= limit) break;

    const messageId = extractMessageId(rawMessage);

    // Skip if already imported (resume support)
    if (messageId && imported.has(messageId)) {
      skipped++;
      continue;
    }

    const labels = extractGmailLabels(rawMessage);
    const { folder, flags } = resolveLabels(labels);

    // Track folder stats
    folderStats[folder] = (folderStats[folder] || 0) + 1;

    if (dryRun) {
      if (count < 20) {
        // Show first 20 in detail
        const subject = extractHeader(rawMessage, 'Subject') || '(no subject)';
        console.log(`  ${count + 1}. [${folder}] ${flags.join(',')} "${subject.slice(0, 60)}"`);
        console.log(`     Labels: ${labels.join(', ')}`);
      }
      count++;
      continue;
    }

    // Ensure folder exists
    if (!createdFolders.has(folder)) {
      try {
        await client!.mailboxCreate(folder);
        console.log(`  Created folder: ${folder}`);
      } catch {
        // Folder might already exist
      }
      createdFolders.add(folder);
    }

    // IMAP APPEND
    try {
      await client!.append(folder, rawMessage, flags);
      count++;

      if (messageId) imported.add(messageId);

      // Progress logging (frequent enough to keep UI responsive)
      if (count === 1 || count % 20 === 0) {
        const elapsed = (Date.now() - startTime) / 1000;
        const rate = (count / elapsed).toFixed(1);
        process.stdout.write(
          `\r  Imported: ${count} | Skipped: ${skipped} | Errors: ${errors} | ${rate} msgs/sec`,
        );

        // Save checkpoint periodically for safe resume.
        if (count % 200 === 0) {
          saveCheckpoint(imported);
        }
      }
    } catch (err) {
      errors++;
      if (errors <= 10) {
        console.error(`\n  Error importing message: ${String(err)}`);
      }
    }
  }

  // Final checkpoint save
  if (!dryRun) {
    saveCheckpoint(imported);
    await client!.logout();
  }

  // Print summary
  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log('\n');
  console.log('=== Import Summary ===');
  console.log(`Total imported: ${count}`);
  console.log(`Skipped (already imported): ${skipped}`);
  console.log(`Errors: ${errors}`);
  console.log(`Time: ${elapsed}s`);
  console.log('');
  console.log('Folder breakdown:');
  const sortedFolders = Object.entries(folderStats).sort((a, b) => b[1] - a[1]);
  for (const [f, n] of sortedFolders) {
    console.log(`  ${f}: ${n}`);
  }
  console.log('');

  if (dryRun) {
    console.log('(Dry run — no messages were actually imported)');
  } else {
    console.log('Done! The sync engine will pick up imported messages automatically.');
  }
}

// ---------------------------------------------------------------------------
// Extract the .mbox file from the .tgz archive as a readable stream
// ---------------------------------------------------------------------------

function extractMboxFromTgz(archivePath: string): Promise<Readable> {
  return new Promise((resolve, reject) => {
    const extract = tar.extract();
    const gunzip = createGunzip();

    extract.on('entry', (header, stream, next) => {
      if (header.name.endsWith('.mbox')) {
        console.log(`Found mbox: ${header.name} (${formatBytes(header.size || 0)})`);
        resolve(stream);
        // Note: we don't call next() here — the tar stream will keep feeding
        // data to the resolved stream until it's done
      } else {
        // Skip non-mbox entries
        stream.on('end', next);
        stream.resume();
      }
    });

    extract.on('finish', () => {
      // If no mbox was found
      reject(new Error('No .mbox file found in the archive'));
    });

    extract.on('error', reject);
    gunzip.on('error', reject);

    fs.createReadStream(archivePath).pipe(gunzip).pipe(extract);
  });
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function extractHeader(raw: Buffer, name: string): string | null {
  const headerSection = raw.subarray(0, 8192).toString('utf-8');
  const regex = new RegExp(`^${name}:\\s*(.+)$`, 'im');
  const match = headerSection.match(regex);
  return match ? match[1].trim() : null;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  return `${(bytes / 1024 / 1024 / 1024).toFixed(1)} GB`;
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
