import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { readCache, writeCache, roundCoords } from "@/lib/enrichment/cache";

export const runtime = "nodejs";
export const maxDuration = 30;

const InputSchema = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
});

const OVERPASS_URL = "https://overpass-api.de/api/interpreter";
const USER_AGENT = "Mintflow/1.0 (info@deloarhossain.ca)";

interface NearbyPlace {
  name: string;
  category: "school" | "park" | "transit" | "restaurant" | "landmark";
  distanceMeters: number;
  lat: number;
  lng: number;
  osmTags?: Record<string, string>;
}

interface NearbyResult {
  schools: NearbyPlace[];
  parks: NearbyPlace[];
  amenities: NearbyPlace[];
  landmarks: NearbyPlace[];
}

const MAX_PER_CATEGORY = 6;

function haversineMeters(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return Math.round(R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
}

function tagsForCategory(category: NearbyPlace["category"]): string {
  switch (category) {
    case "school":
      return `node["amenity"="school"];way["amenity"="school"];relation["amenity"="school"];`;
    case "park":
      return `node["leisure"~"park|garden|nature_reserve"];way["leisure"~"park|garden|nature_reserve"];`;
    case "transit":
      return `node["public_transport"="stop_position"];node["highway"="bus_stop"];node["railway"="station"];`;
    case "restaurant":
      return `node["amenity"~"restaurant|cafe|bakery"];way["amenity"~"restaurant|cafe|bakery"];`;
    case "landmark":
      return `node["tourism"~"museum|gallery|attraction|viewpoint"];way["tourism"~"museum|gallery|attraction|viewpoint"];node["leisure"="golf_course"];way["leisure"="golf_course"];node["natural"="beach"];way["natural"="beach"];`;
  }
}

function buildOverpassQuery(lat: number, lng: number): string {
  const sets = [
    { cat: "school" as const, radius: 1000 },
    { cat: "park" as const, radius: 1000 },
    { cat: "restaurant" as const, radius: 500 },
    { cat: "transit" as const, radius: 500 },
    { cat: "landmark" as const, radius: 3000 },
  ];

  const blocks = sets.map((s) => `(${tagsForCategory(s.cat)})->.${s.cat};`).join("\n");
  // Use around: in each set reference. Simpler shape: rebuild per-cat blocks with around inline.
  const inlineBlocks = sets
    .map((s) => {
      const inner = tagsForCategory(s.cat).replace(/\];/g, `](around:${s.radius},${lat},${lng});`);
      return `(${inner})->.${s.cat};`;
    })
    .join("\n");

  return `
[out:json][timeout:20];
${inlineBlocks}
.school out body center 30;
.park out body center 30;
.restaurant out body center 30;
.transit out body center 30;
.landmark out body center 30;
`.trim();
}

function categoryFromElement(el: any): NearbyPlace["category"] | null {
  const tags = el?.tags ?? {};
  if (tags.amenity === "school") return "school";
  if (["park", "garden", "nature_reserve"].includes(tags.leisure)) return "park";
  if (tags.public_transport === "stop_position" || tags.highway === "bus_stop" || tags.railway === "station") return "transit";
  if (["restaurant", "cafe", "bakery"].includes(tags.amenity)) return "restaurant";
  if (tags.tourism || tags.leisure === "golf_course" || tags.natural === "beach") return "landmark";
  return null;
}

function placeFromElement(el: any, originLat: number, originLng: number): NearbyPlace | null {
  const lat = el.lat ?? el.center?.lat;
  const lng = el.lon ?? el.center?.lon;
  if (lat == null || lng == null) return null;
  const tags = el.tags ?? {};
  const name = tags.name || tags["name:en"];
  if (!name) return null; // unnamed POIs aren't useful for the brief
  const category = categoryFromElement(el);
  if (!category) return null;
  return {
    name,
    category,
    distanceMeters: haversineMeters(originLat, originLng, lat, lng),
    lat,
    lng,
    osmTags: tags,
  };
}

export async function POST(req: NextRequest) {
  let body: unknown;
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const parsed = InputSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Invalid input" }, { status: 400 });

  const { lat, lng } = parsed.data;
  const cacheKey = `nearby:${roundCoords(lat, lng)}`;
  const cached = await readCache<NearbyResult>(cacheKey);
  if (cached) return NextResponse.json({ result: cached, cached: true });

  const query = buildOverpassQuery(lat, lng);

  let upstream: Response;
  try {
    upstream = await fetch(OVERPASS_URL, {
      method: "POST",
      headers: {
        "User-Agent": USER_AGENT,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: `data=${encodeURIComponent(query)}`,
      signal: AbortSignal.timeout(20_000),
    });
  } catch {
    return NextResponse.json(
      { error: "Overpass API timed out. The brief will run without nearby data." },
      { status: 504 },
    );
  }

  if (!upstream.ok) {
    return NextResponse.json({ error: `Overpass returned ${upstream.status}` }, { status: 502 });
  }

  const data = (await upstream.json()) as { elements?: any[] };
  const placesByCat: Record<NearbyPlace["category"], NearbyPlace[]> = {
    school: [], park: [], transit: [], restaurant: [], landmark: [],
  };

  for (const el of data.elements ?? []) {
    const p = placeFromElement(el, lat, lng);
    if (p) placesByCat[p.category].push(p);
  }

  // Dedupe by name (Overpass often returns same node + way), sort by distance, cap.
  const sortAndCap = (arr: NearbyPlace[]): NearbyPlace[] => {
    const seen = new Set<string>();
    const deduped: NearbyPlace[] = [];
    for (const p of arr.sort((a, b) => a.distanceMeters - b.distanceMeters)) {
      const key = p.name.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      deduped.push(p);
      if (deduped.length >= MAX_PER_CATEGORY) break;
    }
    return deduped;
  };

  const result: NearbyResult = {
    schools: sortAndCap(placesByCat.school),
    parks: sortAndCap(placesByCat.park),
    amenities: sortAndCap([...placesByCat.restaurant, ...placesByCat.transit]),
    landmarks: sortAndCap(placesByCat.landmark),
  };

  await writeCache(cacheKey, result);
  return NextResponse.json({ result, cached: false });
}
