"use server";
import pg from "pg";

let pool: pg.Pool | null = null;

/**
 * Returns a shared PostgreSQL connection pool for server-side queries.
 * Reads the same env vars as the sync engine (DB_HOST, DB_PORT, etc.).
 */
export function getPool(): pg.Pool {
  if (!pool) {
    pool = new pg.Pool({
      host: process.env.DB_HOST || "127.0.0.1",
      port: parseInt(process.env.DB_PORT || "5432", 10),
      database: process.env.DB_NAME || "mailsync",
      user: process.env.DB_USER || "mailsync",
      password: process.env.DB_PASSWORD || "mailsync",
      max: 10,
      idleTimeoutMillis: 30000,
    });
  }
  return pool;
}
