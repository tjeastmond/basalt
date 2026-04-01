import { expect, test } from "@playwright/test";

import { login } from "./helpers/auth";
import { fillCollectionIdentity } from "./helpers/collection-form";
import { acceptNextConfirm } from "./helpers/dialog";

test.describe("collection records", () => {
  test("create, edit on full page, and delete", async ({ page }) => {
    const slug = `rec_${Date.now()}`;
    const collectionName = `Records ${slug}`;

    await login(page);
    await page.goto("/collections/new");
    await fillCollectionIdentity(page, slug, collectionName);
    await page.getByRole("button", { name: "Add field" }).click();
    await page.locator('label:has-text("Field name") input').fill("title");
    await page.locator('label:has-text("Required") input[type="checkbox"]').first().check();
    await page.getByRole("button", { name: "Create collection" }).click();
    await expect(page).toHaveURL("/collections");

    await page
      .getByRole("listitem")
      .filter({ hasText: collectionName })
      .getByRole("link", { name: "Records", exact: true })
      .click();
    await expect(page.getByRole("heading", { name: new RegExp(collectionName) })).toBeVisible();

    await page.getByRole("link", { name: "New record" }).click();
    await page.getByRole("textbox", { name: /Title/i }).fill("hello");
    await page.getByRole("button", { name: "Create record" }).click();
    await expect(page.getByRole("heading", { name: /Records/ })).toBeVisible();
    await expect(page.locator("tbody")).toContainText("hello");

    await page.locator('tbody a[href*="/records/"]:not([href$="/new"])').first().click();
    await page.getByRole("textbox", { name: /Title/i }).fill("hello updated");
    await page.getByRole("button", { name: "Save changes" }).click();
    await expect(page.locator("tbody")).toContainText("hello updated");

    await page.locator('tbody a[href*="/records/"]:not([href$="/new"])').first().click();
    void acceptNextConfirm(page);
    await page.getByRole("button", { name: "Delete record" }).click();
    await expect(page.getByText("No records yet.")).toBeVisible();
  });

  test("validates required fields on create", async ({ page }) => {
    const slug = `rec_req_${Date.now()}`;
    const collectionName = `Req ${slug}`;

    await login(page);
    await page.goto("/collections/new");
    await fillCollectionIdentity(page, slug, collectionName);
    await page.getByRole("button", { name: "Add field" }).click();
    await page.locator('label:has-text("Field name") input').fill("title");
    await page.locator('label:has-text("Required") input[type="checkbox"]').first().check();
    await page.getByRole("button", { name: "Create collection" }).click();
    await expect(page).toHaveURL("/collections");

    await page
      .getByRole("listitem")
      .filter({ hasText: collectionName })
      .getByRole("link", { name: "Records", exact: true })
      .click();
    await page.getByRole("link", { name: "New record" }).click();
    await page.getByRole("button", { name: "Create record" }).click();
    await expect(page.locator(".text-destructive").first()).toContainText(/required/i);
  });
});
