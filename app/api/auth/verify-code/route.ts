// Verifies a 6-digit OTP code (from email) and sets the session cookie.
// Uses createClient (SSR client with cookie writer) so the resulting session
// cookie sticks to the browser. NOT the service-role client.

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: NextRequest) {
  const { email, token } = await request.json();
  if (!email || !token) {
    return NextResponse.json({ error: "Email and code are required" }, { status: 400 });
  }

  const supabase = createClient();
  const { error } = await supabase.auth.verifyOtp({
    email: email.trim().toLowerCase(),
    token: token.trim(),
    type: "email",
  });

  if (error) {
    console.error("[verify-code] verifyOtp failed:", error);
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ success: true });
}
