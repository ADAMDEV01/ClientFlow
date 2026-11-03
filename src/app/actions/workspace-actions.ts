"use server";

import { revalidatePath } from "next/cache";
import { requireAuthenticatedUser } from "@/server/authz";
import { createWorkspaceForUser } from "@/server/services/workspace-service";

export type WorkspaceFormState = { error?: string };

export async function createWorkspaceAction(
  _previousState: WorkspaceFormState,
  formData: FormData,
): Promise<WorkspaceFormState> {
  const user = await requireAuthenticatedUser();
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
    return {
      error: error instanceof Error ? error.message : "Could not create workspace.",
    };
  }
}
