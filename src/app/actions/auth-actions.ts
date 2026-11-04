"use server";

import { randomUUID } from "node:crypto";
import argon2 from "argon2";
import { AuthError } from "next-auth";
import { redirect } from "next/navigation";
import { signIn, signOut } from "@/auth";
import { getPrisma } from "@/lib/prisma";
import { loginSchema, registerSchema } from "@/lib/validations/auth";
import { consumeRateLimit } from "@/server/services/rate-limit";

export type FormState = { error?: string; success?: string };

function workspaceSlug(name: string) {
  const base = name.toLowerCase().normalize("NFKD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 36) || "workspace";
  return `${base}-${randomUUID().slice(0, 6)}`;
}

export async function registerAction(
  _previousState: FormState,
  formData: FormData,
): Promise<FormState> {
  const parsed = registerSchema.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
    password: formData.get("password"),
    workspaceName: formData.get("workspaceName"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Check your details." };
  }

  const allowed = await consumeRateLimit(`register:${parsed.data.email}`, 5, 60 * 60);
  if (!allowed) return { error: "Too many registration attempts. Try again later." };

  const prisma = getPrisma();
  const passwordHash = await argon2.hash(parsed.data.password, { type: argon2.argon2id });

  try {
    await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: { name: parsed.data.name, email: parsed.data.email, passwordHash },
        select: { id: true },
      });
      const workspace = await tx.workspace.create({
        data: {
          name: parsed.data.workspaceName,
          slug: workspaceSlug(parsed.data.workspaceName),
          ownerId: user.id,
        },
        select: { id: true },
      });
      await tx.workspaceMember.create({
        data: { workspaceId: workspace.id, userId: user.id, role: "OWNER" },
      });
      await tx.user.update({
        where: { id: user.id },
        data: { activeWorkspaceId: workspace.id },
      });
      await tx.activity.create({
        data: {
          workspaceId: workspace.id,
          actorId: user.id,
          action: "CREATED",
          entityType: "Workspace",
          entityId: workspace.id,
          metadata: { source: "registration" },
        },
      });
    });
  } catch (error) {
    if (typeof error === "object" && error !== null && "code" in error && error.code === "P2002") {
      return { error: "An account with this email already exists." };
    }
    return { error: "We could not create your account. Please try again." };
  }

  try {
    await signIn("credentials", {
      email: parsed.data.email,
      password: parsed.data.password,
      redirectTo: "/app",
    });
  } catch (error) {
    if (error instanceof AuthError) {
      return { error: "Your account was created. Please sign in." };
    }
    throw error;
  }
  return { success: "Account created." };
}

export async function loginAction(
  _previousState: FormState,
  formData: FormData,
): Promise<FormState> {
  const parsed = loginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) return { error: "Enter a valid email and password." };

  try {
    await signIn("credentials", {
      email: parsed.data.email,
      password: parsed.data.password,
      redirectTo: (() => { const next = String(formData.get("next") ?? ""); return next.startsWith("/") && !next.startsWith("//") ? next : "/app"; })(),
    });
  } catch (error) {
    if (error instanceof AuthError) {
      return { error: "Invalid email or password, or too many attempts." };
    }
    throw error;
  }
  return {};
}

export async function logoutAction() {
  await signOut({ redirectTo: "/" });
}
