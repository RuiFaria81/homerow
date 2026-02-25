import { expect, test } from "@playwright/test";

test.describe("Demo mode", () => {
  test("opens directly in inbox without login", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveURL(/\/$/);
    await expect(page.getByRole("heading", { name: "Inbox", exact: true })).toBeVisible();

    const demoSubject = page.locator(".email-row").filter({ hasText: "Welcome to Homerow demo mode" }).first();
    await expect(demoSubject).toBeVisible();
    await expect(page.locator(".email-row").filter({ hasText: "Invoice for February" }).first()).toBeVisible();
    await expect(page.locator(".email-row").filter({ hasText: "Celebrate Black History month" }).first()).toBeVisible();
    await expect(page.locator(".email-row").filter({ hasText: "OpenSearchCon China" })).toHaveCount(0);
    await expect(page.locator(".email-row").filter({ hasText: "Redditors are asking questions" })).toHaveCount(0);
  });
});
