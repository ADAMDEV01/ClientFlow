"use server";

import { redirect } from "next/navigation";
import { requireAuthenticatedUser, requireRole } from "@/server/authz";
import { createWorkspaceInvitation, acceptWorkspaceInvitation } from "@/server/services/invitation-service";
import { actionFailure, actionSuccess, type ActionResult } from "@/server/action-result";

export async function createInvitationAction(
  workspaceId: string,
  input: unknown,
): Promise<ActionResult<{ id: string; email: string; role: string; expiresAt: Date; token: string }>> {
  try {
    const { user } = await requireRole(workspaceId, ["OWNER", "ADMIN"]);
    return actionSuccess(await createWorkspaceInvitation(workspaceId, user.id, input));
  } catch (error) {
    return actionFailure(
      error instanceof Error ? error.name : "INTERNAL_ERROR",
      error instanceof Error ? error.message : "Could not create invitation.",
    );
  }
}

export async function acceptInvitationAction(formData: FormData): Promise<void> {
  const user = await requireAuthenticatedUser();
  if (!user.email) throw new Error("Your account needs an email address.");
  const token = String(formData.get("token") ?? "");
  await acceptWorkspaceInvitation(user.id, user.email, token);
  redirect("/app");
}
