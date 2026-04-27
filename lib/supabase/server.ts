// Server-side Supabase client (App Router).
// Reads/writes the auth cookie so middleware + Route Handlers + Server
// Components share the same session. Uses the publishable key (RLS applies).
//
// For privileged operations (admin invite mint, usage logging) use
// `createServiceClient()` instead — it bypasses RLS via the secret key
// and must NEVER be exposed to the browser.

import { createServerClient } from "@supabase/ssr";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";

export function createClient() {
  const cookieStore = cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // Called from a Server Component — cookies are read-only here.
            // Middleware will refresh the session on next request.
          }
        },
      },
    }
  );
}

// Privileged client — server-only, bypasses RLS. Do not import from client code.
export function createServiceClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: { autoRefreshToken: false, persistSession: false },
    }
  );
}
