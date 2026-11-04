import type { DeliverableStatus } from "@/generated/prisma/client";

export type DeliverableTransition =
  | { ok: true; nextStatus: DeliverableStatus }
  | { ok: false; reason: string };

export function transitionDeliverable(
  current: DeliverableStatus,
  requested: "SUBMITTED" | "APPROVED" | "CHANGES_REQUESTED",
): DeliverableTransition {
  if (current === "DRAFT" && requested === "SUBMITTED") {
    return { ok: true, nextStatus: "SUBMITTED" };
  }

  if (current === "SUBMITTED" && requested === "APPROVED") {
    return { ok: true, nextStatus: "APPROVED" };
  }

  if (current === "SUBMITTED" && requested === "CHANGES_REQUESTED") {
    return { ok: true, nextStatus: "CHANGES_REQUESTED" };
  }

  return {
    ok: false,
    reason: `Cannot move a deliverable from ${current} to ${requested}.`,
  };
}
