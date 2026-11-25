import { createHash, randomBytes } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { getPrisma } from "@/lib/prisma";
import { acceptWorkspaceInvitation } from "@/server/services/invitation-service";

const prisma = getPrisma();
const suffix = crypto.randomUUID();
const ownerId = `invite-owner-${suffix}`;
const adminId = `invite-admin-${suffix}`;
const memberId = `invite-new-member-${suffix}`;
const workspaceSlug = `invite-safety-${suffix}`;
let workspaceId = "";

function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

async function createInvitation(email: string, role: "ADMIN" | "MEMBER") {
  const token = randomBytes(32).toString("base64url");
  const invitation = await prisma.invitation.create({
    data: {
      workspaceId,
      email,
      role,
      tokenHash: hashToken(token),
      expiresAt: new Date(Date.now() + 60 * 60 * 1000),
      invitedById: ownerId,
    },
    select: { id: true },
  });
  return { id: invitation.id, token };
}

beforeAll(async () => {
  await prisma.user.createMany({
    data: [
      {
        id: ownerId,
        email: `${ownerId}@example.test`,
        passwordHash: "integration-only",
      },
      {
        id: adminId,
        email: `${adminId}@example.test`,
        passwordHash: "integration-only",
      },
      {
        id: memberId,
        email: `${memberId}@example.test`,
        passwordHash: "integration-only",
      },
    ],
  });

  const workspace = await prisma.workspace.create({
    data: {
      name: "Invitation Role Safety",
      slug: workspaceSlug,
      ownerId,
      members: {
        create: [
          { userId: ownerId, role: "OWNER" },
          { userId: adminId, role: "ADMIN" },
        ],
      },
    },
    select: { id: true },
  });
  workspaceId = workspace.id;
});

afterAll(async () => {
  if (workspaceId) {
    await prisma.workspace.delete({ where: { id: workspaceId } });
  }

  await prisma.user.deleteMany({
    where: { id: { in: [ownerId, adminId, memberId] } },
  });
  await prisma.$disconnect();
});

describe("workspace invitation role safety", () => {
  it("does not demote an existing ADMIN when they accept an older MEMBER invitation", async () => {
    const email = `${adminId}@example.test`;
    const invitation = await createInvitation(email, "MEMBER");

    await expect(
      acceptWorkspaceInvitation(adminId, email, workspaceId, invitation.token),
    ).rejects.toThrow("already a member");

    const membership = await prisma.workspaceMember.findUniqueOrThrow({
      where: {
        workspaceId_userId: { workspaceId, userId: adminId },
      },
      select: { role: true },
    });
    const savedInvitation = await prisma.invitation.findUniqueOrThrow({
      where: { id: invitation.id },
      select: { status: true },
    });

    expect(membership.role).toBe("ADMIN");
    expect(savedInvitation.status).toBe("PENDING");
  });

  it("grants the invited role to a user who is not already a workspace member", async () => {
    const email = `${memberId}@example.test`;
    const invitation = await createInvitation(email, "MEMBER");

    await expect(
      acceptWorkspaceInvitation(memberId, email, workspaceId, invitation.token),
    ).resolves.toMatchObject({ workspaceId, role: "MEMBER" });

    const membership = await prisma.workspaceMember.findUniqueOrThrow({
      where: {
        workspaceId_userId: { workspaceId, userId: memberId },
      },
      select: { role: true },
    });
    expect(membership.role).toBe("MEMBER");

    await expect(
      acceptWorkspaceInvitation(memberId, email, workspaceId, invitation.token),
    ).rejects.toThrow("invalid, expired, or belongs to another email");
  });
});
