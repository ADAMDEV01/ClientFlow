import "server-only";

export type DeliverableNotificationEvent = "SUBMITTED" | "APPROVED" | "CHANGES_REQUESTED" | "COMMENTED";

export async function notifyDeliverable(input: {
  event: DeliverableNotificationEvent;
  workspaceId: string;
  deliverableId: string;
  version: number;
  actorId: string;
}) {
  // Provider adapter stub; replace with email or in-app delivery later.
  console.info("[ClientFlow notification stub]", { ...input, emittedAt: new Date().toISOString() });
}
