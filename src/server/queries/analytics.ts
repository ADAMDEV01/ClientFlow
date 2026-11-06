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
        where: { workspaceId, dueDate: { lt: now }, status: { not: "DONE" } },
      }),
      prisma.deliverable.count({ where: { workspaceId, status: "SUBMITTED" } }),
      prisma.task.groupBy({
        by: ["status"], where: { workspaceId }, _count: { _all: true },
      }),
      prisma.review.groupBy({
        by: ["decision"], where: { workspaceId }, _count: { _all: true },
      }),
    ]);

  const taskCounts = { TODO: 0, IN_PROGRESS: 0, IN_REVIEW: 0, DONE: 0 };
  for (const group of taskGroups) taskCounts[group.status] = group._count._all;
  const approved = reviewGroups.find((group) => group.decision === "APPROVED")?._count._all ?? 0;
  const decided = reviewGroups.reduce((total, group) => total + group._count._all, 0);

  return {
    activeProjects, overdueTasks, pendingReviews, tasksByStatus: taskCounts,
    approvalRate: decided ? Math.round((approved / decided) * 100) : null,
    decidedReviews: decided,
  };
}

/** Filter options are intentionally unbounded: every project and every actor remains selectable. */
export async function getWorkspaceActivityOptions(workspaceId: string) {
  const prisma = getPrisma();
  const [projects, members] = await Promise.all([
    prisma.project.findMany({
      where: { workspaceId },
      orderBy: [{ name: "asc" }, { id: "asc" }],
      select: { id: true, name: true },
    }),
    prisma.$queryRaw<
      Array<{ actorId: string; name: string | null; email: string | null }>
    >`
      SELECT DISTINCT ON (a."actorId")
        a."actorId", u.name, u.email
      FROM "Activity" a
      JOIN "User" u ON u.id = a."actorId"
      WHERE a."workspaceId" = ${workspaceId}
        AND a."actorId" IS NOT NULL
      ORDER BY a."actorId", a."createdAt" DESC, a.id DESC
    `,
  ]);

  return {
    projects,
    actors: members
      .map(({ actorId, name, email }) => ({
        id: actorId,
        label: name ?? email ?? "Unknown user",
      }))
      .sort((left, right) => left.label.localeCompare(right.label)),
  };
}

export async function getWorkspaceActivity(
  workspaceId: string,
  filters: ActivityFilters = {},
) {
  const prisma = getPrisma();

  if (filters.projectId) {
    const project = await prisma.project.findFirst({
      where: { id: filters.projectId, workspaceId },
      select: { id: true },
    });
    if (!project) return { entries: [], nextCursor: null, hasMore: false };

    // Query Activity directly through EXISTS relations. No entity-ID collection is truncated.
    const rows = await prisma.$queryRaw<Array<{
      id: string; action: ActivityAction; entityType: string; entityId: string;
      createdAt: Date; actorId: string | null; actorName: string | null; actorEmail: string | null;
    }>>`
      SELECT a.id, a.action, a."entityType", a."entityId", a."createdAt",
             u.id AS "actorId", u.name AS "actorName", u.email AS "actorEmail"
      FROM "Activity" a
      LEFT JOIN "User" u ON u.id = a."actorId"
      WHERE a."workspaceId" = ${workspaceId}
        AND (${filters.actorId ?? null}::text IS NULL OR a."actorId" = ${filters.actorId ?? null})
        AND (${filters.action ?? null}::"ActivityAction" IS NULL OR a.action = ${filters.action ?? null}::"ActivityAction")
        AND (
          (a."entityType" = 'Project' AND a."entityId" = ${project.id})
          OR (a."entityType" = 'Task' AND EXISTS (
            SELECT 1 FROM "Task" t
            WHERE t.id = a."entityId" AND t."projectId" = ${project.id}
              AND t."workspaceId" = ${workspaceId}
          ))
          OR (a."entityType" = 'Milestone' AND EXISTS (
            SELECT 1 FROM "Milestone" m
            WHERE m.id = a."entityId" AND m."projectId" = ${project.id}
              AND m."workspaceId" = ${workspaceId}
          ))
          OR (a."entityType" = 'Deliverable' AND EXISTS (
            SELECT 1 FROM "Deliverable" d
            WHERE d.id = a."entityId" AND d."projectId" = ${project.id}
              AND d."workspaceId" = ${workspaceId}
          ))
        )
        AND (
          ${filters.cursor ?? null}::text IS NULL OR EXISTS (
            SELECT 1 FROM "Activity" c
            WHERE c.id = ${filters.cursor ?? null}
              AND c."workspaceId" = ${workspaceId}
              AND (a."createdAt", a.id) < (c."createdAt", c.id)
          )
        )
      ORDER BY a."createdAt" DESC, a.id DESC
      LIMIT ${PAGE_SIZE + 1}
    `;

    const hasMore = rows.length > PAGE_SIZE;
    const page = hasMore ? rows.slice(0, PAGE_SIZE) : rows;
    return {
      entries: page.map((row) => ({
        id: row.id, action: row.action, entityType: row.entityType,
        entityId: row.entityId, createdAt: row.createdAt,
        actor: row.actorId ? { id: row.actorId, name: row.actorName, email: row.actorEmail } : null,
      })),
      hasMore,
      nextCursor: hasMore ? page[page.length - 1]?.id ?? null : null,
    };
  }

  const entries = await prisma.activity.findMany({
    where: {
      workspaceId,
      ...(filters.actorId ? { actorId: filters.actorId } : {}),
      ...(filters.action ? { action: filters.action } : {}),
    },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    ...(filters.cursor ? { cursor: { id: filters.cursor }, skip: 1 } : {}),
    take: PAGE_SIZE + 1,
    select: {
      id: true, action: true, entityType: true, entityId: true, createdAt: true,
      actor: { select: { id: true, name: true, email: true } },
    },
  });
  const hasMore = entries.length > PAGE_SIZE;
  const page = hasMore ? entries.slice(0, PAGE_SIZE) : entries;
  return {
    entries: page, hasMore,
    nextCursor: hasMore ? page[page.length - 1]?.id ?? null : null,
  };
}

