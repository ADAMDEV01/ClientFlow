import "server-only";

import { createHash, randomBytes } from "node:crypto";
import { getPrisma } from "@/lib/prisma";
import { createInvitationSchema } from "@/lib/validations/common";
import { writeActivity } from "@/server/services/activity";
import { consumeRateLimit } from "@/server/services/rate-limit";
import { escapeHtml, getAppBaseUrl, sendInvitationEmail } from "@/server/services/email";

function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export async function createWorkspaceInvitation(
  workspaceId: string,
  actorId: string,
  input: unknown,
) {
  const data = createInvitationSchema.parse(input);
  const appBaseUrl = getAppBaseUrl();
  const allowed = await consumeRateLimit(
    `invite:${workspaceId}:${actorId}`,
    10,
    60 * 60,
  );
  if (!allowed) throw new Error("Invitation rate limit reached. Try again later.");

  const prisma = getPrisma();
  const token = randomBytes(32).toString("base64url");
  const tokenHash = hashToken(token);
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

  const invitation = await prisma.$transaction(async (tx) => {
    const created = await tx.invitation.upsert({
      where: {
        workspaceId_email: { workspaceId, email: data.email },
      },
      create: {
        workspaceId,
        email: data.email,
        role: data.role,
        tokenHash,
        expiresAt,
        invitedById: actorId,
      },
      update: {
        role: data.role,
        tokenHash,
        expiresAt,
        status: "PENDING",
        acceptedAt: null,
        invitedById: actorId,
      },
      select: { id: true, email: true, role: true, expiresAt: true },
    });

    await writeActivity(tx, {
      workspaceId,
      actorId,
      action: "INVITED",
      entityType: "Invitation",
      entityId: created.id,
      metadata: { email: created.email, role: created.role },
    });

    return created;
  });

  const invitationUrl = new URL(`/invite/${token}?workspaceId=${encodeURIComponent(workspaceId)}`, appBaseUrl).toString();
  const emailSent = await sendInvitationEmail({
    to: invitation.email,
    subject: "Your ClientFlow team invitation",
    html: `<p>You have been invited to join a team on ClientFlow as a <strong>${escapeHtml(invitation.role)}</strong>.</p><p><a href="${invitationUrl}">Accept your invitation</a></p><p>This link expires in 7 days and can only be used once.</p>`,
    text: `You have been invited to join a team on ClientFlow as a ${invitation.role}. Accept your invitation: ${invitationUrl}\nThis link expires in 7 days and can only be used once.`,
  });

  // Return the raw token once for the manual-copy fallback. Only its hash is persisted.
  return { ...invitation, token, invitationUrl, emailSent };
}

export async function acceptWorkspaceInvitation(
  userId: string,
  userEmail: string,
  workspaceId: string,
  token: string,
) {
  if (!token || token.length > 200) throw new Error("Invalid invitation token.");
  const tokenHash = hashToken(token);
  const prisma = getPrisma();

  return prisma.$transaction(async (tx) => {
    const invitation = await tx.invitation.findFirst({
      where: {
        workspaceId,
        tokenHash,
        status: "PENDING",
        expiresAt: { gt: new Date() },
      },
      select: {
        id: true,
        workspaceId: true,
        email: true,
        role: true,
      },
    });

    if (!invitation || invitation.email !== userEmail.toLowerCase()) {
      throw new Error("Invitation is invalid, expired, or belongs to another email.");
    }

    const invitationUpdate = await tx.invitation.updateMany({
      where: { id: invitation.id, workspaceId, status: "PENDING" },
      data: { status: "ACCEPTED", acceptedAt: new Date() },
    });
    if (invitationUpdate.count !== 1) throw new Error("Invitation has already been used.");

    await tx.workspaceMember.upsert({
      where: {
        workspaceId_userId: {
          workspaceId: invitation.workspaceId,
          userId,
        },
      },
      create: {
        workspaceId: invitation.workspaceId,
        userId,
        role: invitation.role,
      },
      update: { role: invitation.role },
    });

    await writeActivity(tx, {
      workspaceId: invitation.workspaceId,
      actorId: userId,
      action: "ACCEPTED_INVITATION",
      entityType: "Invitation",
      entityId: invitation.id,
    });

    return { workspaceId: invitation.workspaceId, role: invitation.role };
  });
}
