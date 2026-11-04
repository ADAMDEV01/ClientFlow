import axe from "axe-core";
import { expect, test } from "@playwright/test";

test("home page renders the ClientFlow introduction", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Client work, without the chaos." })).toBeVisible();
  await expect(page.getByText("ClientFlow", { exact: true })).toBeVisible();
});

test("home page passes axe-core WCAG 2.1 A/AA checks", async ({ page }) => {
  await page.goto("/");
  await page.addScriptTag({ content: axe.source });

  const violations = await page.evaluate(async () => {
    type AxeResult = {
      violations: Array<{
        id: string;
        impact: string | null;
        nodes: unknown[];
      }>;
    };
    type AxeGlobal = {
      run: (
        context: Document,
        options: { runOnly: { type: "tag"; values: string[] } },
      ) => Promise<AxeResult>;
    };
    const axeGlobal = (window as Window & { axe?: AxeGlobal }).axe;
    if (!axeGlobal) throw new Error("axe-core did not load in the browser.");

    const result = await axeGlobal.run(document, {
      runOnly: {
        type: "tag",
        values: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"],
      },
    });
    return result.violations.map(({ id, impact, nodes }) => ({
      id,
      impact,
      affectedNodes: nodes.length,
    }));
  });

  expect(violations).toEqual([]);
});

test("team routes redirect unauthenticated visitors to login", async ({ page }) => {
  await page.goto("/app");
  await expect(page).toHaveURL(/\/login\?callbackUrl=%2Fapp/);
});

test("client portal routes redirect unauthenticated visitors to login", async ({ page }) => {
  await page.goto("/portal");
  await expect(page).toHaveURL(/\/login\?callbackUrl=%2Fportal/);
});
