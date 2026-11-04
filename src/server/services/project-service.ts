import "server-only";

import { getPrisma } from "@/lib/prisma";
import {
  createClientSchema,
  createProjectSchema,
  createTaskSchema,
} from "@/lib/validations/common";
import { writeActivity } from "@/server/services/activity";

export async function createClient(
  workspaceId: string,
  actorId: string,
  input: unknown,
) {
  const data = createClientSchema.parse(input);
  const prisma = getPrisma();

  return prisma.$transaction(async (tx) => {
    const client = await tx.client.create({
      data: { ...data, workspaceId },
      select: { id: true, name: true, email: true, company: true, createdAt: true },
    });

    await writeActivity(tx, {
      workspaceId,
      actorId,
      action: "CREATED",
      entityType: "Client",
      entityId: client.id,
    });

    return client;
  });
}

export async function createProject(
  workspaceId: string,
  actorId: string,
  input: unknown,
) {
  const data = createProjectSchema.parse(input);
  const prisma = getPrisma();

  return prisma.$transaction(async (tx) => {
    const client = await tx.client.findFirst({
      where: { id: data.clientId, workspaceId },
      select: { id: true },
    });
    if (!client) throw new Error("Client not found in this workspace.");

    const project = await tx.project.create({
      data: {
        workspaceId,
        clientId: client.id,
        name: data.name,
        description: data.description,
        dueDate: data.dueDate,
        members: { create: { userId: actorId } },
      },
      select: {
        id: true,
        name: true,
        status: true,
        clientId: true,
        dueDate: true,
        createdAt: true,
      },
    });

    await writeActivity(tx, {
      workspaceId,
      actorId,
      action: "CREATED",
      entityType: "Project",
      entityId: project.id,
    });

    return project;
  });
}

export async function createTask(
  workspaceId: string,
  actorId: string,
  input: unknown,
) {
  const data = createTaskSchema.parse(input);
  const prisma = getPrisma();

  return prisma.$transaction(async (tx) => {
    const project = await tx.project.findFirst({
      where: { id: data.projectId, workspaceId },
      select: { id: true },
    });
    if (!project) throw new Error("Project not found in this workspace.");

    if (data.milestoneId) {
      const milestone = await tx.milestone.findFirst({
        where: {
          id: data.milestoneId,
          workspaceId,
          projectId: project.id,
        },
        select: { id: true },
      });
      if (!milestone) throw new Error("Milestone does not belong to this project.");
    }

    if (data.assigneeId) {
      const member = await tx.workspaceMember.findFirst({
        where: { workspaceId, userId: data.assigneeId },
        select: { id: true },
      });
      if (!member) throw new Error("Assignee is not a member of this workspace.");
    }

    const task = await tx.task.create({
      data: {
        workspaceId,
        projectId: project.id,
        milestoneId: data.milestoneId,
        assigneeId: data.assigneeId,
        title: data.title,
        description: data.description,
        visibleToClient: data.visibleToClient,
        dueDate: data.dueDate,
      },
      select: {
        id: true,
        title: true,
        status: true,
        priority: true,
        visibleToClient: true,
        dueDate: true,
        projectId: true,
      },
    });

    await writeActivity(tx, {
      workspaceId,
      actorId,
      action: "CREATED",
      entityType: "Task",
      entityId: task.id,
      metadata: { projectId: project.id },
    });

    return task;
  });
}

export async function createMilestone(
  workspaceId: string,
  actorId: string,
  input: unknown,
) {
  const { createMilestoneSchema } = await import("@/lib/validations/common");
  const data = createMilestoneSchema.parse(input);
  const prisma = getPrisma();

  return prisma.$transaction(async (tx) => {
    const project = await tx.project.findFirst({
      where: { id: data.projectId, workspaceId },
      select: { id: true },
    });
    if (!project) throw new Error("Project not found in this workspace.");

    const last = await tx.milestone.findFirst({
      where: { workspaceId, projectId: project.id },
      orderBy: { position: "desc" },
      select: { position: true },
    });

    const milestone = await tx.milestone.create({
      data: {
        workspaceId,
        projectId: project.id,
        name: data.name,
        description: data.description,
        dueDate: data.dueDate,
        position: (last?.position ?? -1) + 1,
      },
      select: { id: true, name: true, dueDate: true, position: true },
    });

    await writeActivity(tx, {
      workspaceId,
      actorId,
      action: "CREATED",
      entityType: "Milestone",
      entityId: milestone.id,
      metadata: { projectId: project.id },
    });

    return milestone;
  });
}

export async function updateTaskStatus(
  workspaceId: string,
  actorId: string,
  input: unknown,
) {
  const { taskStatusSchema } = await import("@/lib/validations/common");
  const data = taskStatusSchema.parse(input);
  const prisma = getPrisma();

  return prisma.$transaction(async (tx) => {
    const updated = await tx.task.updateMany({
      where: { id: data.taskId, workspaceId },
      data: {
        status: data.status,
        completedAt: data.status === "DONE" ? new Date() : null,
      },
    });
    if (updated.count !== 1) throw new Error("Task not found in this workspace.");

    await writeActivity(tx, {
      workspaceId,
      actorId,
      action: "UPDATED",
      entityType: "Task",
      entityId: data.taskId,
      metadata: { status: data.status },
    });

    return tx.task.findFirstOrThrow({
      where: { id: data.taskId, workspaceId },
      select: { id: true, status: true, completedAt: true },
    });
  });
}

export async function linkClientPortalAccount(
  workspaceId: string,
  actorId: string,
  clientId: string,
  email: string,
) {
  const normalizedEmail = email.trim().toLowerCase();
  const prisma = getPrisma();

  return prisma.$transaction(async (tx) => {
    const client = await tx.client.findFirst({
      where: { id: clientId, workspaceId, email: normalizedEmail },
      select: { id: true, email: true, userId: true },
    });
    if (!client) throw new Error("Client email must match the client record.");
    if (client.userId) throw new Error("This client already has a portal account.");

    const account = await tx.user.findUnique({
      where: { email: normalizedEmail },
      select: { id: true },
    });
    if (!account) throw new Error("Ask the client to create an account first.");

    const linked = await tx.client.updateMany({
      where: { id: clientId, workspaceId, userId: null },
      data: { userId: account.id },
    });
    if (linked.count !== 1) throw new Error("Client portal account was linked by another request.");

    await writeActivity(tx, {
      workspaceId,
      actorId,
      action: "UPDATED",
      entityType: "Client",
      entityId: clientId,
      metadata: { portalAccountLinked: true },
    });

    return { clientId, linked: true };
  });
}
