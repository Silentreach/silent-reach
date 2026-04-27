import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { generateReelMultiplier } from "@/lib/claude";

/* The client extracts frames in the browser and sends them as base64 strings (no data: prefix).
   We accept up to 8 frames per call to stay under Claude's vision token budget. */

const FrameSchema = z.object({
  data: z.string().min(100),
  mediaType: z.enum(["image/jpeg", "image/png", "image/webp"]),
  timestampSec: z.number().min(0).optional(),
  motionDelta: z.number().min(0).max(1).optional(),
});

const InputSchema = z.object({
  sourceDurationSec: z.number().min(3).max(180), // accept 3s-180s
  description: z.string().max(800).optional(),
  series: z.string().max(80).optional(),
  contentType: z.enum(["real_estate", "construction", "general"]).optional(),
  frames: z.array(FrameSchema).min(2).max(16),
});

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

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const candidate = body && typeof body === "object" && "input" in body ? body.input : body;
    const parsed = InputSchema.safeParse(candidate);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid input", details: parsed.error.flatten() },
        { status: 400 }
      );
    }
    const ctxParsed = UserContextSchema.safeParse(
      body && typeof body === "object" ? body.userContext : undefined
    );
    const ctx = ctxParsed.success ? ctxParsed.data : undefined;

    const { sourceDurationSec, description, series, contentType, frames } = parsed.data;
    const output = await generateReelMultiplier(
      { sourceDurationSec, description, series, contentType },
      frames,
      ctx
    );
    return NextResponse.json({ output });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Unknown server error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
