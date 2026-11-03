import "server-only";

import { requireClientAccess } from "@/server/authz";
import { getPrisma } from "@/lib/prisma";

export async function getClientProjectPortal(
  workspaceId: string,
  projectId: string,
) {
  const { user, project: access } = await requireClientAccess(
    workspaceId,
    projectId,
  );
  const prisma = getPrisma();

  return prisma.project.findFirst({
    where: {
      id: access.id,
      workspaceId,
      clientId: user.clientId!,
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
        select: {
          id: true,
          name: true,
          dueDate: true,
          completedAt: true,
        },
      },
      tasks: {
        where: { visibleToClient: true },
        orderBy: { updatedAt: "desc" },
        take: 50,
        select: {
          id: true,
          title: true,
          status: true,
          dueDate: true,
          milestoneId: true,
        },
      },
      deliverables: {
        orderBy: [{ name: "asc" }, { version: "desc" }],
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
        },
      },
    },
  });
}
