import type { UpdateStatusPayload } from "./update-status-types";

export async function getUpdateStatusClient(): Promise<UpdateStatusPayload | null> {
  try {
    const response = await fetch("/api/system/update-status", {
      headers: { accept: "application/json" },
    });

    if (!response.ok) return null;
    return (await response.json()) as UpdateStatusPayload;
  } catch {
    return null;
  }
}
