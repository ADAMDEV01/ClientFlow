import { expect, test } from "@playwright/test";

test("home page renders the ClientFlow introduction", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Client work, without the chaos." })).toBeVisible();
  await expect(page.getByText("ClientFlow", { exact: true })).toBeVisible();
});

test("team routes redirect unauthenticated visitors to login", async ({ page }) => {
  await page.goto("/app");
  await expect(page).toHaveURL(/\/login\?callbackUrl=%2Fapp/);
});

test("client portal routes redirect unauthenticated visitors to login", async ({ page }) => {
  await page.goto("/portal");
  await expect(page).toHaveURL(/\/login\?callbackUrl=%2Fportal/);
});
