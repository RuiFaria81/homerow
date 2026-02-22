import { expect, test, type Page } from "@playwright/test";

const SHORTCUT_ACTION_IDS = [
  "openLeftMenu",
  "openRightMenu",
  "menuNextItem",
  "menuPreviousItem",
  "menuActivateItem",
  "previousPage",
  "nextPage",
  "nextConversation",
  "previousConversation",
  "openConversation",
  "returnToList",
  "archiveConversation",
  "deleteConversation",
  "toggleStar",
  "toggleSelection",
  "markUnread",
  "markImportant",
  "reportSpam",
  "archivePrevious",
  "archiveNext",
  "compose",
  "sendCompose",
  "composeMinimize",
  "composeToggleFullscreen",
  "composeClose",
  "composeSaveDraft",
  "composeToggleSchedule",
  "composeAttachFiles",
  "reply",
  "replyAll",
  "forward",
  "openActionsMenu",
  "openSnoozeMenu",
  "refreshEmails",
  "focusSearch",
  "gotoInbox",
  "gotoStarred",
  "gotoDrafts",
  "gotoSent",
  "clearSelection",
  "toggleHelp",
] as const;

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

function autoReplySwitch(page: Page) {
  return page
    .locator("div", { hasText: "Enable auto reply" })
    .first()
    .locator('[role="switch"]');
}

