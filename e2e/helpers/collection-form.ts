import type { Page } from "@playwright/test";

/** Slug + display name on new/edit collection editor (placeholders collide case-insensitively). */
export async function fillCollectionIdentity(page: Page, slug: string, name: string): Promise<void> {
  await page.getByRole("textbox", { name: /^Slug/i }).fill(slug);
  await page.getByRole("textbox", { name: /Display name/i }).fill(name);
}
