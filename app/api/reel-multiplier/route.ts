import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { generateReelMultiplier } from "@/lib/claude";
import { getServerUserContext } from "@/lib/db/serverContext";

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
    const bodyCtx = ctxParsed.success ? ctxParsed.data : undefined;

    // Source of truth = DB (per signed-in user). Body context only fills in
    // gaps for unmigrated clients. DB voice samples beat body voice samples.
    const dbCtx = await getServerUserContext().catch(() => undefined);
    const ctx = mergeUserContext(dbCtx, bodyCtx);

    const { sourceDurationSec, description, series, contentType, frames } = parsed.data;
    const output = await generateReelMultiplier(
      { sourceDurationSec, description, series, contentType },
      frames,
      ctx
    );

    // Sanitize cutMarkers per package: drop bad ones, clamp to source duration,
    // sort by start, remove overlaps, cap at 6. Without this, Claude occasionally
    // returns cuts past source end (renderer would render a held still frame),
    // overlapping ranges (audio doubles), or single-frame cuts under 1s.
    if (output?.packages) {
      for (const pkg of output.packages) {
        pkg.cutMarkers = sanitizeCuts(pkg.cutMarkers || [], sourceDurationSec);
      }
      // If any package ends with zero usable cuts, surface a 422.
      const broken = output.packages.find((p) => !p.cutMarkers?.length);
      if (broken) {
        return NextResponse.json(
          { error: "AI returned cuts that didn't fit your source video. Please try again — usually a one-time hiccup." },
          { status: 422 }
        );
      }
    }

    // Fire-and-forget usage log: tracks Anthropic spend per org for billing
    // and rate-limit decisions later. Don't block the response.
    logUsage("reel_multiplier", (output as any)._model || "claude-haiku-4-5", output).catch(() => undefined);

    return NextResponse.json({ output });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Unknown server error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

function mergeUserContext(
  db: { voiceSamples?: string[]; voiceNotes?: string; brand?: Record<string, unknown> } | undefined,
  body: { voiceSamples?: string[]; voiceNotes?: string; brand?: Record<string, unknown> } | undefined,
) {
  if (!db && !body) return undefined;
  return {
    voiceSamples: (db?.voiceSamples?.length ? db.voiceSamples : body?.voiceSamples) || [],
    voiceNotes:   db?.voiceNotes || body?.voiceNotes || "",
    brand:        Object.keys(db?.brand || {}).length ? (db?.brand as Record<string, string>) : ((body?.brand as Record<string, string>) || {}),
  };
}


interface CutLike { startSec: number; endSec: number; reason?: string }
function sanitizeCuts(cuts: CutLike[], sourceDurationSec: number): CutLike[] {
  const cleaned = cuts
    .map((c) => ({
      startSec: Math.max(0, Math.min(sourceDurationSec, Number(c.startSec) || 0)),
      endSec:   Math.max(0, Math.min(sourceDurationSec, Number(c.endSec)   || 0)),
      reason:   c.reason,
    }))
    .filter((c) => isFinite(c.startSec) && isFinite(c.endSec))
    .filter((c) => c.endSec > c.startSec + 1.0)        // drop slivers
    .sort((a, b) => a.startSec - b.startSec);

  // Remove overlaps: keep first, push later starts past prior end.
  const noOverlap: CutLike[] = [];
  for (const c of cleaned) {
    const last = noOverlap[noOverlap.length - 1];
    if (!last || c.startSec >= last.endSec) {
      noOverlap.push(c);
    } else if (c.endSec > last.endSec + 1.0) {
      // Salvage the tail past the overlap if it\'s long enough.
      noOverlap.push({ startSec: last.endSec + 0.1, endSec: c.endSec, reason: c.reason });
    }
  }
  return noOverlap.slice(0, 6);
}

async function logUsage(
  feature: string,
  model: string,
  output: unknown,
): Promise<void> {
  try {
    const { createClient } = await import("@/lib/supabase/server");
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data: profile } = await supabase
      .from("users")
      .select("org_id")
      .eq("id", user.id)
      .maybeSingle();
    if (!profile?.org_id) return;
    // Pull token counts off the output if Claude attached them in usage.
    const usage = (output as { _usage?: { input_tokens?: number; output_tokens?: number } })._usage || {};
    const inT = Number(usage.input_tokens || 0);
    const outT = Number(usage.output_tokens || 0);
    // Haiku 4.5 ≈ $1/M input, $5/M output (rough). cost in cents.
    const cents = Math.round((inT * 0.0001 + outT * 0.0005) * 100) / 100;
    await supabase.from("usage_log").insert({
      org_id: profile.org_id,
      user_id: user.id,
      feature,
      model,
      input_tokens: inT,
      output_tokens: outT,
      cost_usd_cents: Math.round(cents),
    });
  } catch {
    // never throw from a fire-and-forget logger
  }
}
