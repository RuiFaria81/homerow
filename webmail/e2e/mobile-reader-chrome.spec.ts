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

function parseCounter(raw: string): { current: number; total: number } | null {
  const match = raw.match(/^\s*(\d+)\s*\/\s*(\d+)\s*$/);
  if (!match) return null;
  return { current: Number(match[1]), total: Number(match[2]) };
}

async function swipeReader(page: Page, fromX: number, toX: number, y = 320): Promise<void> {
  await page.evaluate(
    ({ fromX: startX, toX: endX, y: posY }) => {
      const el = document.querySelector<HTMLElement>('[data-testid="reading-pane-root"]');
      if (!el) return;
      const createTouchLike = (x: number, yPos: number) => ({
        identifier: 1,
        target: el,
        clientX: x,
        clientY: yPos,
        pageX: x,
        pageY: yPos,
        screenX: x,
        screenY: yPos,
      });

      const startTouch = createTouchLike(startX, posY);
      const endTouch = createTouchLike(endX, posY);

      const touchStart = new Event("touchstart", { bubbles: true, cancelable: true });
      Object.defineProperty(touchStart, "touches", { configurable: true, value: [startTouch] });
      el.dispatchEvent(touchStart);

      const touchEnd = new Event("touchend", { bubbles: true, cancelable: true });
      Object.defineProperty(touchEnd, "changedTouches", { configurable: true, value: [endTouch] });
      el.dispatchEvent(touchEnd);
    },
    { fromX, toX, y },
  );
}

async function swipeReaderIframe(page: Page, fromX: number, toX: number, y = 220): Promise<boolean> {
  return page.evaluate(
    ({ fromX: startX, toX: endX, y: posY }) => {
      const frame = document.querySelector<HTMLIFrameElement>('[data-testid="reading-pane-root"] iframe');
      const frameDoc = frame?.contentDocument;
      if (!frame || !frameDoc) return false;
      const createTouchLike = (x: number, yPos: number) => ({
        identifier: 1,
        target: frameDoc.body || frameDoc.documentElement,
        clientX: x,
        clientY: yPos,
        pageX: x,
        pageY: yPos,
        screenX: x,
        screenY: yPos,
      });

      const startTouch = createTouchLike(startX, posY);
      const endTouch = createTouchLike(endX, posY);

      const touchStart = new Event("touchstart", { bubbles: true, cancelable: true });
      Object.defineProperty(touchStart, "touches", { configurable: true, value: [startTouch] });
      frameDoc.dispatchEvent(touchStart);

      const touchEnd = new Event("touchend", { bubbles: true, cancelable: true });
      Object.defineProperty(touchEnd, "changedTouches", { configurable: true, value: [endTouch] });
      frameDoc.dispatchEvent(touchEnd);
      return true;
    },
    { fromX, toX, y },
  );
}

