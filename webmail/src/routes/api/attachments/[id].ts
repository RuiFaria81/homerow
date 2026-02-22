import { readFile } from "node:fs/promises";
import type { APIEvent } from "@solidjs/start/server";
import { auth } from "~/lib/auth";
import { getPool } from "~/lib/db";

function contentDispositionHeader(filename: string): string {
  const safeAscii = filename.replace(/[^a-zA-Z0-9._-]/g, "_") || "attachment";
  const encoded = encodeURIComponent(filename || "attachment");
  return `attachment; filename="${safeAscii}"; filename*=UTF-8''${encoded}`;
}

export async function GET({ request, params }: APIEvent) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session?.user?.email) return new Response("Unauthorized", { status: 401 });

  const attachmentId = params.id;
  if (!attachmentId) return new Response("Missing attachment id", { status: 400 });

  const pool = getPool();
  const result = await pool.query(
    `SELECT a.filename, a.content_type, a.storage_path
     FROM attachments a
     JOIN messages m ON a.message_id = m.id
     JOIN accounts acc ON m.account_id = acc.id
     WHERE acc.email = $1
       AND a.id = $2
     LIMIT 1`,
    [session.user.email, attachmentId],
  );

  const row = result.rows[0];
  if (!row?.storage_path) return new Response("Not found", { status: 404 });

  try {
    const file = await readFile(row.storage_path);
    const filename = (typeof row.filename === "string" && row.filename.trim()) ? row.filename : "attachment";
    const contentType = row.content_type || "application/octet-stream";

    return new Response(file, {
      status: 200,
      headers: {
        "content-type": contentType,
        "content-disposition": contentDispositionHeader(filename),
        "cache-control": "private, max-age=60",
      },
    });
  } catch {
    return new Response("Not found", { status: 404 });
  }
}
