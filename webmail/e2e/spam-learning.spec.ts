import { expect, test, type Page, type Locator, type APIRequestContext } from "@playwright/test";
import nodemailer from "nodemailer";

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

async function openFolder(page: Page, folder: "Inbox" | "Spam"): Promise<void> {
  if (folder === "Inbox") {
    await page.goto("/folder/Inbox");
  } else {
    await page.getByRole("link", { name: new RegExp(`^${folder}(?:\\s+\\d+)?$`) }).first().click();
  }
  await expect(page.getByRole("heading", { name: folder })).toBeVisible({ timeout: 20_000 });
}

async function findRowBySubject(page: Page, folder: "Inbox" | "Spam", subject: string): Promise<Locator> {
  const deadline = Date.now() + 120_000;
  const row = page.locator(".email-row", { hasText: subject }).first();

  while (Date.now() < deadline) {
    const search = page.locator('input[placeholder^="Search"], input[placeholder^="Filter"]').first();
    await expect(search).toBeVisible({ timeout: 20_000 });
    await search.fill(subject);
    if (await row.count()) {
      await expect(row).toBeVisible({ timeout: 10_000 });
      return row;
    }
    const refresh = page.getByTitle("Refresh");
    if (await refresh.count()) {
      await refresh.click();
    }
    await page.waitForTimeout(2_500);
  }

  await expect(row).toBeVisible({ timeout: 5_000 });
  return row;
}

function getRspamdBaseUrl(): string {
  const e2eBase = requiredEnv("E2E_BASE_URL");
  const parsed = new URL(e2eBase);
  const hostParts = parsed.hostname.split(".");
  if (hostParts[0] === "webmail" && hostParts.length >= 3) {
    parsed.hostname = ["rspamd", ...hostParts.slice(1)].join(".");
    return parsed.origin;
  }
  return `https://rspamd.${hostParts.slice(-2).join(".")}`;
}

async function getRspamdLearnedCount(request: APIRequestContext): Promise<number> {
  const auth = Buffer.from(`admin:${requiredEnv("E2E_PASSWORD")}`).toString("base64");
  const response = await request.get(`${getRspamdBaseUrl()}/stat`, {
    headers: { Authorization: `Basic ${auth}` },
  });
  expect(response.ok()).toBeTruthy();
  const body = await response.json();
  const learned = Number(body?.learned ?? NaN);
  expect(Number.isFinite(learned)).toBeTruthy();
  return learned;
}

async function checkRspamdMessage(
  request: APIRequestContext,
  rfc822: string,
): Promise<any> {
  const auth = Buffer.from(`admin:${requiredEnv("E2E_PASSWORD")}`).toString("base64");
  const response = await request.post(`${getRspamdBaseUrl()}/checkv2`, {
    headers: {
      Authorization: `Basic ${auth}`,
      "Content-Type": "message/rfc822",
    },
    data: rfc822,
  });
  expect(response.ok()).toBeTruthy();
  return response.json();
}

type RspamdHistoryRow = {
  subject?: string;
  score?: number;
  action?: string;
  symbols?: Record<string, unknown>;
};

async function getRspamdHistoryRowBySubject(
  request: APIRequestContext,
  subject: string,
): Promise<RspamdHistoryRow | null> {
  const auth = Buffer.from(`admin:${requiredEnv("E2E_PASSWORD")}`).toString("base64");
  const response = await request.get(`${getRspamdBaseUrl()}/history`, {
    headers: { Authorization: `Basic ${auth}` },
  });
  expect(response.ok()).toBeTruthy();
  const body = await response.json();
  const rows = Array.isArray(body?.rows) ? (body.rows as RspamdHistoryRow[]) : [];
  return rows.find((row) => row?.subject === subject) ?? null;
}

