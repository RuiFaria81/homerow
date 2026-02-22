// ---------------------------------------------------------------------------
// PostgreSQL connection pool and helper queries.
// ---------------------------------------------------------------------------

import pg from 'pg';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Config } from './config.js';
import { log } from './logger.js';

const { Pool } = pg;

let pool: pg.Pool;

export function initDb(config: Config): pg.Pool {
  pool = new Pool({
    host: config.db.host,
    port: config.db.port,
    database: config.db.database,
    user: config.db.user,
    password: config.db.password,
    max: 10,
    idleTimeoutMillis: 30_000,
  });

  pool.on('error', (err) => {
    log.error('Unexpected PG pool error', { error: String(err) });
  });

  return pool;
}

/**
 * Auto-migrate: apply schema.sql if the accounts table doesn't exist yet.
 * This makes the engine self-bootstrapping — no manual `psql -f schema.sql` needed.
 */
export async function migrateDb(): Promise<void> {
  const result = await pool.query(`
    SELECT EXISTS (
      SELECT FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = 'accounts'
    ) AS "exists"
  `);

  if (result.rows[0]?.exists) {
    log.info('Database schema already exists, checking incremental migrations');
    await applyIncrementalMigrations();
    return;
  }

  log.info('Database schema not found — running migration…');

  // Resolve schema.sql relative to this file (works in both src/ and dist/)
  const thisDir = path.dirname(fileURLToPath(import.meta.url));
  const schemaPath = path.resolve(thisDir, '..', 'schema.sql');

  // Fallback: try from working directory
  const candidates = [schemaPath, path.resolve('schema.sql')];
  let sql: string | null = null;

  for (const candidate of candidates) {
    try {
      sql = fs.readFileSync(candidate, 'utf-8');
      log.info('Loaded schema from', { path: candidate });
      break;
    } catch {
      // Try next candidate
    }
  }

  if (!sql) {
    throw new Error(
      `Cannot find schema.sql — tried: ${candidates.join(', ')}`,
    );
  }

  await pool.query(sql);
  await applyIncrementalMigrations();
  log.info('Database schema applied successfully');
}

async function applyIncrementalMigrations(): Promise<void> {
  const statements = [
    `CREATE EXTENSION IF NOT EXISTS "pg_trgm"`,
    `CREATE INDEX IF NOT EXISTS idx_messages_size ON messages (account_id, size_bytes)`,
    `CREATE INDEX IF NOT EXISTS idx_messages_attach_date ON messages (account_id, has_attachments, date DESC)`,
    `CREATE INDEX IF NOT EXISTS idx_messages_from_email_lower ON messages (lower(from_address->>'address'))`,
    `CREATE INDEX IF NOT EXISTS idx_messages_subject_trgm ON messages USING GIN (subject gin_trgm_ops)`,
    `CREATE INDEX IF NOT EXISTS idx_messages_to_trgm ON messages USING GIN ((coalesce(to_addresses::text, '')) gin_trgm_ops)`,
    `CREATE INDEX IF NOT EXISTS idx_messages_cc_trgm ON messages USING GIN ((coalesce(cc_addresses::text, '')) gin_trgm_ops)`,
    // Spam score column added for rspamd integration
    `ALTER TABLE messages ADD COLUMN IF NOT EXISTS spam_score REAL`,
  ];

  for (const statement of statements) {
    try {
      await pool.query(statement);
    } catch (err) {
      log.warn('Incremental migration statement failed', { statement, error: String(err) });
    }
  }
}

export function getPool(): pg.Pool {
  if (!pool) throw new Error('Database not initialized — call initDb first');
  return pool;
}

export async function shutdownDb(): Promise<void> {
  if (pool) {
    await pool.end();
    log.info('Database pool closed');
  }
}

// ---------------------------------------------------------------------------
// Typed helpers
// ---------------------------------------------------------------------------

export async function query<T extends pg.QueryResultRow = any>(
  text: string,
  params?: unknown[],
): Promise<pg.QueryResult<T>> {
  return getPool().query<T>(text, params);
}

export async function queryOne<T extends pg.QueryResultRow = any>(
  text: string,
  params?: unknown[],
): Promise<T | null> {
  const result = await query<T>(text, params);
  return result.rows[0] ?? null;
}

export async function transaction<T>(
  fn: (client: pg.PoolClient) => Promise<T>,
): Promise<T> {
  const client = await getPool().connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}
