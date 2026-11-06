import "server-only";

import { requireClientAccess, requireUser } from "@/server/authz";
import { getPrisma } from "@/lib/prisma";

const PORTAL_PROJECT_PAGE_SIZE = 50;

function calculateProgressFromGroups(
  taskGroups: Array<{ status: string; _count: { _all: number } }>,
  milestoneGroups: Array<{ status: string; _count: { _all: number } }>,
) {
  const total = [...taskGroups, ...milestoneGroups].reduce(
    (sum, group) => sum + group._count._all,
    0,
  );
  if (!total) return 0;

  const completed = [
    ...taskGroups.filter((group) => group.status === "DONE"),
    ...milestoneGroups.filter((group) => group.status === "COMPLETED"),
  ].reduce((sum, group) => sum + group._count._all, 0);

  return Math.round((completed / total) * 100);
}

export async function getClientPortalProjects(cursor?: string) {
  const user = await requireUser();
  if (user.role !== "CLIENT" || !user.clientId || !user.workspaceId) {
    throw new Error("Client portal access is required.");
  }

  const prisma = getPrisma();
  const rows = await prisma.project.findMany({
    where: {
      workspaceId: user.workspaceId,
      clientId: user.clientId,
      client: { userId: user.id },
    },
    orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    take: PORTAL_PROJECT_PAGE_SIZE + 1,
    select: {
      id: true,
      workspaceId: true,
      name: true,
      status: true,
      dueDate: true,
      updatedAt: true,
    },
  });

  const hasMore = rows.length > PORTAL_PROJECT_PAGE_SIZE;
  const projects = hasMore ? rows.slice(0, PORTAL_PROJECT_PAGE_SIZE) : rows;
  if (!projects.length) {
    return { projects: [], hasMore: false, nextCursor: null };
  }

  const projectIds = projects.map((project) => project.id);
  const [taskGroups, milestoneGroups] = await Promise.all([
    prisma.task.groupBy({
      by: ["projectId", "status"],
      where: {
        workspaceId: user.workspaceId,
        projectId: { in: projectIds },
        visibleToClient: true,
      },
      _count: { _all: true },
    }),
    prisma.milestone.groupBy({
      by: ["projectId", "status"],
      where: {
        workspaceId: user.workspaceId,
        projectId: { in: projectIds },
      },
      _count: { _all: true },
    }),
  ]);

  const progress = new Map<string, { total: number; completed: number }>();
  for (const projectId of projectIds) {
    progress.set(projectId, { total: 0, completed: 0 });
  }

  for (const group of taskGroups) {
    const counts = progress.get(group.projectId);
    if (!counts) continue;
    counts.total += group._count._all;
    if (group.status === "DONE") counts.completed += group._count._all;
  }
  for (const group of milestoneGroups) {
    const counts = progress.get(group.projectId);
    if (!counts) continue;
    counts.total += group._count._all;
    if (group.status === "COMPLETED") counts.completed += group._count._all;
  }

  return {
    projects: projects.map((project) => {
      const counts = progress.get(project.id) ?? { total: 0, completed: 0 };
      return {
        ...project,
        progress: counts.total
          ? Math.round((counts.completed / counts.total) * 100)
          : 0,
      };
    }),
    hasMore,
    nextCursor: hasMore ? projects[projects.length - 1]?.id ?? null : null,
  };
}

export async function getClientProjectPortal(workspaceId: string, projectId: string) {
  const { user, project: access } = await requireClientAccess(workspaceId, projectId);
  const prisma = getPrisma();
  const project = await prisma.project.findFirst({
    where: {
      id: access.id,
      workspaceId,
      clientId: user.clientId!,
      client: { userId: user.id },
    },
    select: {
      id: true,
      workspaceId: true,
      name: true,
      description: true,
      status: true,
      dueDate: true,
      milestones: {
        orderBy: { position: "asc" },
        take: 100,
        select: { id: true, name: true, status: true, dueDate: true, completedAt: true },
      },
      tasks: {
        where: { visibleToClient: true },
        orderBy: { updatedAt: "desc" },
        take: 50,
        select: { id: true, title: true, status: true, dueDate: true, milestoneId: true },
      },
      deliverables: {
        where: { status: { in: ["SUBMITTED", "APPROVED", "CHANGES_REQUESTED"] } },
        orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
        take: 50,
        select: {
          id: true,
          name: true,
          description: true,
          version: true,
          status: true,
          fileName: true,
          mimeType: true,
          sizeBytes: true,
          revision: true,
          submittedAt: true,
          updatedAt: true,
          reviews: {
            orderBy: { createdAt: "desc" },
            take: 10,
            select: {
              id: true,
              decision: true,
              feedback: true,
              version: true,
              createdAt: true,
              reviewer: { select: { name: true } },
            },
          },
          comments: {
            orderBy: { createdAt: "asc" },
            take: 50,
            select: {
              id: true,
              body: true,
              version: true,
              createdAt: true,
              author: { select: { name: true } },
            },
          },
        },
      },
    },
  });

  if (!project) return null;

  const [taskGroups, milestoneGroups] = await Promise.all([
    prisma.task.groupBy({
      by: ["status"],
      where: {
        workspaceId,
        projectId: project.id,
        visibleToClient: true,
      },
      _count: { _all: true },
    }),
    prisma.milestone.groupBy({
      by: ["status"],
      where: { workspaceId, projectId: project.id },
      _count: { _all: true },
    }),
  ]);

  return {
    ...project,
    progress: calculateProgressFromGroups(taskGroups, milestoneGroups),
  };
}
