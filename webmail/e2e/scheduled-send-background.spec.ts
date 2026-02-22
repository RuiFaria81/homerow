import { expect, test, type Page } from "@playwright/test";
import { ImapFlow } from "imapflow";

test.setTimeout(240_000);

function requiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing env var ${name}`);
  return value;
}

function buildLocalSchedule(offsetMinutes: number): { inputValue: string; dueAt: Date } {
  const dueAt = new Date(Date.now() + offsetMinutes * 60_000 + 30_000);
  dueAt.setSeconds(0, 0);
  if (dueAt.getTime() <= Date.now() + 20_000) {
    dueAt.setMinutes(dueAt.getMinutes() + 1);
  }
  const pad = (n: number) => n.toString().padStart(2, "0");
  const inputValue = `${dueAt.getFullYear()}-${pad(dueAt.getMonth() + 1)}-${pad(dueAt.getDate())}T${pad(dueAt.getHours())}:${pad(dueAt.getMinutes())}`;
  return { inputValue, dueAt };
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

async function sleep(ms: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

async function inboxHasSubject(subject: string): Promise<boolean> {
  const email = requiredEnv("E2E_EMAIL");
  const password = requiredEnv("E2E_PASSWORD");
  const host = process.env.E2E_IMAP_HOST || "mail.inout.email";
  const port = Number(process.env.E2E_IMAP_PORT || "993");
  const secure = (process.env.E2E_IMAP_SECURE || "true") !== "false";

  const client = new ImapFlow({
    host,
    port,
    secure,
    logger: false,
    tls: { rejectUnauthorized: false },
    auth: { user: email, pass: password },
  });

  await client.connect();
  const lock = await client.getMailboxLock("INBOX");
  try {
    const matches = await client.search({ header: ["subject", subject] }, { uid: true });
    return matches.length > 0;
  } finally {
    lock.release();
    await client.logout();
  }
}

async function waitForSubjectInInbox(subject: string, timeoutMs: number): Promise<boolean> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await inboxHasSubject(subject)) return true;
    await sleep(5_000);
  }
  return false;
}

test("scheduled send is delivered even with no active webmail session", async ({ browser, baseURL }) => {
  const context = await browser.newContext({ baseURL });
  const page = await context.newPage();
  await login(page);
  if (new URL(page.url()).pathname !== "/") {
    await page.goto("/");
  }
  await expect(page.getByRole("heading", { name: "Inbox" })).toBeVisible();

  const subject = `Scheduled background ${Date.now()}`;
  const schedule = buildLocalSchedule(1);

  await page.getByRole("button", { name: "Compose" }).click();
  const toInput = page.locator("input[placeholder='Recipients']").first();
  await expect(toInput).toBeVisible();
  await toInput.fill("admin@inout.email");
  await toInput.press("Enter");
  await page.getByPlaceholder("What's this about?").fill(subject);
  await page.locator(".lexical-editor[contenteditable='true']").click();
  await page.keyboard.type("Should send even with no open tab.");

  await page.getByRole("button", { name: "Schedule" }).click();
  await page.getByTestId("compose-schedule-input").fill(schedule.inputValue);
  await page.getByRole("button", { name: "Schedule send" }).click();
  await expect(page.getByText("Message scheduled for")).toBeVisible();

  await context.close();

  const waitUntilAfterDueMs = Math.max(25_000, schedule.dueAt.getTime() - Date.now() + 25_000);
  await sleep(waitUntilAfterDueMs);

  const delivered = await waitForSubjectInInbox(subject, 60_000);
  expect(delivered).toBeTruthy();
});
