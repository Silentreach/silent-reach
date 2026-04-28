// Validates invite code (if provided) and triggers Supabase magic link.
// Uses service-role client so we can read invite_codes (RLS-locked from anon)
// and check whether user already exists.

import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";

// Bootstrap: this email can sign in WITHOUT an invite code (first super_admin).
// The DB trigger handle_new_auth_user also marks this email as is_super_admin.
const SUPER_ADMIN_EMAIL = "dh.nfchs.f@gmail.com";

export async function POST(request: NextRequest) {
  const { email, code } = await request.json();
  if (!email || typeof email !== "string") {
    return NextResponse.json({ error: "Email is required" }, { status: 400 });
  }

  const admin = createServiceClient();

  // Does this email already have an account?
  const { data: existingUser } = await admin
    .from("users")
    .select("id, org_id")
    .eq("email", email)
    .maybeSingle();

  let userMetadata: Record<string, unknown> = {};
  const isSuperAdminBootstrap = !existingUser && email === SUPER_ADMIN_EMAIL;

  if (!existingUser && !isSuperAdminBootstrap) {
    // First sign-in — must redeem an invite code.
    if (!code) {
      return NextResponse.json(
        { error: "Mintflow is invite-only. Please paste the invite code you received." },
        { status: 403 }
      );
    }

    const { data: invite } = await admin
      .from("invite_codes")
      .select("code, intended_email, org_id, redeemed_at, expires_at")
      .eq("code", code)
      .maybeSingle();

    if (!invite) {
      return NextResponse.json({ error: "Invalid invite code." }, { status: 403 });
    }
    if (invite.redeemed_at) {
      return NextResponse.json({ error: "This invite code has already been used." }, { status: 403 });
    }
    if (new Date(invite.expires_at) < new Date()) {
      return NextResponse.json({ error: "This invite code has expired." }, { status: 403 });
    }
    if (invite.intended_email && invite.intended_email !== email) {
      return NextResponse.json(
        { error: "This invite is for a different email address." },
        { status: 403 }
      );
    }

    userMetadata = {
      org_id: invite.org_id,        // null = create new org via trigger
      invite_code: invite.code,
    };
  }

  // Trigger magic link via Supabase Auth.
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
  const { error: linkError } = await admin.auth.signInWithOtp({
    email,
    options: {
      emailRedirectTo: `${siteUrl}/auth/callback`,
      data: userMetadata,
      shouldCreateUser: !existingUser,
    },
  });

  if (linkError) {
    console.error("[request-magic-link] signInWithOtp failed:", linkError);
    return NextResponse.json({ error: linkError.message }, { status: 500 });
  }

  // Mark invite redeemed (will be linked to user_id via trigger after they verify)
  if (!existingUser && code && !isSuperAdminBootstrap) {
    await admin
      .from("invite_codes")
      .update({ redeemed_at: new Date().toISOString() })
      .eq("code", code);
  }

  return NextResponse.json({ success: true });
}
