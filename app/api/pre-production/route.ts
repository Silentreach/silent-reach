import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { generatePreShoot } from "@/lib/claude";
import { getServerUserContext } from "@/lib/db/serverContext";
import { bridgeNicheToLegacy } from "@/lib/prompts/preProductionBridge";
import type { NicheInputs } from "@/types/preProduction";

export const runtime = "nodejs";
export const maxDuration = 60;

const PlatformSchema = z.enum(["instagram", "youtube", "youtube_shorts", "linkedin", "all"]);
const LengthSchema = z.enum(["15s", "30s", "45s", "60s", "90s"]);
const MoodSchema = z.enum(["cinematic", "documentary", "energetic", "calm", "luxury", "editorial"]);

const RealEstateSchema = z.object({
  niche: z.literal("real_estate"),
  address: z.string().min(1).max(200),
  listingStage: z.enum(["coming_soon", "just_listed", "open_house", "price_improvement", "sold"]),
  openHouseDate: z.string().optional(),
  buyerPersonas: z
    .array(z.enum(["first_time", "move_up_family", "downsizer", "investor", "out_of_province", "luxury"]))
    .min(1)
    .max(2),
  heroShot: z.string().max(300).optional(),
  moods: z.array(MoodSchema).max(2),
  platform: PlatformSchema,
  videoLength: LengthSchema,
  conceptOverride: z.string().max(800).optional(),
  mlsText: z.string().max(4000).optional(),
  manualPropertyFacts: z
    .object({
      beds: z.number().int().nonnegative().optional(),
      baths: z.number().nonnegative().optional(),
      sqft: z.number().int().nonnegative().optional(),
      yearBuilt: z.number().int().min(1800).max(2100).optional(),
      lotSqft: z.number().int().nonnegative().optional(),
      askingPriceCad: z.number().int().nonnegative().optional(),
    })
    .optional(),
});

const ConstructionSchema = z.object({
  niche: z.literal("construction"),
  projectPhase: z.enum(["demo", "framing", "rough_in", "drywall", "finish", "final_reveal"]),
  transformationArc: z.enum(["problem_solution", "before_after", "process_hero", "time_lapse", "trade_spotlight"]),
  tradeFocus: z
    .array(z.enum(["gc", "carpenter", "mason", "electrician", "plumber", "tile_finish", "landscape"]))
    .max(2),
  audienceMode: z.enum(["client_facing", "trade_facing"]),
  heroShot: z.string().max(300).optional(),
  moods: z.array(MoodSchema).max(2),
  platform: PlatformSchema,
  videoLength: LengthSchema,
  address: z.string().max(200).optional(),
  droneAvailable: z.boolean(),
  siteSafetyConstraints: z.string().max(800).optional(),
  conceptOverride: z.string().max(800).optional(),
});

const GeneralSchema = z.object({
  niche: z.literal("general"),
  contentMode: z.enum(["day_in_the_life", "explainer", "review", "tutorial", "vlog", "hot_take"]),
  concept: z.string().min(5).max(800),
  heroShot: z.string().max(300).optional(),
  moods: z.array(MoodSchema).max(2),
  platform: PlatformSchema,
  videoLength: LengthSchema,
  audience: z.string().max(160).optional(),
});

const InputSchema = z.discriminatedUnion("niche", [RealEstateSchema, ConstructionSchema, GeneralSchema]);

const NearbyPlaceSchema = z.object({
  name: z.string(),
  category: z.enum(["school", "park", "transit", "restaurant", "landmark"]),
  distanceMeters: z.number(),
  lat: z.number(),
  lng: z.number(),
  osmTags: z.record(z.string()).optional(),
});

const EnrichmentSchema = z
  .object({
    geocode: z.object({
      formattedAddress: z.string(),
      lat: z.number(),
      lng: z.number(),
      neighborhood: z.string().optional(),
      postalCode: z.string().optional(),
    }),
    nearby: z
      .object({
        schools: z.array(NearbyPlaceSchema),
        parks: z.array(NearbyPlaceSchema),
        amenities: z.array(NearbyPlaceSchema),
        landmarks: z.array(NearbyPlaceSchema),
      })
      .nullable()
      .optional(),
  })
  .optional();

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

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const candidate = body && typeof body === "object" && "input" in body ? body.input : body;
    const parsed = InputSchema.safeParse(candidate);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid input", details: parsed.error.flatten() },
        { status: 400 },
      );
    }

    const ctxParsed = UserContextSchema.safeParse(
      body && typeof body === "object" ? body.userContext : undefined,
    );
    const browserCtx = ctxParsed.success ? ctxParsed.data : undefined;

    const enrParsed = EnrichmentSchema.safeParse(
      body && typeof body === "object" ? body.enrichment : undefined,
    );
    const enrichment = enrParsed.success ? enrParsed.data : undefined;

    // Pull DB-backed context (voice samples, brand kit) when signed in.
    const dbCtx = await getServerUserContext().catch(() => undefined);
    const ctx = mergeContext(dbCtx, browserCtx);

    const { legacyInput, injectedContext } = bridgeNicheToLegacy(parsed.data as NicheInputs, undefined, enrichment);
    const output = await generatePreShoot(legacyInput, ctx, injectedContext);

    return NextResponse.json({ output, niche: parsed.data.niche });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Unknown server error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

function mergeContext(db: any, browser: any) {
  if (!db && !browser) return undefined;
  return {
    voiceSamples: (db?.voiceSamples?.length ? db.voiceSamples : browser?.voiceSamples) || [],
    voiceNotes: db?.voiceNotes || browser?.voiceNotes || "",
    brand: Object.keys(db?.brand || {}).length ? db.brand : browser?.brand || {},
  };
}
