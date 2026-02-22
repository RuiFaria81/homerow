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

test.describe("Reader actions", () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
    if (new URL(page.url()).pathname !== "/") {
      await page.goto("/");
    }
    await expect(page.getByRole("heading", { name: "Inbox" })).toBeVisible();
  });

  test("reading pane shows snooze, spam, and read/unread actions", async ({ page }) => {
    const rows = page.locator(".email-row");
    test.skip((await rows.count()) === 0, "Need at least one inbox email");

    await rows.first().click();

    const snoozeButton = page.getByTitle(/^Snooze/).first();
    await expect(snoozeButton).toBeVisible({ timeout: 20_000 });
    await expect(page.getByTitle(/^Mark as spam/).first()).toBeVisible({ timeout: 20_000 });
    await expect(page.getByTitle(/^Mark as (read|unread)/).first()).toBeVisible({ timeout: 20_000 });

    await snoozeButton.click();
    await expect(page.getByText("Snooze until...")).toBeVisible({ timeout: 20_000 });
  });
});
