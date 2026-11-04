import { z } from "zod";

export const cuidSchema = z.string().cuid();
export const workspaceIdSchema = cuidSchema;
export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

export const createWorkspaceSchema = z.object({
  name: z.string().trim().min(2).max(80),
  slug: z.string().trim().toLowerCase().min(3).max(48)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
});

export const createClientSchema = z.object({
  name: z.string().trim().min(2).max(120),
  email: z.string().trim().email().max(254).transform((value) => value.toLowerCase()),
  company: z.string().trim().max(120).optional(),
  phone: z.string().trim().max(40).optional(),
  notes: z.string().trim().max(2000).optional(),
});

export const createProjectSchema = z.object({
  clientId: cuidSchema,
  name: z.string().trim().min(2).max(120),
  description: z.string().trim().max(5000).optional(),
  dueDate: z.coerce.date().optional(),
});

export const createTaskSchema = z.object({
  projectId: cuidSchema,
  milestoneId: cuidSchema.optional(),
  assigneeId: cuidSchema.optional(),
  title: z.string().trim().min(2).max(160),
  description: z.string().trim().max(5000).optional(),
  visibleToClient: z.boolean().default(false),
  dueDate: z.coerce.date().optional(),
});

export const deliverableDecisionSchema = z.object({
  workspaceId: cuidSchema,
  deliverableId: cuidSchema,
  expectedRevision: z.number().int().nonnegative(),
  decision: z.enum(["APPROVED", "CHANGES_REQUESTED"]),
  feedback: z.string().trim().max(4000).optional(),
}).superRefine((value, context) => {
  if (value.decision === "CHANGES_REQUESTED" && !value.feedback?.trim()) {
    context.addIssue({
      code: "custom",
      path: ["feedback"],
      message: "Feedback is required when requesting changes.",
    });
  }
});

export const createMilestoneSchema = z.object({
  projectId: cuidSchema,
  name: z.string().trim().min(2).max(120),
  description: z.string().trim().max(3000).optional(),
  dueDate: z.coerce.date().optional(),
});

export const createDeliverableSchema = z.object({
  projectId: cuidSchema,
  name: z.string().trim().min(2).max(160),
  description: z.string().trim().max(3000).optional(),
  fileKey: z.string().min(1).max(500).optional(),
  fileName: z.string().trim().min(1).max(255).optional(),
  mimeType: z.string().min(1).max(120).optional(),
  sizeBytes: z.number().int().positive().max(15 * 1024 * 1024).optional(),
});

export const createInvitationSchema = z.object({
  email: z.string().trim().email().max(254).transform((value) => value.toLowerCase()),
  role: z.enum(["ADMIN", "MEMBER"]).default("MEMBER"),
});

export const taskStatusSchema = z.object({
  taskId: cuidSchema,
  status: z.enum(["TODO", "IN_PROGRESS", "IN_REVIEW", "DONE"]),
});

export const clientPortalInvitationSchema = z.object({
  clientId: cuidSchema,
});

export const clientPortalRegistrationSchema = z.object({
  name: z.string().trim().min(2).max(80),
  password: z.string().min(12, "Use at least 12 characters.").max(128),
});
