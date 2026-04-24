import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { generatePreShoot } from "@/lib/claude";

const InputSchema = z.object({
  contentType: z.enum([
    "listing_tour",
    "renovation_walkthrough",
    "before_after",
    "contractor_feature",
    "explainer",
    "other",
  ]),
  targetAudience: z.string().min(1),
  location: z.string().min(1),
  videoLength: z.enum(["15s", "30s", "60s", "90s", "3-5min", "5-10min"]),
  platform: z.enum(["instagram", "youtube", "youtube_shorts", "linkedin", "all"]),
  concept: z.string().min(5),
  details: z.string().optional(),
});

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = InputSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid input", details: parsed.error.flatten() },
        { status: 400 }
      );
    }
    const output = await generatePreShoot(parsed.data);
    return NextResponse.json({ output });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Unknown server error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
