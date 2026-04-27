"use client";

// Browser-side Supabase client.
// Used inside React components to read/write data scoped to the current
// signed-in user (RLS enforces org isolation).

import { createBrowserClient } from "@supabase/ssr";

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
