import "server-only";

import { requireClientAccess, requireUser } from "@/server/authz";
import { getPrisma } from "@/lib/prisma";

function calculateProgress(tasks: { status: string }[], milestones: { status: string }[]) {
  const total = tasks.length + milestones.length;
  if (!total) return 0;
  const completed = tasks.filter(task => task.status === "DONE").length + milestones.filter(item => item.status === "COMPLETED").length;
  return Math.round((completed / total) * 100);
}

export async function getClientPortalProjects() {
  const user = await requireUser();
  if (user.role !== "CLIENT" || !user.clientId || !user.workspaceId) throw new Error("Client portal access is required.");
  const projects = await getPrisma().project.findMany({
    where: { workspaceId: user.workspaceId, clientId: user.clientId, client: { userId: user.id } },
    orderBy: { updatedAt: "desc" },
    select: {
      id: true, workspaceId: true, name: true, status: true, dueDate: true, updatedAt: true,
      milestones: { select: { status: true } },
      tasks: { where: { visibleToClient: true }, select: { status: true } },
    },
  });
  return projects.map(project => ({ ...project, progress: calculateProgress(project.tasks, project.milestones) }));
}

export async function getClientProjectPortal(workspaceId: string, projectId: string) {
  const { user, project: access } = await requireClientAccess(workspaceId, projectId);
  const project = await getPrisma().project.findFirst({
    where: { id: access.id, workspaceId, clientId: user.clientId!, client: { userId: user.id } },
    select: {
      id: true, workspaceId: true, name: true, description: true, status: true, dueDate: true,
      milestones: {
        orderBy: { position: "asc" },
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
        orderBy: [{ name: "asc" }, { version: "desc" }],
        select: {
          id: true, name: true, description: true, version: true, status: true, fileName: true, mimeType: true, sizeBytes: true, revision: true, submittedAt: true, updatedAt: true,
          reviews: { orderBy: { createdAt: "desc" }, take: 10, select: { id: true, decision: true, feedback: true, version: true, createdAt: true, reviewer: { select: { name: true } } } },
          comments: { orderBy: { createdAt: "asc" }, take: 50, select: { id: true, body: true, version: true, createdAt: true, author: { select: { name: true } } } },
        },
      },
    },
  });
  if (!project) return null;
  return { ...project, progress: calculateProgress(project.tasks, project.milestones) };
}
