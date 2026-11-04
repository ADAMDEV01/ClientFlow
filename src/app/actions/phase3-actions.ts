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
