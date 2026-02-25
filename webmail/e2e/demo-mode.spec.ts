import { expect, test } from "@playwright/test";

test.describe("Demo mode", () => {
  test("starts on login and enters inbox with demo credentials", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveURL(/\/login(?:\?|$)/);
    await page.getByLabel("Email").fill("demo@demo.com");
    await page.getByLabel("Password").fill("demo");
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page).toHaveURL(/\/$/);
    await expect(page.getByRole("heading", { name: "Inbox", exact: true })).toBeVisible();

    const demoSubject = page.locator(".email-row").filter({ hasText: "Welcome to Homerow demo mode" }).first();
    await expect(demoSubject).toBeVisible();
    await expect(page.locator(".email-row").filter({ hasText: "Invoice for February" }).first()).toBeVisible();
    await expect(page.locator(".email-row").filter({ hasText: "Celebrate Black History month" }).first()).toBeVisible();
  });
});
