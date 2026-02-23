"use server";

import { readFile } from "node:fs/promises";
import path from "node:path";
import type { UpdateMode, UpdateSeverity, UpdateStatusPayload } from "./update-status-types";

const DEFAULT_REPO = "guilhermeprokisch/homerow";
const CACHE_TTL_MS = 12 * 60 * 60 * 1000;

interface Semver {
  major: number;
  minor: number;
  patch: number;
  prerelease: string | null;
}

let cachedValue: UpdateStatusPayload | null = null;
let cachedAt = 0;

export function normalizeVersion(raw: string | null | undefined): string | null {
  const value = (raw || "").trim();
  if (!value) return null;
  const prefixed = value.startsWith("v") ? value : `v${value}`;
  if (!/^v\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/.test(prefixed)) return null;
  return prefixed;
}

function parseSemver(version: string | null): Semver | null {
  if (!version) return null;
  const match = /^v(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z.-]+))?$/.exec(version);
  if (!match) return null;
  return {
    major: Number.parseInt(match[1], 10),
    minor: Number.parseInt(match[2], 10),
    patch: Number.parseInt(match[3], 10),
    prerelease: match[4] || null,
  };
}

export function compareVersions(a: string | null, b: string | null): number {
  const left = parseSemver(a);
  const right = parseSemver(b);
  if (!left || !right) return 0;

  if (left.major !== right.major) return left.major - right.major;
  if (left.minor !== right.minor) return left.minor - right.minor;
  if (left.patch !== right.patch) return left.patch - right.patch;

  if (!left.prerelease && right.prerelease) return 1;
  if (left.prerelease && !right.prerelease) return -1;
  if (!left.prerelease && !right.prerelease) return 0;
  return left.prerelease!.localeCompare(right.prerelease!);
}

export function computeSeverity(installed: string | null, latest: string | null): UpdateSeverity {
  const current = parseSemver(installed);
  const next = parseSemver(latest);
  if (!current || !next) return "unknown";

  const cmp = compareVersions(installed, latest);
  if (cmp >= 0) return "none";

  if (next.major > current.major) return "major";
  if (next.minor > current.minor) return "minor";
  return "patch";
}

async function readInstalledVersionFromFile(): Promise<string | null> {
  const candidates = [
    path.resolve(process.cwd(), "VERSION"),
    path.resolve(process.cwd(), "..", "VERSION"),
    path.resolve(process.cwd(), "..", "..", "VERSION"),
  ];

  for (const candidate of candidates) {
    try {
      const value = (await readFile(candidate, "utf8")).trim();
      const normalized = normalizeVersion(value);
      if (normalized) return normalized;
    } catch {
      // Try next location.
    }
  }

  return null;
}

async function resolveInstalledVersion(): Promise<string> {
  const fromEnv =
    normalizeVersion(process.env.HOMEROW_VERSION) ||
    normalizeVersion(process.env.APP_VERSION) ||
    normalizeVersion(process.env.VERSION);
  if (fromEnv) return fromEnv;

  const fromFile = await readInstalledVersionFromFile();
  if (fromFile) return fromFile;

  return "unknown";
}

function resolveMode(): UpdateMode {
  const value = (process.env.UPDATE_MODE || "track-upstream").trim();
  if (value === "track-origin" || value === "pinned") return value;
  return "track-upstream";
}

function resolveSource(mode: UpdateMode): { repo: string | null; label: "Upstream" | "Origin" | "Pinned" } {
  if (mode === "pinned") return { repo: null, label: "Pinned" };
  if (mode === "track-origin") {
    const repo =
      process.env.UPDATE_ORIGIN_REPO ||
      process.env.GITHUB_REPOSITORY ||
      process.env.UPSTREAM_REPO ||
      DEFAULT_REPO;
    return { repo: repo.trim(), label: "Origin" };
  }

  const repo = (process.env.UPDATE_SOURCE_REPO || process.env.UPSTREAM_REPO || DEFAULT_REPO).trim();
  return { repo, label: "Upstream" };
}

