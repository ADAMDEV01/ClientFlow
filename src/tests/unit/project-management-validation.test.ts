import { describe, expect, it } from "vitest";
import { clientInputSchema, milestoneInputSchema, projectInputSchema, roleChangeSchema, taskInputSchema } from "@/lib/validations/project-management";

const cuid = "c123456789012345678901234";

describe("project management validation", () => {
  it("normalizes client email and trims names", () => {
    expect(clientInputSchema.parse({ name: "  Acme  ", email: " SALES@ACME.COM " })).toMatchObject({ name: "Acme", email: "sales@acme.com" });
  });
  it("rejects invalid client email and oversized fields", () => {
    expect(clientInputSchema.safeParse({ name: "A", email: "not-an-email" }).success).toBe(false);
    expect(clientInputSchema.safeParse({ name: "Valid name", email: "a@b.com", notes: "x".repeat(2001) }).success).toBe(false);
  });
  it("rejects a project due date before its start date", () => {
    const result = projectInputSchema.safeParse({ name: "Website", clientId: cuid, memberIds: [], startDate: "2026-05-10", dueDate: "2026-05-09" });
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error.issues.some(issue => issue.path.includes("dueDate"))).toBe(true);
  });
  it("rejects negative budgets and invalid member IDs", () => {
    expect(projectInputSchema.safeParse({ name: "Website", clientId: cuid, memberIds: [], budget: -1 }).success).toBe(false);
    expect(projectInputSchema.safeParse({ name: "Website", clientId: cuid, memberIds: ["not-a-cuid"] }).success).toBe(false);
  });
  it("validates milestone status and non-negative ordering", () => {
    const base = { projectId: cuid, name: "Design" };
    expect(milestoneInputSchema.safeParse({ ...base, status: "UNKNOWN" }).success).toBe(false);
    expect(milestoneInputSchema.safeParse({ ...base, position: -1 }).success).toBe(false);
  });
  it("validates task status, priority and client visibility", () => {
    const base = { projectId: cuid, title: "Implement login" };
    expect(taskInputSchema.parse({ ...base, visibleToClient: true })).toMatchObject({ status: "TODO", priority: "MEDIUM", visibleToClient: true });
    expect(taskInputSchema.safeParse({ ...base, status: "CANCELLED" }).success).toBe(false);
    expect(taskInputSchema.safeParse({ ...base, priority: "CRITICAL" }).success).toBe(false);
  });
  it("accepts only known workspace roles", () => {
    expect(roleChangeSchema.safeParse({ memberId: cuid, role: "OWNER" }).success).toBe(true);
    expect(roleChangeSchema.safeParse({ memberId: cuid, role: "CLIENT" }).success).toBe(false);
  });
});
