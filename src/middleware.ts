import NextAuth from "next-auth";
import { NextResponse } from "next/server";
import { authConfig } from "@/auth.config";

const { auth: withAuth } = NextAuth(authConfig);

export default withAuth((request) => {
  const pathname = request.nextUrl.pathname;
  const user = request.auth?.user;

  if (!user?.id) {
    const loginUrl = new URL("/login", request.nextUrl);
    loginUrl.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(loginUrl);
  }

  if (pathname.startsWith("/app") && user.role === "CLIENT") {
    return NextResponse.redirect(new URL("/portal", request.nextUrl));
  }

  if (pathname.startsWith("/portal") && user.role !== "CLIENT") {
    return NextResponse.redirect(new URL("/app", request.nextUrl));
  }

  return NextResponse.next();
});

export const config = {
  matcher: ["/app/:path*", "/portal/:path*"],
};
