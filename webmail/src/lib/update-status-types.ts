export type UpdateMode = "track-upstream" | "track-origin" | "pinned";

export type UpdateSeverity = "none" | "patch" | "minor" | "major" | "unknown";

export interface UpdateStatusPayload {
  installed: string;
  latest: string | null;
  updateAvailable: boolean;
  severity: UpdateSeverity;
  releaseUrl: string | null;
  checkedAt: string;
  sourceLabel: "Upstream" | "Origin" | "Pinned";
  sourceRepo: string | null;
  mode: UpdateMode;
}
