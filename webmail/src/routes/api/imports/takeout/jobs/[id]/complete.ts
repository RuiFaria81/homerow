import type { APIEvent } from "@solidjs/start/server";
import { getTakeoutImportJob, mergeTakeoutImportJobOptions, queueTakeoutImportJob } from "~/lib/takeout-import-jobs";
import { kickTakeoutImportWorker } from "~/lib/takeout-import-worker";

interface CompleteJobBody {
  options?: Record<string, unknown>;
}

export async function POST({ params, request }: APIEvent) {
  const id = params.id;
  if (!id) return new Response("Missing job id", { status: 400 });

  let body: CompleteJobBody = {};
  try {
    const parsed = await request.json();
    if (parsed && typeof parsed === "object") body = parsed as CompleteJobBody;
  } catch {
    // Body is optional.
  }

  let job = await getTakeoutImportJob(id);
  if (!job) return new Response("Job not found", { status: 404 });

  if (job.uploadedBytes < job.fileSizeBytes) {
    return new Response("Upload incomplete", { status: 409 });
  }

  if (body.options && typeof body.options === "object") {
    const updated = await mergeTakeoutImportJobOptions(id, body.options);
    if (updated) job = updated;
  }

  const queued = await queueTakeoutImportJob(id);
  if (!queued) {
    return new Response("Job cannot be queued from current state", { status: 409 });
  }

  void kickTakeoutImportWorker();

  return Response.json({ job: queued });
}
