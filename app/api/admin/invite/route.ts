// Mints a new invite code. Gated to super-admin (Deloar) only.
//
// POST /api/admin/invite
// Body: { intended_email?: string, org_id?: string, notes?: string }
// Returns: { code: "MINT-XXXX", url: "https://.../login?code=MINT-XXXX" }

import { NextRequest, NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";

function generateCode(): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // skip confusing chars
  let s = "MINT-";
  for (let i = 0; i < 5; i++) {
    s += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  return s;
}

export async function POST(request: NextRequest) {
  // Auth check — must be a signed-in super_admin.
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: profile } = await supabase
    .from("users")
    .select("is_super_admin")
    .eq("id", user.id)
    .maybeSingle();

  if (!profile?.is_super_admin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json().catch(() => ({}));
  const { intended_email, org_id, notes } = body as {
    intended_email?: string;
    org_id?: string;
    notes?: string;
  };

  // Mint via service role (bypasses RLS on invite_codes).
  const admin = createServiceClient();
  const code = generateCode();

  const { error } = await admin.from("invite_codes").insert({
    code,
    created_by: user.id,
    intended_email: intended_email?.toLowerCase() || null,
    org_id: org_id || null,
    notes: notes || null,
  });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || new URL(request.url).origin;
  return NextResponse.json({
    code,
    url: `${siteUrl}/login?code=${code}`,
    intended_email,
    notes,
  });
}
