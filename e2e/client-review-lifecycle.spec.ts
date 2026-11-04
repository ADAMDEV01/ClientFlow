import { expect, test } from "@playwright/test";

test("full client review lifecycle: register, invite, upload, request changes, resubmit, approve", async ({ browser }) => {
  const ownerContext = await browser.newContext();
  const clientContext = await browser.newContext();
  const owner = await ownerContext.newPage();
  const client = await clientContext.newPage();
  const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const ownerEmail = `owner-${suffix}@example.test`;
  const clientEmail = `client-${suffix}@example.test`;
  const password = "ClientFlow-E2E-Password-2026!";

  try {
    // Registration creates the owner account and its workspace transactionally.
    await owner.goto("/register");
    await owner.getByLabel("Full name").fill("E2E Workspace Owner");
    await owner.getByLabel("Workspace name").fill(`E2E Studio ${suffix}`);
    await owner.getByLabel("Email").fill(ownerEmail);
    await owner.getByLabel("Password").fill(password);
    await owner.getByRole("button", { name: "Create account" }).click();
    await expect(owner).toHaveURL(/\/app/);

    // Add the client, create a project, and issue a one-time portal invitation.
    await owner.goto("/app/clients");
    await owner.getByPlaceholder("Client name").fill("E2E Client");
    await owner.getByPlaceholder("Email address").fill(clientEmail);
    await owner.getByRole("button", { name: "Add client" }).click();
    await expect(owner.getByRole("status")).toContainText("Client added.");
    await owner.goto("/app/clients");
    const clientCard = owner.locator("article").filter({ hasText: "E2E Client" });
    await expect(clientCard).toContainText(clientEmail);

    await owner.goto("/app/projects");
    await owner.getByPlaceholder("Project name").fill("E2E Website Project");
    await owner.getByRole("combobox").first().selectOption({ label: "E2E Client" });
    await owner.getByRole("button", { name: "Create project" }).click();
    await expect(owner.getByRole("status")).toContainText("Project created.");
    await owner.goto("/app/projects");
    await expect(owner.getByText("E2E Website Project")).toBeVisible();

    await owner.goto("/app/clients");
    const invitationCard = owner.locator("article").filter({ hasText: "E2E Client" });
    await invitationCard.getByRole("button", { name: "Invite to client portal" }).click();
    const invitationText = await invitationCard.getByText(/http:\/\//).innerText();
    const invitationUrl = invitationText.match(/https?:\/\/[^\s]+/)?.[0];
    expect(invitationUrl).toBeTruthy();

    // Client accepts the invitation and signs in with the invited email.
    await client.goto(invitationUrl!);
    await client.getByLabel("Your name").fill("E2E Client User");
    await client.getByLabel("Create a password").fill(password);
    await client.getByRole("button", { name: "Create account and accept" }).click();
    await expect(client).toHaveURL(/\/login\?next=/);
    await client.getByLabel("Email").fill(clientEmail);
    await client.getByLabel("Password").fill(password);
    await client.getByRole("button", { name: "Sign in" }).click();
    await expect(client).toHaveURL(/\/portal/);
    await expect(client.getByText("E2E Website Project")).toBeVisible();

    // Team uploads a real PDF and submits the deliverable for review.
    await owner.goto("/app/projects");
    await owner.getByText("E2E Website Project").click();
    const uploadForm = owner.locator("form").filter({ has: owner.locator('input[type="file"]') }).last();
    await uploadForm.locator('input[name="name"]').fill("E2E Homepage Design");
    await uploadForm.locator('input[type="file"]').setInputFiles({
      name: "homepage.pdf",
      mimeType: "application/pdf",
      buffer: Buffer.from("%PDF-1.4\n% ClientFlow E2E fixture\n1 0 obj <<>> endobj\ntrailer <<>>\n%%EOF"),
    });
    await uploadForm.getByRole("button", { name: "Upload deliverable" }).click();
    await expect(owner.getByText("E2E Homepage Design")).toBeVisible();
    await owner.getByRole("button", { name: "Submit for review" }).click();

    // Client requests changes with required feedback.
    await client.goto("/portal");
    await client.getByText("E2E Website Project").click();
    await expect(client.getByText("E2E Homepage Design")).toBeVisible();
    await client.getByLabel("Feedback (required when requesting changes)").fill("Please adjust the hero spacing and heading hierarchy.");
    await client.getByRole("button", { name: "Request changes" }).click();
    await expect(client.getByText("changes requested", { exact: false }).first()).toBeVisible();

    // Team creates version 2, uploads the replacement, and resubmits it.
    await owner.goto("/app/projects");
    await owner.getByText("E2E Website Project").click();
    await owner.getByRole("button", { name: "Create next version" }).click();
    const replacementForm = owner.locator("form").filter({ has: owner.locator('input[type="file"]') }).last();
    await replacementForm.locator('input[type="file"]').setInputFiles({
      name: "homepage-v2.pdf",
      mimeType: "application/pdf",
      buffer: Buffer.from("%PDF-1.4\n% ClientFlow E2E replacement fixture\n1 0 obj <<>> endobj\ntrailer <<>>\n%%EOF"),
    });
    await replacementForm.getByRole("button", { name: "Upload deliverable" }).click();
    await expect(owner.getByText("E2E Homepage Design")).toBeVisible();
    await owner.getByRole("button", { name: "Submit for review" }).last().click();

    // Client approves the resubmitted version.
    await client.goto("/portal");
    await client.getByText("E2E Website Project").click();
    await expect(client.getByText("E2E Homepage Design")).toBeVisible();
    await client.getByRole("button", { name: "Approve" }).last().click();
    await expect(client.getByText("approved", { exact: false }).first()).toBeVisible();
  } finally {
    await ownerContext.close();
    await clientContext.close();
  }
});
