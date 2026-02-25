import { cp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const webmailRoot = path.resolve(__dirname, "..");
const builtPublicDir = path.join(webmailRoot, ".output", "public");
const outDir = process.env.DEMO_STATIC_OUT_DIR
  ? path.resolve(webmailRoot, process.env.DEMO_STATIC_OUT_DIR)
  : path.resolve(webmailRoot, "..", "docs", "public", "demo");

async function runBuild() {
  await new Promise((resolve, reject) => {
    const child = spawn(
      process.platform === "win32" ? "npm.cmd" : "npm",
      ["run", "build"],
      {
        cwd: webmailRoot,
        stdio: "inherit",
        env: {
          ...process.env,
          WEBMAIL_DEMO_MODE: "true",
          WEBMAIL_DEMO_STATIC: "true",
          WEBMAIL_BASE_PATH: "/demo/",
        },
      },
    );
    child.on("exit", (code) => {
      if (code === 0) resolve(undefined);
      else reject(new Error(`webmail build failed with code ${code}`));
    });
    child.on("error", reject);
  });
}

async function main() {
  await runBuild();
  await rm(outDir, { recursive: true, force: true });
  await mkdir(outDir, { recursive: true });
  await cp(builtPublicDir, outDir, { recursive: true });
  await Promise.all(
    [
      "manifest.webmanifest",
      "sw.js",
      "sw.js.gz",
      "sw.js.br",
      "manifest.webmanifest.gz",
      "manifest.webmanifest.br",
    ].map((file) => rm(path.join(outDir, file), { force: true })),
  );

  const indexHtmlPath = path.join(outDir, "index.html");
  const loginHtmlPath = path.join(outDir, "login", "index.html");
  const indexHtml = await readFile(indexHtmlPath, "utf8");
  await mkdir(path.dirname(loginHtmlPath), { recursive: true });
  await writeFile(loginHtmlPath, indexHtml);

  console.log(`Static demo built at ${outDir}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
