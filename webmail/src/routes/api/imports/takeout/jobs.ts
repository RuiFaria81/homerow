import type { APIEvent } from "@solidjs/start/server";
import { stat } from "node:fs/promises";
import path from "node:path";
import { listTakeoutServerArchives } from "~/lib/takeout-import-files";
import {
  detectTakeoutMultipartSet,
  isTakeoutArchiveFilename,
  normalizeTakeoutServerFilename,
} from "~/lib/takeout-import-filenames";
import { createTakeoutImportJob, ensureImportTempDir, listRecentTakeoutImportJobs } from "~/lib/takeout-import-jobs";
import { kickTakeoutImportWorker } from "~/lib/takeout-import-worker";
import { isDemoModeEnabled } from "~/lib/demo-mode";

interface CreateJobBody {
  filename?: string;
  fileSizeBytes?: number;
  existingServerFilename?: string;
  deleteServerFileAfterImport?: boolean;
  options?: Record<string, unknown>;
}

interface ArchivePartOption {
  sourceFilename: string;
  tempFilePath: string;
  fileSizeBytes: number;
}

const MAX_FILE_SIZE_BYTES = 15 * 1024 * 1024 * 1024; // 15 GiB

export async function GET() {
  if (isDemoModeEnabled()) {
    return Response.json({ jobs: [] });
  }
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
    const baseName = normalizeTakeoutServerFilename(existingServerFilename);
    if (!baseName) return new Response("Invalid existingServerFilename", { status: 400 });
    if (!isTakeoutArchiveFilename(baseName)) {
      return new Response("Only .tgz or .tar.gz files are supported", { status: 400 });
    }

    const tempDir = await ensureImportTempDir();
    const availableFiles = (await listTakeoutServerArchives(1000)).map((file) => file.filename);
    const selectedParts = detectTakeoutMultipartSet(baseName, availableFiles);
    const archiveParts: ArchivePartOption[] = [];

    for (const partFilename of selectedParts) {
      const resolvedPath = path.join(tempDir, partFilename);

      let fileStat;
      try {
        fileStat = await stat(resolvedPath);
      } catch {
        return new Response(`Server file not found: ${partFilename}`, { status: 404 });
      }
      if (!fileStat.isFile()) return new Response(`Server path is not a file: ${partFilename}`, { status: 400 });

      archiveParts.push({
        sourceFilename: partFilename,
        tempFilePath: resolvedPath,
        fileSizeBytes: Number(fileStat.size),
      });
    }

    if (archiveParts.length === 0) return new Response("Server file not found", { status: 404 });

    filename = requestedFilename || archiveParts[0].sourceFilename;
    fileSizeBytes = archiveParts.reduce((total, part) => total + part.fileSizeBytes, 0);
    tempFilePath = archiveParts[0].tempFilePath;
    uploadedBytes = fileSizeBytes;
    options.archiveParts = archiveParts;
    const deleteAfterSuccess = body.deleteServerFileAfterImport === true;
    options.deleteSourceFileOnSuccess = deleteAfterSuccess;
    options.keepSourceFile = !deleteAfterSuccess;
  }

  if (!filename) {
    return new Response("Missing filename", { status: 400 });
  }

  if (!isTakeoutArchiveFilename(filename)) {
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
