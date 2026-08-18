import { defineConfig, devices } from "@playwright/test";

/**
 * HostWise e2e suite (roadmap 5.1).
 *
 * Requires the app to be running:
 *   - frontend: `bun next dev --port 3000`
 *   - backend:  `uvicorn app.main:app --port 8000` (in backend/)
 *
 * Run with: `bun run e2e`
 * Base URLs can be overridden with E2E_BASE_URL / E2E_API_URL.
 */
export default defineConfig({
  testDir: "./e2e",
  timeout: 60_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  workers: 1, // shared local DB — keep tests serial
  retries: process.env.CI ? 1 : 0,
  reporter: [["list"]],
  use: {
    baseURL: process.env.E2E_BASE_URL || "http://localhost:3000",
    trace: "retain-on-failure",
    viewport: { width: 1280, height: 900 },
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
});
