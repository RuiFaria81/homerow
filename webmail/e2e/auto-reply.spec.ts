import { expect, test, type Page } from "@playwright/test";

function requiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing env var ${name}`);
  return value;
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

function autoReplySwitch(page: Page) {
  return page
    .locator("div", { hasText: "Enable auto reply" })
    .first()
    .locator('[role="switch"]');
}

async function ensureAutoReplyDisabled(page: Page): Promise<void> {
  await page.goto("/settings?tab=auto-reply");
  await expect(page.getByRole("heading", { name: "Auto Reply" })).toBeVisible({ timeout: 20_000 });
  const checked = await autoReplySwitch(page).getAttribute("aria-checked");
  if (checked === "true") {
    await autoReplySwitch(page).click();
    await expect(autoReplySwitch(page)).toHaveAttribute("aria-checked", "false");
  }
}

test.describe("Auto reply settings and banner", () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test.afterEach(async ({ page }) => {
    await ensureAutoReplyDisabled(page);
  });

  test("toggle auto-reply persists without save button and updates global banner", async ({ page }) => {
    await page.goto("/settings?tab=auto-reply");
    await expect(page.getByRole("heading", { name: "Auto Reply" })).toBeVisible({ timeout: 20_000 });

    await page.getByRole("button", { name: "Clear" }).click();
    const initiallyChecked = await autoReplySwitch(page).getAttribute("aria-checked");
    if (initiallyChecked !== "true") {
      await autoReplySwitch(page).click();
    }
    await expect(autoReplySwitch(page)).toHaveAttribute("aria-checked", "true");
    await expect(page.getByTestId("page-auto-reply-banner")).toBeVisible({ timeout: 20_000 });

    await page.goto("/");
    await expect(page.getByTestId("page-auto-reply-banner")).toBeVisible({ timeout: 20_000 });

    await page.goto("/settings?tab=auto-reply");
    await expect(autoReplySwitch(page)).toHaveAttribute("aria-checked", "true");

    const checkedBeforeDisable = await autoReplySwitch(page).getAttribute("aria-checked");
    if (checkedBeforeDisable === "true") {
      await autoReplySwitch(page).click();
    }
    await expect(autoReplySwitch(page)).toHaveAttribute("aria-checked", "false");
    await expect(page.getByTestId("page-auto-reply-banner")).toHaveCount(0);

    await page.goto("/");
    await expect(page.getByTestId("page-auto-reply-banner")).toHaveCount(0);
  });

  test("global banner message reflects active period dates", async ({ page }) => {
    const today = new Date();
    const dayAfterTomorrow = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000);
    const toDate = (d: Date) => d.toISOString().slice(0, 10);
    const startDate = toDate(today);
    const endDate = toDate(dayAfterTomorrow);

    await page.goto("/settings?tab=auto-reply");
    await expect(page.getByRole("heading", { name: "Auto Reply" })).toBeVisible({ timeout: 20_000 });

    await page.locator('input[type="date"]').nth(0).fill(startDate);
    await page.locator('input[type="date"]').nth(1).fill(endDate);

    const checked = await autoReplySwitch(page).getAttribute("aria-checked");
    if (checked !== "true") {
      await autoReplySwitch(page).click();
    }
    await expect(autoReplySwitch(page)).toHaveAttribute("aria-checked", "true");
    await expect(page.getByTestId("page-auto-reply-banner")).toBeVisible({ timeout: 20_000 });

    await page.goto("/");
    const banner = page.getByTestId("page-auto-reply-banner");
    await expect(banner).toBeVisible({ timeout: 20_000 });
    await expect(banner).toContainText(`from ${startDate}`);
    await expect(banner).toContainText(`until ${endDate}`);
  });
});
