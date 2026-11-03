import "server-only";

import { getPrisma } from "@/lib/prisma";
import { deliverableDecisionSchema } from "@/lib/validations/common";
import { writeActivity } from "@/server/services/activity";

export async function decideDeliverable(
  input: unknown,
  actorId: string,
  clientId: string,
) {
  const data = deliverableDecisionSchema.parse(input);
  const prisma = getPrisma();

  return prisma.$transaction(async (tx) => {
    const deliverable = await tx.deliverable.findFirst({
      where: {
        id: data.deliverableId,
        workspaceId: data.workspaceId,
        status: "SUBMITTED",
        project: { clientId },
      },
      select: { id: true, projectId: true, name: true, version: true },
    });

    if (!deliverable) {
      throw new Error("This submitted deliverable is unavailable for review.");
    }

    const update = await tx.deliverable.updateMany({
      where: {
        id: data.deliverableId,
        workspaceId: data.workspaceId,
        status: "SUBMITTED",
        revision: data.expectedRevision,
      },
      data: {
        status: data.decision,
        revision: { increment: 1 },
        decidedAt: new Date(),
      },
    });

    if (update.count !== 1) {
      throw new Error("This deliverable was already changed. Refresh and try again.");
    }

    await tx.review.create({
      data: {
        workspaceId: data.workspaceId,
        deliverableId: deliverable.id,
        clientId,
        decision: data.decision,
        feedback: data.decision === "CHANGES_REQUESTED" ? data.feedback : null,
      },
    });

    await writeActivity(tx, {
      workspaceId: data.workspaceId,
      actorId,
      action: data.decision === "APPROVED" ? "APPROVED" : "CHANGES_REQUESTED",
      entityType: "Deliverable",
      entityId: deliverable.id,
      metadata: {
        projectId: deliverable.projectId,
        version: deliverable.version,
      },
    });

    return { id: deliverable.id, status: data.decision };
  });
}

export async function createNextDeliverableVersion(
  workspaceId: string,
  actorId: string,
  deliverableId: string,
) {
  const prisma = getPrisma();

  return prisma.$transaction(async (tx) => {
    const previous = await tx.deliverable.findFirst({
      where: {
        id: deliverableId,
        workspaceId,
        status: "CHANGES_REQUESTED",
      },
      select: { projectId: true, name: true, description: true, version: true },
    });

    if (!previous) {
      throw new Error("Only a deliverable with requested changes can be revised.");
    }

    const next = await tx.deliverable.create({
      data: {
        workspaceId,
        projectId: previous.projectId,
        name: previous.name,
        description: previous.description,
        version: previous.version + 1,
        status: "DRAFT",
      },
      select: { id: true, name: true, version: true, status: true },
    });

    await writeActivity(tx, {
      workspaceId,
      actorId,
      action: "CREATED",
      entityType: "Deliverable",
      entityId: next.id,
      metadata: { previousVersion: previous.version, version: next.version },
    });

    return next;
  });
}
