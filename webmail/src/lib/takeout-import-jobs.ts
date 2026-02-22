"use server";

import { randomUUID } from "node:crypto";
import { mkdir } from "node:fs/promises";
import path from "node:path";
import { tmpdir } from "node:os";
import { getPool } from "~/lib/db";

export type ImportJobStatus =
  | "created"
  | "uploading"
  | "queued"
  | "running"
  | "completed"
  | "failed"
  | "cancelled";

export interface TakeoutImportJob {
  id: string;
  status: ImportJobStatus;
  sourceFilename: string;
  tempFilePath: string;
  fileSizeBytes: number;
  uploadedBytes: number;
  processedMessages: number;
  importedMessages: number;
  dbImportedMessages: number;
  imapSyncedMessages: number;
  skippedMessages: number;
  errorCount: number;
  estimatedTotalMessages: number | null;
  estimationInProgress: boolean;
  estimationScannedBytes: number;
  estimationTotalBytes: number;
  options: Record<string, unknown>;
  lastError: string | null;
  startedAt: string | null;
  finishedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

interface JobRow {
  id: string;
  status: ImportJobStatus;
  source_filename: string;
  temp_file_path: string;
  file_size_bytes: number | string;
  uploaded_bytes: number | string;
  processed_messages: number;
  imported_messages: number;
  db_imported_messages: number;
  imap_synced_messages: number;
  skipped_messages: number;
  error_count: number;
  estimated_total_messages: number | null;
  estimation_in_progress: boolean;
  estimation_scanned_bytes: number | string;
  estimation_total_bytes: number | string;
  options_json: Record<string, unknown>;
  last_error: string | null;
  started_at: Date | null;
  finished_at: Date | null;
  created_at: Date;
  updated_at: Date;
}

let schemaEnsured = false;

function toNumber(value: number | string): number {
  return typeof value === "number" ? value : Number.parseInt(value, 10);
}

function mapRow(row: JobRow): TakeoutImportJob {
  return {
    id: row.id,
    status: row.status,
    sourceFilename: row.source_filename,
    tempFilePath: row.temp_file_path,
    fileSizeBytes: toNumber(row.file_size_bytes),
    uploadedBytes: toNumber(row.uploaded_bytes),
    processedMessages: row.processed_messages,
    importedMessages: row.imported_messages,
    dbImportedMessages: row.db_imported_messages ?? row.imported_messages,
    imapSyncedMessages: row.imap_synced_messages ?? row.imported_messages,
    skippedMessages: row.skipped_messages,
    errorCount: row.error_count,
    estimatedTotalMessages: row.estimated_total_messages,
    estimationInProgress: row.estimation_in_progress,
    estimationScannedBytes: toNumber(row.estimation_scanned_bytes),
    estimationTotalBytes: toNumber(row.estimation_total_bytes),
    options: row.options_json || {},
    lastError: row.last_error,
    startedAt: row.started_at ? row.started_at.toISOString() : null,
    finishedAt: row.finished_at ? row.finished_at.toISOString() : null,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  };
}

export async function ensureTakeoutImportSchema(): Promise<void> {
  if (schemaEnsured) return;
  const pool = getPool();

  await pool.query(`
    CREATE TABLE IF NOT EXISTS takeout_import_jobs (
      id UUID PRIMARY KEY,
      status VARCHAR(20) NOT NULL
        CHECK (status IN ('created','uploading','queued','running','completed','failed','cancelled')),
      source_filename TEXT NOT NULL,
      temp_file_path TEXT NOT NULL,
      file_size_bytes BIGINT NOT NULL DEFAULT 0,
      uploaded_bytes BIGINT NOT NULL DEFAULT 0,
      processed_messages INTEGER NOT NULL DEFAULT 0,
      imported_messages INTEGER NOT NULL DEFAULT 0,
      db_imported_messages INTEGER NOT NULL DEFAULT 0,
      imap_synced_messages INTEGER NOT NULL DEFAULT 0,
      skipped_messages INTEGER NOT NULL DEFAULT 0,
      error_count INTEGER NOT NULL DEFAULT 0,
      estimated_total_messages INTEGER,
      estimation_in_progress BOOLEAN NOT NULL DEFAULT false,
      estimation_scanned_bytes BIGINT NOT NULL DEFAULT 0,
      estimation_total_bytes BIGINT NOT NULL DEFAULT 0,
      options_json JSONB NOT NULL DEFAULT '{}'::jsonb,
      last_error TEXT,
      started_at TIMESTAMPTZ,
      finished_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_takeout_import_jobs_status_created
    ON takeout_import_jobs (status, created_at)
  `);

  await pool.query(`
    ALTER TABLE takeout_import_jobs
    ADD COLUMN IF NOT EXISTS db_imported_messages INTEGER NOT NULL DEFAULT 0
  `);
  await pool.query(`
    ALTER TABLE takeout_import_jobs
    ADD COLUMN IF NOT EXISTS imap_synced_messages INTEGER NOT NULL DEFAULT 0
  `);
  await pool.query(`
    UPDATE takeout_import_jobs
    SET db_imported_messages = imported_messages
    WHERE db_imported_messages = 0 AND imported_messages > 0
  `);
  await pool.query(`
    UPDATE takeout_import_jobs
    SET imap_synced_messages = imported_messages
    WHERE imap_synced_messages = 0 AND imported_messages > 0
  `);

  await pool.query(`
    ALTER TABLE takeout_import_jobs
    ADD COLUMN IF NOT EXISTS estimated_total_messages INTEGER
  `);
  await pool.query(`
    ALTER TABLE takeout_import_jobs
    ADD COLUMN IF NOT EXISTS estimation_in_progress BOOLEAN NOT NULL DEFAULT false
  `);
  await pool.query(`
    ALTER TABLE takeout_import_jobs
    ADD COLUMN IF NOT EXISTS estimation_scanned_bytes BIGINT NOT NULL DEFAULT 0
  `);
  await pool.query(`
    ALTER TABLE takeout_import_jobs
    ADD COLUMN IF NOT EXISTS estimation_total_bytes BIGINT NOT NULL DEFAULT 0
  `);
  schemaEnsured = true;
}

export async function ensureImportTempDir(): Promise<string> {
  const configured = (process.env.TAKEOUT_IMPORT_DIR || "").trim();
  const dir = configured || path.join(tmpdir(), "webmail-takeout-imports");
  await mkdir(dir, { recursive: true });
  return dir;
}

export async function createTakeoutImportJob(params: {
  sourceFilename: string;
  fileSizeBytes: number;
  tempFilePath?: string;
  uploadedBytes?: number;
  initialStatus?: "created" | "uploading";
  options?: Record<string, unknown>;
}): Promise<TakeoutImportJob> {
  await ensureTakeoutImportSchema();
  const pool = getPool();
  const id = randomUUID();
  const tempDir = await ensureImportTempDir();
  const safeName = params.sourceFilename.replace(/[^a-zA-Z0-9._-]/g, "_");
  const tempFilePath = params.tempFilePath || path.join(tempDir, `${id}-${safeName}`);
  const uploadedBytes = Math.max(0, Math.min(params.fileSizeBytes, params.uploadedBytes ?? 0));
  const initialStatus = params.initialStatus === "uploading" ? "uploading" : "created";

  const result = await pool.query<JobRow>(
    `
      INSERT INTO takeout_import_jobs (
        id,
        status,
        source_filename,
        temp_file_path,
        file_size_bytes,
        uploaded_bytes,
        options_json
      ) VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb)
      RETURNING *
    `,
    [
      id,
      initialStatus,
      params.sourceFilename,
      tempFilePath,
      params.fileSizeBytes,
      uploadedBytes,
      JSON.stringify(params.options ?? {}),
    ],
  );

  return mapRow(result.rows[0]);
}

export async function getTakeoutImportJob(id: string): Promise<TakeoutImportJob | null> {
  await ensureTakeoutImportSchema();
  const pool = getPool();
  const result = await pool.query<JobRow>(`SELECT * FROM takeout_import_jobs WHERE id = $1`, [id]);
  return result.rows[0] ? mapRow(result.rows[0]) : null;
}

export async function setTakeoutImportEstimatedTotalMessages(params: {
  id: string;
  estimatedTotalMessages: number;
}): Promise<void> {
  await ensureTakeoutImportSchema();
  const pool = getPool();
  await pool.query(
    `
      UPDATE takeout_import_jobs
      SET estimated_total_messages = $2,
          estimation_in_progress = false,
          updated_at = now()
      WHERE id = $1
    `,
    [params.id, params.estimatedTotalMessages],
  );
}

export async function beginTakeoutImportEstimation(params: {
  id: string;
  estimationTotalBytes: number;
}): Promise<void> {
  await ensureTakeoutImportSchema();
  const pool = getPool();
  await pool.query(
    `
      UPDATE takeout_import_jobs
      SET estimation_in_progress = true,
          estimation_scanned_bytes = 0,
          estimation_total_bytes = $2,
          updated_at = now()
      WHERE id = $1
    `,
    [params.id, params.estimationTotalBytes],
  );
}

export async function updateTakeoutImportEstimationProgress(params: {
  id: string;
  estimationScannedBytes: number;
}): Promise<void> {
  await ensureTakeoutImportSchema();
  const pool = getPool();
  await pool.query(
    `
      UPDATE takeout_import_jobs
      SET estimation_scanned_bytes = GREATEST(estimation_scanned_bytes, $2),
          updated_at = now()
      WHERE id = $1
    `,
    [params.id, params.estimationScannedBytes],
  );
}

export async function clearTakeoutImportEstimationState(id: string): Promise<void> {
  await ensureTakeoutImportSchema();
  const pool = getPool();
  await pool.query(
    `
      UPDATE takeout_import_jobs
      SET estimation_in_progress = false,
          updated_at = now()
      WHERE id = $1
    `,
    [id],
  );
}

export async function listRecentTakeoutImportJobs(limit = 10): Promise<TakeoutImportJob[]> {
  await ensureTakeoutImportSchema();
  const pool = getPool();
  const result = await pool.query<JobRow>(
    `SELECT * FROM takeout_import_jobs ORDER BY created_at DESC LIMIT $1`,
    [limit],
  );
  return result.rows.map(mapRow);
}

export async function setTakeoutImportUploadedBytes(params: {
  id: string;
  uploadedBytes: number;
}): Promise<TakeoutImportJob | null> {
  await ensureTakeoutImportSchema();
  const pool = getPool();
  const result = await pool.query<JobRow>(
    `
      UPDATE takeout_import_jobs
      SET status = CASE WHEN status = 'created' THEN 'uploading' ELSE status END,
          uploaded_bytes = GREATEST(uploaded_bytes, $2),
          updated_at = now()
      WHERE id = $1
      RETURNING *
    `,
    [params.id, params.uploadedBytes],
  );

  return result.rows[0] ? mapRow(result.rows[0]) : null;
}

export async function queueTakeoutImportJob(id: string): Promise<TakeoutImportJob | null> {
  await ensureTakeoutImportSchema();
  const pool = getPool();
  const result = await pool.query<JobRow>(
    `
      UPDATE takeout_import_jobs
      SET status = 'queued',
          last_error = NULL,
          updated_at = now()
      WHERE id = $1
        AND status IN ('created', 'uploading', 'failed')
      RETURNING *
    `,
    [id],
  );

  return result.rows[0] ? mapRow(result.rows[0]) : null;
}

export async function mergeTakeoutImportJobOptions(
  id: string,
  options: Record<string, unknown>,
): Promise<TakeoutImportJob | null> {
  await ensureTakeoutImportSchema();
  const pool = getPool();
  const result = await pool.query<JobRow>(
    `
      UPDATE takeout_import_jobs
      SET options_json = COALESCE(options_json, '{}'::jsonb) || $2::jsonb,
          updated_at = now()
      WHERE id = $1
      RETURNING *
    `,
    [id, JSON.stringify(options)],
  );
  return result.rows[0] ? mapRow(result.rows[0]) : null;
}

export async function claimNextQueuedTakeoutImportJob(): Promise<TakeoutImportJob | null> {
  await ensureTakeoutImportSchema();
  const pool = getPool();

  const result = await pool.query<JobRow>(`
    UPDATE takeout_import_jobs
    SET status = 'running',
        started_at = COALESCE(started_at, now()),
        updated_at = now()
    WHERE id = (
      SELECT id
      FROM takeout_import_jobs
      WHERE status = 'queued'
      ORDER BY created_at ASC
      FOR UPDATE SKIP LOCKED
      LIMIT 1
    )
    RETURNING *
  `);

  return result.rows[0] ? mapRow(result.rows[0]) : null;
}

export async function requeueStaleRunningTakeoutImportJobs(maxStaleMinutes = 10): Promise<number> {
  await ensureTakeoutImportSchema();
  const pool = getPool();
  const result = await pool.query<{ count: string }>(
    `
      WITH stale AS (
        UPDATE takeout_import_jobs
        SET status = 'queued',
            updated_at = now(),
            last_error = COALESCE(last_error, 'Recovered stale running job after process restart.')
        WHERE status = 'running'
          AND updated_at < now() - ($1::text || ' minutes')::interval
        RETURNING id
      )
      SELECT COUNT(*)::text AS count FROM stale
    `,
    [String(maxStaleMinutes)],
  );

  return Number.parseInt(result.rows[0]?.count ?? "0", 10);
}

export async function updateTakeoutImportProgress(params: {
  id: string;
  processedMessages: number;
  importedMessages: number;
  dbImportedMessages?: number;
  imapSyncedMessages?: number;
  skippedMessages: number;
  errorCount: number;
}): Promise<void> {
  await ensureTakeoutImportSchema();
  const pool = getPool();
  await pool.query(
    `
      UPDATE takeout_import_jobs
      SET processed_messages = $2,
          imported_messages = $3,
          db_imported_messages = $4,
          imap_synced_messages = $5,
          skipped_messages = $6,
          error_count = $7,
          updated_at = now()
      WHERE id = $1
    `,
    [
      params.id,
      params.processedMessages,
      params.importedMessages,
      params.dbImportedMessages ?? params.importedMessages,
      params.imapSyncedMessages ?? params.importedMessages,
      params.skippedMessages,
      params.errorCount,
    ],
  );
}

export async function completeTakeoutImportJob(params: {
  id: string;
  processedMessages: number;
  importedMessages: number;
  dbImportedMessages?: number;
  imapSyncedMessages?: number;
  skippedMessages: number;
  errorCount: number;
}): Promise<void> {
  await ensureTakeoutImportSchema();
  const pool = getPool();
  await pool.query(
    `
      UPDATE takeout_import_jobs
      SET status = 'completed',
          processed_messages = $2,
          imported_messages = $3,
          db_imported_messages = $4,
          imap_synced_messages = $5,
          skipped_messages = $6,
          error_count = $7,
          finished_at = now(),
          updated_at = now()
      WHERE id = $1
    `,
    [
      params.id,
      params.processedMessages,
      params.importedMessages,
      params.dbImportedMessages ?? params.importedMessages,
      params.imapSyncedMessages ?? params.importedMessages,
      params.skippedMessages,
      params.errorCount,
    ],
  );
}

export async function failTakeoutImportJob(params: {
  id: string;
  message: string;
}): Promise<void> {
  await ensureTakeoutImportSchema();
  const pool = getPool();
  await pool.query(
    `
      UPDATE takeout_import_jobs
      SET status = 'failed',
          last_error = $2,
          finished_at = now(),
          updated_at = now()
      WHERE id = $1
    `,
    [params.id, params.message],
  );
}

export async function cancelTakeoutImportJob(id: string): Promise<TakeoutImportJob | null> {
  await ensureTakeoutImportSchema();
  const pool = getPool();
  const result = await pool.query<JobRow>(
    `
      UPDATE takeout_import_jobs
      SET status = 'cancelled',
          finished_at = now(),
          updated_at = now()
      WHERE id = $1
        AND status IN ('created', 'uploading', 'queued', 'running')
      RETURNING *
    `,
    [id],
  );

  return result.rows[0] ? mapRow(result.rows[0]) : null;
}
