import { z } from "zod";

const id = z.string().cuid();
const optionalDate = z.union([z.literal(""), z.coerce.date()]).optional().transform(v => v || undefined);

export const clientInputSchema = z.object({
  name: z.string().trim().min(2).max(120),
  email: z.string().trim().email().max(254).transform(v => v.toLowerCase()),
  company: z.string().trim().max(120).optional(),
  phone: z.string().trim().max(40).optional(),
  notes: z.string().trim().max(2000).optional(),
});

export const projectInputSchema = z.object({
  name: z.string().trim().min(2).max(120),
  description: z.string().trim().max(5000).optional(),
  clientId: id,
  startDate: optionalDate,
  dueDate: optionalDate,
  budget: z.union([z.literal(""), z.coerce.number().finite().nonnegative().max(9999999999.99)]).optional().transform(v => v === "" ? undefined : v),
  memberIds: z.array(id).max(100).default([]),
}).superRefine((v, ctx) => {
  if (v.startDate && v.dueDate && v.dueDate < v.startDate) ctx.addIssue({ code: "custom", path: ["dueDate"], message: "Due date must be on or after the start date." });
});

export const milestoneInputSchema = z.object({
  projectId: id,
  name: z.string().trim().min(2).max(120),
  description: z.string().trim().max(3000).optional(),
  dueDate: optionalDate,
  status: z.enum(["PENDING", "IN_PROGRESS", "COMPLETED"]).default("PENDING"),
  position: z.number().int().min(0).optional(),
});

export const taskInputSchema = z.object({
  projectId: id,
  milestoneId: id.optional(),
  assigneeId: id.optional(),
  title: z.string().trim().min(2).max(160),
  description: z.string().trim().max(5000).optional(),
  priority: z.enum(["LOW", "MEDIUM", "HIGH", "URGENT"]).default("MEDIUM"),
  dueDate: optionalDate,
  status: z.enum(["TODO", "IN_PROGRESS", "IN_REVIEW", "DONE"]).default("TODO"),
  visibleToClient: z.boolean().default(false),
});

export const roleChangeSchema = z.object({ memberId: id, role: z.enum(["OWNER", "ADMIN", "MEMBER"]) });
export const memberRemovalSchema = z.object({ memberId: id });
