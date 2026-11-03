import NextAuth from "next-auth";

// Credentials verification and database-backed user lookup are implemented in Phase 2.
// Keep session strategy explicit so the Credentials provider can use JWT sessions.
export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [],
  session: { strategy: "jwt" },
});
