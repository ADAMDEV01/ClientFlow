"use server";
import { requireRole } from "@/server/authz";
import { actionFailure, actionSuccess } from "@/server/action-result";
import { saveClient, deleteClient, saveProject, deleteProject, saveMilestone, deleteMilestone, saveTask, deleteTask, changeMemberRole, removeWorkspaceMember } from "@/server/services/phase3-service";

async function run(workspaceId: string, roles: ("OWNER"|"ADMIN"|"MEMBER")[], fn: (actorId: string) => Promise<unknown>) {
  try { const { user } = await requireRole(workspaceId, roles); return actionSuccess(await fn(user.id)); }
  catch (error) { return actionFailure(error instanceof Error ? error.name : "INTERNAL_ERROR", error instanceof Error ? error.message : "Request failed."); }
}
export const saveClientAction = (workspaceId: string, input: unknown, id?: string) => run(workspaceId, ["OWNER","ADMIN","MEMBER"], actor => saveClient(workspaceId, actor, input, id));
export const deleteClientAction = (workspaceId: string, id: string) => run(workspaceId, ["OWNER","ADMIN"], actor => deleteClient(workspaceId, actor, id));
export const saveProjectAction = (workspaceId: string, input: unknown, id?: string) => run(workspaceId, ["OWNER","ADMIN","MEMBER"], actor => saveProject(workspaceId, actor, input, id));
export const deleteProjectAction = (workspaceId: string, id: string) => run(workspaceId, ["OWNER","ADMIN"], actor => deleteProject(workspaceId, actor, id));
export const saveMilestoneAction = (workspaceId: string, input: unknown, id?: string) => run(workspaceId, ["OWNER","ADMIN","MEMBER"], actor => saveMilestone(workspaceId, actor, input, id));
export const deleteMilestoneAction = (workspaceId: string, id: string) => run(workspaceId, ["OWNER","ADMIN"], actor => deleteMilestone(workspaceId, actor, id));
export const saveTaskAction = (workspaceId: string, input: unknown, id?: string) => run(workspaceId, ["OWNER","ADMIN","MEMBER"], actor => saveTask(workspaceId, actor, input, id));
export const deleteTaskAction = (workspaceId: string, id: string) => run(workspaceId, ["OWNER","ADMIN"], actor => deleteTask(workspaceId, actor, id));
export const changeMemberRoleAction = (workspaceId: string, input: unknown) => run(workspaceId, ["OWNER"], actor => changeMemberRole(workspaceId, actor, input));
export const removeWorkspaceMemberAction = (workspaceId: string, input: unknown) => run(workspaceId, ["OWNER"], actor => removeWorkspaceMember(workspaceId, actor, input));

export type Phase3FormState = { error?: string; success?: string };
export async function createProjectPhase3FormAction(_prev: Phase3FormState, fd: FormData): Promise<Phase3FormState> {
  const workspaceId = String(fd.get("workspaceId") ?? "");
  const result = await saveProjectAction(workspaceId, {
    name: fd.get("name"), description: fd.get("description") || undefined, clientId: fd.get("clientId"),
    startDate: fd.get("startDate") || undefined, dueDate: fd.get("dueDate") || undefined,
    budget: fd.get("budget") || undefined, memberIds: fd.getAll("memberIds").map(String),
  });
  return result.ok ? { success: "Project created." } : { error: result.error.message };
}
export async function createTaskPhase3FormAction(_prev: Phase3FormState, fd: FormData): Promise<Phase3FormState> {
  const workspaceId = String(fd.get("workspaceId") ?? "");
  const result = await saveTaskAction(workspaceId, {
    projectId: fd.get("projectId"), title: fd.get("title"), description: fd.get("description") || undefined,
    assigneeId: fd.get("assigneeId") || undefined, priority: fd.get("priority"), dueDate: fd.get("dueDate") || undefined,
    status: fd.get("status"), visibleToClient: fd.get("visibleToClient") === "on",
  });
  return result.ok ? { success: "Task created." } : { error: result.error.message };
}
export async function createMilestonePhase3FormAction(_prev: Phase3FormState, fd: FormData): Promise<Phase3FormState> {
  const workspaceId = String(fd.get("workspaceId") ?? "");
  const position = fd.get("position");
  const result = await saveMilestoneAction(workspaceId, {
    projectId: fd.get("projectId"), name: fd.get("name"), description: fd.get("description") || undefined,
    dueDate: fd.get("dueDate") || undefined, status: fd.get("status"), position: position ? Number(position) : undefined,
  });
  return result.ok ? { success: "Milestone created." } : { error: result.error.message };
}
