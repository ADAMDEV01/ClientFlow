import "server-only";

import { createHash, randomBytes } from "node:crypto";
import argon2 from "argon2";
import { getPrisma } from "@/lib/prisma";
import { clientPortalInvitationSchema, clientPortalRegistrationSchema } from "@/lib/validations/common";
import { writeActivity } from "@/server/services/activity";
import { consumeRateLimit } from "@/server/services/rate-limit";
import { escapeHtml, getAppBaseUrl, sendInvitationEmail } from "@/server/services/email";

const EXPIRY_DAYS = 7;
function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export async function createClientPortalInvitation(workspaceId: string, actorId: string, input: unknown) {
  const data = clientPortalInvitationSchema.parse(input);
  const allowed = await consumeRateLimit(`client-invite:${workspaceId}:${actorId}`, 10, 60 * 60);
  if (!allowed) throw new Error("Invitation rate limit reached. Try again later.");
  const prisma = getPrisma();
  const client = await prisma.client.findFirst({
    where: { id: data.clientId, workspaceId },
    select: { id: true, name: true, email: true, userId: true },
  });
  if (!client) throw new Error("Client not found in this workspace.");
  if (client.userId) throw new Error("This client already has a portal account.");
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + EXPIRY_DAYS * 24 * 60 * 60 * 1000);
  const invitation = await prisma.$transaction(async tx => {
    const row = await tx.clientInvitation.upsert({
      where: { workspaceId_clientId: { workspaceId, clientId: client.id } },
      create: { workspaceId, clientId: client.id, email: client.email.trim().toLowerCase(), tokenHash: hashToken(token), expiresAt, invitedById: actorId },
      update: { email: client.email.trim().toLowerCase(), tokenHash: hashToken(token), expiresAt, status: "PENDING", acceptedAt: null, invitedById: actorId },
      select: { id: true, email: true, expiresAt: true },
    });
    await writeActivity(tx, { workspaceId, actorId, action: "INVITED", entityType: "ClientInvitation", entityId: row.id, metadata: { clientId: client.id, email: row.email } });
    return row;
  });
  const url = new URL(`/client-invite/${token}`, getAppBaseUrl()).toString();
  await sendInvitationEmail({
    to: client.email,
    subject: "Your ClientFlow portal invitation",
    html: `<p>You have been invited to the ClientFlow portal for <strong>${escapeHtml(client.name)}</strong>.</p><p><a href="${url}">Accept invitation</a></p><p>This link expires in ${EXPIRY_DAYS} days and can only be used once.</p>`,
    text: `You have been invited to the ClientFlow portal for ${client.name}. Accept invitation: ${url}\nThis link expires in ${EXPIRY_DAYS} days and can only be used once.`,
  });
  return { ...invitation, clientName: client.name, token, invitationUrl: url };
}

export async function getClientPortalInvitation(token: string) {
  if (!token || token.length > 200) return null;
  return getPrisma().clientInvitation.findFirst({
    where: { tokenHash: hashToken(token), status: "PENDING", expiresAt: { gt: new Date() } },
    select: { id: true, email: true, expiresAt: true, client: { select: { name: true, email: true, userId: true } }, workspace: { select: { name: true } } },
  }).then(invitation => invitation && invitation.client.email.toLowerCase() === invitation.email.toLowerCase() ? invitation : null);
}

export async function acceptClientPortalInvitation(userId: string, userEmail: string, token: string) {
  if (!token || token.length > 200) throw new Error("Invalid client invitation token.");
  const prisma = getPrisma();
  return prisma.$transaction(async tx => {
    const invitation = await tx.clientInvitation.findFirst({
      where: { tokenHash: hashToken(token), status: "PENDING", expiresAt: { gt: new Date() } },
      select: { id: true, workspaceId: true, clientId: true, email: true },
    });
    if (!invitation || invitation.email.toLowerCase() !== userEmail.trim().toLowerCase()) throw new Error("Invitation is invalid, expired, or belongs to another email.");
    const client = await tx.client.findFirst({ where: { id: invitation.clientId, workspaceId: invitation.workspaceId }, select: { id: true, email: true, userId: true } });
    if (!client || client.email.toLowerCase() !== invitation.email.toLowerCase() || (client.userId && client.userId !== userId)) throw new Error("This client is already linked to another account.");
    const otherProfile = await tx.client.findFirst({ where: { userId, NOT: { id: client.id } }, select: { id: true } });
    if (otherProfile) throw new Error("This account is already linked to another client portal.");
    const consumed = await tx.clientInvitation.updateMany({ where: { id: invitation.id, status: "PENDING", expiresAt: { gt: new Date() } }, data: { status: "ACCEPTED", acceptedAt: new Date() } });
    if (consumed.count !== 1) throw new Error("Invitation has already been used.");
    if (!client.userId) {
      const linked = await tx.client.updateMany({ where: { id: client.id, workspaceId: invitation.workspaceId, userId: null }, data: { userId } });
      if (linked.count !== 1) throw new Error("This client was linked by another request.");
    }
    await writeActivity(tx, { workspaceId: invitation.workspaceId, actorId: userId, action: "ACCEPTED_INVITATION", entityType: "ClientInvitation", entityId: invitation.id, metadata: { clientId: client.id } });
    return { workspaceId: invitation.workspaceId, clientId: client.id };
  }, { isolationLevel: "Serializable" });
}

export async function registerAndAcceptClientInvitation(token: string, input: unknown) {
  if (!token || token.length > 200) throw new Error("Invalid client invitation token.");
  const data = clientPortalRegistrationSchema.parse(input);
  const passwordHash = await argon2.hash(data.password, { type: argon2.argon2id });
  const prisma = getPrisma();
  return prisma.$transaction(async tx => {
    const invitation = await tx.clientInvitation.findFirst({
      where: { tokenHash: hashToken(token), status: "PENDING", expiresAt: { gt: new Date() } },
      select: { id: true, workspaceId: true, clientId: true, email: true },
    });
    if (!invitation) throw new Error("Invitation is invalid, expired, or has already been used.");
    const userEmail = invitation.email.toLowerCase();
    const client = await tx.client.findFirst({ where: { id: invitation.clientId, workspaceId: invitation.workspaceId }, select: { id: true, email: true, userId: true } });
    if (!client || client.email.toLowerCase() !== userEmail || client.userId) throw new Error("This client record changed or is already linked.");
    if (await tx.user.findUnique({ where: { email: userEmail }, select: { id: true } })) throw new Error("An account with this email already exists. Sign in with the invited email to accept the invitation.");
    const user = await tx.user.create({ data: { name: data.name, email: userEmail, passwordHash }, select: { id: true } });
    const linked = await tx.client.updateMany({ where: { id: invitation.clientId, workspaceId: invitation.workspaceId, userId: null }, data: { userId: user.id } });
    if (linked.count !== 1) throw new Error("This client is already linked to another account.");
    const consumed = await tx.clientInvitation.updateMany({ where: { id: invitation.id, status: "PENDING", expiresAt: { gt: new Date() } }, data: { status: "ACCEPTED", acceptedAt: new Date() } });
    if (consumed.count !== 1) throw new Error("Invitation has already been used.");
    await writeActivity(tx, { workspaceId: invitation.workspaceId, actorId: user.id, action: "ACCEPTED_INVITATION", entityType: "ClientInvitation", entityId: invitation.id, metadata: { clientId: invitation.clientId } });
    return { userId: user.id, email: userEmail };
  });
}
