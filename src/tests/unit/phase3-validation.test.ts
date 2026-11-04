import { describe, expect, it } from "vitest";
import { projectInputSchema, taskInputSchema, milestoneInputSchema } from "@/lib/validations/phase3";

describe("Phase 3 validation", () => {
  it("rejects a project due date before its start date", () => {
    const result = projectInputSchema.safeParse({ name: "Website", clientId: "clxxxxxxxxxxxxxxxxxxxxxxxxx", startDate: "2026-11-10", dueDate: "2026-11-09", memberIds: [] });
    expect(result.success).toBe(false);
  });
  it("accepts a project without an optional budget", () => {
    const result = projectInputSchema.safeParse({ name: "Website", clientId: "clxxxxxxxxxxxxxxxxxxxxxxxxx", startDate: "2026-11-09", dueDate: "2026-11-10", memberIds: [] });
    expect(result.success).toBe(true);
  });
  it("rejects invalid task status and priority", () => {
    const result = taskInputSchema.safeParse({ projectId: "clxxxxxxxxxxxxxxxxxxxxxxxxx", title: "Build UI", status: "BLOCKED", priority: "CRITICAL" });
    expect(result.success).toBe(false);
  });
  it("accepts ordered milestone states", () => {
    const result = milestoneInputSchema.safeParse({ projectId: "clxxxxxxxxxxxxxxxxxxxxxxxxx", name: "Design", status: "IN_PROGRESS", position: 2 });
    expect(result.success).toBe(true);
  });
});
