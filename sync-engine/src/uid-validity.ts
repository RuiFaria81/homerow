export function normalizeUidValidity(value: string | number | null | undefined): string | null {
  if (value === null || value === undefined) return null;
  const normalized = String(value).trim();
  return normalized.length > 0 ? normalized : null;
}

export function isSameUidValidity(
  dbValue: string | number | null | undefined,
  serverValue: string | number | null | undefined,
): boolean {
  const left = normalizeUidValidity(dbValue);
  const right = normalizeUidValidity(serverValue);
  if (left === null || right === null) return false;
  return left === right;
}
