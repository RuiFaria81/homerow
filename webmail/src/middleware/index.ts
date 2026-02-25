import { createMiddleware } from "@solidjs/start/middleware";
import { redirect } from "@solidjs/router";
import { auth } from "~/lib/auth";
import { isDemoModeEnabled, isDemoStaticModeEnabled } from "~/lib/demo-mode";
import { resetDemoState } from "~/lib/demo-mail-data";
import { DEMO_AUTH_COOKIE } from "~/lib/demo-user";

function getCookieValue(cookieHeader: string, name: string): string | null {
  const prefix = `${name}=`;
  for (const part of cookieHeader.split(";")) {
    const trimmed = part.trim();
    if (trimmed.startsWith(prefix)) {
      return trimmed.slice(prefix.length);
    }
  }
  return null;
}

export default createMiddleware({
  onRequest: async (event) => {
    const { pathname } = new URL(event.request.url);
    const accept = event.request.headers.get("accept") || "";
    const isApiRequest =
      pathname.startsWith("/api/") ||
      pathname.startsWith("/_server") ||
      pathname.startsWith("/_m");
    const wantsHtmlDocument = accept.includes("text/html");

    if (isDemoStaticModeEnabled()) {
      if (isDemoModeEnabled() && wantsHtmlDocument) {
        resetDemoState();
      }
      return;
    }

    // Skip auth check for login page, auth API routes, and static assets
    if (
      pathname === "/login" ||
      pathname === "/api/health" ||
      pathname.startsWith("/api/demo-auth/") ||
      pathname.startsWith("/api/auth/") ||
      pathname.startsWith("/_build/") ||
      pathname.startsWith("/assets/") ||
      pathname === "/manifest.webmanifest" ||
      pathname === "/sw.js" ||
      pathname === "/favicon.svg" ||
      pathname === "/favicon.ico" ||
      pathname.endsWith(".png") ||
      pathname.endsWith(".ico")
    ) {
      if (isDemoModeEnabled() && wantsHtmlDocument) {
        resetDemoState();
      }
      return;
    }

    if (isDemoModeEnabled()) {
      if (wantsHtmlDocument) {
        // Demo should always start from a clean state after hard reload.
        resetDemoState();
      }
      const cookieHeader = event.request.headers.get("cookie") || "";
      const demoCookie = getCookieValue(cookieHeader, DEMO_AUTH_COOKIE);
      const isDemoAuthenticated = demoCookie === "1";

      if (!isDemoAuthenticated) {
        if (isApiRequest || !wantsHtmlDocument) {
          return new Response(JSON.stringify({ error: "Unauthorized" }), {
            status: 401,
            headers: { "content-type": "application/json" },
          });
        }
        return redirect("/login");
      }
      return;
    }

    const session = await auth.api.getSession({
      headers: event.request.headers,
    });

    if (!session) {
      if (isApiRequest || !wantsHtmlDocument) {
        return new Response(
          JSON.stringify({ error: "Unauthorized" }),
          {
            status: 401,
            headers: { "content-type": "application/json" },
          },
        );
      }
      return redirect("/login");
    }
  },
});
