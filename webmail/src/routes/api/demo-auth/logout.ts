import type { APIEvent } from "@solidjs/start/server";
import { isDemoModeEnabled } from "~/lib/demo-mode";
import { DEMO_AUTH_COOKIE } from "~/lib/demo-user";

export async function POST({ request }: APIEvent) {
  if (!isDemoModeEnabled()) return new Response("Not found", { status: 404 });
  const secure = new URL(request.url).protocol === "https:";
  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: {
      "content-type": "application/json",
      "set-cookie": `${DEMO_AUTH_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${secure ? "; Secure" : ""}`,
    },
  });
}
