import { config as loadEnv } from "dotenv";
import path from "node:path";
import { defineConfig, devices } from "@playwright/test";

loadEnv({ path: path.resolve(process.cwd(), ".env.local") });
loadEnv({ path: path.resolve(process.cwd(), ".env") });

const baseURL = process.env.BASE_URL ?? "http://localhost:3000";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.GITHUB_ACTIONS ? 2 : 0,
  /** Same dev user across browser tests; fewer workers avoids Better Auth / session contention. */
  workers: process.env.GITHUB_ACTIONS ? 1 : 3,
  reporter: [["list"]],
  globalSetup: path.resolve(process.cwd(), "e2e/global-setup.ts"),
  use: {
    baseURL,
    trace: "on-first-retry",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: "pnpm dev",
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
