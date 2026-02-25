import { access, readFile, readdir } from "node:fs/promises";
import path from "node:path";

const base = path.resolve(process.cwd(), "public", "demo");

async function mustExist(file) {
  await access(path.join(base, file));
}

async function collectFiles(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = await Promise.all(
    entries.map(async (entry) => {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) return collectFiles(fullPath);
      return [fullPath];
    }),
  );
  return files.flat();
}

async function main() {
  await mustExist("index.html");
  await mustExist("login/index.html");
  await mustExist("_build");
  await mustExist("logo.svg");
  await mustExist("human-avatar.jpg");

  const indexHtml = await readFile(path.join(base, "index.html"), "utf8");
  if (!indexHtml.includes("/demo/_build/")) {
    throw new Error("Static webmail build is not using /demo base path.");
  }

  const allFiles = await collectFiles(base);
  const jsFiles = allFiles.filter((file) => file.endsWith(".js"));
  const jsContents = await Promise.all(jsFiles.map((file) => readFile(file, "utf8")));
  const combinedJs = jsContents.join("\n");
  const clientEntryFiles = jsFiles.filter((file) => path.basename(file).startsWith("client-"));
  const clientEntryContents = await Promise.all(clientEntryFiles.map((file) => readFile(file, "utf8")));
  const combinedClientEntryJs = clientEntryContents.join("\n");

  if (!combinedJs.includes("demo@demo.com")) {
    throw new Error("Demo credentials are missing from static webmail bundle.");
  }
  if (!combinedJs.includes("__WEBMAIL_DEMO_STATIC_MODE__")) {
    throw new Error("Demo static mode logic is missing from static webmail bundle.");
  }
  if (combinedJs.includes("webmail-demo-auth")) {
    throw new Error("Demo static auth should not persist in web storage.");
  }
  if (combinedClientEntryJs.includes("src_lib_mail-client_ts--")) {
    throw new Error("Client entry bundle still references server mail-client functions.");
  }
  console.log("Static demo assets look valid.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
