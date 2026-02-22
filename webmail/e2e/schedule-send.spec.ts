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

async function scheduleMessage(page: Page, subject: string, minutesFromNow: number): Promise<void> {
  await page.getByRole("button", { name: "Compose" }).click();
  await expect(page.getByText("New Message")).toBeVisible();

  const toInput = page.locator("input[placeholder='Recipients']").first();
  await toInput.fill("admin@inout.email");
  await toInput.press("Enter");
  await page.getByPlaceholder("What's this about?").fill(subject);

  const editor = page.locator(".lexical-editor[contenteditable='true']");
  await editor.click();
  await page.keyboard.type("Schedule this email.");

  await page.getByRole("button", { name: "Schedule" }).click();
  await page.getByTestId("compose-schedule-input").fill(localDatetimeValueFromNow(minutesFromNow));
  await expect(page.getByTestId("compose-schedule-preview")).toBeVisible();
  await page.getByRole("button", { name: "Schedule send" }).click();
  await expect(page.getByText("Message scheduled for")).toBeVisible();
  await expect(page.getByText("New Message")).not.toBeVisible();
}

function rangeLocator(page: Page) {
  return page
    .locator("div")
    .filter({ hasText: /((\d[\d,]*)\s*[–-]\s*(\d[\d,]*)\s+of\s+(\d[\d,]*)|0\s+of\s+0)/ })
    .first();
}

test.describe("Scheduled send", () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
    if (new URL(page.url()).pathname !== "/") {
      await page.goto("/");
    }
    await expect(page.getByRole("heading", { name: "Inbox" })).toBeVisible();
  });

  test("shows validation when schedule time is missing", async ({ page }) => {
    await page.getByRole("button", { name: "Compose" }).click();
    await expect(page.getByText("New Message")).toBeVisible();

    const toInput = page.locator("input[placeholder='Recipients']").first();
    await toInput.fill("admin@inout.email");
    await toInput.press("Enter");
    await page.locator(".lexical-editor[contenteditable='true']").click();
    await page.keyboard.type("Missing schedule validation.");

    await page.getByRole("button", { name: "Schedule" }).click();
    await page.getByTestId("compose-schedule-input").fill("");
    await page.getByRole("button", { name: "Schedule send" }).click();

    await expect(page.getByTestId("compose-schedule-error")).toContainText("Pick a date and time");
  });

  test("schedules message for later", async ({ page }) => {
    const subject = `Scheduled test ${Date.now()}`;
    await scheduleMessage(page, subject, 10);
    await page.getByRole("link", { name: "Scheduled" }).click();
    await expect(page.getByRole("heading", { name: "Scheduled" })).toBeVisible();
    await expect(page.getByText(subject).first()).toBeVisible();
    await expect(page.getByText("Scheduled for").first()).toBeVisible();

    await page.getByRole("link", { name: "Sent" }).click();
    await expect(page.getByRole("heading", { name: "Sent" })).toBeVisible();
    await page.getByPlaceholder("Search in Sent...").fill(subject);
    await expect(page.getByText(subject)).toHaveCount(0);

    await page.getByRole("link", { name: "Scheduled" }).click();
    await expect(page.getByRole("heading", { name: "Scheduled" })).toBeVisible();
    await expect(page.getByText(subject).first()).toBeVisible();

    await page.getByPlaceholder(`Search in Scheduled...`).fill(subject);
    await page.locator("input[type='checkbox']").first().check();
    await page.getByRole("button", { name: "Cancel schedule" }).click();
    await expect(page.getByText(subject)).toHaveCount(0);
  });

  test("scheduled folder next page advances when pagination is cursorless", async ({ page }) => {
    const stamp = Date.now();
    await scheduleMessage(page, `Scheduled page nav ${stamp} A`, 12);
    await scheduleMessage(page, `Scheduled page nav ${stamp} B`, 13);

    await page.evaluate(() => {
      const raw = localStorage.getItem("settings");
      const current = raw ? JSON.parse(raw) : {};
      current.emailsPerPage = "1";
      localStorage.setItem("settings", JSON.stringify(current));
    });
    await page.reload();
    await expect(page.getByRole("heading", { name: "Inbox" })).toBeVisible();

    await page.getByRole("link", { name: "Scheduled" }).click();
    await expect(page.getByRole("heading", { name: "Scheduled" })).toBeVisible();

    const range = rangeLocator(page);
    await expect(range).toContainText(/1\s*[–-]\s*1\s+of\s+\d+/);

    const nextPageButton = page.getByTitle("Next page");
    await expect(nextPageButton).toBeEnabled();
    await nextPageButton.click();

    await expect(range).toContainText(/2\s*[–-]\s*2\s+of\s+\d+/);
  });

  test("scheduled folder previous page returns to first page after navigating next", async ({ page }) => {
    const stamp = Date.now();
    await scheduleMessage(page, `Scheduled prev nav ${stamp} A`, 14);
    await scheduleMessage(page, `Scheduled prev nav ${stamp} B`, 15);

    await page.evaluate(() => {
      const raw = localStorage.getItem("settings");
      const current = raw ? JSON.parse(raw) : {};
      current.emailsPerPage = "1";
      localStorage.setItem("settings", JSON.stringify(current));
    });
    await page.reload();
    await expect(page.getByRole("heading", { name: "Inbox" })).toBeVisible();

    await page.getByRole("link", { name: "Scheduled" }).click();
    await expect(page.getByRole("heading", { name: "Scheduled" })).toBeVisible();

    const range = rangeLocator(page);
    await expect(range).toContainText(/1\s*[–-]\s*1\s+of\s+\d+/);

    const nextPageButton = page.getByTitle("Next page");
    await expect(nextPageButton).toBeEnabled();
    await nextPageButton.click();
    await expect(range).toContainText(/2\s*[–-]\s*2\s+of\s+\d+/);

    const previousPageButton = page.getByTitle("Previous page");
    await expect(previousPageButton).toBeEnabled();
    await previousPageButton.click();
    await expect(range).toContainText(/1\s*[–-]\s*1\s+of\s+\d+/);
  });
});
