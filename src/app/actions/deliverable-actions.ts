"use server";

import { requireClientAccess, requireRole } from "@/server/authz";
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

export async function decideDeliverableAction(
  input: unknown,
): Promise<ActionResult<Awaited<ReturnType<typeof decideDeliverable>>>> {
  try {
    if (
      typeof input !== "object" ||
      input === null ||
      !("workspaceId" in input) ||
      !("deliverableId" in input) ||
      typeof input.workspaceId !== "string" ||
      typeof input.deliverableId !== "string"
    ) {
      return actionFailure("VALIDATION_ERROR", "Invalid deliverable review input.");
    }

    const { user, project } = await requireClientAccess(
      input.workspaceId,
      // The service checks the deliverable and its current submitted state.
      // Resolve its project before passing the client-owned identity onward.
      await (async () => {
        const { getPrisma } = await import("@/lib/prisma");
        const record = await getPrisma().deliverable.findFirst({
          where: {
            id: input.deliverableId,
            workspaceId: input.workspaceId,
          },
          select: { projectId: true },
        });
        if (!record) throw new Error("Deliverable not found.");
        return record.projectId;
      })(),
    );

    return actionSuccess(
      await decideDeliverable(input, user.id, user.clientId ?? project.clientId),
    );
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
