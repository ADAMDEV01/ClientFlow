"use server";

import { requireClientAccess, requireRole } from "@/server/authz";
import { getPrisma } from "@/lib/prisma";
import { actionFailure, actionSuccess, type ActionResult } from "@/server/action-result";
import {
  createNextDeliverableVersion,
  decideDeliverable,
} from "@/server/services/deliverable-service";

function failure(error: unknown) {
  return actionFailure(
    error instanceof Error ? error.name : "INTERNAL_ERROR",
    error instanceof Error ? error.message : "Something went wrong.",
  );
}

export async function submitClientReviewAction(
  formData: FormData,
): Promise<ActionResult<{ id: string; status: "APPROVED" | "CHANGES_REQUESTED" }>> {
  try {
    const workspaceId = String(formData.get("workspaceId") ?? "");
    const deliverableId = String(formData.get("deliverableId") ?? "");
    const expectedRevision = Number(formData.get("expectedRevision"));
    const decision = String(formData.get("decision") ?? "");
    const feedback = String(formData.get("feedback") ?? "");

    if (!workspaceId || !deliverableId || !Number.isInteger(expectedRevision)) {
      return actionFailure("VALIDATION_ERROR", "Invalid review details.");
    }
    if (decision !== "APPROVED" && decision !== "CHANGES_REQUESTED") {
      return actionFailure("VALIDATION_ERROR", "Choose a valid review decision.");
    }
    if (decision === "CHANGES_REQUESTED" && !feedback.trim()) {
      return actionFailure("VALIDATION_ERROR", "Feedback is required when requesting changes.");
    }

    const prisma = getPrisma();
    const deliverable = await prisma.deliverable.findFirst({
      where: { id: deliverableId, workspaceId },
      select: { projectId: true },
    });
    if (!deliverable) return actionFailure("NOT_FOUND", "Deliverable not found.");

    const { user } = await requireClientAccess(workspaceId, deliverable.projectId);
    if (!user.clientId) return actionFailure("FORBIDDEN", "Client account required.");

    return actionSuccess(await decideDeliverable({
      workspaceId,
      deliverableId,
      expectedRevision,
      decision,
      feedback,
    }, user.id, user.clientId));
  } catch (error) {
    return failure(error);
  }
}

export async function createNextDeliverableVersionAction(
  workspaceId: string,
  deliverableId: string,
): Promise<ActionResult<Awaited<ReturnType<typeof createNextDeliverableVersion>>>> {
  try {
    const { user } = await requireRole(workspaceId, ["OWNER", "ADMIN", "MEMBER"]);
    return actionSuccess(
      await createNextDeliverableVersion(workspaceId, user.id, deliverableId),
    );
  } catch (error) {
    return failure(error);
  }
}
