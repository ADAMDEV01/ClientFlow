import { expect, test } from "@playwright/test";

test("complete client deliverable review lifecycle", async ({ page, browser }) => {
  const unique = Date.now().toString() + "-" + Math.random().toString(36).slice(2, 8);
  const teamEmail = "team-" + unique + "@example.test";
  const clientEmail = "client-" + unique + "@example.test";
  const password = "ClientFlow-Test-Password-2026!";

  await page.goto("/register");
  await page.getByLabel("Full name").fill("ClientFlow Test Owner");
  await page.getByLabel("Workspace name").fill("Lifecycle Studio " + unique);
  await page.getByLabel("Email").fill(teamEmail);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page).toHaveURL(/\/app/);

  await page.goto("/app/clients");
  await page.getByPlaceholder("Client name").fill("Lifecycle Client");
  await page.getByPlaceholder("Email address").fill(clientEmail);
  await page.getByRole("button", { name: "Add client" }).click();
  await expect(page.getByText("Lifecycle Client", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Invite to client portal" }).click();

  const invitationText = page.getByText(/http:\/\/localhost:3000\/client-invite\//);
  await expect(invitationText).toBeVisible({ timeout: 15_000 });
  const invitationUrl = (await invitationText.textContent())?.match(/http:\/\/localhost:3000\/client-invite\/[A-Za-z0-9_-]+/)?.[0];
  expect(invitationUrl).toBeTruthy();

  await page.goto("/app/projects");
  await page.getByPlaceholder("Project name").fill("Lifecycle Project " + unique);
  await page.locator('select[name="clientId"]').selectOption({ label: "Lifecycle Client" });
  await page.getByRole("button", { name: "Create project" }).click();
  const projectLink = page.getByRole("link", { name: "Lifecycle Project " + unique });
  await expect(projectLink).toBeVisible();
  await projectLink.click();
  const projectId = new URL(page.url()).pathname.split("/").pop();
  expect(projectId).toBeTruthy();

  await page.locator('input[name="name"]').last().fill("Client delivery pack");
  await page.locator('input[name="file"]').first().setInputFiles({
    name: "delivery.pdf",
    mimeType: "application/pdf",
    buffer: Buffer.from("%PDF-1.4\nClientFlow lifecycle test file\n%%EOF"),
  });
  await page.getByRole("button", { name: "Upload deliverable" }).click();
  await expect(page.getByText("File uploaded as a new draft deliverable.")).toBeVisible();
  await page.getByRole("button", { name: "Submit for review" }).click();
  await expect(page.getByText("submitted", { exact: true }).first()).toBeVisible();

  const clientContext = await browser.newContext();
  const clientPage = await clientContext.newPage();
  try {
    await clientPage.goto(invitationUrl!);
    await clientPage.getByLabel("Your name").fill("Lifecycle Client User");
    await clientPage.getByLabel("Create a password").fill(password);
    await clientPage.getByRole("button", { name: "Create account and accept" }).click();
    await expect(clientPage).toHaveURL(/\/login/);
    await clientPage.getByLabel("Email").fill(clientEmail);
    await clientPage.getByLabel("Password").fill(password);
    await clientPage.getByRole("button", { name: "Sign in" }).click();
    await expect(clientPage).toHaveURL(/\/portal/);
    await clientPage.goto("/portal/" + projectId);
    await expect(clientPage.getByRole("heading", { name: "Client delivery pack" })).toBeVisible();
    await clientPage.getByLabel(/Feedback/).fill("Please update the second section.");
    await clientPage.getByRole("button", { name: "Request changes" }).click();
    await expect(clientPage.getByText("changes requested", { exact: true }).first()).toBeVisible();

    await page.goto("/app/projects/" + projectId);
    await page.getByRole("button", { name: "Create next version" }).click();
    await expect(page.getByText(/Created draft version 2/)).toBeVisible();
    await page.locator('input[name="file"]').last().setInputFiles({
      name: "delivery-v2.pdf",
      mimeType: "application/pdf",
      buffer: Buffer.from("%PDF-1.4\nClientFlow revised lifecycle test file\n%%EOF"),
    });
    await page.getByRole("button", { name: "Upload deliverable" }).last().click();
    await expect(page.getByText("File attached to the new version.")).toBeVisible();
    await page.getByRole("button", { name: "Submit for review" }).last().click();
    await expect(page.getByText("submitted", { exact: true }).last()).toBeVisible();

    await clientPage.reload();
    await expect(clientPage.getByText("submitted", { exact: true })).toBeVisible();
    await clientPage.getByRole("button", { name: "Approve" }).click();
    await expect(clientPage.getByText("approved", { exact: true }).first()).toBeVisible();
  } finally {
    await clientContext.close();
  }
});
