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

test.describe("Compose validation behavior", () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
    if (new URL(page.url()).pathname !== "/") {
      await page.goto("/");
    }
    await expect(page.getByRole("heading", { name: "Inbox" })).toBeVisible();
  });

  test("allows writing body first when recipients are empty", async ({ page }) => {
    await page.getByRole("button", { name: "Compose" }).click();
    await expect(page.getByText("New Message")).toBeVisible();

    const editor = page.locator(".lexical-editor[contenteditable='true']");
    await editor.click();
    await page.keyboard.type("Body first is allowed.");
    await expect(editor).toContainText("Body first is allowed.");

    await page.waitForTimeout(300);
    const activeTagAndClass = await page.evaluate(() => ({
      tag: document.activeElement?.tagName ?? "",
      className: (document.activeElement as HTMLElement | null)?.className ?? "",
    }));
    expect(activeTagAndClass.tag).not.toBe("INPUT");
    expect(activeTagAndClass.className).toContain("lexical-editor");
  });

  test("send without recipients shows validation toast", async ({ page }) => {
    await page.getByRole("button", { name: "Compose" }).click();
    await expect(page.getByText("New Message")).toBeVisible();

    await page.getByRole("button", { name: "Send" }).click();
    await expect(page.getByTestId("compose-recipient-error")).toContainText("Add at least one recipient");
    await expect(page.locator("input[placeholder='Recipients']")).toBeFocused();
  });

  test("empty subject asks for confirmation before sending", async ({ page }) => {
    await page.getByRole("button", { name: "Compose" }).click();
    await expect(page.getByText("New Message")).toBeVisible();

    const toInput = page.locator("input[placeholder='Recipients']").first();
    await toInput.fill("admin@inout.email");
    await toInput.press("Enter");

    const editor = page.locator(".lexical-editor[contenteditable='true']");
    await editor.click();
    await page.keyboard.type("No subject confirmation");

    await page.getByRole("button", { name: "Send" }).click();
    await expect(page.getByRole("heading", { name: "Send without subject?" })).toBeVisible();
    await page.getByRole("button", { name: "Cancel" }).click();
    await expect(page.getByText("New Message")).toBeVisible();
  });
});
