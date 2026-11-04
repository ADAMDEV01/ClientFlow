"use server";

import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { requireRole } from "@/server/authz";
import { actionFailure, actionSuccess, type ActionResult } from "@/server/action-result";
import {
  createClientPortalInvitation,
  acceptClientPortalInvitation,
  registerAndAcceptClientInvitation,
} from "@/server/services/client-invitation-service";

export async function createClientPortalInvitationAction(workspaceId: string, input: unknown): Promise<ActionResult<Awaited<ReturnType<typeof createClientPortalInvitation>>>> {
  try {
    const { user } = await requireRole(workspaceId, ["OWNER", "ADMIN"]);
    return actionSuccess(await createClientPortalInvitation(workspaceId, user.id, input));
  } catch (error) {
    return actionFailure(error instanceof Error ? error.name : "INTERNAL_ERROR", error instanceof Error ? error.message : "Could not create invitation.");
  }
}

export type ClientInvitationFormState = { error?: string; invitationUrl?: string; expiresAt?: string };
export async function createClientPortalInvitationFormAction(_previous: ClientInvitationFormState, formData: FormData): Promise<ClientInvitationFormState> {
  const workspaceId = String(formData.get("workspaceId") ?? "");
  const result = await createClientPortalInvitationAction(workspaceId, { clientId: formData.get("clientId") });
  if (!result.ok) return { error: result.error.message };
  return { invitationUrl: result.data.invitationUrl, expiresAt: result.data.expiresAt.toLocaleDateString() };
}

export type AcceptClientInvitationState = { error?: string };
export async function acceptClientPortalInvitationFormAction(_previous: AcceptClientInvitationState, formData: FormData): Promise<AcceptClientInvitationState> {
  try {
    const token = String(formData.get("token") ?? "");
    const session = await auth();
    if (session?.user?.id && session.user.email) {
      await acceptClientPortalInvitation(session.user.id, session.user.email, token);
      redirect("/portal");
    }
    const name = String(formData.get("name") ?? "");
    const password = String(formData.get("password") ?? "");
    await registerAndAcceptClientInvitation(token, { name, password });
    redirect("/login?next=%2Fportal");
  } catch (error) {
    if (error && typeof error === "object" && "digest" in error) throw error;
    return { error: error instanceof Error ? error.message : "Invitation could not be accepted." };
  }
}
