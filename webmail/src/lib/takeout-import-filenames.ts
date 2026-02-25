import path from "node:path";

const TAKEOUT_ARCHIVE_EXTENSIONS = [".tgz", ".tar.gz"] as const;
const TAKEOUT_PART_SUFFIX_PATTERN = /^(.*?)[\s._-](?:part[\s._-]?)?(\d{3,4})$/i;

interface ParsedMultipartName {
  extension: string;
  stem: string;
  partNumber: number;
}

export function isTakeoutArchiveFilename(value: string): boolean {
  const name = value.trim().toLowerCase();
  return TAKEOUT_ARCHIVE_EXTENSIONS.some((ext) => name.endsWith(ext));
}

export function normalizeTakeoutServerFilename(value: string): string {
  return path.basename(value.trim());
}

function splitArchiveExtension(filename: string): { stem: string; extension: string } | null {
  const trimmed = filename.trim();
  if (!trimmed) return null;
  const lower = trimmed.toLowerCase();
  for (const ext of TAKEOUT_ARCHIVE_EXTENSIONS) {
    if (!lower.endsWith(ext)) continue;
    const stem = trimmed.slice(0, trimmed.length - ext.length);
    return { stem, extension: ext };
  }
  return null;
}

function parseMultipartName(filename: string): ParsedMultipartName | null {
  const split = splitArchiveExtension(filename);
  if (!split) return null;
  const match = split.stem.match(TAKEOUT_PART_SUFFIX_PATTERN);
  if (!match) return null;
  const stem = match[1].trim();
  const partNumber = Number.parseInt(match[2], 10);
  if (!stem || !Number.isFinite(partNumber)) return null;
  return { extension: split.extension, stem: stem.toLowerCase(), partNumber };
}

export function detectTakeoutMultipartSet(selectedFilename: string, allFilenames: string[]): string[] {
  const selectedBase = normalizeTakeoutServerFilename(selectedFilename);
  const selectedParsed = parseMultipartName(selectedBase);
  if (!selectedParsed) return [selectedBase];

  const matched = allFilenames
    .map((name) => normalizeTakeoutServerFilename(name))
    .map((name) => ({ name, parsed: parseMultipartName(name) }))
    .filter((entry) =>
      Boolean(entry.parsed)
      && entry.parsed!.extension === selectedParsed.extension
      && entry.parsed!.stem === selectedParsed.stem,
    )
    .sort((a, b) => a.parsed!.partNumber - b.parsed!.partNumber);

  if (matched.length <= 1) return [selectedBase];
  return matched.map((entry) => entry.name);
}
