import type { Page } from "@playwright/test";

import { smokeCredentials } from "./env";

export async function login(page: Page, creds?: { email: string; password: string }): Promise<void> {
  const { email, password } = creds ?? smokeCredentials();
  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.getByRole("button", { name: "Log out" }).waitFor({ state: "visible" });
}
