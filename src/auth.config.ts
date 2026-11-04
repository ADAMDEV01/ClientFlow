import type { NextAuthConfig } from "next-auth";

export const authConfig = {
  secret: process.env.AUTH_SECRET,
  trustHost: true,
  session: { strategy: "jwt" },
  pages: { signIn: "/login" },
  providers: [],
  callbacks: {
    async session({ session, token }) {
      if (session.user) {
        session.user.id = String(token.userId ?? token.sub ?? "");
        session.user.userId = String(token.userId ?? token.sub ?? "");
        session.user.workspaceId =
          typeof token.workspaceId === "string" ? token.workspaceId : null;
        session.user.activeWorkspaceId =
          typeof token.activeWorkspaceId === "string" ? token.activeWorkspaceId : null;
        session.user.role =
          token.role === "OWNER" || token.role === "ADMIN" ||
          token.role === "MEMBER" || token.role === "CLIENT"
            ? token.role
            : null;
        session.user.clientId =
          typeof token.clientId === "string" ? token.clientId : null;
      }
      return session;
    },
  },
} satisfies NextAuthConfig;
