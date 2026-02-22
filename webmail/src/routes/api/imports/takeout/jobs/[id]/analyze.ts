import type { APIEvent } from "@solidjs/start/server";
import {
  beginTakeoutImportEstimation,
  clearTakeoutImportEstimationState,
  getTakeoutImportJob,
  mergeTakeoutImportJobOptions,
  setTakeoutImportEstimatedTotalMessages,
  updateTakeoutImportEstimationProgress,
} from "~/lib/takeout-import-jobs";
import { analyzeTakeoutArchive } from "~/lib/takeout-import-worker";

interface AnalyzeJobBody {
  force?: boolean;
}

const runningAnalyses = new Map<string, Promise<void>>();

function hasBlockedSendersAnalysis(value: unknown): boolean {
  if (!value || typeof value !== "object") return false;
  const parsed = value as Record<string, unknown>;
  return Array.isArray(parsed.blockedSenders);
}

function isAnalysisRunning(id: string): boolean {
  return runningAnalyses.has(id);
}

function kickTakeoutArchiveAnalysis(id: string): void {
  if (runningAnalyses.has(id)) return;

  const task = (async () => {
    const job = await getTakeoutImportJob(id);
    if (!job) return;
    if (job.uploadedBytes < job.fileSizeBytes) return;

    try {
      await beginTakeoutImportEstimation({
        id: job.id,
        estimationTotalBytes: job.fileSizeBytes,
      });

      let lastProgressWrite = 0;
      const analysis = await analyzeTakeoutArchive({
        tgzPath: job.tempFilePath,
        onProgress: async (bytesRead, totalBytes) => {
          const now = Date.now();
          if (now - lastProgressWrite < 1000) return;
          lastProgressWrite = now;
          await updateTakeoutImportEstimationProgress({
            id: job.id,
            estimationScannedBytes: Math.min(bytesRead, totalBytes),
          });
        },
      });

      await setTakeoutImportEstimatedTotalMessages({
        id: job.id,
        estimatedTotalMessages: analysis.estimatedTotalMessages,
      });

      await mergeTakeoutImportJobOptions(job.id, {
        takeoutAnalysis: analysis,
        takeoutAnalysisError: null,
        takeoutAnalysisUpdatedAt: new Date().toISOString(),
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Takeout analysis failed.";
      await mergeTakeoutImportJobOptions(job.id, {
        takeoutAnalysisError: message,
      });
    } finally {
      await clearTakeoutImportEstimationState(job.id);
      runningAnalyses.delete(id);
    }
  })().finally(() => {
    runningAnalyses.delete(id);
  });

  runningAnalyses.set(id, task);
}

export async function POST({ params, request }: APIEvent) {
  const id = params.id;
  if (!id) return new Response("Missing job id", { status: 400 });

  let body: AnalyzeJobBody = {};
  try {
    const parsed = await request.json();
    if (parsed && typeof parsed === "object") body = parsed as AnalyzeJobBody;
  } catch {
    // Body is optional.
  }

  const job = await getTakeoutImportJob(id);
  if (!job) return new Response("Job not found", { status: 404 });
  if (job.uploadedBytes < job.fileSizeBytes) return new Response("Upload incomplete", { status: 409 });

  const existingAnalysis = job.options?.takeoutAnalysis;
  if (!body.force && existingAnalysis && typeof existingAnalysis === "object" && hasBlockedSendersAnalysis(existingAnalysis)) {
    return Response.json({ job, analysis: existingAnalysis });
  }

  if (body.force) {
    await mergeTakeoutImportJobOptions(job.id, {
      takeoutAnalysis: null,
      takeoutAnalysisError: null,
    });
  }

  const alreadyRunning = isAnalysisRunning(job.id);
  kickTakeoutArchiveAnalysis(job.id);

  const refreshed = await getTakeoutImportJob(job.id);
  return Response.json(
    { job: refreshed ?? job, started: !alreadyRunning, inProgress: true },
    { status: 202 },
  );
}
