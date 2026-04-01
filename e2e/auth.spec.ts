import { expect, test } from "@playwright/test";

import { login } from "./helpers/auth";
import { smokeCredentials } from "./helpers/env";

test.describe("auth", () => {
  test("sign in and sign out", async ({ page }) => {
    await login(page);
    await expect(page.getByRole("link", { name: "Collections" })).toBeVisible();
    await page.getByRole("button", { name: "Log out" }).click();
    await expect(page.getByRole("link", { name: "Sign in" })).toBeVisible({ timeout: 30_000 });
  });

  test("rejects wrong password", async ({ page }) => {
    const { email } = smokeCredentials();
    await page.goto("/login");
    await page.getByLabel("Email").fill(email);
    await page.getByLabel("Password", { exact: true }).fill("not-the-real-password-xyz");
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page).toHaveURL(/\/login/);
    await expect(page.getByRole("heading", { name: "Sign in" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Log out" })).toHaveCount(0);
  });
});
