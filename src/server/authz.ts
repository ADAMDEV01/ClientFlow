import "server-only";

import { auth } from "@/auth";
import { getPrisma } from "@/lib/prisma";

export type TeamRole = "OWNER" | "ADMIN" | "MEMBER";
export type PortalRole = TeamRole | "CLIENT";

export class AuthorizationError extends Error {
  constructor(message = "You are not allowed to perform this action.") {
    super(message);
    this.name = "AuthorizationError";
  }
}

export async function requireAuthenticatedUser() {
  const session = await auth();
  if (!session?.user?.id) {
    throw new AuthorizationError("Authentication is required.");
  }
  return session.user;
}

export async function requireWorkspaceMember(workspaceId: string) {
  const user = await requireAuthenticatedUser();
  const prisma = getPrisma();

  const membership = await prisma.workspaceMember.findFirst({
    where: { workspaceId, userId: user.id },
    select: { id: true, workspaceId: true, userId: true, role: true },
  });

  if (!membership) {
    throw new AuthorizationError("Workspace access denied.");
  }

  return { user, membership };
}

export async function requireRole(
  workspaceId: string,
  allowedRoles: readonly TeamRole[],
) {
  const context = await requireWorkspaceMember(workspaceId);

  if (!allowedRoles.includes(context.membership.role)) {
    throw new AuthorizationError("Your workspace role cannot perform this action.");
  }

  return context;
}

export async function requireClientAccess(
  workspaceId: string,
  projectId: string,
) {
  const user = await requireAuthenticatedUser();
  if (!user.clientId) {
    throw new AuthorizationError("Client portal access is required.");
  }

  const prisma = getPrisma();
  const project = await prisma.project.findFirst({
    where: {
      id: projectId,
      workspaceId,
      clientId: user.clientId,
      client: { userId: user.id },
    },
    select: { id: true, workspaceId: true, clientId: true },
  });

  if (!project) {
    throw new AuthorizationError("Project access denied.");
  }

  return { user, project };
}
