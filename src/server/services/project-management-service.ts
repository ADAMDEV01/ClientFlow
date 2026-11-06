import "server-only";
import { getPrisma } from "@/lib/prisma";
import { writeActivity } from "@/server/services/activity";
import { clientInputSchema, projectInputSchema, milestoneInputSchema, taskInputSchema, roleChangeSchema, memberRemovalSchema } from "@/lib/validations/project-management";

/**
 * Retry PostgreSQL serialization failures. Concurrent owner mutations can
 * otherwise both observe the same owner count and write different rows.
 */
async function withSerializableRetry<T>(operation: () => Promise<T>): Promise<T> {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      return await operation();
    } catch (error) {
      const code =
        typeof error === "object" && error !== null && "code" in error
          ? (error as { code?: unknown }).code
          : undefined;
      if (code !== "P2034" || attempt === 2) throw error;
      await new Promise((resolve) => setTimeout(resolve, 10 * (attempt + 1)));
    }
  }
  throw new Error("Owner update could not be completed. Please retry.");
}

export async function saveClient(workspaceId: string, actorId: string, input: unknown, clientId?: string) {
  const data = clientInputSchema.parse(input); const db = getPrisma();
  return db.$transaction(async tx => {
    if (clientId && !(await tx.client.findFirst({ where: { id: clientId, workspaceId }, select: { id: true } }))) throw new Error("Client not found in this workspace.");
    const client = clientId
      ? await tx.client.update({ where: { id: clientId }, data, select: { id: true, name: true, email: true } })
      : await tx.client.create({ data: { ...data, workspaceId }, select: { id: true, name: true, email: true } });
    await writeActivity(tx, { workspaceId, actorId, action: clientId ? "UPDATED" : "CREATED", entityType: "Client", entityId: client.id });
    return client;
  });
}
export async function deleteClient(workspaceId: string, actorId: string, clientId: string) {
  const db = getPrisma(); return db.$transaction(async tx => {
    const row = await tx.client.findFirst({ where: { id: clientId, workspaceId }, select: { id: true, _count: { select: { projects: true } } } });
    if (!row) throw new Error("Client not found in this workspace.");
    if (row._count.projects) throw new Error("Move or delete this client's projects before deleting the client.");
    await tx.client.delete({ where: { id: clientId } });
    await writeActivity(tx, { workspaceId, actorId, action: "DELETED", entityType: "Client", entityId: clientId });
  });
}
export async function saveProject(workspaceId: string, actorId: string, input: unknown, projectId?: string) {
  const data = projectInputSchema.parse(input); const db = getPrisma();
  return db.$transaction(async tx => {
    const client = await tx.client.findFirst({ where: { id: data.clientId, workspaceId }, select: { id: true } });
    if (!client) throw new Error("Client not found in this workspace.");
    if (projectId && !(await tx.project.findFirst({ where: { id: projectId, workspaceId }, select: { id: true } }))) throw new Error("Project not found in this workspace.");
    const members = data.memberIds.length ? await tx.workspaceMember.findMany({ where: { workspaceId, userId: { in: data.memberIds } }, select: { userId: true } }) : [];
    if (members.length !== new Set(data.memberIds).size) throw new Error("Every project member must belong to this workspace.");
    const payload = { name: data.name, description: data.description, clientId: data.clientId, startDate: data.startDate, dueDate: data.dueDate, budget: data.budget ?? null };
    const project = projectId
      ? await tx.project.update({ where: { id: projectId }, data: payload, select: { id: true, name: true } })
      : await tx.project.create({ data: { ...payload, workspaceId }, select: { id: true, name: true } });
    await tx.projectMember.deleteMany({ where: { workspaceId, projectId: project.id } });
    const ids = data.memberIds.includes(actorId) ? data.memberIds : [...data.memberIds, actorId];
    if (ids.length) await tx.projectMember.createMany({ data: [...new Set(ids)].map(userId => ({ workspaceId, projectId: project.id, userId })) });
    await writeActivity(tx, { workspaceId, actorId, action: projectId ? "UPDATED" : "CREATED", entityType: "Project", entityId: project.id });
    return project;
  });
}
export async function deleteProject(workspaceId: string, actorId: string, projectId: string) {
  const db = getPrisma(); return db.$transaction(async tx => {
    const row = await tx.project.findFirst({ where: { id: projectId, workspaceId }, select: { id: true } });
    if (!row) throw new Error("Project not found in this workspace.");
    await tx.project.delete({ where: { id: projectId } });
    await writeActivity(tx, { workspaceId, actorId, action: "DELETED", entityType: "Project", entityId: projectId });
  });
}
export async function saveMilestone(workspaceId: string, actorId: string, input: unknown, milestoneId?: string) {
  const data = milestoneInputSchema.parse(input); const db = getPrisma();
  return db.$transaction(async tx => {
    if (!(await tx.project.findFirst({ where: { id: data.projectId, workspaceId }, select: { id: true } }))) throw new Error("Project not found in this workspace.");
    if (milestoneId && !(await tx.milestone.findFirst({ where: { id: milestoneId, workspaceId, projectId: data.projectId }, select: { id: true } }))) throw new Error("Milestone not found in this project.");
    const completedAt = data.status === "COMPLETED" ? new Date() : null;
    const milestone = milestoneId
      ? await tx.milestone.update({ where: { id: milestoneId }, data: { name: data.name, description: data.description, dueDate: data.dueDate, status: data.status, completedAt, ...(data.position === undefined ? {} : { position: data.position }) }, select: { id: true, name: true, status: true, position: true } })
      : await tx.milestone.create({ data: { workspaceId, projectId: data.projectId, name: data.name, description: data.description, dueDate: data.dueDate, status: data.status, completedAt, position: data.position ?? ((await tx.milestone.count({ where: { workspaceId, projectId: data.projectId } }))) }, select: { id: true, name: true, status: true, position: true } });
    await writeActivity(tx, { workspaceId, actorId, action: milestoneId ? "UPDATED" : "CREATED", entityType: "Milestone", entityId: milestone.id });
    return milestone;
  });
}
export async function deleteMilestone(workspaceId: string, actorId: string, milestoneId: string) {
  const db = getPrisma(); return db.$transaction(async tx => {
    const row = await tx.milestone.findFirst({ where: { id: milestoneId, workspaceId }, select: { id: true, _count: { select: { tasks: true } } } });
    if (!row) throw new Error("Milestone not found in this workspace.");
    if (row._count.tasks) throw new Error("Move or delete its tasks before deleting this milestone.");
    await tx.milestone.delete({ where: { id: milestoneId } });
    await writeActivity(tx, { workspaceId, actorId, action: "DELETED", entityType: "Milestone", entityId: milestoneId });
  });
}
export async function saveTask(workspaceId: string, actorId: string, input: unknown, taskId?: string) {
  const data = taskInputSchema.parse(input); const db = getPrisma();
  return db.$transaction(async tx => {
    if (!(await tx.project.findFirst({ where: { id: data.projectId, workspaceId }, select: { id: true } }))) throw new Error("Project not found in this workspace.");
    if (data.milestoneId && !(await tx.milestone.findFirst({ where: { id: data.milestoneId, workspaceId, projectId: data.projectId }, select: { id: true } }))) throw new Error("Milestone does not belong to this project.");
    if (data.assigneeId && !(await tx.workspaceMember.findFirst({ where: { workspaceId, userId: data.assigneeId }, select: { id: true } }))) throw new Error("Assignee is not a member of this workspace.");
    if (taskId && !(await tx.task.findFirst({ where: { id: taskId, workspaceId, projectId: data.projectId }, select: { id: true } }))) throw new Error("Task not found in this project.");
    const payload = { title: data.title, description: data.description, milestoneId: data.milestoneId ?? null, assigneeId: data.assigneeId ?? null, priority: data.priority, dueDate: data.dueDate, status: data.status, visibleToClient: data.visibleToClient, completedAt: data.status === "DONE" ? new Date() : null };
    const task = taskId ? await tx.task.update({ where: { id: taskId }, data: payload, select: { id: true, title: true, status: true } }) : await tx.task.create({ data: { ...payload, workspaceId, projectId: data.projectId }, select: { id: true, title: true, status: true } });
    await writeActivity(tx, { workspaceId, actorId, action: taskId ? "UPDATED" : "CREATED", entityType: "Task", entityId: task.id, metadata: { projectId: data.projectId } });
    return task;
  });
}
export async function deleteTask(workspaceId: string, actorId: string, taskId: string) {
  const db = getPrisma(); return db.$transaction(async tx => {
    const row = await tx.task.findFirst({ where: { id: taskId, workspaceId }, select: { id: true } });
    if (!row) throw new Error("Task not found in this workspace.");
    await tx.task.delete({ where: { id: taskId } });
    await writeActivity(tx, { workspaceId, actorId, action: "DELETED", entityType: "Task", entityId: taskId });
  });
}
export async function changeMemberRole(workspaceId: string, actorId: string, input: unknown) {
  const data = roleChangeSchema.parse(input);
  const db = getPrisma();
  return withSerializableRetry(() =>
    db.$transaction(async (tx) => {
      const target = await tx.workspaceMember.findFirst({
        where: { id: data.memberId, workspaceId },
        select: { id: true, userId: true, role: true },
      });
      if (!target) throw new Error("Member not found in this workspace.");
      if (target.userId === actorId && data.role !== "OWNER") {
        throw new Error("An owner cannot demote themselves.");
      }
      if (target.role === "OWNER" && data.role !== "OWNER") {
        const owners = await tx.workspaceMember.count({ where: { workspaceId, role: "OWNER" } });
        if (owners <= 1) throw new Error("The workspace must always have at least one owner.");
      }
      const updated = await tx.workspaceMember.update({
        where: { id: target.id },
        data: { role: data.role },
        select: { id: true, role: true },
      });
      await writeActivity(tx, {
        workspaceId,
        actorId,
        action: "UPDATED",
        entityType: "WorkspaceMember",
        entityId: target.id,
        metadata: { role: data.role },
      });
      return updated;
    }, { isolationLevel: "Serializable" }),
  );
}
export async function removeWorkspaceMember(workspaceId: string, actorId: string, input: unknown) {
  const data = memberRemovalSchema.parse(input);
  const db = getPrisma();
  return withSerializableRetry(() =>
    db.$transaction(async (tx) => {
      const target = await tx.workspaceMember.findFirst({
        where: { id: data.memberId, workspaceId },
        select: { id: true, userId: true, role: true },
      });
      if (!target) throw new Error("Member not found in this workspace.");
      if (target.userId === actorId) throw new Error("You cannot remove yourself from this workspace.");
      if (
        target.role === "OWNER" &&
        (await tx.workspaceMember.count({ where: { workspaceId, role: "OWNER" } })) <= 1
      ) {
        throw new Error("The last owner cannot be removed.");
      }
      await tx.workspaceMember.delete({ where: { id: target.id } });
      await writeActivity(tx, {
        workspaceId,
        actorId,
        action: "DELETED",
        entityType: "WorkspaceMember",
        entityId: target.id,
      });
      return { removed: true };
    }, { isolationLevel: "Serializable" }),
  );
}
export async function getProjectProgress(workspaceId: string, projectId: string) {
  const prisma = getPrisma();
  const project = await prisma.project.findFirst({
    where: { id: projectId, workspaceId },
    select: { id: true },
  });
  if (!project) throw new Error("Project not found in this workspace.");

  const [totalTasks, completedTasks, totalMilestones, completedMilestones] =
    await Promise.all([
      prisma.task.count({ where: { workspaceId, projectId } }),
      prisma.task.count({ where: { workspaceId, projectId, status: "DONE" } }),
      prisma.milestone.count({ where: { workspaceId, projectId } }),
      prisma.milestone.count({
        where: { workspaceId, projectId, status: "COMPLETED" },
      }),
    ]);

  const total = totalTasks + totalMilestones;
  if (!total) return 0;
  return Math.round(((completedTasks + completedMilestones) / total) * 100);
}
