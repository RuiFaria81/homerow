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

test.describe("Reading pane local-first behavior", () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
    if (new URL(page.url()).pathname !== "/") {
      await page.goto("/");
    }
    await expect(page.getByRole("heading", { name: "Inbox" })).toBeVisible();
  });

  test("switching emails keeps reader content without loading flicker", async ({ page }) => {
    const rows = page.locator(".email-row");
    test.skip((await rows.count()) < 2, "Need at least two email rows");

    await page.route("**/*", async (route, request) => {
      if (request.method() === "POST") {
        await page.waitForTimeout(1200);
      }
      await route.continue();
    });

    await rows.first().click();

    const loadingText = page.getByText("Loading email...");
    await expect(loadingText).toHaveCount(0, { timeout: 12_000 });

    await rows.nth(1).click();

    await expect
      .poll(async () => loadingText.count(), { timeout: 800, intervals: [100, 200, 200, 300] })
      .toBe(0);
  });

  test("opening and reopening reader keeps list resize free of layout transitions", async ({ page }) => {
    const rows = page.locator(".email-row");
    test.skip((await rows.count()) < 1, "Need at least one email row");

    const listPanel = page.getByTestId("mail-list-panel");
    const firstRow = rows.first();

    await expect(firstRow).not.toHaveClass(/transition-all/);

    await firstRow.click();
    await expect(listPanel).not.toHaveClass(/transition-\[width,height\]/);
    await expect(firstRow).not.toHaveClass(/transition-all/);

    await page.getByTestId("reading-pane-close").click();
    await expect(page.getByTestId("reading-pane-close")).toHaveCount(0);

    await firstRow.click();
    await expect(listPanel).not.toHaveClass(/transition-\[width,height\]/);
    await expect(firstRow).not.toHaveClass(/transition-all/);
  });
});
