import type { APIEvent } from "@solidjs/start/server";
import { isDemoModeEnabled } from "~/lib/demo-mode";
import { DEMO_AUTH_COOKIE, DEMO_USER_PASSWORD, DEMO_USER_PROFILE } from "~/lib/demo-user";

interface DemoLoginBody {
  email?: string;
  password?: string;
}

export async function POST({ request }: APIEvent) {
  if (!isDemoModeEnabled()) return new Response("Not found", { status: 404 });

  let body: DemoLoginBody;
  try {
    body = (await request.json()) as DemoLoginBody;
  } catch {
    return new Response("Invalid payload", { status: 400 });
  }

  const email = (body.email || "").trim().toLowerCase();
  const password = body.password || "";
  const valid = email === DEMO_USER_PROFILE.email.toLowerCase() && password === DEMO_USER_PASSWORD;
  if (!valid) return new Response("Invalid demo credentials", { status: 401 });

  const secure = new URL(request.url).protocol === "https:";
  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: {
      "content-type": "application/json",
      "set-cookie": `${DEMO_AUTH_COOKIE}=1; Path=/; HttpOnly; SameSite=Lax${secure ? "; Secure" : ""}`,
    },
  });
}
