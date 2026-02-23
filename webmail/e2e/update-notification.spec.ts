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

test("shows update notification elements when update is available", async ({ page }) => {
  await page.route("**/api/system/update-status", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        installed: "v1.0.0",
        latest: "v1.1.0",
        updateAvailable: true,
        severity: "minor",
        releaseUrl: "https://github.com/guilhermeprokisch/homerow/releases/tag/v1.1.0",
        checkedAt: new Date().toISOString(),
        sourceLabel: "Upstream",
        sourceRepo: "guilhermeprokisch/homerow",
        mode: "track-upstream",
      }),
    });
  });

  await login(page);
  await expect(page.getByTestId("github-menu-update-dot")).toBeVisible({ timeout: 20_000 });

  await page.getByTestId("github-menu-button").click();
  await expect(page.getByTestId("github-menu-update-item")).toBeVisible();
  await page.getByTestId("github-menu-update-item").click();
  await expect(page).toHaveURL(/\/settings/);
  await expect(page.getByTestId("settings-update-card")).toBeVisible();
  await page.getByTestId("settings-update-notifications-off").click();
  await page.goto("/");
  await expect(page.getByTestId("github-menu-update-dot")).toHaveCount(0);
});
