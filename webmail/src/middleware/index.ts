import { createMiddleware } from "@solidjs/start/middleware";
import { redirect } from "@solidjs/router";
import { auth } from "~/lib/auth";
import { isDemoModeEnabled, isDemoStaticModeEnabled } from "~/lib/demo-mode";
import { resetDemoState } from "~/lib/demo-mail-data";

export default createMiddleware({
  onRequest: async (event) => {
    const { pathname, search } = new URL(event.request.url);
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

    // Support older cached clients that still request hashed chunks from
    // /assets/* instead of /_build/assets/*.
    if (pathname.startsWith("/assets/")) {
      const target = pathname.replace("/assets/", "/_build/assets/");
      return new Response(null, {
        status: 307,
        headers: { location: `${target}${search}` },
      });
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
