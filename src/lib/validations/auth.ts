import { z } from "zod";

export const registerSchema = z.object({
  name: z.string().trim().min(2).max(80),
  email: z.string().trim().email().max(254).transform((value) => value.toLowerCase()),
  password: z.string().min(12, "Use at least 12 characters.").max(128),
  workspaceName: z.string().trim().min(2, "Workspace name must be at least 2 characters.").max(80),
});

export const loginSchema = z.object({
  email: z.string().trim().email().max(254).transform((value) => value.toLowerCase()),
  password: z.string().min(1).max(128),
});

export const switchWorkspaceSchema = z.object({
  workspaceId: z.string().cuid(),
});