async function fetchLatestFromRepo(repo: string): Promise<string | null> {
  const mock = normalizeVersion(process.env.UPDATE_CHECK_MOCK_LATEST_VERSION);
  if (mock) return mock;

  const headers = {
    "accept": "application/vnd.github+json",
    "user-agent": "homerow-webmail-update-check",
  };

  try {
    const latestReleaseResponse = await fetch(`https://api.github.com/repos/${repo}/releases/latest`, {
      headers,
      signal: AbortSignal.timeout(7000),
    });

    if (latestReleaseResponse.ok) {
      const payload = (await latestReleaseResponse.json()) as { tag_name?: string };
      const normalized = normalizeVersion(payload.tag_name || null);
      if (normalized) return normalized;
    }
  } catch {
    // Fall through to tags endpoint.
  }

  try {
    const tagsResponse = await fetch(`https://api.github.com/repos/${repo}/tags?per_page=50`, {
      headers,
      signal: AbortSignal.timeout(7000),
    });
    if (!tagsResponse.ok) return null;

    const payload = (await tagsResponse.json()) as Array<{ name?: string }>;
    const versions = payload
      .map((item) => normalizeVersion(item.name || null))
      .filter((value): value is string => Boolean(value));

    if (versions.length === 0) return null;

    versions.sort((a, b) => compareVersions(a, b));
    return versions[versions.length - 1];
  } catch {
    return null;
  }
}

async function resolveLatestVersion(mode: UpdateMode, sourceRepo: string | null): Promise<string | null> {
  const mock = normalizeVersion(process.env.UPDATE_CHECK_MOCK_LATEST_VERSION);
  if (mock) return mock;

  if (mode === "pinned") {
    return normalizeVersion(process.env.UPDATE_TARGET || null);
  }
  if (!sourceRepo) return null;
  return fetchLatestFromRepo(sourceRepo);
}

function releaseUrlFor(repo: string | null, version: string | null): string | null {
  if (!repo || !version) return null;
  return `https://github.com/${repo}/releases/tag/${version}`;
}

function resolveDebugForcedStatus(input: {
  installed: string;
  latest: string | null;
  mode: UpdateMode;
  source: { repo: string | null; label: "Upstream" | "Origin" | "Pinned" };
}): UpdateStatusPayload | null {
  const forceAvailable = process.env.UPDATE_CHECK_FORCE_AVAILABLE === "1";
  const forceLatest = normalizeVersion(process.env.UPDATE_CHECK_FORCE_LATEST_VERSION || null);
  const forceInstalled = normalizeVersion(process.env.UPDATE_CHECK_FORCE_INSTALLED_VERSION || null);

  if (!forceAvailable && !forceLatest && !forceInstalled) return null;

  const installed = forceInstalled || input.installed;
  const latest = forceLatest || input.latest || normalizeVersion("v999.0.0");
  const severity = computeSeverity(normalizeVersion(installed), latest);
  const updateAvailable = forceAvailable ? true : severity !== "none" && severity !== "unknown";

  return {
    installed,
    latest,
    updateAvailable,
    severity: forceAvailable && (severity === "none" || severity === "unknown") ? "minor" : severity,
    releaseUrl: releaseUrlFor(input.source.repo, latest),
    checkedAt: new Date().toISOString(),
    sourceLabel: input.source.label,
    sourceRepo: input.source.repo,
    mode: input.mode,
  };
}

export async function getUpdateStatus(options?: { force?: boolean }): Promise<UpdateStatusPayload> {
  const now = Date.now();
  const disableCache = process.env.UPDATE_CHECK_DISABLE_CACHE === "1";
  const force = options?.force || false;
  if (!force && !disableCache && cachedValue && now - cachedAt < CACHE_TTL_MS) {
    return cachedValue;
  }

  const mode = resolveMode();
  const source = resolveSource(mode);
  const installed = await resolveInstalledVersion();
  const latest = await resolveLatestVersion(mode, source.repo);
  const debugStatus = resolveDebugForcedStatus({ installed, latest, mode, source });
  if (debugStatus) {
    cachedValue = debugStatus;
    cachedAt = now;
    return debugStatus;
  }
  const severity = computeSeverity(normalizeVersion(installed), latest);
  const updateAvailable = severity !== "none" && severity !== "unknown";

  const status: UpdateStatusPayload = {
    installed,
    latest,
    updateAvailable,
    severity,
    releaseUrl: releaseUrlFor(source.repo, latest),
    checkedAt: new Date().toISOString(),
    sourceLabel: source.label,
    sourceRepo: source.repo,
    mode,
  };

  cachedValue = status;
  cachedAt = now;
  return status;
}
