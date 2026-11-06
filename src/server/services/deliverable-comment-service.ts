import "server-only";

import { getPrisma } from "@/lib/prisma";
import { writeActivity } from "@/server/services/activity";

export async function addDeliverableComment(input: {
  workspaceId: string;
  deliverableId: string;
  actorId: string;
  clientId?: string;
  body: string;
}) {
  const body = input.body.trim();
  if (!body || body.length > 4000) throw new Error("Comment must be between 1 and 4000 characters.");
  const prisma = getPrisma();
  return prisma.$transaction(async tx => {
    const deliverable = await tx.deliverable.findFirst({
      where: {
        id: input.deliverableId,
        workspaceId: input.workspaceId,
        ...(input.clientId ? { project: { clientId: input.clientId } } : {}),
      },
      select: { id: true, version: true, status: true },
    });
    if (!deliverable) throw new Error("Deliverable not found.");
    if (input.clientId && !["SUBMITTED", "APPROVED", "CHANGES_REQUESTED"].includes(deliverable.status)) {
      throw new Error("This deliverable is not available for client comments.");
    }
    const comment = await tx.deliverableComment.create({
      data: {
        workspaceId: input.workspaceId,
        deliverableId: deliverable.id,
        authorId: input.actorId,
        version: deliverable.version,
        body,
      },
      select: { id: true, body: true, version: true, createdAt: true },
    });
    await writeActivity(tx, {
      workspaceId: input.workspaceId,
      actorId: input.actorId,
      action: "COMMENTED",
      entityType: "Deliverable",
      entityId: deliverable.id,
      metadata: { version: deliverable.version, commentId: comment.id },
    });
    return comment;
  });
}
