import { readdirSync, readFileSync, statSync } from "node:fs";

const distDir = new URL("../dist/", import.meta.url);
const mermaidPagePath = new URL("../dist/guides/mermaid-diagrams/index.html", import.meta.url);
const pageHtml = readFileSync(mermaidPagePath, "utf8");

if (!pageHtml.includes('<pre class="mermaid"')) {
  throw new Error("Expected Mermaid block to be transformed into <pre class=\"mermaid\"> in built page.");
}

const astroAssetsDir = new URL("../dist/_astro/", import.meta.url);
const mermaidBundleExists = readdirSync(astroAssetsDir).some((entry) => /^mermaid\.core\..+\.js$/.test(entry));

if (!mermaidBundleExists) {
  throw new Error("Expected Mermaid client bundle in dist/_astro (mermaid.core.*.js).");
}

if (!statSync(distDir).isDirectory()) {
  throw new Error("Expected dist directory to exist.");
}

console.log("Mermaid build test passed.");
