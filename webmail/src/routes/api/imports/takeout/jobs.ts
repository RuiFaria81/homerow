import type { APIEvent } from "@solidjs/start/server";
import { stat } from "node:fs/promises";
import path from "node:path";
import { createTakeoutImportJob, ensureImportTempDir, listRecentTakeoutImportJobs } from "~/lib/takeout-import-jobs";
import { kickTakeoutImportWorker } from "~/lib/takeout-import-worker";

interface CreateJobBody {
  filename?: string;
  fileSizeBytes?: number;
  existingServerFilename?: string;
  deleteServerFileAfterImport?: boolean;
  options?: Record<string, unknown>;
}

const MAX_FILE_SIZE_BYTES = 15 * 1024 * 1024 * 1024; // 15 GiB

export async function GET() {
  void kickTakeoutImportWorker();
  const jobs = await listRecentTakeoutImportJobs(20);
  return Response.json({ jobs });
}

export async function POST({ request }: APIEvent) {
  let body: CreateJobBody;
  try {
    body = (await request.json()) as CreateJobBody;
  } catch {
    return new Response("Invalid JSON body", { status: 400 });
  }

  const existingServerFilename = (body.existingServerFilename || "").trim();
  const requestedFilename = (body.filename || "").trim();
  let filename = requestedFilename;
  let fileSizeBytes = Number(body.fileSizeBytes || 0);
  let tempFilePath: string | undefined;
  let uploadedBytes = 0;
  const options: Record<string, unknown> = { ...(body.options || {}) };

  if (existingServerFilename) {
    const baseName = path.basename(existingServerFilename);
    if (!baseName) return new Response("Invalid existingServerFilename", { status: 400 });
    if (!baseName.toLowerCase().endsWith(".tgz") && !baseName.toLowerCase().endsWith(".tar.gz")) {
      return new Response("Only .tgz or .tar.gz files are supported", { status: 400 });
    }

    const tempDir = await ensureImportTempDir();
    const resolvedPath = path.join(tempDir, baseName);

    let fileStat;
    try {
      fileStat = await stat(resolvedPath);
    } catch {
      return new Response("Server file not found", { status: 404 });
    }
    if (!fileStat.isFile()) return new Response("Server path is not a file", { status: 400 });

    filename = requestedFilename || baseName;
    fileSizeBytes = Number(fileStat.size);
    tempFilePath = resolvedPath;
    uploadedBytes = fileSizeBytes;
    const deleteAfterSuccess = body.deleteServerFileAfterImport === true;
    options.deleteSourceFileOnSuccess = deleteAfterSuccess;
    options.keepSourceFile = !deleteAfterSuccess;
  }

  if (!filename) {
    return new Response("Missing filename", { status: 400 });
  }

  if (!filename.toLowerCase().endsWith(".tgz") && !filename.toLowerCase().endsWith(".tar.gz")) {
    return new Response("Only .tgz or .tar.gz files are supported", { status: 400 });
  }

  if (!Number.isFinite(fileSizeBytes) || fileSizeBytes <= 0) {
    return new Response("Invalid fileSizeBytes", { status: 400 });
  }

  if (fileSizeBytes > MAX_FILE_SIZE_BYTES) {
    return new Response("File too large", { status: 413 });
  }

  const job = await createTakeoutImportJob({
    sourceFilename: filename,
    fileSizeBytes,
    tempFilePath,
    uploadedBytes,
    initialStatus: uploadedBytes > 0 ? "uploading" : "created",
    options,
  });

  return Response.json({ job }, { status: 201 });
}
