import type { Page } from "@playwright/test";

/** Accept the next `window.confirm` (e.g. delete collection / record). */
export function acceptNextConfirm(page: Page): Promise<void> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error("Timed out waiting for confirm dialog"));
    }, 10_000);
    page.once("dialog", (dialog) => {
      clearTimeout(timer);
      if (dialog.type() !== "confirm") {
        void dialog.dismiss();
        reject(new Error(`Expected confirm, got ${dialog.type()}`));
        return;
      }
      void dialog.accept().then(() => resolve());
    });
  });
}
