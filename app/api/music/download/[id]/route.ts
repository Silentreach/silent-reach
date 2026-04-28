// Proxy Jamendo audio downloads through our server so the browser doesn't get
// CORS-blocked. Jamendo's CDN doesn't set Access-Control-Allow-Origin, so a
// direct fetch() from the client fails with "Failed to fetch".
//
// GET /api/music/download/<trackId>
// Streams back the mp3 with proper CORS-allow headers.

import { NextRequest, NextResponse } from "next/server";

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  const trackId = params.id;
  if (!trackId || !/^\d+$/.test(trackId)) {
    return NextResponse.json({ error: "Invalid track id" }, { status: 400 });
  }

  const clientId = process.env.JAMENDO_CLIENT_ID;
  if (!clientId) {
    return NextResponse.json({ error: "Music service unavailable" }, { status: 503 });
  }

  // Fetch the track metadata to get the actual audio URL (audiodownload field)
  const metaUrl = new URL("https://api.jamendo.com/v3.0/tracks/");
  metaUrl.searchParams.set("client_id", clientId);
  metaUrl.searchParams.set("format", "json");
  metaUrl.searchParams.set("id", trackId);
  metaUrl.searchParams.set("audioformat", "mp32");

  let metaRes: Response;
  try {
    metaRes = await fetch(metaUrl.toString(), {
      headers: { "User-Agent": "Mintflow/1.0" },
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Jamendo lookup failed" },
      { status: 502 },
    );
  }

  if (!metaRes.ok) {
    return NextResponse.json({ error: `Jamendo lookup ${metaRes.status}` }, { status: 502 });
  }

  const meta = await metaRes.json();
  const track = meta?.results?.[0];
  if (!track) {
    return NextResponse.json({ error: "Track not found" }, { status: 404 });
  }

  const audioUrl: string | undefined = track.audiodownload || track.audio;
  if (!audioUrl) {
    return NextResponse.json({ error: "Track has no audio URL" }, { status: 502 });
  }

  // Fetch the audio bytes server-side and pipe back to the client.
  let audioRes: Response;
  try {
    audioRes = await fetch(audioUrl, {
      headers: { "User-Agent": "Mintflow/1.0" },
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Audio fetch failed" },
      { status: 502 },
    );
  }

  if (!audioRes.ok || !audioRes.body) {
    return NextResponse.json(
      { error: `Audio fetch ${audioRes.status}` },
      { status: 502 },
    );
  }

  return new NextResponse(audioRes.body, {
    status: 200,
    headers: {
      "Content-Type": audioRes.headers.get("Content-Type") || "audio/mpeg",
      "Cache-Control": "public, max-age=86400, immutable",
      "Access-Control-Allow-Origin": "*",
    },
  });
}
