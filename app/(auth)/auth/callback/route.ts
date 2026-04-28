import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import type { EmailOtpType } from "@supabase/supabase-js";

// Magic-link / OAuth callback.
// Supabase email links use one of two formats depending on project config:
//   * Modern (PKCE):  ?code=xxx                     → exchangeCodeForSession
//   * Legacy (OTP):   ?token_hash=xxx&type=email    → verifyOtp
// We support both so a project can flip its template without breaking auth.

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const redirectTo = searchParams.get("redirect") || searchParams.get("next") || "/";

  const supabase = createClient();

  // OAuth / PKCE flow
  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) {
      return NextResponse.redirect(
        `${origin}/auth/error?reason=${encodeURIComponent(error.message)}`
      );
    }
    return NextResponse.redirect(`${origin}${redirectTo}`);
  }

  // Magic-link OTP flow
  if (tokenHash && type) {
    const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type });
    if (error) {
      return NextResponse.redirect(
        `${origin}/auth/error?reason=${encodeURIComponent(error.message)}`
      );
    }
    return NextResponse.redirect(`${origin}${redirectTo}`);
  }

  return NextResponse.redirect(`${origin}/auth/error?reason=missing_code`);
}
