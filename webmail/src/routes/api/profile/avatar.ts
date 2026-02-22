import type { APIEvent } from "@solidjs/start/server";
import { auth } from "~/lib/auth";
import { deleteAvatarByPublicUrl, saveAvatarBlob } from "~/lib/avatar-storage";

export async function POST({ request }: APIEvent) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) return new Response("Unauthorized", { status: 401 });

  const form = await request.formData();
  const avatar = form.get("avatar");
  if (!(avatar instanceof Blob)) {
    return new Response("Missing avatar file", { status: 400 });
  }

  try {
    const url = await saveAvatarBlob(avatar);
    return Response.json({ url }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not upload avatar";
    return new Response(message, { status: 400 });
  }
}

export async function DELETE({ request }: APIEvent) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) return new Response("Unauthorized", { status: 401 });

  let payload: { imageUrl?: string };
  try {
    payload = (await request.json()) as { imageUrl?: string };
  } catch {
    payload = {};
  }

  await deleteAvatarByPublicUrl(payload.imageUrl);
  return Response.json({ success: true });
}
