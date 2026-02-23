import type { APIEvent } from "@solidjs/start/server";
import { auth } from "~/lib/auth";
import { getUpdateStatus } from "~/lib/update-status-server";

function isAdminEmail(email: string | null | undefined): boolean {
  const configured = (process.env.ADMIN_EMAIL || "").trim().toLowerCase();
  if (!configured) return true;
  return (email || "").trim().toLowerCase() === configured;
}

export async function GET({ request }: APIEvent) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session?.user) return new Response("Unauthorized", { status: 401 });
  if (!isAdminEmail(session.user.email)) return new Response("Forbidden", { status: 403 });

  const url = new URL(request.url);
  const force = url.searchParams.get("force") === "1";
  const status = await getUpdateStatus({ force });
  return Response.json(status, { status: 200 });
}
