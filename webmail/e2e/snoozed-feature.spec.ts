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

test.describe("Snoozed feature", () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
    if (new URL(page.url()).pathname !== "/") {
      await page.goto("/");
    }
    await expect(page.getByRole("heading", { name: "Inbox" })).toBeVisible();
  });

  test("snooze selector shows presets and can move mail to Snoozed", async ({ page }) => {
    const rows = page.locator(".email-row");
    const rowCount = await rows.count();
    test.skip(rowCount === 0, "Need at least one email in inbox");

    await rows.first().locator(".mail-checkbox").check();

    await page.getByTitle("Snooze").click();
    await expect(page.getByText("Snooze until...")).toBeVisible();
    await expect(page.getByRole("button", { name: /Later today/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /Tomorrow/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /Later this week/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /This weekend/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /Next week/i })).toBeVisible();

    await page.getByRole("button", { name: /Later today/i }).click();

    const snoozedLink = page.getByRole("link", { name: /Snoozed/i });
    await expect(snoozedLink).toBeVisible();
    await snoozedLink.click();

    await expect(page).toHaveURL(/\/folder\/Snoozed/i);
    await expect(page.getByRole("heading", { name: "Snoozed" })).toBeVisible();
    await expect(page.locator(".email-row").first()).toBeVisible();
    await expect(page.locator(".email-row").first()).toContainText(/Snoozed until/i);
  });

  test("context-menu snooze moves the clicked row to Snoozed", async ({ page }) => {
    const rows = page.locator(".email-row");
    const rowCount = await rows.count();
    test.skip(rowCount === 0, "Need at least one email in inbox");

    await rows.first().click({ button: "right" });
    const contextMenu = page.locator('[data-context-menu-root="true"]');
    await expect(contextMenu).toBeVisible();
    await contextMenu.getByRole("button", { name: "Snooze" }).click();

    await expect(page.getByText("Snooze until...")).toBeVisible();
    await page.getByRole("button", { name: /Tomorrow/i }).click();

    const snoozedLink = page.getByRole("link", { name: /Snoozed/i });
    await expect(snoozedLink).toBeVisible();
    await snoozedLink.click();

    await expect(page).toHaveURL(/\/folder\/Snoozed/i);
    await expect(page.getByRole("heading", { name: "Snoozed" })).toBeVisible();
    await expect(page.locator(".email-row").first()).toBeVisible();
    await expect(page.locator(".email-row").first()).toContainText(/Snoozed until/i);
  });

  test("custom snooze date requires explicit confirm", async ({ page }) => {
    const rows = page.locator(".email-row");
    const rowCount = await rows.count();
    test.skip(rowCount === 0, "Need at least one email in inbox");

    await rows.first().locator(".mail-checkbox").check();
    await page.getByTitle("Snooze").click();
    await page.getByRole("button", { name: /Select date and time/i }).click();

    const dateInput = page.locator('input[type="datetime-local"]');
    await expect(dateInput).toBeVisible();
    await dateInput.fill("2099-12-31T08:00");

    // Must explicitly confirm to apply selected custom value.
    await expect(page.getByRole("button", { name: "Confirm" })).toBeVisible();
    await page.getByRole("button", { name: "Confirm" }).click();

    const snoozedLink = page.getByRole("link", { name: /Snoozed/i });
    await expect(snoozedLink).toBeVisible();
    await snoozedLink.click();

    await expect(page).toHaveURL(/\/folder\/Snoozed/i);
    await expect(page.getByRole("heading", { name: "Snoozed" })).toBeVisible();
    await expect(page.locator(".email-row").first()).toContainText(/Snoozed until/i);
  });
});
