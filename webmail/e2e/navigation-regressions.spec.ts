import { expect, test, type Locator, type Page } from "@playwright/test";

function requiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing env var ${name}`);
  return value;
}

function parseDisplayedTotal(raw: string): number | null {
  const rangeMatch = raw.match(/(\d[\d,]*)\s*[–-]\s*(\d[\d,]*)\s+of\s+(\d[\d,]*)/i);
  if (rangeMatch) return Number(rangeMatch[3].replace(/,/g, ""));
  const zeroMatch = raw.match(/\b0\s+of\s+0\b/i);
  if (zeroMatch) return 0;
  return null;
}

async function login(page: Page): Promise<void> {
  const email = requiredEnv("E2E_EMAIL");
  const password = requiredEnv("E2E_PASSWORD");

  await page.goto("/login");
  if (!page.url().includes("/login")) return;

  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL((url) => !url.pathname.includes("/login"), { timeout: 20_000 });
}

function rangeLocator(page: Page): Locator {
  return page.locator("div").filter({ hasText: /((\d[\d,]*)\s*[–-]\s*(\d[\d,]*)\s+of\s+(\d[\d,]*)|0\s+of\s+0)/ }).first();
}

async function expectMessageListRendered(page: Page, section: string): Promise<void> {
  const listRegion = page.locator("main div.relative.flex-1.min-h-0.flex.flex-col").first();
  const rows = listRegion.locator(".email-row");
  const emptyStateHeadings = listRegion.locator("h3");

  await expect
    .poll(async () => (await rows.count()) + (await emptyStateHeadings.count()), {
      timeout: 15_000,
      message: `${section} list should render rows or a valid empty state`,
    })
    .toBeGreaterThan(0);

  const displayedTotal = parseDisplayedTotal(await rangeLocator(page).innerText());
  if (displayedTotal !== null && displayedTotal > 0) {
    await expect
      .poll(async () => rows.count(), {
        timeout: 15_000,
        message: `${section} shows ${displayedTotal} total emails but no rendered rows`,
      })
      .toBeGreaterThan(0);
  }
}

test.describe("Navigation regressions", () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
    if (new URL(page.url()).pathname !== "/") {
      await page.goto("/");
    }
    await expect(page.getByRole("heading", { name: "Inbox", exact: true })).toBeVisible();
  });

  test("inbox/folder navigation keeps lists painted", async ({ page }) => {
    for (let cycle = 0; cycle < 3; cycle += 1) {
      await page.getByRole("link", { name: /^Drafts(?:\s+\d+)?$/ }).first().click();
      await expect(page.getByRole("heading", { name: "Drafts", exact: true })).toBeVisible();
      await expectMessageListRendered(page, "Drafts");

      await page.getByRole("link", { name: /^Archive(?:\s+\d+)?$/ }).first().click();
      await expect(page.getByRole("heading", { name: "Archive", exact: true })).toBeVisible();
      await expectMessageListRendered(page, "Archive");

      await page.getByRole("link", { name: /^Inbox(?:\s+\d+)?$/ }).first().click();
      await expect(page.getByRole("heading", { name: "Inbox", exact: true })).toBeVisible();
      await expectMessageListRendered(page, "Inbox");
    }
  });

  test("settings to inbox navigation keeps list painted", async ({ page }) => {
    for (let cycle = 0; cycle < 3; cycle += 1) {
      await page.goto("/settings");
      await expect(page.getByRole("heading", { name: "Settings", exact: true })).toBeVisible();

      await page.getByRole("link", { name: /^Inbox(?:\s+\d+)?$/ }).first().click();
      await expect(page.getByRole("heading", { name: "Inbox", exact: true })).toBeVisible();
      await expectMessageListRendered(page, "Inbox");
    }
  });

  test("left menu tree expanded state survives reload", async ({ page }) => {
    const sentToggle = page.getByTestId("sidebar-toggle-sent");
    await expect(sentToggle).toBeVisible();
    await sentToggle.click();
    await expect(page.getByTestId("sidebar-sent-tree")).toHaveCount(0);

    const categoriesToggle = page.getByTestId("sidebar-toggle-categories");
    const hasCategoriesToggle = (await categoriesToggle.count()) > 0;
    if (hasCategoriesToggle) {
      await categoriesToggle.click();
      await expect(page.getByTestId("sidebar-categories-tree")).toHaveCount(0);
    }

    await page.reload();
    await expect(page.getByRole("heading", { name: "Inbox", exact: true })).toBeVisible();
    await expect(page.getByTestId("sidebar-sent-tree")).toHaveCount(0);
    if (hasCategoriesToggle) {
      await expect(page.getByTestId("sidebar-categories-tree")).toHaveCount(0);
    }
  });
});
