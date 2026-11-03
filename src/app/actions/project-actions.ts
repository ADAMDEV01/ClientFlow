"use server";

import { requireRole } from "@/server/authz";
import { actionFailure, actionSuccess, type ActionResult } from "@/server/action-result";
import { createClient, createProject, createTask } from "@/server/services/project-service";

function failure(error: unknown) {
  return actionFailure(
    error instanceof Error ? error.name : "INTERNAL_ERROR",
    error instanceof Error ? error.message : "Something went wrong.",
  );
}

export async function createClientAction(
  workspaceId: string,
  input: unknown,
): Promise<ActionResult<Awaited<ReturnType<typeof createClient>>>> {
  try {
    const { user } = await requireRole(workspaceId, ["OWNER", "ADMIN", "MEMBER"]);
    return actionSuccess(await createClient(workspaceId, user.id, input));
  } catch (error) {
    return failure(error);
  }
}

export async function createProjectAction(
  workspaceId: string,
  input: unknown,
): Promise<ActionResult<Awaited<ReturnType<typeof createProject>>>> {
  try {
    const { user } = await requireRole(workspaceId, ["OWNER", "ADMIN", "MEMBER"]);
    return actionSuccess(await createProject(workspaceId, user.id, input));
  } catch (error) {
    return failure(error);
  }
}

export async function createTaskAction(
  workspaceId: string,
  input: unknown,
): Promise<ActionResult<Awaited<ReturnType<typeof createTask>>>> {
  try {
    const { user } = await requireRole(workspaceId, ["OWNER", "ADMIN", "MEMBER"]);
    return actionSuccess(await createTask(workspaceId, user.id, input));
  } catch (error) {
    return failure(error);
  }
}
