import path from "node:path";
import { tmpdir } from "node:os";
import { createHash } from "node:crypto";

function checkpointBaseName(archivePath: string): string {
  const file = path.basename(archivePath);
  if (file.endsWith(".tar.gz")) return file.slice(0, -".tar.gz".length);
  if (file.endsWith(".tgz")) return file.slice(0, -".tgz".length);
  return file;
}

function checkpointStem(archivePath: string): string {
  const base = checkpointBaseName(archivePath).replace(/[^a-zA-Z0-9._-]/g, "_");
  const full = path.resolve(archivePath);
  const digest = createHash("sha1").update(full).digest("hex").slice(0, 12);
  return `${base}-${digest}`;
}

export function getTakeoutCheckpointDir(): string {
  const configured = (process.env.TAKEOUT_IMPORT_CHECKPOINT_DIR || "").trim();
  if (configured) return configured;
  return path.join(tmpdir(), "webmail-takeout-checkpoints");
}

export function checkpointMetaPathForArchive(archivePath: string): string {
  return path.join(getTakeoutCheckpointDir(), `.import-checkpoint-${checkpointStem(archivePath)}.json`);
}

export function checkpointIdsPathForArchive(archivePath: string): string {
  return path.join(getTakeoutCheckpointDir(), `.import-checkpoint-${checkpointStem(archivePath)}.ids`);
}

