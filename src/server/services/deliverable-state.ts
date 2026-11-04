import type { DeliverableStatus } from "@/generated/prisma/client";

export type DeliverableEvent = "SUBMIT" | "APPROVE" | "REQUEST_CHANGES";
export type DeliverableTransition =
  | { ok: true; nextStatus: DeliverableStatus }
  | { ok: false; reason: string };

const transitions: Record<DeliverableStatus, Partial<Record<DeliverableEvent, DeliverableStatus>>> = {
  DRAFT: { SUBMIT: "SUBMITTED" },
  SUBMITTED: { APPROVE: "APPROVED", REQUEST_CHANGES: "CHANGES_REQUESTED" },
  APPROVED: {},
  CHANGES_REQUESTED: {},
};

export function transitionDeliverable(current: DeliverableStatus, event: DeliverableEvent): DeliverableTransition {
  const nextStatus = transitions[current][event];
  return nextStatus
    ? { ok: true, nextStatus }
    : { ok: false, reason: `Event ${event} is not allowed while deliverable is ${current}.` };
}
