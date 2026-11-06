import "server-only";

import { getPrisma } from "@/lib/prisma";
import { deliverableDecisionSchema } from "@/lib/validations/common";
import { writeActivity } from "@/server/services/activity";
import { transitionDeliverable } from "@/server/services/deliverable-state";

export async function decideDeliverable(
  input: unknown,
  actorId: string,
  clientId: string,
) {
  const data = deliverableDecisionSchema.parse(input);
  const prisma = getPrisma();

  const result = await prisma.$transaction(async (tx) => {
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
    const transition = transitionDeliverable("SUBMITTED", data.decision === "APPROVED" ? "APPROVE" : "REQUEST_CHANGES");
    if (!transition.ok) throw new Error(transition.reason);

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
        reviewerId: actorId,
        version: deliverable.version,
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

    return { id: deliverable.id, status: data.decision, version: deliverable.version };
  });
  return { id: result.id, status: result.status };
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

export async function createDeliverable(
  workspaceId: string,
  actorId: string,
  input: unknown,
) {
  const { createDeliverableSchema } = await import("@/lib/validations/common");
  const data = createDeliverableSchema.parse(input);
  const prisma = getPrisma();

  return prisma.$transaction(async (tx) => {
    const project = await tx.project.findFirst({
      where: { id: data.projectId, workspaceId },
      select: { id: true },
    });
    if (!project) throw new Error("Project not found in this workspace.");

    const deliverable = await tx.deliverable.create({
      data: {
        workspaceId,
        projectId: project.id,
        name: data.name,
        description: data.description,
        fileKey: data.fileKey,
        fileName: data.fileName,
        mimeType: data.mimeType,
        sizeBytes: data.sizeBytes,
        version: 1,
        status: "DRAFT",
      },
      select: { id: true, name: true, version: true, status: true },
    });

    await writeActivity(tx, {
      workspaceId,
      actorId,
      action: "CREATED",
      entityType: "Deliverable",
      entityId: deliverable.id,
      metadata: { projectId: project.id, version: 1 },
    });

    return deliverable;
  });
}

export async function submitDeliverable(
  workspaceId: string,
  actorId: string,
  deliverableId: string,
  expectedRevision: number,
) {
  const prisma = getPrisma();

  const result = await prisma.$transaction(async (tx) => {
    const current = await tx.deliverable.findFirst({
      where: { id: deliverableId, workspaceId },
      select: { status: true, version: true },
    });
    if (!current) throw new Error("Deliverable not found.");
    const transition = transitionDeliverable(current.status, "SUBMIT");
    if (!transition.ok) throw new Error(transition.reason);
    const updated = await tx.deliverable.updateMany({
      where: {
        id: deliverableId,
        workspaceId,
        status: "DRAFT",
        revision: expectedRevision,
      },
      data: {
        status: "SUBMITTED",
        revision: { increment: 1 },
        submittedAt: new Date(),
        decidedAt: null,
      },
    });

    if (updated.count !== 1) {
      throw new Error("Deliverable changed or is not ready for submission.");
    }

    await writeActivity(tx, {
      workspaceId,
      actorId,
      action: "SUBMITTED",
      entityType: "Deliverable",
      entityId: deliverableId,
    });

    return tx.deliverable.findFirstOrThrow({
      where: { id: deliverableId, workspaceId },
      select: { id: true, status: true, revision: true, submittedAt: true, version: true },
    });
  });
  return result;
}

export async function attachFileToDeliverable(
  workspaceId: string,
  actorId: string,
  projectId: string,
  deliverableId: string,
  file: { fileKey: string; fileName: string; mimeType: string; sizeBytes: number },
) {
  const prisma = getPrisma();

  return prisma.$transaction(async (tx) => {
    const draft = await tx.deliverable.findFirst({
      where: {
        id: deliverableId,
        workspaceId,
        projectId,
        status: "DRAFT",
      },
      select: { id: true, fileKey: true },
    });
    if (!draft) throw new Error("Only a draft in this project can receive an upload.");
    if (draft.fileKey) throw new Error("This draft already has a file. Create a new version to replace it.");

    const updated = await tx.deliverable.updateMany({
      where: { id: deliverableId, workspaceId, projectId, status: "DRAFT", fileKey: null },
      data: {
        fileKey: file.fileKey,
        fileName: file.fileName,
        mimeType: file.mimeType,
        sizeBytes: file.sizeBytes,
        revision: { increment: 1 },
      },
    });
    if (updated.count !== 1) throw new Error("Deliverable changed while uploading.");

    await writeActivity(tx, {
      workspaceId,
      actorId,
      action: "UPLOADED",
      entityType: "Deliverable",
      entityId: deliverableId,
      metadata: { sizeBytes: file.sizeBytes, mimeType: file.mimeType },
    });

    return tx.deliverable.findFirstOrThrow({
      where: { id: deliverableId, workspaceId },
      select: { id: true, name: true, version: true, status: true, revision: true },
    });
  });
}
