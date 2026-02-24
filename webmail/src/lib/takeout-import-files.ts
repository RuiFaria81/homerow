import { readdir, stat } from "node:fs/promises";
import path from "node:path";
import { isTakeoutArchiveFilename } from "~/lib/takeout-import-filenames";
import { ensureImportTempDir } from "~/lib/takeout-import-jobs";

export interface TakeoutServerArchiveFile {
  filename: string;
  fileSizeBytes: number;
  modifiedAt: string;
}

export async function listTakeoutServerArchives(limit = 100): Promise<TakeoutServerArchiveFile[]> {
  const dir = await ensureImportTempDir();
  const entries = await readdir(dir, { withFileTypes: true });

  const files = await Promise.all(entries
    .filter((entry) => entry.isFile() && isTakeoutArchiveFilename(entry.name))
    .map(async (entry) => {
      const fullPath = path.join(dir, entry.name);
      const fileStat = await stat(fullPath);
      return {
        filename: entry.name,
        fileSizeBytes: Number(fileStat.size),
        modifiedAt: fileStat.mtime.toISOString(),
      } satisfies TakeoutServerArchiveFile;
    }));

  return files
    .sort((a, b) => Date.parse(b.modifiedAt) - Date.parse(a.modifiedAt))
    .slice(0, Math.max(1, limit));
}
