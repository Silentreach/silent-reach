// Mintflow auth gate (replaces Basic Auth).
//
// Behavior:
//   * Refreshes Supabase session cookie on every request.
//   * Public routes (login, auth callback, invite redemption, static assets)
//     pass through unauthenticated.
//   * Everything else requires a signed-in user — anonymous visitors are
//     redirected to /login.
//
// Note on backwards compat: BASIC_AUTH_USER/BASIC_AUTH_PASS env vars are
// IGNORED now. Remove them from Vercel after Supabase auth is verified live.

import { NextResponse, type NextRequest } from "next/server";
import { updateSession } from "./lib/supabase/middleware";

const PUBLIC_ROUTES = [
  "/login",
  "/auth/callback",
  "/auth/error",
  "/invite",          // /invite/[code] — invite landing page
];

function isPublicRoute(pathname: string): boolean {
  return PUBLIC_ROUTES.some((p) => pathname === p || pathname.startsWith(p + "/"));
}

export async function middleware(request: NextRequest) {
  const { response, user } = await updateSession(request);
  const { pathname } = request.nextUrl;

  // Public routes pass through.
  if (isPublicRoute(pathname)) return response;

  // Anonymous visitors → /login (preserve return path).
  if (!user) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    if (pathname !== "/") url.searchParams.set("redirect", pathname);
    return NextResponse.redirect(url);
  }

  return response;
}

// Run on every page + API route except Next internals & static assets.
export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|logo.svg|public/).*)",
  ],
};
