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
        members: { create: { workspaceId, userId: actorId } },
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
