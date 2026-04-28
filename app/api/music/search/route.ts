// Proxies Pixabay's audio search so the API key stays server-side.
// Free tier: 100 requests / 60s. We cache results in memory for 5min per
// query string to avoid burning quota on repeated panel-opens.
//
// Set PIXABAY_API_KEY in Vercel env vars. If unset the route returns 503
// with a helpful message instead of leaking the missing-key error.

import { NextRequest, NextResponse } from "next/server";

interface PixabayAudio {
  id: number;
  title: string;
  duration: number;          // seconds
  audio: string;             // mp3 URL
  preview_url: string;       // shorter preview mp3
  user: string;              // creator name (for attribution)
  user_id: number;
  pageURL: string;           // pixabay page (license/attribution)
  tags: string;              // comma-separated
}

interface PixabayResponse {
  total: number;
  totalHits: number;
  hits: PixabayAudio[];
}

const cache = new Map<string, { ts: number; data: PixabayAudio[] }>();
const CACHE_TTL_MS = 5 * 60 * 1000;

export async function GET(request: NextRequest) {
  const key = process.env.PIXABAY_API_KEY;
  if (!key) {
    return NextResponse.json(
      { error: "Music search is unavailable. Server missing PIXABAY_API_KEY." },
      { status: 503 }
    );
  }

  const { searchParams } = new URL(request.url);
  const q = (searchParams.get("q") || "").trim().slice(0, 80);
  const minDuration = parseInt(searchParams.get("min_duration") || "30", 10);
  const maxDuration = parseInt(searchParams.get("max_duration") || "120", 10);

  if (!q) {
    return NextResponse.json({ error: "Query is required" }, { status: 400 });
  }

  const cacheKey = `${q}|${minDuration}|${maxDuration}`;
  const cached = cache.get(cacheKey);
  if (cached && Date.now() - cached.ts < CACHE_TTL_MS) {
    return NextResponse.json({ tracks: cached.data, cached: true });
  }

  const url = new URL("https://pixabay.com/api/audio/");
  url.searchParams.set("key", key);
  url.searchParams.set("q", q);
  url.searchParams.set("per_page", "10");
  url.searchParams.set("safesearch", "true");

  let res: Response;
  try {
    res = await fetch(url.toString(), {
      headers: { "User-Agent": "Mintflow/1.0" },
      next: { revalidate: 300 }, // shared edge cache too
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Pixabay request failed" },
      { status: 502 }
    );
  }

  if (!res.ok) {
    return NextResponse.json(
      { error: `Pixabay returned ${res.status}` },
      { status: 502 }
    );
  }

  let payload: PixabayResponse;
  try {
    payload = (await res.json()) as PixabayResponse;
  } catch {
    return NextResponse.json({ error: "Pixabay returned non-JSON" }, { status: 502 });
  }

  // Filter by duration; map to a leaner shape the client uses.
  const tracks = (payload.hits || [])
    .filter((h) => h.duration >= minDuration && h.duration <= maxDuration)
    .slice(0, 8)
    .map((h) => ({
      id: h.id,
      title: h.title,
      duration: h.duration,
      audioUrl: h.audio,
      previewUrl: h.preview_url || h.audio,
      creator: h.user,
      pageUrl: h.pageURL,
      tags: h.tags,
    }));

  cache.set(cacheKey, { ts: Date.now(), data: payload.hits });
  return NextResponse.json({ tracks });
}
