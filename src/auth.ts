import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import argon2 from "argon2";
import { z } from "zod";
import { authConfig } from "@/auth.config";
import { getPrisma } from "@/lib/prisma";
import { consumeRateLimit } from "@/server/services/rate-limit";

// A valid Argon2id hash used to keep unknown-email login attempts on the same
// expensive verification path as known users. It is not a credential.
const DUMMY_PASSWORD_HASH =
  "$argon2id$v=19$m=65536,t=3,p=4$Az7Tujw2El+hbx/snBZ5Ag$x5mB81OGMs6T3T6ADFYGPTY6cx2DQ563pfF8I48up3s";

export async function verifyCredentialsPassword(
  password: string,
  storedHash: string | null,
): Promise<boolean> {
  const matches = await argon2.verify(storedHash ?? DUMMY_PASSWORD_HASH, password);
  return storedHash !== null && matches;
}

const credentialsSchema = z.object({
  email: z.string().trim().email().max(254).transform((value) => value.toLowerCase()),
  password: z.string().min(1).max(128),
});

export const { handlers, auth, signIn, signOut, unstable_update: updateSession } = NextAuth({
  ...authConfig,
  providers: [
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(rawCredentials) {
        const parsed = credentialsSchema.safeParse(rawCredentials);
        if (!parsed.success) return null;
        const allowed = await consumeRateLimit(`login:${parsed.data.email}`, 8, 15 * 60);
        if (!allowed) return null;

        const account = await getPrisma().user.findUnique({
          where: { email: parsed.data.email },
          select: { id: true, name: true, email: true, passwordHash: true },
        });
        const matches = await verifyCredentialsPassword(
          parsed.data.password,
          account?.passwordHash ?? null,
        );
        if (!account || !matches) return null;
        return { id: account.id, name: account.name, email: account.email };
      },
    }),
  ],
  callbacks: {
    ...authConfig.callbacks,
    async jwt({ token, user, trigger }) {
      // Server Components can read a refreshed JWT but cannot reliably persist
      // its Set-Cookie header. Refresh context only on sign-in or an explicit
      // session update, avoiding repeat database reads on page navigation.
      if (!user?.id && trigger !== "update") return token;

      const userId =
        typeof user?.id === "string" ? user.id :
        typeof token.userId === "string" ? token.userId :
        typeof token.sub === "string" ? token.sub : null;
      if (!userId) return token;

      const prisma = getPrisma();
      const account = await prisma.user.findUnique({
        where: { id: userId },
        include: {
          memberships: {
            orderBy: { createdAt: "asc" },
            select: { workspaceId: true, role: true },
          },
          clientProfiles: {
            take: 1,
            orderBy: { createdAt: "asc" },
            select: { id: true, workspaceId: true },
          },
        },
      });

      if (!account) return null;

      const membership =
        account.memberships.find((item) => item.workspaceId === account.activeWorkspaceId) ??
        account?.memberships[0] ??
        null;
      const client = membership ? null : account.clientProfiles[0] ?? null;

      if (account && membership && account.activeWorkspaceId !== membership.workspaceId) {
        await prisma.user.update({
          where: { id: account.id },
          data: { activeWorkspaceId: membership.workspaceId },
        });
      }

      token.userId = userId;
      token.workspaceId = membership?.workspaceId ?? client?.workspaceId ?? null;
      token.activeWorkspaceId = membership?.workspaceId ?? null;
      token.role = membership?.role ?? (client ? "CLIENT" : null);
      token.clientId = client?.id ?? null;
      return token;
    },
  },
});
