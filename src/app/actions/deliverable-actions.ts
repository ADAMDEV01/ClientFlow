"use server";

import { revalidatePath } from "next/cache";
import { requireClientAccess, requireRole } from "@/server/authz";
import { getPrisma } from "@/lib/prisma";
import { actionFailure, actionSuccess, type ActionResult } from "@/server/action-result";
import {
  createDeliverable,
  createNextDeliverableVersion,
  decideDeliverable,
  submitDeliverable,
} from "@/server/services/deliverable-service";

function failure(error: unknown) {
  return actionFailure(
    error instanceof Error ? error.name : "INTERNAL_ERROR",
    error instanceof Error ? error.message : "Something went wrong.",
  );
}

export async function submitClientReviewAction(formData: FormData): Promise<void> {
  try {
    const workspaceId = String(formData.get("workspaceId") ?? "");
    const deliverableId = String(formData.get("deliverableId") ?? "");
    const expectedRevision = Number(formData.get("expectedRevision"));
    const decision = String(formData.get("decision") ?? "");
    const feedback = String(formData.get("feedback") ?? "");

    if (!workspaceId || !deliverableId || !Number.isInteger(expectedRevision)) {
      throw new Error("Invalid review details.");
    }
    if (decision !== "APPROVED" && decision !== "CHANGES_REQUESTED") {
      throw new Error("Choose a valid review decision.");
    }
    if (decision === "CHANGES_REQUESTED" && !feedback.trim()) {
      throw new Error("Feedback is required when requesting changes.");
    }

    const prisma = getPrisma();
    const deliverable = await prisma.deliverable.findFirst({
      where: { id: deliverableId, workspaceId },
      select: { projectId: true },
    });
    if (!deliverable) throw new Error("Deliverable not found.");

    const { user } = await requireClientAccess(workspaceId, deliverable.projectId);
    if (!user.clientId) throw new Error("Client account required.");

    await decideDeliverable({
      workspaceId,
      deliverableId,
      expectedRevision,
      decision,
      feedback,
    }, user.id, user.clientId);
    revalidatePath(`/portal/${deliverable.projectId}`);
  } catch (error) {
    throw new Error(error instanceof Error ? error.message : "Review failed.");
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

export async function createDeliverableAction(
  workspaceId: string,
  input: unknown,
): Promise<ActionResult<Awaited<ReturnType<typeof createDeliverable>>>> {
  try {
    const { user } = await requireRole(workspaceId, ["OWNER", "ADMIN", "MEMBER"]);
    return actionSuccess(await createDeliverable(workspaceId, user.id, input));
  } catch (error) {
    return failure(error);
  }
}

export async function submitDeliverableAction(
  workspaceId: string,
  deliverableId: string,
  expectedRevision: number,
): Promise<ActionResult<Awaited<ReturnType<typeof submitDeliverable>>>> {
  try {
    const { user } = await requireRole(workspaceId, ["OWNER", "ADMIN", "MEMBER"]);
    return actionSuccess(
      await submitDeliverable(workspaceId, user.id, deliverableId, expectedRevision),
    );
  } catch (error) {
    return failure(error);
  }
}

export type DeliverableFormState = { error?: string; success?: string; deliverableId?: string };

export async function createDeliverableFormAction(
  _previousState: DeliverableFormState,
  formData: FormData,
): Promise<DeliverableFormState> {
  const workspaceId = String(formData.get("workspaceId") ?? "");
  const result = await createDeliverableAction(workspaceId, {
    projectId: formData.get("projectId"),
    name: formData.get("name"),
    description: formData.get("description") || undefined,
  });
  return result.ok ? { success: "Deliverable draft created." } : { error: result.error.message };
}

export async function submitDeliverableFormAction(
  _previousState: DeliverableFormState,
  formData: FormData,
): Promise<DeliverableFormState> {
  const workspaceId = String(formData.get("workspaceId") ?? "");
  const deliverableId = String(formData.get("deliverableId") ?? "");
  const expectedRevision = Number(formData.get("expectedRevision"));
  const result = await submitDeliverableAction(workspaceId, deliverableId, expectedRevision);
  return result.ok ? { success: "Deliverable submitted for client review." } : { error: result.error.message };
}

export async function createNextVersionFormAction(
  _previousState: DeliverableFormState,
  formData: FormData,
): Promise<DeliverableFormState> {
  const workspaceId = String(formData.get("workspaceId") ?? "");
  const deliverableId = String(formData.get("deliverableId") ?? "");
  const result = await createNextDeliverableVersionAction(workspaceId, deliverableId);
  return result.ok ? { success: `Created draft version ${result.data.version}. Upload its updated file below.`, deliverableId: result.data.id } : { error: result.error.message };
}
