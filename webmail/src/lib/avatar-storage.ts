import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import { basename, extname, join, resolve } from "node:path";
import { randomUUID } from "node:crypto";
import { tmpdir } from "node:os";

const AVATAR_PUBLIC_PREFIX = "/api/profile/avatar/";
const defaultAvatarStorageDir = (() => {
  const cwd = process.cwd();
  if (!cwd || cwd === "/") return join(tmpdir(), "webmail", "avatars");
  return join(cwd, ".data", "avatars");
})();
const AVATAR_STORAGE_DIR = process.env.AVATAR_STORAGE_DIR || defaultAvatarStorageDir;

const MIME_TO_EXT: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
};

const EXT_TO_MIME: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
  ".gif": "image/gif",
};

export const MAX_AVATAR_BYTES = 1_500_000;

const safeFilename = (value: string) => basename(value).replace(/[^a-zA-Z0-9._-]/g, "");

export async function saveAvatarBlob(blob: Blob): Promise<string> {
  const ext = MIME_TO_EXT[blob.type];
  if (!ext) throw new Error("Unsupported image type. Use PNG, JPG, WEBP, or GIF.");
  if (!Number.isFinite(blob.size) || blob.size <= 0 || blob.size > MAX_AVATAR_BYTES) {
    throw new Error("Invalid image size. Keep it under 1.5MB.");
  }

  const buffer = Buffer.from(await blob.arrayBuffer());
  const filename = `${Date.now()}-${randomUUID()}.${ext}`;
  await mkdir(AVATAR_STORAGE_DIR, { recursive: true });
  await writeFile(join(AVATAR_STORAGE_DIR, filename), buffer, { flag: "wx" });
  return `${AVATAR_PUBLIC_PREFIX}${encodeURIComponent(filename)}`;
}

export async function deleteAvatarByPublicUrl(imageUrl: string | null | undefined): Promise<void> {
  if (!imageUrl || typeof imageUrl !== "string") return;

  let pathname = imageUrl;
  try {
    pathname = new URL(imageUrl, "http://localhost").pathname;
  } catch {
    pathname = imageUrl;
  }

  if (!pathname.startsWith(AVATAR_PUBLIC_PREFIX)) return;
  const rawName = decodeURIComponent(pathname.slice(AVATAR_PUBLIC_PREFIX.length));
  const filename = safeFilename(rawName);
  if (!filename) return;

  try {
    await unlink(join(AVATAR_STORAGE_DIR, filename));
  } catch {
    // Ignore file-not-found and transient deletion errors.
  }
}

export async function readAvatarByFilename(filenameParam: string): Promise<{ contentType: string; data: Buffer } | null> {
  const filename = safeFilename(decodeURIComponent(filenameParam || ""));
  if (!filename) return null;

  const absoluteDir = resolve(AVATAR_STORAGE_DIR);
  const absoluteFile = resolve(join(absoluteDir, filename));
  if (!absoluteFile.startsWith(`${absoluteDir}/`) && absoluteFile !== absoluteDir) {
    return null;
  }

  const contentType = EXT_TO_MIME[extname(filename).toLowerCase()] || "application/octet-stream";
  try {
    const data = await readFile(absoluteFile);
    return { contentType, data };
  } catch {
    return null;
  }
}
