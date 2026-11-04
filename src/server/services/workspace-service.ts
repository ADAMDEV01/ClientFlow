import "server-only";

import { getPrisma } from "@/lib/prisma";
import { createWorkspaceSchema } from "@/lib/validations/common";

export async function createWorkspaceForUser(
  userId: string,
  input: unknown,
) {
  const data = createWorkspaceSchema.parse(input);
  const prisma = getPrisma();

  return prisma.$transaction(async (tx) => {
    const workspace = await tx.workspace.create({
      data: {
        name: data.name,
        slug: data.slug,
        ownerId: userId,
        members: {
          create: { userId, role: "OWNER" },
        },
      },
      select: { id: true, name: true, slug: true, createdAt: true },
    });

    await tx.user.update({
      where: { id: userId },
      data: { activeWorkspaceId: workspace.id },
    });

    await tx.activity.create({
      data: {
        workspaceId: workspace.id,
        actorId: userId,
        action: "CREATED",
        entityType: "Workspace",
        entityId: workspace.id,
      },
    });

    return workspace;
  });
}
