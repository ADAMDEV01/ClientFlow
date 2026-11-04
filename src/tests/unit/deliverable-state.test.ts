import { describe, expect, it } from "vitest";
import { transitionDeliverable } from "@/server/services/deliverable-state";

describe("deliverable state machine", () => {
  it.each([
    ["DRAFT", "SUBMITTED", true],
    ["CHANGES_REQUESTED", "SUBMITTED", false],
    ["SUBMITTED", "APPROVED", true],
    ["SUBMITTED", "CHANGES_REQUESTED", true],
    ["DRAFT", "APPROVED", false],
    ["APPROVED", "SUBMITTED", false],
    ["APPROVED", "CHANGES_REQUESTED", false],
  ] as const)("handles %s -> %s", (current, requested, allowed) => {
    expect(transitionDeliverable(current, requested).ok).toBe(allowed);
  });
});
