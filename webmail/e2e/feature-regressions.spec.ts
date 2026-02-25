import { expect, test, type Locator, type Page } from "@playwright/test";
import nodemailer from "nodemailer";

function requiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing env var ${name}`);
  return value;
}

function smtpHost(): string {
  const explicit = process.env.E2E_SMTP_HOST;
  if (explicit) return explicit;

  const baseUrl = requiredEnv("E2E_BASE_URL");
  const parsed = new URL(baseUrl);
  if (parsed.hostname.startsWith("webmail.")) {
    return parsed.hostname.replace(/^webmail\./, "mail.");
  }
  return "mail.inout.email";
}

function smtpPort(): number {
  const explicit = process.env.E2E_SMTP_PORT;
  if (explicit) return Number.parseInt(explicit, 10) || 25;
  return 25;
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

async function openInboxFolder(page: Page): Promise<void> {
  await page.goto("/folder/Inbox");
  await expect(page.getByRole("heading", { name: "Inbox" })).toBeVisible({ timeout: 20_000 });
}

async function waitForRowBySubject(page: Page, subject: string): Promise<Locator> {
  const deadline = Date.now() + 120_000;
  const row = page.locator(".email-row", { hasText: subject }).first();

  while (Date.now() < deadline) {
    await page.getByPlaceholder("Search in Inbox...").fill(subject);
    if (await row.count()) {
      await expect(row).toBeVisible({ timeout: 10_000 });
      return row;
    }
    await page.getByTitle("Refresh").click();
    await page.waitForTimeout(2_500);
  }

  await expect(row).toBeVisible({ timeout: 5_000 });
  return row;
}

async function sendInboundEmail(params: {
  subject: string;
  text: string;
  html?: string;
  attachments?: Array<{ filename: string; content: string | Buffer; contentType?: string }>;
}): Promise<void> {
  const user = requiredEnv("E2E_EMAIL");
  const password = requiredEnv("E2E_PASSWORD");
  const transport = nodemailer.createTransport({
    host: smtpHost(),
    port: smtpPort(),
    secure: smtpPort() === 465,
    auth: {
      user,
      pass: password,
    },
    tls: { rejectUnauthorized: false },
  });

  await transport.sendMail({
    from: user,
    to: user,
    subject: params.subject,
    text: params.text,
    html: params.html,
    attachments: params.attachments,
  });

  transport.close();
}

async function sendThreadedConversation(params: {
  subject: string;
  participants: string[];
  messages: number;
}): Promise<void> {
  const user = requiredEnv("E2E_EMAIL");
  const password = requiredEnv("E2E_PASSWORD");
  const transport = nodemailer.createTransport({
    host: smtpHost(),
    port: smtpPort(),
    secure: smtpPort() === 465,
    auth: {
      user,
      pass: password,
    },
    tls: { rejectUnauthorized: false },
  });

  const threadRoot = `thread-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const ids = Array.from({ length: params.messages }, (_, idx) => `<${threadRoot}-${idx + 1}@inout.email>`);

  for (let i = 0; i < params.messages; i += 1) {
    const references = ids.slice(0, i);
    await transport.sendMail({
      from: `${params.participants[i % params.participants.length]} <${user}>`,
      to: user,
      subject: params.subject,
      text: `Thread message ${i + 1}`,
      messageId: ids[i],
      inReplyTo: i > 0 ? ids[i - 1] : undefined,
      references: references.length > 0 ? references.join(" ") : undefined,
    });
  }

  transport.close();
}

async function waitForHomeRowBySubject(page: Page, subject: string): Promise<Locator> {
  const deadline = Date.now() + 120_000;
  const row = page.locator(".email-row", { hasText: subject }).first();

  while (Date.now() < deadline) {
    if (await row.count()) {
      await expect(row).toBeVisible({ timeout: 10_000 });
      return row;
    }
    await page.getByTitle("Refresh").click();
    await page.waitForTimeout(2_500);
  }

  await expect(row).toBeVisible({ timeout: 5_000 });
  return row;
}

