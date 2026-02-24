import { listTakeoutServerArchives } from "~/lib/takeout-import-files";
import { ensureImportTempDir } from "~/lib/takeout-import-jobs";

export async function GET() {
  try {
    const directory = await ensureImportTempDir();
    const files = await listTakeoutServerArchives(100);
    return Response.json({ available: true, directory, files });
  } catch {
    return Response.json(
      {
        available: false,
        files: [],
        error: "Server takeout directory is not available.",
      },
      { status: 503 },
    );
  }
}
