import { test, expect } from "@playwright/test";
import { resetData, seedProperty, seedRevenue, seedExpense } from "./helpers";

/**
 * HostWise core flows (roadmap 5.1) — 8 smoke flows across the main pages.
 * Each test resets the business data and seeds what it needs, so the suite is
 * idempotent and safe to run in CI.
 */

async function waitForApp(page: import("@playwright/test").Page) {
  // The AppShell shows a loading gate while the backend starts; wait for the
  // sidebar (or any page content) to appear.
  await expect(page.locator("main").first()).toBeVisible({ timeout: 30_000 });
}

/** Navigate with domcontentloaded — Next.js dev keeps the `load` event
 *  pending via HMR, which can hang the default `load` waitUntil. */
async function goto(page: import("@playwright/test").Page, path: string) {
  await page.goto(path, { waitUntil: "domcontentloaded" });
}

test("01 · Dashboard loads and renders the shell", async ({ page }) => {
  await resetData();
  await goto(page, "/");
  await waitForApp(page);
  await expect(page.getByRole("link", { name: "Dashboard" })).toBeVisible();
  // Sidebar navigation is present.
  for (const label of ["Properties", "Finance", "Analytics", "Reports", "Settings"]) {
    await expect(page.getByRole("link", { name: label })).toBeVisible();
  }
});

test("02 · Create a property from the UI", async ({ page }) => {
  await resetData();
  await goto(page, "/properties");
  await waitForApp(page);
  await page.getByRole("button", { name: "Add Property" }).click();
  await page.getByPlaceholder("e.g. Sunset Villa").fill("E2E Sunset Villa");
  await page.getByRole("button", { name: "Create Property" }).click();
  await expect(page.getByText("E2E Sunset Villa")).toBeVisible({ timeout: 15_000 });
});

test("03 · Add a revenue record from the UI", async ({ page }) => {
  await resetData();
  const pid = await seedProperty("E2E Rev Villa");
  await goto(page, "/finance");
  await waitForApp(page);
  await page.getByRole("button", { name: "Add" }).first().click();
  // Entry form: pick the property, enter gross (first number input), save.
  const form = page.locator("form").first();
  await form.locator("select").first().selectOption(pid);
  await form.locator('input[type="number"]').first().fill("1200");
  await form.getByRole("button", { name: "Save" }).click();
  await expect(page.getByText("E2E Rev Villa").first()).toBeVisible({ timeout: 15_000 });
});

test("04 · Analytics page shows portfolio data", async ({ page }) => {
  await resetData();
  const pid = await seedProperty("E2E Analytics Villa");
  await seedRevenue(pid, "2026-06-10", 1500, 150);
  await seedExpense(pid, "2026-06-12", 300);
  await goto(page, "/analytics");
  await waitForApp(page);
  await expect(page.getByText("€1,350", { exact: false }).first()).toBeVisible({ timeout: 20_000 });
});

test("05 · AI Advisor renders a report", async ({ page }) => {
  await resetData();
  const pid = await seedProperty("E2E AI Villa");
  await seedRevenue(pid, "2026-06-10", 1500, 150);
  await seedExpense(pid, "2026-06-12", 300);
  await goto(page, "/ai-advisor");
  await waitForApp(page);
  await expect(page.getByText("Executive AI Summary")).toBeVisible({ timeout: 30_000 });
});

test("06 · Reports page renders the portfolio report", async ({ page }) => {
  await resetData();
  const pid = await seedProperty("E2E Report Villa");
  await seedRevenue(pid, "2026-06-10", 1500, 150);
  await seedExpense(pid, "2026-06-12", 300);
  await goto(page, "/reports");
  await waitForApp(page);
  await expect(page.getByText("Executive Summary")).toBeVisible({ timeout: 30_000 });
});

test("07 · Import page lists samples and iCal connector", async ({ page }) => {
  await resetData();
  await goto(page, "/import");
  await waitForApp(page);
  await expect(page.getByText("Sample Templates")).toBeVisible();
  await expect(page.getByText("Calendar (iCal)")).toBeVisible();
  await expect(page.getByText("iCal (Airbnb / Booking)")).toBeVisible();
});

test("08 · Settings tabs render (Business, Notifications)", async ({ page }) => {
  await resetData();
  await goto(page, "/settings");
  await waitForApp(page);
  await expect(page.getByRole("tab", { name: "Business" })).toBeVisible();
  await expect(page.getByRole("tab", { name: "Notifications" })).toBeVisible();
  await expect(page.getByRole("tab", { name: "Maintenance" })).toBeVisible();
});