test.describe("Mobile reader chrome", () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await login(page);
    if (new URL(page.url()).pathname !== "/") {
      await page.goto("/");
    }
    await expect(page.getByRole("heading", { name: "Inbox" })).toBeVisible();
  });

  test("hides global mobile chrome while reading and restores only on upward scroll", async ({ page }) => {
    await expect(page.getByTestId("mobile-compose-fab")).toBeVisible();
    await expect(page.getByTestId("mobile-compose-fab")).toContainText("Compose");
    await page.goto("/settings");
    await expect(page.getByRole("heading", { name: "Settings", exact: true })).toBeVisible();
    await expect(page.getByTestId("mobile-compose-fab")).toHaveCount(0);
    await page.goto("/");
    await expect(page.getByRole("heading", { name: "Inbox" })).toBeVisible();

    await expect(page.getByTestId("mail-category-tabs")).toBeHidden();

    const rows = page.locator(".email-row");
    test.skip((await rows.count()) < 1, "Need at least one inbox email");
    await rows.first().click();

    await expect(page.getByTestId("reading-pane-close")).toBeVisible({ timeout: 20_000 });
    await expect(page.getByTestId("app-top-header")).toHaveCount(0);
    await expect(page.getByTestId("mobile-compose-fab")).toHaveCount(0);

    const toolbar = page.getByTestId("mobile-reader-toolbar");
    const quickReply = page.getByTestId("mobile-reader-quick-reply");
    const scrollContainer = page.getByTestId("mobile-reader-scroll-container").first();

    await expect(toolbar).toBeVisible();
    await expect(quickReply).toBeVisible();

    await scrollContainer.evaluate((el) => {
      const filler = document.createElement("div");
      filler.style.height = "2400px";
      filler.setAttribute("data-e2e-filler", "true");
      el.appendChild(filler);
    });

    await scrollContainer.evaluate((el) => {
      el.scrollTop = 240;
      el.dispatchEvent(new Event("scroll", { bubbles: true }));
    });
    await expect(toolbar).toHaveClass(/max-h-0/);
    await expect(quickReply).toHaveClass(/translate-y-full/);

    await scrollContainer.evaluate((el) => {
      el.scrollTop = 180;
      el.dispatchEvent(new Event("scroll", { bubbles: true }));
    });
    await expect(toolbar).not.toHaveClass(/max-h-0/);
    await expect(quickReply).not.toHaveClass(/translate-y-full/);

    await scrollContainer.evaluate((el) => {
      el.scrollTop = 260;
      el.dispatchEvent(new Event("scroll", { bubbles: true }));
    });
    await expect(toolbar).toHaveClass(/max-h-0/);
    await page.waitForTimeout(220);
    await expect(toolbar).toHaveClass(/max-h-0/);

    await scrollContainer.evaluate((el) => {
      el.scrollTop = 200;
      el.dispatchEvent(new Event("scroll", { bubbles: true }));
    });
    await expect(toolbar).not.toHaveClass(/max-h-0/);
  });

  test("keeps nav controls hidden on mobile and supports swipe next/previous", async ({ page }) => {
    const rows = page.locator(".email-row");
    test.skip((await rows.count()) < 2, "Need at least two inbox emails");
    await rows.first().click();

    await expect(page.getByTestId("reading-pane-close")).toBeVisible({ timeout: 20_000 });
    await expect(page.getByTestId("reading-pane-prev")).toBeHidden();
    await expect(page.getByTestId("reading-pane-next")).toBeHidden();
    await expect(page.getByTestId("reading-pane-fullspace")).toBeHidden();

    const counter = page.getByTestId("reading-pane-position-counter");
    await expect(counter).toBeVisible();
    const initial = parseCounter((await counter.textContent()) || "");
    test.skip(!initial || initial.total < 2, "Need at least two messages in reader context");
    const scrollContainer = page.getByTestId("mobile-reader-scroll-container").first();
    await scrollContainer.evaluate((el) => {
      const filler = document.createElement("div");
      filler.style.height = "2200px";
      filler.setAttribute("data-e2e-swipe-filler", "true");
      el.appendChild(filler);
      el.scrollTop = 260;
      el.dispatchEvent(new Event("scroll", { bubbles: true }));
    });

    const paneRoot = page.getByTestId("reading-pane-root");
    await swipeReader(page, 320, 90);
    await expect(paneRoot).toHaveClass(/reading-pane-swipe-next/);
    await expect
      .poll(async () => parseCounter((await counter.textContent()) || "")?.current ?? 0, { timeout: 6_000 })
      .toBe(Math.min(initial.current + 1, initial.total));
    await expect
      .poll(async () => scrollContainer.evaluate((el) => el.scrollTop), { timeout: 6_000 })
      .toBeLessThan(8);

    await swipeReader(page, 80, 300);
    await expect(paneRoot).toHaveClass(/reading-pane-swipe-previous/);
    await expect
      .poll(async () => parseCounter((await counter.textContent()) || "")?.current ?? 0, { timeout: 6_000 })
      .toBe(initial.current);

    const iframeSwipePossible = await swipeReaderIframe(page, 320, 90);
    test.skip(!iframeSwipePossible, "Need an iframe-based message body for iframe swipe validation");
    await expect
      .poll(async () => parseCounter((await counter.textContent()) || "")?.current ?? 0, { timeout: 6_000 })
      .toBeGreaterThan(initial.current);

    const afterFirstIframeSwipe = parseCounter((await counter.textContent()) || "");
    test.skip(!afterFirstIframeSwipe, "Missing reader counter after first iframe swipe");

    await swipeReaderIframe(page, 80, 300);
    await expect
      .poll(async () => parseCounter((await counter.textContent()) || "")?.current ?? 0, { timeout: 6_000 })
      .toBe(afterFirstIframeSwipe.current - 1);
  });
});
