// Mintflow auth gate (replaces Basic Auth).
//
// Behavior:
//   * Refreshes Supabase session cookie on every request.
//   * Public routes (login, auth callback, invite redemption, auth APIs,
//     static assets) pass through unauthenticated.
//   * Everything else requires a signed-in user — anonymous visitors are
//     redirected to /login (HTML pages) or get 401 JSON (API routes).
//
// Note on backwards compat: BASIC_AUTH_USER/BASIC_AUTH_PASS env vars are
// IGNORED now. Remove them from Vercel after Supabase auth is verified live.

import { NextResponse, type NextRequest } from "next/server";
import { updateSession } from "./lib/supabase/middleware";

// Routes that never require auth. /api/auth/* must be here so that
// /api/auth/request-magic-link can be called from the unauthenticated
// login form. /api/admin/* is NOT here — admin routes self-gate via
// super_admin check inside the route handler.
const PUBLIC_ROUTES = [
  "/login",
  "/auth/callback",
  "/auth/error",
  "/auth",            // catches any future /auth/* page
  "/invite",          // /invite/[code] — invite landing page
  "/api/auth",        // /api/auth/request-magic-link, /api/auth/signout, etc.
];

function isPublicRoute(pathname: string): boolean {
  return PUBLIC_ROUTES.some((p) => pathname === p || pathname.startsWith(p + "/"));
}

export async function middleware(request: NextRequest) {
  const { response, user } = await updateSession(request);
  const { pathname } = request.nextUrl;

  // Public routes pass through.
  if (isPublicRoute(pathname)) return response;

  // Anonymous visitors hitting protected routes.
  if (!user) {
    // For API routes, return JSON 401 instead of redirecting to /login HTML
    // (otherwise the client's fetch().json() blows up on the HTML body).
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
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