test.describe("Compose UI regressions", () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem("webmail.compose.fullscreen.v1", "false");
    });
    await login(page);
    if (new URL(page.url()).pathname !== "/") {
      await page.goto("/");
    }
    await expect(page.getByRole("heading", { name: "Inbox" })).toBeVisible();
  });

  test("composer formatting toolbar renders below editor", async ({ page }) => {
    await page.getByRole("button", { name: "Compose" }).click();
    await expect(page.getByText("New Message")).toBeVisible();

    const panel = page.locator(".compose-panel-enter");
    const editor = panel.locator(".lexical-editor").first();
    const toolbar = panel.locator(".lexical-toolbar").first();

    await expect(editor).toBeVisible();
    await expect(toolbar).toBeVisible();

    const editorBox = await editor.boundingBox();
    const toolbarBox = await toolbar.boundingBox();

    expect(editorBox).toBeTruthy();
    expect(toolbarBox).toBeTruthy();
    expect(toolbarBox!.y).toBeGreaterThan(editorBox!.y);
  });

  test("composer keeps fullscreen preference in local storage", async ({ page }) => {
    await page.getByRole("button", { name: "Compose" }).click();
    await expect(page.getByText("New Message")).toBeVisible();

    await page.getByRole("button", { name: /fullscreen/i }).click();
    await expect(page.locator(".compose-overlay-enter")).toBeVisible();

    await page.getByRole("button", { name: /close/i }).click();

    await page.getByRole("button", { name: "Compose" }).click();
    await expect(page.getByRole("button", { name: /exit fullscreen/i })).toBeVisible();
    await expect(page.locator(".compose-overlay-enter")).toBeVisible();
  });

  test("page shows auto-reply banner when auto-reply is active", async ({ page }) => {
    await page.goto("/settings?tab=auto-reply");
    await expect(page.getByRole("heading", { name: "Auto Reply" })).toBeVisible({ timeout: 20_000 });
    await page.getByRole("button", { name: "Clear" }).click();

    const checked = await autoReplySwitch(page).getAttribute("aria-checked");
    if (checked !== "true") {
      await autoReplySwitch(page).click();
    }
    await expect(autoReplySwitch(page)).toHaveAttribute("aria-checked", "true");
    await expect(page.getByTestId("page-auto-reply-banner")).toBeVisible({ timeout: 20_000 });

    await page.goto("/");
    await expect(page.getByRole("heading", { name: "Inbox" })).toBeVisible();
    await expect(page.getByTestId("page-auto-reply-banner")).toBeVisible();
    await expect(page.getByTestId("page-auto-reply-banner")).toContainText("Auto Reply");
  });

  test("composer Tab flow moves To -> Cc -> Bcc -> Subject -> Body", async ({ page }) => {
    await page.getByRole("button", { name: "Compose" }).click();
    const panel = page.locator(".compose-panel-enter");
    await expect(panel.getByText("New Message")).toBeVisible();

    await panel.getByRole("button", { name: "Cc", exact: true }).click();
    await panel.getByRole("button", { name: "Bcc", exact: true }).click();

    const toInput = page.locator("input[placeholder='Recipients']").first();
    const ccInput = page.locator("input[placeholder='Cc recipients']").first();
    const bccInput = page.locator("input[placeholder='Bcc recipients']").first();
    const subjectInput = page.getByPlaceholder("What's this about?");
    const editor = page.locator(".compose-panel-enter .lexical-editor[contenteditable='true']").first();

    await toInput.click();
    await toInput.fill("admin@inout.email");
    await toInput.press("Tab");
    await expect(ccInput).toBeFocused();

    await ccInput.fill("admin@inout.email");
    await ccInput.press("Tab");
    await expect(bccInput).toBeFocused();

    await bccInput.fill("admin@inout.email");
    await bccInput.press("Tab");
    await expect(subjectInput).toBeFocused();

    await subjectInput.fill("Keyboard tab order test");
    await subjectInput.press("Tab");
    await expect(editor).toBeFocused();
  });

  test("question mark toggles keyboard shortcuts help modal", async ({ page }) => {
    await page.getByRole("heading", { name: "Inbox" }).click();
    await page.keyboard.press("Shift+/");
    await expect(page.getByTestId("keyboard-shortcuts-help")).toBeVisible();
    await expect(page.getByRole("heading", { name: "Keyboard shortcuts" })).toBeVisible();

    await page.keyboard.press("Escape");
    await expect(page.getByTestId("keyboard-shortcuts-help")).toHaveCount(0);
  });

  test("escape blurs search input focus", async ({ page }) => {
    const searchInput = page.getByPlaceholder("Search messages");
    await searchInput.click();
    await expect(searchInput).toBeFocused();

    await page.keyboard.press("Escape");
    await expect(searchInput).not.toBeFocused();
  });

  test("search results keep inbox shortcuts and clear search when returning to inbox", async ({ page }) => {
    const inboxRows = page.locator(".email-row");
    test.skip((await inboxRows.count()) < 1, "Need at least one email row");

    const firstRowText = ((await inboxRows.first().innerText()) || "").trim();
    const query = firstRowText.split(/\s+/)[0] || "inbox";

    const searchInput = page.getByPlaceholder("Search messages");
    await searchInput.fill(query);
    await searchInput.press("Enter");
    await expect(page).toHaveURL(/\/search\?q=/);

    const resultsRows = page.locator(".email-row");
    test.skip((await resultsRows.count()) < 1, "Search returned no rows for derived inbox query");
    await expect(resultsRows.first()).toHaveClass(/email-row-active/);

    await page.getByText(/Results for/i).first().click();
    await page.keyboard.press("/");
    await expect(searchInput).toBeFocused();

    await page.keyboard.press("Escape");
    await page.getByText(/Results for/i).first().click();
    await page.keyboard.press("Backspace");
    await expect(page).toHaveURL("/");
    await expect(searchInput).toHaveValue("");
  });

  test("escape closes compose modal", async ({ page }) => {
    await page.getByRole("button", { name: "Compose" }).click();
    await expect(page.getByText("New Message")).toBeVisible();

    // First Escape blurs focused compose input; second Escape closes the modal.
    await page.keyboard.press("Escape");
    await page.keyboard.press("Escape");
    await expect(page.getByText("New Message")).toHaveCount(0);
  });

  test("compose action shortcuts trigger compose controls", async ({ page }) => {
    await page.getByRole("button", { name: "Compose" }).click();
    await expect(page.getByText("New Message")).toBeVisible();

    await page.keyboard.press("Control+Shift+S");
    await expect(page.getByTestId("compose-schedule-input")).toBeVisible();

    await page.keyboard.press("Control+S");
    await expect(page.getByText(/Draft saved/i)).toBeVisible();

    await page.keyboard.press("Control+Shift+M");
    await expect(page.locator(".compose-panel-enter")).toHaveCount(0);
    await expect(page.getByTestId("compose-minimized-bar")).toBeVisible();

    await page.getByTestId("compose-minimized-bar").click();
    await expect(page.getByText("New Message")).toBeVisible();

    await page.keyboard.press("Control+Shift+W");
    await expect(page.getByText("New Message")).toHaveCount(0);
  });

  test("settings allow custom compose shortcut and recorder capture", async ({ page }) => {
    await page.goto("/settings?tab=shortcuts");
    await expect(page.getByRole("heading", { name: "Keyboard Shortcuts" })).toBeVisible();

    await page.getByTestId("shortcut-input-compose-primary").fill("n");
    await page.getByTestId("shortcut-record-compose-primary").click();
    await page.keyboard.press("KeyN");
    await expect(page.getByTestId("shortcut-input-compose-primary")).toHaveValue("n");

    await page.goto("/");
    await expect(page.getByRole("heading", { name: "Inbox" })).toBeVisible();

    await page.keyboard.press("n");
    await expect(page.getByText("New Message")).toBeVisible();
    await page.getByRole("button", { name: /close/i }).click();
    await expect(page.getByText("New Message")).toHaveCount(0);

    await page.goto("/settings?tab=shortcuts");
    await page.getByTestId("shortcuts-restore-defaults").click();
  });

  test("shortcuts settings shows every action and flags conflicts", async ({ page }) => {
    await page.goto("/settings?tab=shortcuts");
    await expect(page.getByRole("heading", { name: "Keyboard Shortcuts" })).toBeVisible();

    for (const id of SHORTCUT_ACTION_IDS) {
      await expect(page.getByTestId(`shortcut-input-${id}-primary`)).toBeVisible();
      await expect(page.getByTestId(`shortcut-record-${id}-primary`)).toBeVisible();
    }

    const nextConversationPrimary = page.getByTestId("shortcut-input-nextConversation-primary");
    const previousConversationPrimary = page.getByTestId("shortcut-input-previousConversation-primary");

    await nextConversationPrimary.fill("q");
    await previousConversationPrimary.fill("q");

    await expect(page.getByTestId("shortcut-conflict-warning")).toBeVisible();
    await expect(nextConversationPrimary).toHaveAttribute("data-conflict", "true");
    await expect(previousConversationPrimary).toHaveAttribute("data-conflict", "true");

    await page.getByTestId("shortcuts-restore-defaults").click();
    await expect(page.getByTestId("shortcut-conflict-warning")).toHaveCount(0);
  });

  test("help modal has key/action tracking toggle", async ({ page }) => {
    await page.keyboard.press("Shift+/");
    await expect(page.getByTestId("keyboard-shortcuts-help")).toBeVisible();

    await page.getByTestId("help-shortcut-feedback-on").click();
    await expect(page.getByTestId("help-shortcut-feedback-on")).toBeVisible();

    await page.getByTestId("help-shortcut-feedback-off").click();
    await expect(page.getByTestId("help-shortcut-feedback-off")).toBeVisible();
  });

  test("shortcuts open control menus and refresh", async ({ page }) => {
    await page.goto("/settings?tab=shortcuts");
    await page.getByTestId("shortcut-feedback-on").click();

    await page.goto("/");
    const rows = page.locator(".email-row");
    test.skip((await rows.count()) < 1, "Need at least one email row");

    await rows.first().click();

    await page.keyboard.press(".");
    await expect(page.locator('[data-context-menu-root="true"]')).toBeVisible();
    await expect(page.getByText(/Toggle actions menu/i)).toBeVisible();

    await page.keyboard.press("z");
    await expect(page.getByText("Snooze until...")).toBeVisible();

    await page.mouse.click(10, 10);
    await page.keyboard.press("Shift+R");
    await expect(page.getByText(/Refresh emails/i)).toBeVisible();
  });

  test("shortcuts open side menus and allow arrow navigation", async ({ page }) => {
    await page.goto("/settings?tab=shortcuts");
    await page.getByTestId("shortcut-feedback-on").click();

    await page.goto("/");
    await expect(page.getByRole("heading", { name: "Inbox" })).toBeVisible();

    const collapseButton = page.locator('button[title^="Collapse menu"]');
    if (await collapseButton.isVisible()) {
      await collapseButton.click();
    }
    await expect(page.getByTestId("left-sidebar-menu")).toHaveCount(0);

    await page.keyboard.press("m");
    await expect(page.getByTestId("left-sidebar-menu")).toBeVisible();
    await expect(page.getByText(/Toggle left menu/i)).toBeVisible();

    await page.keyboard.press("Shift+M");
    await expect(page.getByTestId("quick-settings-panel")).toHaveClass(/translate-x-0/);
    await expect(page.getByText(/Toggle right menu/i)).toBeVisible();

    await page.keyboard.press("ArrowDown");
    await expect(page.getByText(/Menu next item/i)).toBeVisible();

    await page.keyboard.press("Enter");
    await expect(page.getByText(/Menu select item/i)).toBeVisible();
  });

  test("arrow keys navigate email list by default", async ({ page }) => {
    await page.goto("/settings?tab=shortcuts");
    await page.getByTestId("shortcut-feedback-on").click();

    await page.goto("/");
    const rows = page.locator(".email-row");
    test.skip((await rows.count()) < 2, "Need at least two email rows");

    await page.keyboard.press("ArrowDown");
    await expect(rows.nth(0)).toHaveClass(/email-row-active/);
    await expect(page.getByText(/Next conversation/i)).toHaveCount(0);

    await page.keyboard.press("ArrowDown");
    await expect(rows.nth(1)).toHaveClass(/email-row-active/);

  });

  test("shortcuts navigate previous and next page", async ({ page }) => {
    await page.goto("/settings?tab=shortcuts");
    await page.getByTestId("shortcut-feedback-on").click();

    await page.goto("/");
    const nextPageButton = page.locator('button[title^="Next page"]');
    test.skip(await nextPageButton.isDisabled(), "Need at least one next page");

    await page.keyboard.press("Shift+ArrowRight");
    await expect(page.getByText(/Next page/i)).toBeVisible();
  });

  test("shortcuts for reply, reply all, and forward open compose", async ({ page }) => {
    await page.goto("/settings?tab=shortcuts");
    await page.getByTestId("shortcut-feedback-on").click();

    await page.goto("/");
    const rows = page.locator(".email-row");
    test.skip((await rows.count()) < 1, "Need at least one email row");

    await rows.first().click();

    await page.keyboard.press("r");
    await expect(page.getByText("New Message")).toBeVisible();
    await expect(page.getByPlaceholder("What's this about?")).toHaveValue(/Re:/i);
    await page.getByRole("button", { name: /close/i }).click();

    await page.keyboard.press("a");
    await expect(page.getByText("New Message")).toBeVisible();
    await expect(page.getByPlaceholder("What's this about?")).toHaveValue(/Re:/i);
    await page.getByRole("button", { name: /close/i }).click();

    await page.keyboard.press("f");
    await expect(page.getByText("New Message")).toBeVisible();
    await expect(page.getByPlaceholder("What's this about?")).toHaveValue(/Fwd:/i);
    await page.getByRole("button", { name: /close/i }).click();
  });
});
