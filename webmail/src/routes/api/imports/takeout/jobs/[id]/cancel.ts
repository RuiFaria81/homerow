import type { APIEvent } from "@solidjs/start/server";
import { requestCancelTakeoutJob } from "~/lib/takeout-import-worker";
import { getTakeoutImportJob } from "~/lib/takeout-import-jobs";

export async function POST({ params }: APIEvent) {
  const id = params.id;
  if (!id) return new Response("Missing job id", { status: 400 });

  const ok = await requestCancelTakeoutJob(id);
  if (!ok) return new Response("Job not found or cannot be cancelled", { status: 404 });

  const job = await getTakeoutImportJob(id);
  return Response.json({ job });
}
