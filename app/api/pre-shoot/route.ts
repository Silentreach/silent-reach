import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { generatePreShoot } from "@/lib/claude";
import { getServerUserContext } from "@/lib/db/serverContext";

const UserContextSchema = z
  .object({
    voiceSamples: z.array(z.string()).max(20).optional(),
    voiceNotes: z.string().max(2000).optional(),
    brand: z
      .object({
        name: z.string().max(80).optional(),
        tagline: z.string().max(160).optional(),
        primaryColor: z.string().max(20).optional(),
        secondaryColor: z.string().max(20).optional(),
      })
      .optional(),
  })
  .optional();

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
  series: z.string().max(80).optional(),
});

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    // Accept either flat input (legacy) or { input, userContext } envelope.
    const candidate = body && typeof body === "object" && "input" in body ? body.input : body;
    const parsed = InputSchema.safeParse(candidate);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid input", details: parsed.error.flatten() },
        { status: 400 }
      );
    }
    const ctxParsed = UserContextSchema.safeParse(body && typeof body === "object" ? body.userContext : undefined);
    const ctx = ctxParsed.success ? ctxParsed.data : undefined;
    const output = await generatePreShoot(parsed.data, ctx);
    return NextResponse.json({ output });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Unknown server error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

function mergeUserContext(db: any, body: any) {
  if (!db && !body) return undefined;
  return {
    voiceSamples: (db?.voiceSamples?.length ? db.voiceSamples : body?.voiceSamples) || [],
    voiceNotes:   db?.voiceNotes || body?.voiceNotes || "",
    brand:        Object.keys(db?.brand || {}).length ? db.brand : (body?.brand || {}),
  };
}