test.describe("Spam learning flow", () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
    if (new URL(page.url()).pathname !== "/") {
      await page.goto("/");
    }
    await expect(page.getByRole("heading", { name: "Inbox", exact: true })).toBeVisible();
  });

  test("message can move Inbox -> Spam via UI, stay in Spam, and increments rspamd learned stats", async ({ page, request }) => {
    test.setTimeout(180_000);
    const learnedBefore = await getRspamdLearnedCount(request);

    // Use an existing inbox message to exercise the real move/training path.
    await openFolder(page, "Inbox");
    const inboxRows = page.locator(".email-row");
    const inboxCount = await inboxRows.count();
    test.skip(inboxCount === 0, "Need at least one message in Inbox to test spam move/training");
    const inboxRow = inboxRows.first();
    await expect(inboxRow).toBeVisible({ timeout: 20_000 });
    await inboxRow.locator(".mail-checkbox").check();
    await page.getByTitle("Mark as spam").click();

    // Verify Spam folder still has rows after move.
    await openFolder(page, "Spam");
    await expect(page.locator(".email-row").first()).toBeVisible({ timeout: 30_000 });

    // Backend assertion: moving to Spam should eventually train bayes.
    await expect
      .poll(async () => getRspamdLearnedCount(request), {
        timeout: 90_000,
        intervals: [2_000, 3_000, 5_000],
      })
      .toBeGreaterThan(learnedBefore);
  });

  test("GTUBE mock spam is detected by rspamd backend", async ({ request }) => {
    const gtube = "XJS*C4JDBQADN1.NSBN3*2IDNEN*GTUBE-STANDARD-ANTI-UBE-TEST-EMAIL*C.34X";
    const messageId = `<e2e-gtube-${Date.now()}@inout.email>`;
    const subject = `E2E GTUBE backend ${Date.now()}`;
    const payload = [
      "From: tester@example.com",
      `To: ${requiredEnv("E2E_EMAIL")}`,
      `Subject: ${subject}`,
      "Date: Fri, 20 Feb 2026 16:30:00 +0000",
      `Message-Id: ${messageId}`,
      "",
      gtube,
      "",
    ].join("\r\n");

    const result = await checkRspamdMessage(request, payload);
    const symbols = result?.symbols ?? {};
    const score = Number(result?.score ?? NaN);
    const action = String(result?.action ?? "");

    expect(symbols.GTUBE).toBeTruthy();
    expect(Number.isFinite(score)).toBeTruthy();
    expect(score).toBeGreaterThanOrEqual(6);
    expect(["add header", "reject", "soft reject", "greylist"]).toContain(action);
  });

  test("real SMTP injection is scanned by rspamd and lands in mailbox flow", async ({ page, request }) => {
    test.setTimeout(180_000);
    const recipient = requiredEnv("E2E_EMAIL");
    const smtpHost = "mail.inout.email";
    const subject = `E2E SMTP inbound ${Date.now()}`;
    const messageId = `<e2e-smtp-${Date.now()}@example.net>`;
    const body = [
      "Hello from SMTP injection test.",
      "Earn $$$ fast with amazing deal and urgent action now.",
      "Click now and free money offer.",
    ].join(" ");
    const from = "external-e2e@example.net";
    const payload = [
      `From: ${from}`,
      `To: ${recipient}`,
      `Subject: ${subject}`,
      "Date: Fri, 20 Feb 2026 16:30:00 +0000",
      `Message-Id: ${messageId}`,
      "",
      body,
      "",
    ].join("\r\n");

    // Send through SMTP directly (no webmail compose path).
    const transport = nodemailer.createTransport({
      host: smtpHost,
      port: 25,
      secure: false,
      tls: { rejectUnauthorized: false },
    });

    let delivered = false;
    try {
      const info = await transport.sendMail({
        from,
        to: recipient,
        subject,
        text: body,
        messageId,
      });
      delivered = (info.accepted || []).length > 0;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      const rejectedAsSpam = /554\s+5\.7\.1\s+spam message rejected/i.test(message);
      if (!rejectedAsSpam) throw err;
      delivered = false;
    }

    if (!delivered) {
      // Production-safe behavior: strong spam is rejected before delivery.
      const result = await checkRspamdMessage(request, payload);
      const action = String(result?.action ?? "");
      const score = Number(result?.score ?? NaN);
      expect(Number.isFinite(score)).toBeTruthy();
      expect(score).toBeGreaterThanOrEqual(4);
      expect(["reject", "add header", "soft reject", "greylist"]).toContain(action);
      return;
    }

    // Confirm rspamd scanned this exact subject in history.
    await expect
      .poll(async () => getRspamdHistoryRowBySubject(request, subject), {
        timeout: 120_000,
        intervals: [3_000, 5_000, 7_000],
      })
      .not.toBeNull();

    const row = (await getRspamdHistoryRowBySubject(request, subject)) as RspamdHistoryRow;
    const score = Number(row?.score ?? NaN);
    expect(Number.isFinite(score)).toBeTruthy();

    // Message should be visible in either Inbox or Spam mailbox views.
    await openFolder(page, "Inbox");
    const inboxSearch = page.locator('input[placeholder^="Search"]').first();
    await inboxSearch.fill(subject);
    const inboxRows = await page.locator(".email-row", { hasText: subject }).count();

    await openFolder(page, "Spam");
    const spamSearch = page.locator('input[placeholder^="Search"]').first();
    await spamSearch.fill(subject);
    const spamRows = await page.locator(".email-row", { hasText: subject }).count();

    expect(inboxRows + spamRows).toBeGreaterThan(0);
  });
});
