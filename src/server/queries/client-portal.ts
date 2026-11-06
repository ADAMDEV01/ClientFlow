import "server-only";

import { requireClientAccess, requireUser } from "@/server/authz";
import { getPrisma } from "@/lib/prisma";

const PORTAL_PROJECT_PAGE_SIZE = 50;
const MILESTONE_PAGE_SIZE = 50;
const TASK_PAGE_SIZE = 50;
const DELIVERABLE_PAGE_SIZE = 50;
const REVIEW_PAGE_SIZE = 10;
const COMMENT_PAGE_SIZE = 50;

export type ClientProjectPortalCursors = {
  milestonesCursor?: string;
  tasksCursor?: string;
  deliverablesCursor?: string;
  reviewCursors?: Record<string, string>;
  commentCursors?: Record<string, string>;
};

function calculateProgressFromGroups(
  taskGroups: Array<{ status: string; _count: { _all: number } }>,
  milestoneGroups: Array<{ status: string; _count: { _all: number } }>,
) {
  const total = [...taskGroups, ...milestoneGroups].reduce(
    (sum, group) => sum + group._count._all, 0,
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
      workspaceId: user.workspaceId, clientId: user.clientId,
      client: { userId: user.id },
    },
    orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    take: PORTAL_PROJECT_PAGE_SIZE + 1,
    select: {
      id: true, workspaceId: true, name: true, status: true,
      dueDate: true, updatedAt: true,
    },
  });

  const hasMore = rows.length > PORTAL_PROJECT_PAGE_SIZE;
  const projects = hasMore ? rows.slice(0, PORTAL_PROJECT_PAGE_SIZE) : rows;
  if (!projects.length) return { projects: [], hasMore: false, nextCursor: null };

  const projectIds = projects.map((project) => project.id);
  const [taskGroups, milestoneGroups] = await Promise.all([
    prisma.task.groupBy({
      by: ["projectId", "status"],
      where: { workspaceId: user.workspaceId, projectId: { in: projectIds }, visibleToClient: true },
      _count: { _all: true },
    }),
    prisma.milestone.groupBy({
      by: ["projectId", "status"],
      where: { workspaceId: user.workspaceId, projectId: { in: projectIds } },
      _count: { _all: true },
    }),
  ]);

  const progress = new Map<string, { total: number; completed: number }>();
  for (const projectId of projectIds) progress.set(projectId, { total: 0, completed: 0 });
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
      return { ...project, progress: counts.total ? Math.round((counts.completed / counts.total) * 100) : 0 };
    }),
    hasMore,
    nextCursor: hasMore ? projects[projects.length - 1]?.id ?? null : null,
  };
}

export async function getClientProjectPortal(
  workspaceId: string,
  projectId: string,
  cursors: ClientProjectPortalCursors = {},
) {
  const { user, project: access } = await requireClientAccess(workspaceId, projectId);
  const prisma = getPrisma();
  const project = await prisma.project.findFirst({
    where: {
      id: access.id, workspaceId, clientId: user.clientId!,
      client: { userId: user.id },
    },
    select: {
      id: true, workspaceId: true, name: true, description: true,
      status: true, dueDate: true,
      milestones: {
        orderBy: [{ position: "asc" }, { id: "asc" }],
        ...(cursors.milestonesCursor ? { cursor: { id: cursors.milestonesCursor }, skip: 1 } : {}),
        take: MILESTONE_PAGE_SIZE + 1,
        select: { id: true, name: true, status: true, dueDate: true, completedAt: true },
      },
      tasks: {
        where: { visibleToClient: true },
        orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
        ...(cursors.tasksCursor ? { cursor: { id: cursors.tasksCursor }, skip: 1 } : {}),
        take: TASK_PAGE_SIZE + 1,
        select: { id: true, title: true, status: true, dueDate: true, milestoneId: true },
      },
      deliverables: {
        where: { status: { in: ["SUBMITTED", "APPROVED", "CHANGES_REQUESTED"] } },
        orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
        ...(cursors.deliverablesCursor ? { cursor: { id: cursors.deliverablesCursor }, skip: 1 } : {}),
        take: DELIVERABLE_PAGE_SIZE + 1,
        select: {
          id: true, name: true, description: true, version: true, status: true,
          fileName: true, mimeType: true, sizeBytes: true, revision: true,
          submittedAt: true, updatedAt: true,
          reviews: {
            orderBy: [{ createdAt: "desc" }, { id: "desc" }],
            ...(cursors.reviewCursors?.[ "PLACEHOLDER" ] ? {} : {}),
            take: REVIEW_PAGE_SIZE + 1,
            select: {
              id: true, decision: true, feedback: true, version: true, createdAt: true,
              reviewer: { select: { name: true } },
            },
          },
          comments: {
            orderBy: [{ createdAt: "asc" }, { id: "asc" }],
            take: COMMENT_PAGE_SIZE + 1,
            select: {
              id: true, body: true, version: true, createdAt: true,
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
      by: ["status"], where: { workspaceId, projectId: project.id, visibleToClient: true },
      _count: { _all: true },
    }),
    prisma.milestone.groupBy({
      by: ["status"], where: { workspaceId, projectId: project.id },
      _count: { _all: true },
    }),
  ]);

  const milestonesHasMore = project.milestones.length > MILESTONE_PAGE_SIZE;
  const milestones = milestonesHasMore ? project.milestones.slice(0, MILESTONE_PAGE_SIZE) : project.milestones;
  const tasksHasMore = project.tasks.length > TASK_PAGE_SIZE;
  const tasks = tasksHasMore ? project.tasks.slice(0, TASK_PAGE_SIZE) : project.tasks;
  const deliverablesHasMore = project.deliverables.length > DELIVERABLE_PAGE_SIZE;
  const deliverableRows = deliverablesHasMore
    ? project.deliverables.slice(0, DELIVERABLE_PAGE_SIZE)
    : project.deliverables;

  const deliverables = deliverableRows.map((item) => {
    const reviewsHasMore = item.reviews.length > REVIEW_PAGE_SIZE;
    const reviews = reviewsHasMore ? item.reviews.slice(0, REVIEW_PAGE_SIZE) : item.reviews;
    const commentsHasMore = item.comments.length > COMMENT_PAGE_SIZE;
    const comments = commentsHasMore ? item.comments.slice(0, COMMENT_PAGE_SIZE) : item.comments;
    return {
      ...item, reviews, comments,
      reviewsHasMore,
      reviewsNextCursor: reviewsHasMore ? reviews[reviews.length - 1]?.id ?? null : null,
      commentsHasMore,
      commentsNextCursor: commentsHasMore ? comments[comments.length - 1]?.id ?? null : null,
    };
  });

  return {
    ...project,
    milestones, tasks, deliverables,
    milestonesHasMore,
    milestonesNextCursor: milestonesHasMore ? milestones[milestones.length - 1]?.id ?? null : null,
    tasksHasMore,
    tasksNextCursor: tasksHasMore ? tasks[tasks.length - 1]?.id ?? null : null,
    deliverablesHasMore,
    deliverablesNextCursor: deliverablesHasMore ? deliverables[deliverables.length - 1]?.id ?? null : null,
    progress: calculateProgressFromGroups(taskGroups, milestoneGroups),
  };
}
