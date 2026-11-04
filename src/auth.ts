import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import argon2 from "argon2";
import { z } from "zod";
import { authConfig } from "@/auth.config";
import { getPrisma } from "@/lib/prisma";
import { consumeRateLimit } from "@/server/services/rate-limit";

const credentialsSchema = z.object({
  email: z.string().trim().email().max(254).transform((value) => value.toLowerCase()),
  password: z.string().min(1).max(128),
});

export const { handlers, auth, signIn, signOut } = NextAuth({
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

        const user = await getPrisma().user.findUnique({
          where: { email: parsed.data.email },
          select: { id: true, name: true, email: true, passwordHash: true },
        });
        if (!user) return null;

        const matches = await argon2.verify(user.passwordHash, parsed.data.password);
        if (!matches) return null;
        return { id: user.id, name: user.name, email: user.email };
      },
    }),
  ],
  callbacks: {
    ...authConfig.callbacks,
    async jwt({ token, user }) {
      const userId = user?.id ?? token.userId ?? token.sub;
      if (!userId) return token;

      const prisma = getPrisma();
      const account = await prisma.user.findUnique({
        where: { id: userId },
        select: {
          id: true,
          activeWorkspaceId: true,
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

      const membership =
        account?.memberships.find((item) => item.workspaceId === account.activeWorkspaceId) ??
        account?.memberships[0] ??
        null;
      const client = membership ? null : account?.clientProfiles[0] ?? null;

      if (account && membership && account.activeWorkspaceId !== membership.workspaceId) {
        await prisma.user.update({
          where: { id: account.id },
          data: { activeWorkspaceId: membership.workspaceId },
        });
      }

      token.userId = userId;
      token.workspaceId = membership?.workspaceId ?? client?.workspaceId ?? null;
      token.role = membership?.role ?? (client ? "CLIENT" : null);
      token.clientId = client?.id ?? null;
      return token;
    },
  },
});
