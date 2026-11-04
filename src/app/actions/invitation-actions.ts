"use server";

import { redirect } from "next/navigation";
import { requireAuthenticatedUser, requireRole } from "@/server/authz";
import { createWorkspaceInvitation, acceptWorkspaceInvitation } from "@/server/services/invitation-service";
import { actionFailure, actionSuccess, type ActionResult } from "@/server/action-result";

export async function createInvitationAction(
  workspaceId: string,
  input: unknown,
): Promise<ActionResult<{ id: string; email: string; role: string; expiresAt: Date; token: string; invitationUrl: string }>> {
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
  const workspaceId = String(formData.get("workspaceId") ?? "");
  const token = String(formData.get("token") ?? "");
  await acceptWorkspaceInvitation(user.id, user.email, workspaceId, token);
  redirect("/app");
}

export type InvitationFormState = { error?: string; inviteUrl?: string };

export async function createInvitationFormAction(
  _previousState: InvitationFormState,
  formData: FormData,
): Promise<InvitationFormState> {
  const workspaceId = String(formData.get("workspaceId") ?? "");
  const result = await createInvitationAction(workspaceId, {
    email: formData.get("email"),
    role: formData.get("role"),
  });
  if (!result.ok) return { error: result.error.message };
  return { inviteUrl: result.data.invitationUrl };
}
