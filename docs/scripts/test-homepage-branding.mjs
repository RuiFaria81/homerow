import { readFileSync } from "node:fs";

const homePagePath = new URL("../dist/index.html", import.meta.url);
const quickStartPagePath = new URL(
  "../dist/getting-started/quick-start/index.html",
  import.meta.url,
);

const homeHtml = readFileSync(homePagePath, "utf8");
const quickStartHtml = readFileSync(quickStartPagePath, "utf8");
const siteTitleClassPattern = /class="site-title\b/;

if (siteTitleClassPattern.test(homeHtml)) {
  throw new Error("Expected homepage top bar to hide custom site title branding.");
}

if (!siteTitleClassPattern.test(quickStartHtml)) {
  throw new Error("Expected docs pages to keep the custom site title branding.");
}

if (!homeHtml.includes("Homerow") || !homeHtml.includes("Mail")) {
  throw new Error("Expected homepage header title to contain the branded 'Homerow Mail' text.");
}

if (!homeHtml.includes('class="home-hero-title-logo"') || !homeHtml.includes("/logo-app.svg")) {
  throw new Error("Expected homepage hero title to render the Homerow logo element.");
}

if (
  !homeHtml.includes(
    "A practical deployment path for running your own mail stack with a custom web interface, keeping infrastructure explicit and reproducible.",
  )
) {
  throw new Error("Expected homepage tagline to keep the updated copy.");
}

console.log("Homepage branding test passed.");
