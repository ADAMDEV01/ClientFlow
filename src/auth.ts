import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import argon2 from "argon2";
import { z } from "zod";
import { authConfig } from "@/auth.config";
import { getPrisma } from "@/lib/prisma";
import { consumeRateLimit } from "@/server/services/rate-limit";

const AUTH_CONTEXT_REFRESH_INTERVAL = 60_000;

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
        if (!account) return null;

        const matches = await argon2.verify(account.passwordHash, parsed.data.password);
        if (!matches) return null;
        return { id: account.id, name: account.name, email: account.email };
      },
    }),
  ],
  callbacks: {
    ...authConfig.callbacks,
    async jwt({ token, user, trigger }) {
      const lastContextRefresh =
        typeof token.authContextUpdatedAt === "number" ? token.authContextUpdatedAt : 0;
      const shouldRefresh =
        Boolean(user?.id) ||
        trigger === "update" ||
        Date.now() - lastContextRefresh >= AUTH_CONTEXT_REFRESH_INTERVAL;

      // Keep workspace and role claims in the JWT between refreshes instead of
      // adding a database round trip to every authenticated page request.
      if (!shouldRefresh) return token;

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
      token.authContextUpdatedAt = Date.now();
      return token;
    },
  },
});
