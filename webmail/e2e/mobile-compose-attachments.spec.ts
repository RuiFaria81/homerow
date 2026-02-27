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

test.describe("Mobile compose attachments", () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await login(page);
  });

  test("adds attachments from mobile compose picker", async ({ page }) => {
    await page.goto("/compose");
    await expect(page.getByRole("heading", { name: "New Message" })).toBeVisible();

    await page.getByTestId("compose-mobile-file-input").setInputFiles([
      {
        name: "mobile-attachment.txt",
        mimeType: "text/plain",
        buffer: Buffer.from("mobile attachment smoke test", "utf8"),
      },
    ]);

    await expect(page.getByTestId("compose-mobile-attachment-chip")).toHaveCount(1);
    await expect(page.getByText("mobile-attachment.txt")).toBeVisible();
  });
});
