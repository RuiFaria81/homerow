const TRUTHY_VALUES = new Set(["1", "true", "yes", "on"]);

function parseBooleanEnv(value: string | undefined): boolean {
  if (!value) return false;
  return TRUTHY_VALUES.has(value.trim().toLowerCase());
}

export function isDemoModeEnabled(): boolean {
  const baseUrl = (import.meta as { env?: Record<string, string | undefined> }).env?.BASE_URL || "";
  if (baseUrl.includes("/demo/") || baseUrl.includes("/webmail-demo/")) {
    return true;
  }
  const metaEnv = (import.meta as { env?: Record<string, string | undefined> }).env;
  if (parseBooleanEnv(metaEnv?.WEBMAIL_DEMO_MODE) || parseBooleanEnv(metaEnv?.DEMO_MODE)) {
    return true;
  }
  const globalFlag = (globalThis as { __WEBMAIL_DEMO_MODE__?: boolean }).__WEBMAIL_DEMO_MODE__;
  if (typeof globalFlag === "boolean") return globalFlag;
  const env = typeof process !== "undefined" ? process.env : undefined;
  return parseBooleanEnv(env?.WEBMAIL_DEMO_MODE) || parseBooleanEnv(env?.DEMO_MODE);
}

export function isDemoStaticModeEnabled(): boolean {
  const baseUrl = (import.meta as { env?: Record<string, string | undefined> }).env?.BASE_URL || "";
  if (baseUrl.includes("/demo/") || baseUrl.includes("/webmail-demo/")) {
    return true;
  }
  const metaEnv = (import.meta as { env?: Record<string, string | undefined> }).env;
  if (parseBooleanEnv(metaEnv?.WEBMAIL_DEMO_STATIC)) {
    return true;
  }
  const globalFlag = (globalThis as { __WEBMAIL_DEMO_STATIC_MODE__?: boolean }).__WEBMAIL_DEMO_STATIC_MODE__;
  if (typeof globalFlag === "boolean") return globalFlag;
  const env = typeof process !== "undefined" ? process.env : undefined;
  return parseBooleanEnv(env?.WEBMAIL_DEMO_STATIC);
}
