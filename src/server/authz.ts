import "server-only";

import { auth } from "@/auth";
import { getPrisma } from "@/lib/prisma";

export type TeamRole = "OWNER" | "ADMIN" | "MEMBER";
export type PortalRole = TeamRole | "CLIENT";
export type AuthzErrorCode =
  | "UNAUTHENTICATED"
  | "WORKSPACE_ACCESS_DENIED"
  | "ROLE_FORBIDDEN"
  | "CLIENT_ACCESS_DENIED";

export class AuthzError extends Error {
  constructor(
    public readonly code: AuthzErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "AuthzError";
  }
}

/** Backwards-compatible name for existing service/action imports. */
export class AuthorizationError extends AuthzError {
  constructor(message = "You are not allowed to perform this action.") {
    super("UNAUTHENTICATED", message);
    this.name = "AuthorizationError";
  }
}

export async function requireUser() {
  const session = await auth();
  if (!session?.user?.id) {
    throw new AuthorizationError("Authentication is required.");
  }
  return session.user;
}

export const requireAuthenticatedUser = requireUser;

export async function requireWorkspaceMember(workspaceId: string) {
  const user = await requireUser();
  const membership = await getPrisma().workspaceMember.findFirst({
    where: { workspaceId, userId: user.id },
    select: { id: true, workspaceId: true, userId: true, role: true },
  });
  if (!membership) {
    throw new AuthzError("WORKSPACE_ACCESS_DENIED", "Workspace access denied.");
  }
  return { user, membership };
}

export async function requireRole(
  workspaceId: string,
  allowedRoles: readonly TeamRole[],
) {
  const context = await requireWorkspaceMember(workspaceId);
  if (!allowedRoles.includes(context.membership.role)) {
    throw new AuthzError("ROLE_FORBIDDEN", "Your workspace role cannot perform this action.");
  }
  return context;
}

export async function requireClientProjectAccess(workspaceId: string, projectId: string) {
  const user = await requireUser();
  if (user.role !== "CLIENT" || !user.clientId) {
    throw new AuthzError("CLIENT_ACCESS_DENIED", "Client portal access is required.");
  }
  const project = await getPrisma().project.findFirst({
    where: {
      id: projectId,
      workspaceId,
      clientId: user.clientId,
      client: { userId: user.id },
    },
    select: { id: true, workspaceId: true, clientId: true },
  });
  if (!project) {
    throw new AuthzError("CLIENT_ACCESS_DENIED", "Project access denied.");
  }
  return { user, project };
}

export const requireClientAccess = requireClientProjectAccess;
