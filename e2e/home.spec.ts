import { expect, test } from "@playwright/test";
test("home page renders the ClientFlow introduction", async ({ page }) => { await page.goto("/"); await expect(page.getByRole("heading", { name: "Client work, without the chaos." })).toBeVisible(); await expect(page.getByText("ClientFlow", { exact: true })).toBeVisible(); });
