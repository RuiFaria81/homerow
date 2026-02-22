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

test.describe("Blocked senders settings flow", () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test("manual block and batch unblock from settings", async ({ page }) => {
    const senderEmail = `e2e-blocked-${Date.now()}@example.net`;

    await page.goto("/settings?tab=blocked");
    await expect(page.getByRole("heading", { name: "Blocked Senders" })).toBeVisible({ timeout: 20_000 });

    await page.getByPlaceholder("sender@example.com").fill(senderEmail);
    await page.getByRole("button", { name: "Block sender" }).click();

    const blockedRow = page.locator("div", { hasText: senderEmail }).first();
    await expect(blockedRow).toBeVisible({ timeout: 20_000 });
    await page.getByTestId(`blocked-row-check-${senderEmail}`).check();

    await page.getByRole("button", { name: "Unblock selected" }).click();
    await expect(page.getByTestId(`blocked-row-check-${senderEmail}`)).toHaveCount(0, { timeout: 20_000 });
  });
});
