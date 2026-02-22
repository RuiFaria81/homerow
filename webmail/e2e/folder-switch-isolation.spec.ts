import { expect, test, type Page } from "@playwright/test";

function requiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing env var ${name}`);
  return value;
}

function localDatetimeValueFromNow(offsetMinutes: number): string {
  const date = new Date(Date.now() + offsetMinutes * 60_000);
  date.setSeconds(0, 0);
  const pad = (n: number) => n.toString().padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
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

async function openFolderAndAssertNoSubject(page: Page, folder: "Drafts" | "Sent" | "Archive" | "Snoozed", forbiddenSubject: string): Promise<void> {
  await page.getByRole("link", { name: folder }).click();
  await expect(page.getByRole("heading", { name: folder })).toBeVisible();
  await page.getByPlaceholder(`Search in ${folder}...`).fill(forbiddenSubject);
  await expect(page.getByText(forbiddenSubject)).toHaveCount(0);
}

test.describe("Folder list isolation", () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
    if (new URL(page.url()).pathname !== "/") {
      await page.goto("/");
    }
    await expect(page.getByRole("heading", { name: "Inbox" })).toBeVisible();
  });

  test("switching folder views repeatedly does not leak previous folder rows", async ({ page }) => {
    const stamp = Date.now();
    const scheduledSubject = `Isolation scheduled ${stamp}`;
    const sentSubject = `Isolation sent ${stamp}`;

    // Create a unique sent marker for Sent checks.
    await page.getByRole("button", { name: "Compose" }).click();
    await expect(page.getByText("New Message")).toBeVisible();
    let toInput = page.locator("input[placeholder='Recipients']").first();
    await toInput.fill("admin@inout.email");
    await toInput.press("Enter");
    await page.getByPlaceholder("What's this about?").fill(sentSubject);
    await page.locator(".lexical-editor[contenteditable='true']").click();
    await page.keyboard.type("Folder switching isolation sent marker.");
    await page.getByRole("button", { name: "Send" }).click();
    await expect(page.getByText("Message sent!")).toBeVisible();

    // Create a unique scheduled marker for Scheduled checks.
    await page.getByRole("button", { name: "Compose" }).click();
    await expect(page.getByText("New Message")).toBeVisible();
    toInput = page.locator("input[placeholder='Recipients']").first();
    await toInput.fill("admin@inout.email");
    await toInput.press("Enter");
    await page.getByPlaceholder("What's this about?").fill(scheduledSubject);
    await page.locator(".lexical-editor[contenteditable='true']").click();
    await page.keyboard.type("Folder switching isolation scheduled marker.");
    await page.getByRole("button", { name: "Schedule" }).click();
    await page.getByTestId("compose-schedule-input").fill(localDatetimeValueFromNow(10));
    await page.getByRole("button", { name: "Schedule send" }).click();
    await expect(page.getByText("Message scheduled for")).toBeVisible();

    await page.getByRole("link", { name: "Scheduled" }).click();
    await expect(page.getByRole("heading", { name: "Scheduled" })).toBeVisible();
    await page.getByPlaceholder("Search in Scheduled...").fill(scheduledSubject);
    await expect(page.getByText(scheduledSubject).first()).toBeVisible();

    for (let cycle = 0; cycle < 3; cycle += 1) {
      await page.getByRole("link", { name: "Drafts" }).click();
      await expect(page.getByRole("heading", { name: "Drafts" })).toBeVisible();
      await page.getByPlaceholder("Search in Drafts...").fill(sentSubject);
      await expect(page.getByText(sentSubject)).toHaveCount(0);
      await page.getByPlaceholder("Search in Drafts...").fill(scheduledSubject);
      await expect(page.getByText(scheduledSubject)).toHaveCount(0);

      await page.getByRole("link", { name: "Sent" }).click();
      await expect(page.getByRole("heading", { name: "Sent" })).toBeVisible();
      await page.getByPlaceholder("Search in Sent...").fill(sentSubject);
      await expect(page.getByText(sentSubject).first()).toBeVisible();
      await page.getByPlaceholder("Search in Sent...").fill(scheduledSubject);
      await expect(page.getByText(scheduledSubject)).toHaveCount(0);

      await openFolderAndAssertNoSubject(page, "Archive", sentSubject);
      await page.getByPlaceholder("Search in Archive...").fill(scheduledSubject);
      await expect(page.getByText(scheduledSubject)).toHaveCount(0);

      await openFolderAndAssertNoSubject(page, "Snoozed", sentSubject);
      await page.getByPlaceholder("Search in Snoozed...").fill(scheduledSubject);
      await expect(page.getByText(scheduledSubject)).toHaveCount(0);
    }

    await page.getByRole("link", { name: "Scheduled" }).click();
    await expect(page.getByRole("heading", { name: "Scheduled" })).toBeVisible();
    await page.getByPlaceholder("Search in Scheduled...").fill(scheduledSubject);
    await expect(page.getByText(scheduledSubject).first()).toBeVisible();
  });
});
