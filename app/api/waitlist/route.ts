import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createServiceClient } from "@/lib/supabase/server";

const InputSchema = z.object({
  email: z.string().email().max(254).transform((s) => s.trim().toLowerCase()),
  tier: z.enum(["creator", "studio", "brokerage"]),
  cadence: z.enum(["monthly", "annual"]).default("monthly"),
  source: z.string().max(120).optional(),
});

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = InputSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid input" },
      { status: 400 },
    );
  }

  const supabase = createServiceClient();
  const { error } = await supabase
    .from("waitlist")
    .upsert(
      {
        email: parsed.data.email,
        tier: parsed.data.tier,
        cadence: parsed.data.cadence,
        source: parsed.data.source ?? null,
        user_agent: req.headers.get("user-agent")?.slice(0, 500) ?? null,
      },
      { onConflict: "email,tier", ignoreDuplicates: false },
    );

  if (error) {
    console.error("[waitlist] insert failed", error);
    return NextResponse.json({ error: "Could not save your spot. Try again." }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