async function forceThreadedInboxMode(page: Page): Promise<void> {
  await page.addInitScript(() => {
    try {
      const raw = window.localStorage.getItem("settings");
      const current = raw ? JSON.parse(raw) : {};
      window.localStorage.setItem(
        "settings",
        JSON.stringify({
          ...current,
          enableCategories: false,
          conversationView: true,
        }),
      );
    } catch {
      window.localStorage.setItem(
        "settings",
        JSON.stringify({ enableCategories: false, conversationView: true }),
      );
    }
  });
}

test.describe("Requested feature regressions", () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
    if (new URL(page.url()).pathname !== "/") {
      await page.goto("/");
    }
    await expect(page.getByRole("heading", { name: "Inbox" })).toBeVisible();
  });

  test("delays send with countdown toast and allows undo", async ({ page }) => {
    await page.getByRole("button", { name: "Compose" }).click();
    await expect(page.getByText("New Message")).toBeVisible();

    const toInput = page.locator("input[placeholder='Recipients']").first();
    await toInput.fill("admin@inout.email");
    await toInput.press("Enter");
    await page.getByPlaceholder("What's this about?").fill(`Delayed send e2e ${Date.now()}`);
    await page.locator(".lexical-editor[contenteditable='true']").click();
    await page.keyboard.type("This email should be undoable during countdown.");

    await page.getByRole("button", { name: "Send", exact: true }).click();

    await expect(page.getByText(/Sending in 5/i)).toBeVisible();
    await expect(page.getByText(/Sending in 4/i)).toBeVisible({ timeout: 2_500 });
    await page.getByRole("button", { name: "Undo" }).click();
    await expect(page.getByText(/Send canceled/i)).toBeVisible();
    await expect(page.getByText("New Message")).toBeVisible();

    await page.waitForTimeout(5_500);
    await expect(page.getByText("Message sent!")).toHaveCount(0);
  });

  test("plain text links open in a new tab", async ({ page }) => {
    const stamp = Date.now();
    const subject = `Plain text link e2e ${stamp}`;
    const url = `https://example.com/plain-link-${stamp}`;
    await sendInboundEmail({
      subject,
      text: `Hello.\nPlease visit ${url}\nThanks.`,
    });

    await openInboxFolder(page);
    const row = await waitForRowBySubject(page, subject);
    await row.click();

    const link = page.locator(`a[href="${url}"]`).first();
    await expect(link).toBeVisible({ timeout: 20_000 });

    const popupPromise = page.waitForEvent("popup");
    await link.click();
    const popup = await popupPromise;
    await popup.waitForLoadState("domcontentloaded");
    expect(popup.url()).toContain(url);
    await popup.close();
  });

  test("html email links open in a new tab instead of inside reader iframe", async ({ page }) => {
    const stamp = Date.now();
    const subject = `HTML link e2e ${stamp}`;
    const url = `https://example.com/html-link-${stamp}`;
    await sendInboundEmail({
      subject,
      text: `Open ${url}`,
      html: `<div><p>Tap this <a href="${url}">message link</a>.</p></div>`,
    });

    await openInboxFolder(page);
    const row = await waitForRowBySubject(page, subject);
    await row.click();

    const frameLink = page
      .frameLocator('iframe[title="Email Content"]')
      .locator(`a[href="${url}"]`)
      .first();
    await expect(frameLink).toBeVisible({ timeout: 20_000 });

    const popupPromise = page.waitForEvent("popup");
    await frameLink.click();
    const popup = await popupPromise;
    await popup.waitForLoadState("domcontentloaded");
    expect(popup.url()).toContain(url);
    await popup.close();
  });

  test("shows received attachments in the reading interface", async ({ page }) => {
    const stamp = Date.now();
    const subject = `Inbound attachment e2e ${stamp}`;
    const attachmentName = `e2e-attachment-${stamp}.txt`;
    const attachmentContent = `Attachment payload ${stamp}`;

    await sendInboundEmail({
      subject,
      text: "Attachment visibility regression test.",
      attachments: [
        {
          filename: attachmentName,
          content: attachmentContent,
          contentType: "text/plain",
        },
      ],
    });

    await openInboxFolder(page);
    const row = await waitForRowBySubject(page, subject);
    await expect(row.getByLabel("Has attachments")).toBeVisible({ timeout: 20_000 });
    await row.click();

    await expect(page.getByLabel("Has attachments").first()).toBeVisible({ timeout: 30_000 });
    const attachmentSection = page.getByTestId("received-attachments").first();
    await expect(attachmentSection).toBeVisible({ timeout: 30_000 });
    const attachmentLink = attachmentSection.getByRole("link", { name: attachmentName }).first();
    await expect(attachmentLink).toBeVisible({ timeout: 30_000 });
    await expect(attachmentLink).toHaveAttribute("href", /\/api\/attachments\/.+/);
    await expect(attachmentLink).toHaveAttribute("target", "_blank");
    await expect(attachmentLink).toHaveAttribute("download", attachmentName);

    const href = await attachmentLink.getAttribute("href");
    expect(href).toBeTruthy();
    const absoluteAttachmentUrl = new URL(href!, page.url()).toString();

    const apiResponse = await page.request.get(absoluteAttachmentUrl);
    expect(apiResponse.status()).toBe(200);
    expect(apiResponse.headers()["content-disposition"] || "").toContain("attachment;");
    expect(await apiResponse.text()).toContain(attachmentContent);

    await expect(attachmentLink).toHaveAttribute("href", /\/api\/attachments\/.+/);
  });

  test("header uses inbox logo action, larger search input, and no support button", async ({ page }) => {
    await page.goto("/folder/Sent");
    await expect(page).toHaveURL(/\/folder\/Sent(?:\?|$)/);

    const logoButton = page.getByRole("button", { name: "Go to Inbox" });
    await expect(logoButton).toBeVisible();
    await expect(logoButton).toContainText("Homerow");
    await expect(logoButton).toContainText("beta");
    await logoButton.click();
    await expect(page).toHaveURL(/\/(?:\?|$)/);
    await expect(page.getByRole("heading", { name: "Inbox" })).toBeVisible();

    await expect(page.getByTitle("Support")).toHaveCount(0);

    const searchInput = page.getByPlaceholder("Search messages");
    const bounds = await searchInput.boundingBox();
    expect(bounds?.height ?? 0).toBeGreaterThanOrEqual(50);

    const commandPaletteIndicator = page.getByTestId("command-palette-indicator");
    await expect(commandPaletteIndicator).toBeVisible();
    await commandPaletteIndicator.click();
    await expect(page.getByTestId("command-palette")).toBeVisible();
  });

  test("refresh button animates while refreshing and shows inline completion state", async ({ page }) => {
    const refreshButton = page.getByTestId("inbox-refresh-button");
    await expect(refreshButton).toBeVisible();
    await expect(refreshButton).toHaveAttribute("data-state", "idle");

    await refreshButton.click();
    await expect
      .poll(async () => await refreshButton.getAttribute("data-state"))
      .not.toBe("idle");

    await expect(refreshButton).toHaveAttribute("data-state", "success");
    await expect(page.getByTestId("inbox-refresh-success-icon")).toBeVisible();
    await expect(refreshButton).toHaveAttribute("data-state", "idle", { timeout: 6_000 });
  });

  test("shows participant hint and grouped email count for conversations in inbox rows", async ({ page }) => {
    const stamp = Date.now();
    const subject = `Thread row indicator e2e ${stamp}`;
    await sendThreadedConversation({
      subject,
      participants: ["Anna", "John", "me", "Chris"],
      messages: 4,
    });

    await forceThreadedInboxMode(page);
    await page.goto("/");
    const row = await waitForHomeRowBySubject(page, subject);
    const countText = (await row.getByTestId("email-row-message-count").innerText()).trim();
    const count = Number.parseInt(countText, 10);
    expect(Number.isFinite(count)).toBeTruthy();
    expect(count).toBeGreaterThan(1);

    const participantsText = (await row.getByTestId("email-row-participants").innerText()).trim();
    expect(participantsText).toMatch(/Anna|John|Chris|me/i);
    expect(participantsText).toMatch(/,| and more/i);
  });

  test("opens command palette with keyboard shortcut and executes compose command", async ({ page }) => {
    const modifier = process.platform === "darwin" ? "Meta" : "Control";

    await page.keyboard.press(`${modifier}+k`);
    const palette = page.getByTestId("command-palette");
    const input = page.getByTestId("command-palette-input");
    await expect(palette).toBeVisible();
    await expect(input).toBeFocused();

    await page.keyboard.press(`${modifier}+k`);
    await expect(palette).toHaveCount(0);

    await page.keyboard.press(`${modifier}+k`);
    await expect(palette).toBeVisible();
    await input.fill("compose");
    await page.keyboard.press("Enter");

    await expect(palette).toHaveCount(0);
    await expect(page.getByText("New Message")).toBeVisible();
  });

  test("navigates to settings tab from command palette settings commands", async ({ page }) => {
    const modifier = process.platform === "darwin" ? "Meta" : "Control";

    await page.keyboard.press(`${modifier}+k`);
    const input = page.getByTestId("command-palette-input");
    await expect(input).toBeFocused();

    await input.fill("settings appearance");
    await page.getByRole("button", { name: /Go to Settings > Appearance/i }).click();

    await expect(page).toHaveURL(/\/settings\?tab=appearance(?:&|$)/);
    await expect(page.getByTestId("settings-tab-appearance")).toBeVisible();
  });

  test("escape in compose editor exits editing without closing compose, and palette escape does not close compose", async ({ page }) => {
    const modifier = process.platform === "darwin" ? "Meta" : "Control";

    await page.getByRole("button", { name: "Compose" }).click();
    await expect(page.getByText("New Message")).toBeVisible();

    const editor = page.locator(".lexical-editor[contenteditable='true']").first();
    await editor.click();
    await page.keyboard.type("Testing escape behavior in compose.");
    await page.keyboard.press("Escape");

    await expect(page.getByText("New Message")).toBeVisible();

    await page.keyboard.press(`${modifier}+k`);
    const palette = page.getByTestId("command-palette");
    await expect(palette).toBeVisible();
    await page.keyboard.press("Escape");

    await expect(palette).toHaveCount(0);
    await expect(page.getByText("New Message")).toBeVisible();
  });

  test("command palette prioritizes compose actions when compose is open", async ({ page }) => {
    const modifier = process.platform === "darwin" ? "Meta" : "Control";

    await page.getByRole("button", { name: "Compose" }).click();
    await expect(page.getByText("New Message")).toBeVisible();

    await page.keyboard.press(`${modifier}+k`);
    const palette = page.getByTestId("command-palette");
    await expect(palette).toBeVisible();
    await expect(palette.getByRole("button", { name: /Send message/i })).toBeVisible();
    await expect(palette.getByRole("button", { name: /Save draft/i })).toBeVisible();
  });

  test("hides list action buttons until an email is selected", async ({ page }) => {
    await openInboxFolder(page);
    const rows = page.locator(".email-row");
    test.skip((await rows.count()) < 1, "Need at least one email row");

    await expect(page.getByTestId("mail-list-bulk-actions")).toHaveCount(0);

    await page.locator("input[type='checkbox']").first().check();
    const bulkActions = page.getByTestId("mail-list-bulk-actions");
    await expect(bulkActions).toBeVisible();
    await expect(bulkActions.getByTitle("Archive")).toBeVisible();

    await page.locator("input[type='checkbox']").first().uncheck();
    await expect(page.getByTestId("mail-list-bulk-actions")).toHaveCount(0);
  });

  test("logoff redirects to login immediately", async ({ page }) => {
    await page.getByRole("button", { name: "Open account menu" }).click();
    await page.getByRole("menuitem", { name: "Log off" }).click();
    await page.waitForURL(/\/login(?:\?|$)/, { timeout: 10_000 });
  });

  test("browser notification uses app icon", async ({ page }) => {
    await page.context().addInitScript(() => {
      const records: Array<{ title: string; options: NotificationOptions }> = [];

      class FakeNotification {
        static permission: NotificationPermission = "granted";
        static requestPermission(): Promise<NotificationPermission> {
          return Promise.resolve("granted");
        }

        onclick: (() => void) | null = null;

        constructor(title: string, options: NotificationOptions = {}) {
          records.push({ title, options });
        }

        close() {}
      }

      class FakeEventSource {
        static instances: FakeEventSource[] = [];
        private listeners = new Map<string, Array<(event: MessageEvent) => void>>();
        onerror: ((this: EventSource, ev: Event) => any) | null = null;

        constructor(_url: string) {
          FakeEventSource.instances.push(this);
          setTimeout(() => {
            this.emit("connected", { data: "{}" } as MessageEvent);
          }, 0);
        }

        addEventListener(type: string, listener: (event: MessageEvent) => void) {
          const current = this.listeners.get(type) ?? [];
          current.push(listener);
          this.listeners.set(type, current);
        }

        removeEventListener(type: string, listener: (event: MessageEvent) => void) {
          const current = this.listeners.get(type) ?? [];
          this.listeners.set(
            type,
            current.filter((item) => item !== listener),
          );
        }

        close() {}

        emit(type: string, event: MessageEvent) {
          const listeners = this.listeners.get(type) ?? [];
          for (const listener of listeners) listener(event);
        }
      }

      try {
        Object.defineProperty(Document.prototype, "visibilityState", {
          configurable: true,
          get: () => "hidden",
        });
      } catch {
        // Ignore if browser blocks redefining this property.
      }

      // @ts-expect-error test shim
      window.Notification = FakeNotification;
      // @ts-expect-error test shim
      window.EventSource = FakeEventSource;
      // @ts-expect-error test shim
      window.__notificationRecords = records;
      // @ts-expect-error test shim
      window.__emitMailEvent = (payload: Record<string, unknown>) => {
        const event = { data: JSON.stringify(payload) } as MessageEvent;
        for (const source of FakeEventSource.instances) {
          source.emit("mail", event);
        }
      };
    });

    const notifPage = await page.context().newPage();
    await notifPage.goto("/");
    await expect(notifPage.getByRole("heading", { name: "Inbox" })).toBeVisible();

    await notifPage.evaluate(() => {
      // @ts-expect-error test shim
      window.__emitMailEvent({
        type: "new_message",
        uid: Date.now(),
        from: "Icon Test",
        subject: "Notification icon regression",
      });
    });

    await expect
      .poll(async () => notifPage.evaluate(() => {
        // @ts-expect-error test shim
        return window.__notificationRecords.length;
      }))
      .toBeGreaterThan(0);

    const icon = await notifPage.evaluate(() => {
      // @ts-expect-error test shim
      return window.__notificationRecords[0]?.options?.icon;
    });
    expect(icon).toBe("/pwa-192.png");

    await notifPage.close();
  });

  test("settings import tab uses dedicated import icon", async ({ page }) => {
    await page.goto("/settings");
    await expect(page.getByRole("heading", { name: "Settings", exact: true })).toBeVisible();

    const importIconPaths = await page
      .getByTestId("settings-tab-icon-import")
      .locator("path")
      .evaluateAll((paths) => paths.map((path) => path.getAttribute("d") ?? ""));

    expect(importIconPaths).toContain("M4 16h5l1.5 2h3L15 16h5");
    expect(importIconPaths).not.toContain("M8 7h8");
  });
});
