"use server";

import { requireRole } from "@/server/authz";
import { actionFailure, actionSuccess } from "@/server/action-result";
import {
  saveClient, deleteClient, saveProject, deleteProject, saveMilestone,
  deleteMilestone, saveTask, deleteTask, changeMemberRole, removeWorkspaceMember,
} from "@/server/services/project-management-service";

async function run(
  workspaceId: string,
  roles: ("OWNER" | "ADMIN" | "MEMBER")[],
  fn: (actorId: string) => Promise<unknown>,
) {
  try {
    const { user } = await requireRole(workspaceId, roles);
    return actionSuccess(await fn(user.id));
  } catch (error) {
    return actionFailure(
      error instanceof Error ? error.name : "INTERNAL_ERROR",
      error instanceof Error ? error.message : "Request failed.",
    );
  }
}

export async function saveClientAction(workspaceId: string, input: unknown, id?: string) {
  return run(workspaceId, ["OWNER", "ADMIN", "MEMBER"], actor => saveClient(workspaceId, actor, input, id));
}
export async function deleteClientAction(workspaceId: string, id: string) {
  return run(workspaceId, ["OWNER", "ADMIN"], actor => deleteClient(workspaceId, actor, id));
}
export async function saveProjectAction(workspaceId: string, input: unknown, id?: string) {
  return run(workspaceId, ["OWNER", "ADMIN", "MEMBER"], actor => saveProject(workspaceId, actor, input, id));
}
export async function deleteProjectAction(workspaceId: string, id: string) {
  return run(workspaceId, ["OWNER", "ADMIN"], actor => deleteProject(workspaceId, actor, id));
}
export async function saveMilestoneAction(workspaceId: string, input: unknown, id?: string) {
  return run(workspaceId, ["OWNER", "ADMIN", "MEMBER"], actor => saveMilestone(workspaceId, actor, input, id));
}
export async function deleteMilestoneAction(workspaceId: string, id: string) {
  return run(workspaceId, ["OWNER", "ADMIN"], actor => deleteMilestone(workspaceId, actor, id));
}
export async function saveTaskAction(workspaceId: string, input: unknown, id?: string) {
  return run(workspaceId, ["OWNER", "ADMIN", "MEMBER"], actor => saveTask(workspaceId, actor, input, id));
}
export async function deleteTaskAction(workspaceId: string, id: string) {
  return run(workspaceId, ["OWNER", "ADMIN"], actor => deleteTask(workspaceId, actor, id));
}
export async function changeMemberRoleAction(workspaceId: string, input: unknown) {
  return run(workspaceId, ["OWNER"], actor => changeMemberRole(workspaceId, actor, input));
}
export async function removeWorkspaceMemberAction(workspaceId: string, input: unknown) {
  return run(workspaceId, ["OWNER"], actor => removeWorkspaceMember(workspaceId, actor, input));
}

export type ProjectManagementFormState = { error?: string; success?: string };

export async function createProjectProjectManagementFormAction(_prev: ProjectManagementFormState, fd: FormData): Promise<ProjectManagementFormState> {
  const workspaceId = String(fd.get("workspaceId") ?? "");
  const result = await saveProjectAction(workspaceId, {
    name: fd.get("name"), description: fd.get("description") || undefined, clientId: fd.get("clientId"),
    startDate: fd.get("startDate") || undefined, dueDate: fd.get("dueDate") || undefined,
    budget: fd.get("budget") || undefined, memberIds: fd.getAll("memberIds").map(String),
  });
  return result.ok ? { success: "Project created." } : { error: result.error.message };
}
export async function createTaskProjectManagementFormAction(_prev: ProjectManagementFormState, fd: FormData): Promise<ProjectManagementFormState> {
  const workspaceId = String(fd.get("workspaceId") ?? "");
  const result = await saveTaskAction(workspaceId, {
    projectId: fd.get("projectId"), title: fd.get("title"), description: fd.get("description") || undefined,
    assigneeId: fd.get("assigneeId") || undefined, priority: fd.get("priority"), dueDate: fd.get("dueDate") || undefined,
    status: fd.get("status"), visibleToClient: fd.get("visibleToClient") === "on",
  });
  return result.ok ? { success: "Task created." } : { error: result.error.message };
}
export async function createMilestoneProjectManagementFormAction(_prev: ProjectManagementFormState, fd: FormData): Promise<ProjectManagementFormState> {
  const workspaceId = String(fd.get("workspaceId") ?? "");
  const position = fd.get("position");
  const result = await saveMilestoneAction(workspaceId, {
    projectId: fd.get("projectId"), name: fd.get("name"), description: fd.get("description") || undefined,
    dueDate: fd.get("dueDate") || undefined, status: fd.get("status"), position: position ? Number(position) : undefined,
  });
  return result.ok ? { success: "Milestone created." } : { error: result.error.message };
}
