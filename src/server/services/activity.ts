import "server-only";

import type { Prisma, ActivityAction } from "@/generated/prisma/client";

type ActivityInput = {
  workspaceId: string;
  actorId: string;
  action: ActivityAction;
  entityType: string;
  entityId: string;
  metadata?: Prisma.InputJsonValue;
};

/**
 * Use this helper with the transaction client passed by a service.
 * Activity creation therefore commits or rolls back with the mutation.
 */
export async function writeActivity(
  tx: Prisma.TransactionClient,
  input: ActivityInput,
) {
  return tx.activity.create({
    data: {
      workspaceId: input.workspaceId,
      actorId: input.actorId,
      action: input.action,
      entityType: input.entityType,
      entityId: input.entityId,
      metadata: input.metadata,
    },
  });
}
