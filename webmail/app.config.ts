import { defineConfig } from "@solidjs/start/config";
import tailwindcss from "@tailwindcss/vite";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const parseBooleanEnv = (value?: string) => !!value && ["1", "true", "yes", "on"].includes(value.trim().toLowerCase());
const demoStatic = parseBooleanEnv(process.env.WEBMAIL_DEMO_STATIC);
const basePathRaw = process.env.WEBMAIL_BASE_PATH || "/";
const normalizedBasePath = basePathRaw === "/" ? "/" : `/${basePathRaw.replace(/^\/+|\/+$/g, "")}/`;

export default defineConfig({
  ssr: !demoStatic,
  middleware: "src/middleware/index.ts",
  server: {
    baseURL: normalizedBasePath === "/" ? "" : normalizedBasePath.slice(0, -1),
    preset: "node-server",
  },
  vite: ({ router }) => ({
    base: normalizedBasePath,
    define: {
      "import.meta.env.WEBMAIL_DEMO_MODE": JSON.stringify(process.env.WEBMAIL_DEMO_MODE || ""),
      "import.meta.env.DEMO_MODE": JSON.stringify(process.env.DEMO_MODE || ""),
      "import.meta.env.WEBMAIL_DEMO_STATIC": JSON.stringify(process.env.WEBMAIL_DEMO_STATIC || ""),
    },
    plugins: [tailwindcss()],
    resolve: {
      alias: {
        "@": resolve(__dirname, "./src"),
        ...(router === "client" && demoStatic
          ? { "~/lib/mail-client": resolve(__dirname, "./src/lib/mail-client-browser.ts") }
          : {}),
      },
    },
    ...(router === "client"
      ? {
          optimizeDeps: {
            exclude: ["imapflow", "nodemailer", "pg"],
          },
          build: {
            rollupOptions: {
              external: ["imapflow", "nodemailer", "pg"],
            },
          },
        }
      : {}),
  }),
});
