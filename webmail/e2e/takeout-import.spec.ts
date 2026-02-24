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

test.describe("Takeout import settings", () => {
  test("shows Gmail logo and lists server archives when available", async ({ page }) => {
    await page.route("**/api/imports/takeout/jobs", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: "[]",
      });
    });

    await page.route("**/api/imports/takeout/files", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          files: [
            {
              filename: "takeout-20260213T174547Z-3-001.tgz",
              fileSizeBytes: 1048576,
              modifiedAt: "2026-02-13T17:45:47.000Z",
            },
          ],
        }),
      });
    });

    await login(page);
    await page.goto("/settings?tab=import");

    const logo = page.getByRole("img", { name: "Gmail logo" });
    await expect(logo).toBeVisible();
    await expect(logo).toHaveAttribute("src", /\/gmail-logo\.svg$/);

    await page.getByRole("button", { name: "Use file already on server" }).click();

    const serverFile = page.getByRole("button", { name: /takeout-20260213T174547Z-3-001\.tgz/ });
    await expect(serverFile).toBeVisible();
    await serverFile.click();

    await expect(page.getByPlaceholder("your-archive.tgz")).toHaveValue("takeout-20260213T174547Z-3-001.tgz");
  });

  test("shows a friendly warning when takeout API endpoints are unavailable", async ({ page }) => {
    await page.route("**/api/imports/takeout/jobs", async (route) => {
      await route.fulfill({
        status: 404,
        contentType: "text/html",
        body: "<!DOCTYPE html><html><body><h1>Not Found</h1></body></html>",
      });
    });

    await login(page);
    await page.goto("/settings?tab=import");

    await expect(
      page.getByText("Takeout import API endpoints are not available on this server (404). Deploy the latest backend to use this flow."),
    ).toBeVisible();

    await expect(page.getByText("<!DOCTYPE html>")).toHaveCount(0);
  });
});
