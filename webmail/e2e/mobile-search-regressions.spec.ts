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

test.describe("Mobile search regressions", () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await login(page);
  });

  test("keeps results list visible by default and only opens reader after tapping a result", async ({ page }) => {
    await page.goto("/search?q=e");
    await expect(page.getByText(/Results for \"e\"/)).toBeVisible();

    const rows = page.locator(".email-row");
    test.skip((await rows.count()) < 1, "Need at least one search result");

    await expect(page.getByTestId("mail-list-panel")).toBeVisible();
    await expect(page.getByTestId("reading-pane-close")).toHaveCount(0);

    await rows.first().click();
    await expect(page.getByTestId("reading-pane-close")).toBeVisible({ timeout: 20_000 });
    await expect(page.getByTestId("mail-list-panel")).toBeHidden();

    await page.getByTestId("reading-pane-close").click();
    await expect(page.getByTestId("mail-list-panel")).toBeVisible();
    await expect(page.getByTestId("reading-pane-close")).toHaveCount(0);
  });

  test("keeps advanced search filters usable on small screens", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { name: "Inbox" })).toBeVisible();

    await page.getByTestId("search-filters-button").click();
    const panel = page.getByTestId("search-filters-panel");
    await expect(panel).toBeVisible();

    const viewport = page.viewportSize();
    const bounds = await panel.evaluate((el) => {
      const rect = el.getBoundingClientRect();
      return { top: rect.top, left: rect.left, right: rect.right, bottom: rect.bottom };
    });
    if (viewport) {
      expect(bounds.top).toBeGreaterThanOrEqual(0);
      expect(bounds.left).toBeGreaterThanOrEqual(0);
      expect(bounds.right).toBeLessThanOrEqual(viewport.width);
      expect(bounds.bottom).toBeLessThanOrEqual(viewport.height);
    }

    await panel.getByRole("button", { name: "Search", exact: true }).scrollIntoViewIfNeeded();
    await expect(panel.getByRole("button", { name: "Search", exact: true })).toBeVisible();
  });

  test("hides row checkboxes on mobile and shows sender avatars in list rows", async ({ page }) => {
    await page.addInitScript(() => {
      (window as Window & { __sawMobileRowCheckbox?: boolean }).__sawMobileRowCheckbox = false;
      const sawCheckbox = () => {
        const found = document.querySelector(".email-row input[type='checkbox']");
        if (found) {
          (window as Window & { __sawMobileRowCheckbox?: boolean }).__sawMobileRowCheckbox = true;
        }
      };
      const observer = new MutationObserver(sawCheckbox);
      const startObserver = () => {
        sawCheckbox();
        observer.observe(document.documentElement, { childList: true, subtree: true });
      };
      if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", startObserver, { once: true });
      } else {
        startObserver();
      }
      window.addEventListener("beforeunload", () => observer.disconnect(), { once: true });
    });

    await page.goto("/");
    await expect(page.getByRole("heading", { name: "Inbox" })).toBeVisible();

    const rows = page.locator(".email-row");
    test.skip((await rows.count()) < 1, "Need at least one inbox email");

    await expect(page.locator('.email-row input[type="checkbox"]')).toHaveCount(0);
    const avatar = page.getByTestId("mobile-email-row-avatar").first();
    const sender = page.getByTestId("mobile-email-row-sender").first();
    const subject = page.getByTestId("mobile-email-row-subject").first();
    await expect(avatar).toBeVisible();
    await expect(sender).toBeVisible();
    await expect(subject).toBeVisible();

    const avatarBounds = await avatar.boundingBox();
    expect(avatarBounds).not.toBeNull();
    expect(avatarBounds?.width ?? 0).toBeGreaterThanOrEqual(34);

    const senderBounds = await sender.boundingBox();
    const subjectBounds = await subject.boundingBox();
    expect(senderBounds).not.toBeNull();
    expect(subjectBounds).not.toBeNull();
    expect(Math.abs((senderBounds?.x ?? 0) - (subjectBounds?.x ?? 0))).toBeLessThanOrEqual(2);

    await page.waitForTimeout(2500);
    const sawLoadTimeCheckbox = await page.evaluate(
      () => (window as Window & { __sawMobileRowCheckbox?: boolean }).__sawMobileRowCheckbox ?? false,
    );
    expect(sawLoadTimeCheckbox).toBeFalsy();
  });

  test("removes mobile top separator styling from header", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { name: "Inbox" })).toBeVisible();

    const header = page.locator("header").first();
    const styles = await header.evaluate((el) => {
      const computed = window.getComputedStyle(el);
      return {
        borderBottomWidth: computed.borderBottomWidth,
        boxShadow: computed.boxShadow,
      };
    });
    expect(styles.borderBottomWidth).toBe("0px");
    expect(styles.boxShadow).toBe("none");
  });
});
