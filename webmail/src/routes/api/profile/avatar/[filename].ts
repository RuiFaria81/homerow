import type { APIEvent } from "@solidjs/start/server";
import { readAvatarByFilename } from "~/lib/avatar-storage";

export async function GET({ params }: APIEvent) {
  const filename = params.filename;
  if (!filename) return new Response("Missing filename", { status: 400 });

  const avatar = await readAvatarByFilename(filename);
  if (!avatar) return new Response("Not found", { status: 404 });

  return new Response(avatar.data, {
    status: 200,
    headers: {
      "content-type": avatar.contentType,
      "cache-control": "public, max-age=31536000, immutable",
    },
  });
}
