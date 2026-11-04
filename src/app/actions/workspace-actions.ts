"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getPrisma } from "@/lib/prisma";
import { switchWorkspaceSchema } from "@/lib/validations/auth";
import { requireUser } from "@/server/authz";
import { createWorkspaceForUser } from "@/server/services/workspace-service";

export type WorkspaceFormState = { error?: string };
export type WorkspaceSwitchState = { error?: string };

export async function createWorkspaceAction(
  _previousState: WorkspaceFormState,
  formData: FormData,
): Promise<WorkspaceFormState> {
  const user = await requireUser();
  const name = String(formData.get("name") ?? "");
  const slug = String(formData.get("slug") ?? "");
  try {
    await createWorkspaceForUser(user.id, { name, slug });
    revalidatePath("/app");
    return {};
  } catch (error) {
    if (error instanceof Error && error.message.includes("Unique constraint")) {
      return { error: "That workspace URL is already taken." };
    }
    return { error: error instanceof Error ? error.message : "Could not create workspace." };
  }
}

export async function switchWorkspaceAction(
  _previousState: WorkspaceSwitchState,
  formData: FormData,
): Promise<WorkspaceSwitchState> {
  const user = await requireUser();
  const parsed = switchWorkspaceSchema.safeParse({ workspaceId: formData.get("workspaceId") });
  if (!parsed.success) return { error: "Choose a valid workspace." };

  const prisma = getPrisma();
  const membership = await prisma.workspaceMember.findFirst({
    where: { workspaceId: parsed.data.workspaceId, userId: user.id },
    select: { workspaceId: true },
  });
  if (!membership) return { error: "You are not a member of that workspace." };

  await prisma.user.update({
    where: { id: user.id },
    data: { activeWorkspaceId: membership.workspaceId },
  });
  revalidatePath("/", "layout");
  redirect("/app");
}
