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

test.describe("Compose inline images", () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
    if (new URL(page.url()).pathname !== "/") {
      await page.goto("/");
    }
    await expect(page.getByRole("heading", { name: "Inbox" })).toBeVisible();
  });

  test("inserts uploaded image inline in composer editor", async ({ page }) => {
    await page.getByRole("button", { name: "Compose" }).click();
    await expect(page.getByText("New Message")).toBeVisible();

    const onePixelPng = Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO7+f6QAAAAASUVORK5CYII=",
      "base64",
    );

    await page.locator('[data-testid="inline-image-upload-input"]').setInputFiles({
      name: "inline.png",
      mimeType: "image/png",
      buffer: onePixelPng,
    });

    const editorImage = page.locator(".lexical-editor img[src^='data:image/png']").first();
    await expect(editorImage).toBeVisible();
  });

  test("drop image inline and keep non-image drop as attachment", async ({ page }) => {
    await page.getByRole("button", { name: "Compose" }).click();
    await expect(page.getByText("New Message")).toBeVisible();

    const dataTransfer = await page.evaluateHandle(() => {
      const dt = new DataTransfer();
      const imageBase64 = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO7+f6QAAAAASUVORK5CYII=";
      const bytes = Uint8Array.from(atob(imageBase64), (c) => c.charCodeAt(0));
      dt.items.add(new File([bytes], "drop-inline.png", { type: "image/png" }));
      dt.items.add(new File(["drop as attachment"], "notes.txt", { type: "text/plain" }));
      return dt;
    });

    await page.locator(".compose-panel-enter").dispatchEvent("dragover", { dataTransfer });
    await expect(page.getByText("Drop files to attach")).toBeVisible();
    await page.locator(".lexical-editor").dispatchEvent("drop", { dataTransfer });

    const editorImage = page.locator(".lexical-editor img[src^='data:image/png']").first();
    await expect(editorImage).toBeVisible();
    await expect(page.getByText("notes.txt")).toBeVisible();
    await expect(page.getByText("Drop files to attach")).toHaveCount(0);
  });

  test("quick reply accepts dropped file attachments and keeps image drop inline", async ({ page }) => {
    const rows = page.locator(".email-row");
    test.skip((await rows.count()) < 1, "Need at least one email row");

    await rows.first().click();

    const inlineComposer = page.getByTestId("inline-composer");
    await expect(inlineComposer).toBeVisible();
    await inlineComposer.getByRole("button", { name: "Reply" }).first().click();

    const quickForm = page.getByTestId("inline-composer-form");
    const quickEditor = inlineComposer.locator(".lexical-editor[contenteditable='true']").first();

    const attachmentDrop = await page.evaluateHandle(() => {
      const dt = new DataTransfer();
      dt.items.add(new File(["quick reply attachment"], "quick-notes.txt", { type: "text/plain" }));
      return dt;
    });

    await quickForm.dispatchEvent("dragover", { dataTransfer: attachmentDrop });
    await expect(inlineComposer.getByText("Drop files to attach")).toBeVisible();
    await quickForm.dispatchEvent("drop", { dataTransfer: attachmentDrop });
    await expect(inlineComposer.getByText("quick-notes.txt")).toBeVisible();
    await expect(inlineComposer.getByText("Drop files to attach")).toHaveCount(0);

    const imageDrop = await page.evaluateHandle(() => {
      const dt = new DataTransfer();
      const imageBase64 = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO7+f6QAAAAASUVORK5CYII=";
      const bytes = Uint8Array.from(atob(imageBase64), (c) => c.charCodeAt(0));
      dt.items.add(new File([bytes], "quick-inline.png", { type: "image/png" }));
      return dt;
    });

    await quickEditor.dispatchEvent("drop", { dataTransfer: imageDrop });
    const quickEditorImage = quickEditor.locator("img[src^='data:image/png']").first();
    await expect(quickEditorImage).toBeVisible();
  });
});
