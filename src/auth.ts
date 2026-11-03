import NextAuth from "next-auth";

// The Credentials provider will be connected to the persisted User model
// when the authentication and database domain are implemented.
export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [],
  secret: process.env.AUTH_SECRET,
  trustHost: true,
  session: { strategy: "jwt" },
});
