"use server";

import { requireRole } from "@/server/authz";
import { actionFailure, actionSuccess, type ActionResult } from "@/server/action-result";
import { createClient, createMilestone, createProject, createTask } from "@/server/services/project-service";

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

export type ProjectFormState = { error?: string; success?: string };

export async function createClientFormAction(
  _previousState: ProjectFormState,
  formData: FormData,
): Promise<ProjectFormState> {
  const workspaceId = String(formData.get("workspaceId") ?? "");
  const result = await createClientAction(workspaceId, {
    name: formData.get("name"),
    email: formData.get("email"),
    company: formData.get("company") || undefined,
    phone: formData.get("phone") || undefined,
  });
  return result.ok ? { success: "Client added." } : { error: result.error.message };
}

export async function createProjectFormAction(
  _previousState: ProjectFormState,
  formData: FormData,
): Promise<ProjectFormState> {
  const workspaceId = String(formData.get("workspaceId") ?? "");
  const result = await createProjectAction(workspaceId, {
    clientId: formData.get("clientId"),
    name: formData.get("name"),
    description: formData.get("description") || undefined,
    dueDate: formData.get("dueDate") || undefined,
  });
  return result.ok ? { success: "Project created." } : { error: result.error.message };
}

export async function createTaskFormAction(
  _previousState: ProjectFormState,
  formData: FormData,
): Promise<ProjectFormState> {
  const workspaceId = String(formData.get("workspaceId") ?? "");
  const result = await createTaskAction(workspaceId, {
    projectId: formData.get("projectId"),
    title: formData.get("title"),
    description: formData.get("description") || undefined,
    visibleToClient: formData.get("visibleToClient") === "on",
    dueDate: formData.get("dueDate") || undefined,
  });
  return result.ok ? { success: "Task created." } : { error: result.error.message };
}

export async function createMilestoneAction(
  workspaceId: string,
  input: unknown,
): Promise<ActionResult<Awaited<ReturnType<typeof createMilestone>>>> {
  try {
    const { user } = await requireRole(workspaceId, ["OWNER", "ADMIN", "MEMBER"]);
    return actionSuccess(await createMilestone(workspaceId, user.id, input));
  } catch (error) {
    return failure(error);
  }
}

export async function createMilestoneFormAction(
  _previousState: ProjectFormState,
  formData: FormData,
): Promise<ProjectFormState> {
  const workspaceId = String(formData.get("workspaceId") ?? "");
  const result = await createMilestoneAction(workspaceId, {
    projectId: formData.get("projectId"),
    name: formData.get("name"),
    description: formData.get("description") || undefined,
    dueDate: formData.get("dueDate") || undefined,
  });
  return result.ok ? { success: "Milestone created." } : { error: result.error.message };
}
