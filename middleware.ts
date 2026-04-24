import { NextResponse, type NextRequest } from "next/server";

// Basic Auth gate — protects the whole site (including /api/*) from anonymous
// visitors so stray traffic can't burn Anthropic API credits.
//
// To enable: set BASIC_AUTH_USER and BASIC_AUTH_PASS in Vercel Env Vars.
// To disable: delete those env vars (middleware falls through when either is missing).

export function middleware(req: NextRequest) {
  const user = process.env.BASIC_AUTH_USER;
  const pass = process.env.BASIC_AUTH_PASS;

  // Fail-open: if either env var is missing, auth is disabled.
  // This prevents locking yourself out by accident and lets local dev skip auth.
  if (!user || !pass) {
    return NextResponse.next();
  }

  const authHeader = req.headers.get("authorization");
  if (authHeader) {
    const [scheme, encoded] = authHeader.split(" ");
    if (scheme === "Basic" && encoded) {
      try {
        // atob() is available in the Edge runtime used by middleware
        const decoded = atob(encoded);
        const sepIndex = decoded.indexOf(":");
        if (sepIndex !== -1) {
          const u = decoded.slice(0, sepIndex);
          const p = decoded.slice(sepIndex + 1);
          if (u === user && p === pass) {
            return NextResponse.next();
          }
        }
      } catch {
        /* malformed header — fall through to 401 */
      }
    }
  }

  return new NextResponse("Authentication required", {
    status: 401,
    headers: {
      "WWW-Authenticate": 'Basic realm="Silent Reach", charset="UTF-8"',
      "Cache-Control": "no-store",
    },
  });
}

// Run on everything except Next internal assets and the public logo.
export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|logo.svg).*)"],
};
