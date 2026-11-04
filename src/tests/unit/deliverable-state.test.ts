import { describe, expect, it } from "vitest";
import { transitionDeliverable, type DeliverableEvent } from "@/server/services/deliverable-state";
import type { DeliverableStatus } from "@/generated/prisma/client";

const states: DeliverableStatus[] = ["DRAFT", "SUBMITTED", "APPROVED", "CHANGES_REQUESTED"];
const events: DeliverableEvent[] = ["SUBMIT", "APPROVE", "REQUEST_CHANGES"];

describe("deliverable state machine", () => {
  it.each([
    ["DRAFT", "SUBMIT", "SUBMITTED"],
    ["SUBMITTED", "APPROVE", "APPROVED"],
    ["SUBMITTED", "REQUEST_CHANGES", "CHANGES_REQUESTED"],
  ] as const)("allows %s + %s -> %s", (state, event, expected) => {
    expect(transitionDeliverable(state, event)).toEqual({ ok: true, nextStatus: expected });
  });

  it.each(states.flatMap(state => events.map(event => [state, event] as const))
    .filter(([state, event]) => !(
      (state === "DRAFT" && event === "SUBMIT") ||
      (state === "SUBMITTED" && (event === "APPROVE" || event === "REQUEST_CHANGES"))
    )))("rejects %s + %s", (state, event) => {
      const result = transitionDeliverable(state, event);
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.reason).toContain(state);
    });
});
