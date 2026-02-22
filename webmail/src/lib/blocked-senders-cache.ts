export const BLOCKED_SENDERS_CACHE_KEY = "blocked-senders-cache-v1";

function canUseStorage(): boolean {
  return typeof window !== "undefined" && typeof localStorage !== "undefined";
}

function normalizeEmail(value: string): string {
  return value.trim().toLowerCase();
}

export function cacheBlockedSenderEmails(values: Array<string | null | undefined>): void {
  if (!canUseStorage()) return;
  const unique = Array.from(
    new Set(
      values
        .map((value) => (typeof value === "string" ? normalizeEmail(value) : ""))
        .filter(Boolean),
    ),
  );
  localStorage.setItem(BLOCKED_SENDERS_CACHE_KEY, JSON.stringify(unique));
}

export function getBlockedSenderEmailSet(): Set<string> {
  if (!canUseStorage()) return new Set();
  try {
    const raw = localStorage.getItem(BLOCKED_SENDERS_CACHE_KEY);
    if (!raw) return new Set();
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return new Set();
    return new Set(parsed.map((item) => normalizeEmail(String(item))));
  } catch {
    return new Set();
  }
}

export function extractEmailAddress(value?: string | null): string | null {
  if (!value) return null;
  const match = value.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i);
  return match ? normalizeEmail(match[0]) : null;
}

export function isBlockedSenderCandidate(params: {
  fromAddress?: string | null;
  fromLabel?: string | null;
}): boolean {
  const blocked = getBlockedSenderEmailSet();
  if (!blocked.size) return false;

  const fromAddress = params.fromAddress ? normalizeEmail(params.fromAddress) : "";
  if (fromAddress && blocked.has(fromAddress)) return true;

  const extracted = extractEmailAddress(params.fromLabel);
  return extracted ? blocked.has(extracted) : false;
}
