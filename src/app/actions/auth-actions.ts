"use server";

import argon2 from "argon2";
import { AuthError } from "next-auth";
import { signIn, signOut } from "@/auth";
import { getPrisma } from "@/lib/prisma";
import { registerSchema } from "@/lib/validations/auth";

export type FormState = { error?: string; success?: string };

export async function registerAction(
  _previousState: FormState,
  formData: FormData,
): Promise<FormState> {
  const parsed = registerSchema.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
    password: formData.get("password"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Check your details." };
  }

  const prisma = getPrisma();
  const existing = await prisma.user.findUnique({
    where: { email: parsed.data.email },
    select: { id: true },
  });
  if (existing) return { error: "An account with this email already exists." };

  const passwordHash = await argon2.hash(parsed.data.password, {
    type: argon2.argon2id,
  });

  try {
    await prisma.user.create({
      data: {
        name: parsed.data.name,
        email: parsed.data.email,
        passwordHash,
      },
      select: { id: true },
    });
  } catch {
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
      return { error: "Account created. Please sign in to continue." };
    }
    throw error;
  }

  return { success: "Account created." };
}

export async function loginAction(formData: FormData) {
  await signIn("credentials", {
    email: formData.get("email"),
    password: formData.get("password"),
    redirectTo: "/app",
  });
}

export async function logoutAction() {
  await signOut({ redirectTo: "/" });
}
