/* Claude Haiku 4.5 — extracts structured property facts from a pasted MLS
   listing URL or text. ~$0.002 per call, ~3s wall clock. The user can also
   paste a URL; we don't crawl it (Realtor.ca ToS), we just extract the
   pasted text. */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import Anthropic from "@anthropic-ai/sdk";

export const runtime = "nodejs";
export const maxDuration = 30;

const InputSchema = z.object({
  text: z.string().min(20).max(8000),
});

const OutputSchema = z.object({
  beds: z.number().int().nonnegative().nullable(),
  baths: z.number().nonnegative().nullable(),
  sqft: z.number().int().nonnegative().nullable(),
  yearBuilt: z.number().int().min(1800).max(2100).nullable(),
  lotSqft: z.number().int().nonnegative().nullable(),
  askingPriceCad: z.number().int().nonnegative().nullable(),
  features: z.array(z.string()).max(20),
  notes: z.string().max(400).nullable(),
});

const SYSTEM = `You are a property-listing parser. Given a chunk of free-form text from an MLS-style real-estate listing (Victoria BC market), extract structured facts. If a field isn't present, return null — do not guess.

Output strict JSON matching the schema. No markdown fences. No prose outside JSON.

Schema:
{
  "beds": number | null,
  "baths": number | null,
  "sqft": number | null,
  "yearBuilt": number | null,
  "lotSqft": number | null,
  "askingPriceCad": number | null,
  "features": string[],
  "notes": string | null
}

Rules:
- "features" is at most 20 short tags (e.g. "waterfront", "ocean view", "garden suite", "heritage", "heat pump", "EV charger", "garage 2-car", "primary on main", "ALR", "subject-free encouraged").
- "notes" is 1-2 sentences only if there's something the structured fields miss. Otherwise null.
- Convert lot acreage to sqft (1 acre = 43,560 sqft).
- BC asking-price formats vary ("$1,295,000", "1.295M", "1,295k") — normalize to integer CAD.
- Bath count can be fractional (e.g. 2.5).`;

export async function POST(req: NextRequest) {
  let body: unknown;
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const parsed = InputSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Invalid input" }, { status: 400 });

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return NextResponse.json({ error: "Anthropic key not configured" }, { status: 500 });

  const client = new Anthropic({ apiKey });
  let raw = "";
  try {
    const msg = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 800,
      system: SYSTEM,
      messages: [{ role: "user", content: parsed.data.text }],
    });
    raw = msg.content
      .filter((c) => c.type === "text")
      .map((c) => (c as { type: "text"; text: string }).text)
      .join("");
  } catch (err: unknown) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Claude call failed" },
      { status: 502 },
    );
  }

  // Strip markdown fences if the model added any
  const cleaned = raw.replace(/```(?:json)?\s*([\s\S]*?)\s*```/m, "$1").trim();
  let json: unknown;
  try { json = JSON.parse(cleaned); }
  catch {
    return NextResponse.json({ error: "Couldn't parse the listing." }, { status: 422 });
  }

  const out = OutputSchema.safeParse(json);
  if (!out.success) {
    return NextResponse.json({ error: "Listing parser returned an unexpected shape." }, { status: 422 });
  }

  return NextResponse.json({ result: out.data });
}
