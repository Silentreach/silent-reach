// Music search proxy — uses Jamendo (https://api.jamendo.com/v3.0/tracks).
//
// Why Jamendo: Pixabay's audio API is locked behind their Pro partner program
// (free-tier keys get HTTP 403 on /api/audio/). Jamendo offers 600,000+
// Creative Commons tracks, a free public API, no special-access gate.
//
// CC license note: Jamendo tracks come in three flavors:
//   - CC-BY        (attribution required)
//   - CC-BY-NC     (non-commercial only — UNSAFE for client-paid reels)
//   - CC-BY-SA     (share-alike — UNSAFE for derivative works)
// We filter to license=ccby (commercial-friendly attribution-only) by default
// and surface the creator name + page URL in the UI for credit.
//
// Set JAMENDO_CLIENT_ID in Vercel env vars (free signup at
// https://devportal.jamendo.com/). 5-minute in-memory cache per query.

import { NextRequest, NextResponse } from "next/server";

interface JamendoTrack {
  id: string;
  name: string;
  duration: number;
  artist_name: string;
  artist_id: string;
  album_name?: string;
  audio: string;          // full streaming URL (mp32 by default)
  audiodownload: string;  // downloadable mp3
  shareurl: string;       // jamendo.com page for attribution
  image?: string;
  tags?: { genres?: { name?: string }[] } | string;
}

interface JamendoResponse {
  headers: {
    status: string;
    code: number;
    error_message?: string;
    results_count: number;
  };
  results: JamendoTrack[];
}

const cache = new Map<string, { ts: number; data: JamendoTrack[] }>();
const CACHE_TTL_MS = 5 * 60 * 1000;

export async function GET(request: NextRequest) {
  const clientId = process.env.JAMENDO_CLIENT_ID;
  if (!clientId) {
    return NextResponse.json(
      { error: "Music search is unavailable. Server missing JAMENDO_CLIENT_ID." },
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
    const tracks = cached.data
      .filter((t) => t.duration >= minDuration && t.duration <= maxDuration)
      .slice(0, 8)
      .map(formatTrack);
    return NextResponse.json({ tracks, cached: true });
  }

  const url = new URL("https://api.jamendo.com/v3.0/tracks/");
  url.searchParams.set("client_id", clientId);
  url.searchParams.set("format", "json");
  url.searchParams.set("limit", "20"); // we filter down to 8
  url.searchParams.set("search", q);
  url.searchParams.set("include", "musicinfo");
  url.searchParams.set("audioformat", "mp32");
  url.searchParams.set("ccnc", "false");      // exclude non-commercial
  url.searchParams.set("ccsa", "false");      // exclude share-alike (creates derivative-work issues)
  url.searchParams.set("ccnd", "false");      // exclude no-derivatives (REELS ARE DERIVATIVE WORKS)
  url.searchParams.set("order", "popularity_total");

  let res: Response;
  try {
    res = await fetch(url.toString(), {
      headers: { "User-Agent": "Mintflow/1.0" },
      next: { revalidate: 300 },
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Jamendo request failed" },
      { status: 502 }
    );
  }

  if (!res.ok) {
    return NextResponse.json({ error: `Jamendo returned ${res.status}` }, { status: 502 });
  }

  let payload: JamendoResponse;
  try {
    payload = (await res.json()) as JamendoResponse;
  } catch {
    return NextResponse.json({ error: "Jamendo returned non-JSON" }, { status: 502 });
  }

  if (payload.headers.status !== "success") {
    return NextResponse.json(
      { error: payload.headers.error_message || "Jamendo search failed" },
      { status: 502 }
    );
  }

  cache.set(cacheKey, { ts: Date.now(), data: payload.results });

  const tracks = (payload.results || [])
    .filter((t) => t.duration >= minDuration && t.duration <= maxDuration)
    .slice(0, 8)
    .map(formatTrack);

  return NextResponse.json({ tracks });
}

// Map Jamendo track to the leaner shape the client expects.
// Keep the same shape as the previous Pixabay implementation so the client
// component doesn't need to know about the swap.
function formatTrack(t: JamendoTrack) {
  return {
    id: parseInt(t.id, 10) || 0,
    title: t.name || "Untitled",
    duration: t.duration,
    audioUrl: t.audiodownload || t.audio,
    previewUrl: t.audio,
    creator: t.artist_name || "Unknown",
    pageUrl: t.shareurl || "https://www.jamendo.com",
    tags: typeof t.tags === "string"
      ? t.tags
      : t.tags?.genres?.map((g) => g.name).filter(Boolean).join(", ") || "",
  };
}
