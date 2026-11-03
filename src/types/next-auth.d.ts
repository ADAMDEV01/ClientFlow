import type { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      workspaceId: string | null;
      role: "OWNER" | "ADMIN" | "MEMBER" | "CLIENT" | null;
      clientId: string | null;
    } & DefaultSession["user"];
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    userId?: string;
    workspaceId?: string | null;
    role?: "OWNER" | "ADMIN" | "MEMBER" | "CLIENT" | null;
    clientId?: string | null;
  }
}
