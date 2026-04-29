import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { readCache, writeCache, normalizeAddress } from "@/lib/enrichment/cache";

export const runtime = "nodejs";
export const maxDuration = 30;

const InputSchema = z.object({
  address: z.string().min(3).max(200),
});

const NOMINATIM = "https://nominatim.openstreetmap.org/search";
const USER_AGENT = "Mintflow/1.0 (info@deloarhossain.ca)";

interface GeocodeResult {
  formattedAddress: string;
  lat: number;
  lng: number;
  neighborhood?: string;
  postalCode?: string;
  osmType?: string;
  osmId?: number;
}

export async function POST(req: NextRequest) {
  let body: unknown;
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const parsed = InputSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }

  const cacheKey = `geocode:${normalizeAddress(parsed.data.address)}`;
  const cached = await readCache<GeocodeResult>(cacheKey);
  if (cached) return NextResponse.json({ result: cached, cached: true });

  // Bias toward British Columbia, Canada — the home market.
  const params = new URLSearchParams({
    q: parsed.data.address,
    format: "json",
    addressdetails: "1",
    limit: "1",
    countrycodes: "ca",
  });

  let upstream: Response;
  try {
    upstream = await fetch(`${NOMINATIM}?${params.toString()}`, {
      headers: {
        "User-Agent": USER_AGENT,
        "Accept-Language": "en-CA",
        "Accept": "application/json",
      },
      signal: AbortSignal.timeout(10_000),
    });
  } catch (err) {
    return NextResponse.json(
      { error: "Geocoding service timed out. Try again or fill manual fields." },
      { status: 504 },
    );
  }

  if (!upstream.ok) {
    return NextResponse.json(
      { error: `Nominatim returned ${upstream.status}` },
      { status: 502 },
    );
  }

  const data = (await upstream.json()) as Array<{
    lat: string;
    lon: string;
    display_name: string;
    osm_type?: string;
    osm_id?: number;
    address?: Record<string, string>;
  }>;

  if (!data.length) {
    return NextResponse.json(
      { error: "Couldn't find that address. Try a more specific street + city." },
      { status: 404 },
    );
  }

  const top = data[0];
  const result: GeocodeResult = {
    formattedAddress: top.display_name,
    lat: Number(top.lat),
    lng: Number(top.lon),
    neighborhood: top.address?.neighbourhood || top.address?.suburb || top.address?.city_district,
    postalCode: top.address?.postcode,
    osmType: top.osm_type,
    osmId: top.osm_id,
  };

  await writeCache(cacheKey, result);
  return NextResponse.json({ result, cached: false });
}
