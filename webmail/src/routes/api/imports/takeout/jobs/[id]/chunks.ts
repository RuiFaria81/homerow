import type { APIEvent } from "@solidjs/start/server";
import { open } from "node:fs/promises";
import { dirname } from "node:path";
import { mkdir } from "node:fs/promises";
import { getTakeoutImportJob, setTakeoutImportUploadedBytes } from "~/lib/takeout-import-jobs";

const MAX_CHUNK_BYTES = 8 * 1024 * 1024;

export async function POST({ params, request }: APIEvent) {
  const id = params.id;
  if (!id) return new Response("Missing job id", { status: 400 });

  const job = await getTakeoutImportJob(id);
  if (!job) return new Response("Job not found", { status: 404 });

  if (!["created", "uploading"].includes(job.status)) {
    return new Response("Job is not accepting uploads", { status: 409 });
  }

  const form = await request.formData();
  const chunk = form.get("chunk");
  const offsetRaw = form.get("offset");

  if (!(chunk instanceof Blob)) {
    return new Response("Missing chunk", { status: 400 });
  }

  const offset = Number(offsetRaw);
  if (!Number.isFinite(offset) || offset < 0) {
    return new Response("Invalid offset", { status: 400 });
  }

  if (chunk.size <= 0 || chunk.size > MAX_CHUNK_BYTES) {
    return new Response("Invalid chunk size", { status: 400 });
  }

  await mkdir(dirname(job.tempFilePath), { recursive: true });
  const buffer = Buffer.from(await chunk.arrayBuffer());

  const fileHandle = await open(job.tempFilePath, "a+");
  try {
    await fileHandle.write(buffer, 0, buffer.length, offset);
  } finally {
    await fileHandle.close();
  }

  const uploadedBytes = Math.min(job.fileSizeBytes, offset + buffer.length);
  const updated = await setTakeoutImportUploadedBytes({ id, uploadedBytes });

  return Response.json({ job: updated });
}
