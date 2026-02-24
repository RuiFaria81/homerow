import path from "node:path";

const TAKEOUT_ARCHIVE_EXTENSIONS = [".tgz", ".tar.gz"] as const;

export function isTakeoutArchiveFilename(value: string): boolean {
  const name = value.trim().toLowerCase();
  return TAKEOUT_ARCHIVE_EXTENSIONS.some((ext) => name.endsWith(ext));
}

export function normalizeTakeoutServerFilename(value: string): string {
  return path.basename(value.trim());
}
