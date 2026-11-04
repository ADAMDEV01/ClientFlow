import "server-only";

import type { ActivityAction } from "@/generated/prisma/client";
import { getPrisma } from "@/lib/prisma";
import { requireUser } from "@/server/authz";

const PAGE_SIZE = 25;

export type ActivityFilters = {
  projectId?: string;
  actorId?: string;
  action?: ActivityAction;
  cursor?: string;
};

export async function getWorkspaceDashboardStats(workspaceId: string) {
  const prisma = getPrisma();
  const now = new Date();

  const [activeProjects, overdueTasks, pendingReviews, taskGroups, reviewGroups] =
    await Promise.all([
      prisma.project.count({ where: { workspaceId, status: "ACTIVE" } }),
      prisma.task.count({
        where: {
          workspaceId,
          dueDate: { lt: now },
          status: { not: "DONE" },
        },
      }),
      prisma.deliverable.count({
        where: { workspaceId, status: "SUBMITTED" },
      }),
      prisma.task.groupBy({
        by: ["status"],
        where: { workspaceId },
        _count: { _all: true },
      }),
      prisma.review.groupBy({
        by: ["decision"],
        where: { workspaceId },
        _count: { _all: true },
      }),
    ]);

  const taskCounts = {
    TODO: 0,
    IN_PROGRESS: 0,
    IN_REVIEW: 0,
    DONE: 0,
  };
  for (const group of taskGroups) taskCounts[group.status] = group._count._all;

  const approved = reviewGroups.find((group) => group.decision === "APPROVED")?._count._all ?? 0;
  const decided = reviewGroups.reduce((total, group) => total + group._count._all, 0);

  return {
    activeProjects,
    overdueTasks,
    pendingReviews,
    tasksByStatus: taskCounts,
    approvalRate: decided ? Math.round((approved / decided) * 100) : null,
    decidedReviews: decided,
  };
}

export async function getWorkspaceActivityOptions(workspaceId: string) {
  const prisma = getPrisma();
  const [projects, members] = await Promise.all([
    prisma.project.findMany({
      where: { workspaceId },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
    prisma.workspaceMember.findMany({
      where: { workspaceId },
      orderBy: { user: { name: "asc" } },
      select: { userId: true, user: { select: { name: true, email: true } } },
    }),
  ]);

  return {
    projects,
    actors: members.map(({ userId, user }) => ({
      id: userId,
      label: user.name ?? user.email,
    })),
  };
}

export async function getWorkspaceActivity(
  workspaceId: string,
  filters: ActivityFilters = {},
) {
  const prisma = getPrisma();
  let projectEntityIds: string[] | undefined;

  if (filters.projectId) {
    const project = await prisma.project.findFirst({
      where: { id: filters.projectId, workspaceId },
      select: {
        id: true,
        tasks: { select: { id: true } },
        milestones: { select: { id: true } },
        deliverables: { select: { id: true } },
      },
    });
    if (!project) return { entries: [], nextCursor: null, hasMore: false };

    projectEntityIds = [
      project.id,
      ...project.tasks.map((item) => item.id),
      ...project.milestones.map((item) => item.id),
      ...project.deliverables.map((item) => item.id),
    ];
  }

  const entries = await prisma.activity.findMany({
    where: {
      workspaceId,
      ...(filters.actorId ? { actorId: filters.actorId } : {}),
      ...(filters.action ? { action: filters.action } : {}),
      ...(projectEntityIds
        ? {
            entityId: { in: projectEntityIds },
            entityType: { in: ["Project", "Task", "Milestone", "Deliverable"] },
          }
        : {}),
    },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    ...(filters.cursor ? { cursor: { id: filters.cursor }, skip: 1 } : {}),
    take: PAGE_SIZE + 1,
    select: {
      id: true,
      action: true,
      entityType: true,
      entityId: true,
      createdAt: true,
      actor: { select: { id: true, name: true, email: true } },
    },
  });

  const hasMore = entries.length > PAGE_SIZE;
  const page = hasMore ? entries.slice(0, PAGE_SIZE) : entries;
  return {
    entries: page,
    hasMore,
    nextCursor: hasMore ? page[page.length - 1]?.id ?? null : null,
  };
}

export async function getClientActivityFeed() {
  const user = await requireUser();
  if (user.role !== "CLIENT" || !user.clientId || !user.workspaceId) {
    throw new Error("Client portal access is required.");
  }

  const prisma = getPrisma();
  const projects = await prisma.project.findMany({
    where: {
      workspaceId: user.workspaceId,
      clientId: user.clientId,
      client: { userId: user.id },
    },
    select: {
      id: true,
      name: true,
      tasks: { where: { visibleToClient: true }, select: { id: true } },
      milestones: { select: { id: true } },
      deliverables: { where: { status: { in: ["SUBMITTED", "APPROVED", "CHANGES_REQUESTED"] } }, select: { id: true } },
    },
  });

  if (!projects.length) return [];

  const projectByEntityId = new Map<string, string>();
  const entityIds: string[] = [];
  for (const project of projects) {
    projectByEntityId.set(project.id, project.name);
    entityIds.push(project.id);
    for (const task of project.tasks) {
      projectByEntityId.set(task.id, project.name);
      entityIds.push(task.id);
    }
    for (const milestone of project.milestones) {
      projectByEntityId.set(milestone.id, project.name);
      entityIds.push(milestone.id);
    }
    for (const deliverable of project.deliverables) {
      projectByEntityId.set(deliverable.id, project.name);
      entityIds.push(deliverable.id);
    }
  }

  const activity = await prisma.activity.findMany({
    where: {
      workspaceId: user.workspaceId,
      entityId: { in: entityIds },
      entityType: { in: ["Project", "Task", "Milestone", "Deliverable"] },
    },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: 15,
    select: {
      id: true,
      action: true,
      entityType: true,
      entityId: true,
      createdAt: true,
      actor: { select: { name: true } },
    },
  });

  // Deliberately omit actor email, metadata, internal IDs and entity IDs in the client feed.
  return activity.map((entry) => ({
    id: entry.id,
    action: entry.action,
    entityType: entry.entityType,
    projectName: projectByEntityId.get(entry.entityId) ?? "Project",
    createdAt: entry.createdAt,
    actorName: entry.actor?.name ?? "Team member",
  }));
}
