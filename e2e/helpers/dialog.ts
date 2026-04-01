import type { Page } from "@playwright/test";

const CONFIRM_TIMEOUT_MS = 10_000;

/**
 * Start waiting for the next `window.confirm`. Call before the action that opens it, then
 * `await` the returned promise after the click: `const done = acceptNextConfirm(page); await click(); await done;`
 */
export function acceptNextConfirm(page: Page): Promise<void> {
  return page.waitForEvent("dialog", { timeout: CONFIRM_TIMEOUT_MS }).then(async (dialog) => {
    if (dialog.type() !== "confirm") {
      await dialog.dismiss();
      throw new Error(`Expected confirm, got ${dialog.type()}`);
    }
    await dialog.accept();
  });
}
