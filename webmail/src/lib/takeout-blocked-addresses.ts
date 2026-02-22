export function parseTakeoutBlockedAddressesJson(content: string): string[] {
  try {
    const parsed = JSON.parse(content) as Record<string, unknown>;
    const rawAddresses = Array.isArray(parsed.addresses) ? parsed.addresses : [];
    const seen = new Set<string>();
    const out: string[] = [];
    for (const entry of rawAddresses) {
      if (typeof entry !== "string") continue;
      const normalized = entry.trim().toLowerCase();
      if (!normalized || seen.has(normalized)) continue;
      if (!/^[a-z0-9._%+\-]+@[a-z0-9.\-]+\.[a-z]{2,}$/i.test(normalized)) continue;
      seen.add(normalized);
      out.push(normalized);
    }
    return out.sort((a, b) => a.localeCompare(b));
  } catch {
    return [];
  }
}
