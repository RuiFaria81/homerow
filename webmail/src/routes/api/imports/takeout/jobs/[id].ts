import type { APIEvent } from "@solidjs/start/server";
import { getTakeoutImportJob } from "~/lib/takeout-import-jobs";
import { kickTakeoutImportWorker } from "~/lib/takeout-import-worker";

export async function GET({ params }: APIEvent) {
  void kickTakeoutImportWorker();
  const id = params.id;
  if (!id) return new Response("Missing job id", { status: 400 });

  const job = await getTakeoutImportJob(id);
  if (!job) return new Response("Job not found", { status: 404 });

  return Response.json({ job });
}
