import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import argon2 from "argon2";
import { z } from "zod";
import { getPrisma } from "@/lib/prisma";

const credentialsSchema = z.object({
  email: z.string().trim().email().max(254),
  password: z.string().min(1).max(128),
});

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(rawCredentials) {
        const parsed = credentialsSchema.safeParse(rawCredentials);
        if (!parsed.success) return null;

        const prisma = getPrisma();
        const user = await prisma.user.findUnique({
          where: { email: parsed.data.email.toLowerCase() },
          select: { id: true, name: true, email: true, passwordHash: true },
        });

        if (!user) return null;

        const passwordMatches = await argon2.verify(
          user.passwordHash,
          parsed.data.password,
        );

        if (!passwordMatches) return null;

        return { id: user.id, name: user.name, email: user.email };
      },
    }),
  ],
  secret: process.env.AUTH_SECRET,
  trustHost: true,
  session: { strategy: "jwt" },
  callbacks: {
    async jwt({ token, user }) {
      if (user?.id) {
        const prisma = getPrisma();
        const membership = await prisma.workspaceMember.findFirst({
          where: { userId: user.id },
          orderBy: { createdAt: "asc" },
          select: { workspaceId: true, role: true },
        });
        const client = await prisma.client.findFirst({
          where: { userId: user.id },
          select: { id: true, workspaceId: true },
        });

        token.userId = user.id;
        token.workspaceId = membership?.workspaceId ?? client?.workspaceId ?? null;
        token.role = membership?.role ?? (client ? "CLIENT" : null);
        token.clientId = client?.id ?? null;
      }

      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = String(token.userId ?? token.sub ?? "");
        session.user.workspaceId =
          typeof token.workspaceId === "string" ? token.workspaceId : null;
        session.user.role =
          typeof token.role === "string" ? token.role : null;
        session.user.clientId =
          typeof token.clientId === "string" ? token.clientId : null;
      }
      return session;
    },
  },
});
