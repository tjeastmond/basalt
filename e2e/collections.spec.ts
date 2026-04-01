import { expect, test } from "@playwright/test";

import { login } from "./helpers/auth";
import { fillCollectionIdentity } from "./helpers/collection-form";
import { acceptNextConfirm } from "./helpers/dialog";

test.describe("collections", () => {
  test("create, edit, and delete", async ({ page }) => {
    const slug = `smoke_${Date.now()}`;
    const name = `Smoke ${slug}`;

    await login(page);
    await page.goto("/collections/new");
    await fillCollectionIdentity(page, slug, name);

    await page.getByRole("button", { name: "Add field" }).click();
    await page.locator('label:has-text("Field name") input').fill("title");
    await page.locator('label:has-text("Required") input[type="checkbox"]').first().check();

    await page.getByRole("button", { name: "Create collection" }).click();
    await expect(page).toHaveURL("/collections");
    await expect(page.getByRole("link", { name: new RegExp(name) })).toBeVisible();

    await page.getByRole("link", { name: new RegExp(name) }).click();
    await expect(page).toHaveURL(new RegExp(`/collections/[a-f0-9-]+/edit`));

    const edited = `${name} edited`;
    await page.getByRole("textbox", { name: /Display name/i }).fill(edited);
    await page.getByRole("button", { name: "Save changes" }).click();
    await expect(page).toHaveURL("/collections");
    await expect(page.getByRole("link", { name: new RegExp(edited) })).toBeVisible();

    await page.getByRole("link", { name: new RegExp(edited) }).click();
    void acceptNextConfirm(page);
    await page.getByRole("button", { name: "Delete collection" }).click();
    await expect(page).toHaveURL("/collections");
    await expect(page.getByRole("link", { name: new RegExp(edited) })).toHaveCount(0);
  });

  test("requires slug and name", async ({ page }) => {
    await login(page);
    await page.goto("/collections/new");
    await fillCollectionIdentity(page, "", "");
    await page.getByRole("button", { name: "Create collection" }).click();
    await expect(page.getByText("Slug and name are required.")).toBeVisible();
  });

  test("duplicate slug is rejected", async ({ page }) => {
    const slug = `dup_${Date.now()}`;

    await login(page);
    await page.goto("/collections/new");
    await fillCollectionIdentity(page, slug, "First");
    await page.getByRole("button", { name: "Create collection" }).click();
    await expect(page).toHaveURL("/collections");

    await page.goto("/collections/new");
    await fillCollectionIdentity(page, slug, "Second");
    await page.getByRole("button", { name: "Create collection" }).click();
    await expect(page.getByRole("main").getByText("A collection with this slug already exists.")).toBeVisible();
  });
});
