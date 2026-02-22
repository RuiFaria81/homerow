import { createHmac } from "node:crypto";
import { expect, test, type Page } from "@playwright/test";

function requiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing env var ${name}`);
  return value;
}

function base32Decode(input: string): Buffer {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  const normalized = input.toUpperCase().replace(/=+$/g, "").replace(/\s+/g, "");
  let bits = "";

  for (const char of normalized) {
    const index = alphabet.indexOf(char);
    if (index < 0) {
      throw new Error("Invalid base32 secret");
    }
    bits += index.toString(2).padStart(5, "0");
  }

  const bytes: number[] = [];
  for (let i = 0; i + 8 <= bits.length; i += 8) {
    bytes.push(parseInt(bits.slice(i, i + 8), 2));
  }
  return Buffer.from(bytes);
}

function generateTotpFromOtpAuthUri(uri: string): string {
  const parsed = new URL(uri);
  const secret = parsed.searchParams.get("secret") || "";
  const digits = Number(parsed.searchParams.get("digits") || "6");
  const period = Number(parsed.searchParams.get("period") || "30");
  const algorithm = (parsed.searchParams.get("algorithm") || "SHA1").toUpperCase();

  const counter = Math.floor(Date.now() / 1000 / period);
  const counterBuffer = Buffer.alloc(8);
  counterBuffer.writeBigUInt64BE(BigInt(counter));

  const hash = createHmac(algorithm.toLowerCase(), base32Decode(secret)).update(counterBuffer).digest();
  const offset = hash[hash.length - 1] & 0x0f;
  const binary =
    ((hash[offset] & 0x7f) << 24) |
    ((hash[offset + 1] & 0xff) << 16) |
    ((hash[offset + 2] & 0xff) << 8) |
    (hash[offset + 3] & 0xff);

  const otp = (binary % 10 ** digits).toString();
  return otp.padStart(digits, "0");
}

async function loginWithPassword(page: Page): Promise<void> {
  const email = requiredEnv("E2E_EMAIL");
  const password = requiredEnv("E2E_PASSWORD");

  await page.goto("/login");
  if (!page.url().includes("/login")) return;

  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL((url) => !url.pathname.includes("/login"), { timeout: 20_000 });
}

test("optional 2FA supports backup codes and can be disabled", async ({ page }) => {
  const password = requiredEnv("E2E_PASSWORD");

  await loginWithPassword(page);
  await expect(page.getByRole("heading", { name: "Inbox" })).toBeVisible();

  await page.goto("/settings?tab=accounts");
  await expect(page.getByRole("heading", { name: "Accounts" })).toBeVisible();

  const twoFactorPassword = page.getByPlaceholder("Current password (required for 2FA changes)");
  await twoFactorPassword.fill(password);

  const disableButton = page.getByRole("button", { name: "Disable 2FA" });
  if (await disableButton.count()) {
    await disableButton.click();
    await expect(page.getByText("Disabled", { exact: true })).toBeVisible();
  }

  await page.getByRole("button", { name: "Enable 2FA" }).click();
  await expect(page.getByRole("button", { name: "Verify and enable" })).toBeVisible();
  await expect(page.getByAltText("Two-factor setup QR code")).toBeVisible();

  const otpAuthUri = (await page.locator("code").filter({ hasText: /^otpauth:/ }).first().innerText()).trim();
  const setupCode = generateTotpFromOtpAuthUri(otpAuthUri);

  await page.getByPlaceholder("Authenticator code").fill(setupCode);
  await page.getByRole("button", { name: "Verify and enable" }).click();
  await expect(page.getByText("Enabled", { exact: true })).toBeVisible();

  const backupCode = (await page
    .locator("div")
    .filter({ hasText: "Backup codes" })
    .locator("code")
    .first()
    .innerText()).trim();
  expect(backupCode.length).toBeGreaterThan(4);

  await page.context().clearCookies();
  await page.goto("/login");
  await page.getByLabel("Email").fill(requiredEnv("E2E_EMAIL"));
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();

  await expect(page.getByRole("heading", { name: "Two-step verification" })).toBeVisible();
  await page.getByRole("button", { name: "Backup code" }).click();
  await page.getByPlaceholder("Enter backup code").fill(backupCode);
  await page.getByRole("button", { name: "Verify and sign in" }).click();
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByRole("heading", { name: "Inbox" })).toBeVisible();

  await page.goto("/settings?tab=accounts");
  await expect(page.getByRole("heading", { name: "Accounts" })).toBeVisible();
  await page.getByPlaceholder("Current password (required for 2FA changes)").fill(password);
  await page.getByRole("button", { name: "Disable 2FA" }).click();
  await expect(page.getByText("Disabled", { exact: true })).toBeVisible();
});
