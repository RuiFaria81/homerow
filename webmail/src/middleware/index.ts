import { createMiddleware } from "@solidjs/start/middleware";
import { redirect } from "@solidjs/router";
import { auth } from "~/lib/auth";

export default createMiddleware({
  onRequest: async (event) => {
    const { pathname } = new URL(event.request.url);
    const accept = event.request.headers.get("accept") || "";

    // Skip auth check for login page, auth API routes, and static assets
    if (
      pathname === "/login" ||
      pathname === "/api/health" ||
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
      return;
    }

    const session = await auth.api.getSession({
      headers: event.request.headers,
    });

    if (!session) {
      const isApiRequest =
        pathname.startsWith("/api/") ||
        pathname.startsWith("/_server") ||
        pathname.startsWith("/_m");
      const wantsHtmlDocument = accept.includes("text/html");

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
