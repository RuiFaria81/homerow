export function normalizeEmail(value: string | null | undefined): string {
  return (value || "").trim().toLowerCase();
}

export function extractEmailFromSenderDisplay(value: string | null | undefined): string {
  const raw = (value || "").trim();
  if (!raw) return "";

  const bracketMatch = raw.match(/<([^>]+)>/);
  if (bracketMatch && bracketMatch[1]) {
    return normalizeEmail(bracketMatch[1]);
  }

  const directMatch = raw.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i);
  return directMatch ? normalizeEmail(directMatch[0]) : "";
}

export function isCurrentUserSender(params: {
  from?: string | null;
  fromAddress?: string | null;
  currentUserEmail?: string | null;
}): boolean {
  const current = normalizeEmail(params.currentUserEmail);
  if (!current) return false;

  const fromAddress = normalizeEmail(params.fromAddress);
  if (fromAddress) return fromAddress === current;

  return extractEmailFromSenderDisplay(params.from) === current;
}