export async function getClientActivityFeed(cursor?: string) {
  const user = await requireUser();
  if (user.role !== "CLIENT" || !user.clientId || !user.workspaceId) {
    throw new Error("Client portal access is required.");
  }

  const prisma = getPrisma();
  const rows = await prisma.$queryRaw<Array<{
    id: string; action: ActivityAction; entityType: string; createdAt: Date;
    projectName: string; actorName: string | null;
  }>>`
    SELECT a.id, a.action, a."entityType", a."createdAt",
           p.name AS "projectName", u.name AS "actorName"
    FROM "Activity" a
    LEFT JOIN "User" u ON u.id = a."actorId"
    JOIN "Project" p ON p."workspaceId" = a."workspaceId"
    JOIN "Client" c ON c.id = p."clientId" AND c."workspaceId" = p."workspaceId"
    WHERE a."workspaceId" = ${user.workspaceId}
      AND c.id = ${user.clientId} AND c."userId" = ${user.id}
      AND (
        (a."entityType" = 'Project' AND a."entityId" = p.id)
        OR (a."entityType" = 'Task' AND EXISTS (
          SELECT 1 FROM "Task" t WHERE t.id = a."entityId" AND t."projectId" = p.id
            AND t."workspaceId" = p."workspaceId" AND t."visibleToClient" = true
        ))
        OR (a."entityType" = 'Milestone' AND EXISTS (
          SELECT 1 FROM "Milestone" m WHERE m.id = a."entityId" AND m."projectId" = p.id
            AND m."workspaceId" = p."workspaceId"
        ))
        OR (a."entityType" = 'Deliverable' AND EXISTS (
          SELECT 1 FROM "Deliverable" d WHERE d.id = a."entityId" AND d."projectId" = p.id
            AND d."workspaceId" = p."workspaceId"
            AND d.status IN ('SUBMITTED', 'APPROVED', 'CHANGES_REQUESTED')
        ))
      )
      AND (
        ${cursor ?? null}::text IS NULL OR EXISTS (
          SELECT 1 FROM "Activity" cursor_activity
          WHERE cursor_activity.id = ${cursor ?? null}
            AND cursor_activity."workspaceId" = ${user.workspaceId}
            AND (a."createdAt", a.id) < (cursor_activity."createdAt", cursor_activity.id)
        )
      )
    ORDER BY a."createdAt" DESC, a.id DESC
    LIMIT 16
  `;
  const hasMore = rows.length > 15;
  const page = hasMore ? rows.slice(0, 15) : rows;

  // Deliberately omit actor email, metadata, internal IDs and entity IDs in the client feed.
  return {
    entries: page.map((entry) => ({
      id: entry.id, action: entry.action, entityType: entry.entityType,
      projectName: entry.projectName, createdAt: entry.createdAt,
      actorName: entry.actorName ?? "Team member",
    })),
    hasMore,
    nextCursor: hasMore ? page[page.length - 1]?.id ?? null : null,
  };
}
