import NextAuth from "next-auth";
import { NextResponse } from "next/server";
import { authConfig } from "@/auth.config";

const { auth: withAuth } = NextAuth(authConfig);

function createNonce() {
  return btoa(crypto.randomUUID());
}

function createCsp(nonce: string) {
  const development = process.env.NODE_ENV !== "production";
  return [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${development ? " 'unsafe-eval'" : ""}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob: https:",
    "font-src 'self' data:",
    "connect-src 'self' https: wss:",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    ...(development ? [] : ["upgrade-insecure-requests"]),
  ].join("; ");
}

export default withAuth((request) => {
  const nonce = createNonce();
  const contentSecurityPolicy = createCsp(nonce);
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set("Content-Security-Policy", contentSecurityPolicy);

  const pathname = request.nextUrl.pathname;
  const user = request.auth?.user;
  let response: NextResponse;

  if ((pathname.startsWith("/app") || pathname.startsWith("/portal")) && !user?.id) {
    const loginUrl = new URL("/login", request.nextUrl);
    loginUrl.searchParams.set("callbackUrl", pathname);
    response = NextResponse.redirect(loginUrl);
  } else if (pathname.startsWith("/app") && user?.role === "CLIENT") {
    response = NextResponse.redirect(new URL("/portal", request.nextUrl));
  } else if (pathname.startsWith("/portal") && user?.role !== "CLIENT") {
    response = NextResponse.redirect(new URL("/app", request.nextUrl));
  } else {
    response = NextResponse.next({ request: { headers: requestHeaders } });
  }

  response.headers.set("Content-Security-Policy", contentSecurityPolicy);
  response.headers.set("x-nonce", nonce);
  return response;
});

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|.*\\..*).*)"],
};
