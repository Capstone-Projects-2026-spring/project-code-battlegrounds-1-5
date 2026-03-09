import { test, expect } from "@playwright/test";

let testEmail: string = `bun${Date.now()}@test.com`;

test("signup flow works", async ({ page }) => {
  await page.goto("/signup");

  await page.fill('[data-testid="name-signup"]', "Test User");

  await page.fill('[data-testid="email-signup"]', testEmail);
  await page.fill('[data-testid="password-signup"]', "password123");

  await page.click("button[data-testid='signup-button']");

  await expect(page).toHaveURL("/landingpage", {
    timeout: 15000,
  });
  await expect(page.getByText("Welcome")).toBeVisible();
});

test("login flow works", async ({ page }) => {
  await page.goto("/login");

  await page.fill('[data-testid="email-login"]', testEmail);
  await page.fill('[data-testid="password-login"]', "password123");

  await page.click("button[data-testid='login-button']");

  await expect(page).toHaveURL("/landingpage", {
    timeout: 15000,
  });
});

test("logout blocks landingpage", async ({ page }) => {
  await page.goto("/login");

  await page.fill('[data-testid="email-login"]', testEmail);
  await page.fill('[data-testid="password-login"]', "password123");

  await page.click("button[data-testid='login-button']");

  await page.click("text=Sign Out");

  await expect(page).toHaveURL("/login");

  await page.goto("/landingpage");

  await expect(page).toHaveURL("/login");
});

test("landingpage requires auth", async ({ page }) => {
  await page.goto("/landingpage");

  await expect(page).toHaveURL("/login");
});

test.afterAll(async ({ request }) => {
  await request.post("/api/test/cleanup", {
    data: { email: testEmail },
  });
});