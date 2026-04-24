import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { generatePostUpload } from "@/lib/claude";
import {
  extractVideoId,
  fetchVideoMeta,
  fetchTranscript,
  fetchThumbnailAsBase64,
} from "@/lib/youtube";

const InputSchema = z.object({
  youtubeUrl: z.string().min(5),
  audienceOverride: z.string().optional(),
  locationOverride: z.string().optional(),
  visualContext: z.string().optional(),
  manualTranscript: z.string().optional(),
});

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = InputSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid input", details: parsed.error.flatten() },
        { status: 400 }
      );
    }
    const {
      youtubeUrl,
      audienceOverride,
      locationOverride,
      visualContext,
      manualTranscript,
    } = parsed.data;

    const videoId = extractVideoId(youtubeUrl);
    if (!videoId) {
      return NextResponse.json(
        { error: "Could not parse a YouTube video ID from that URL" },
        { status: 400 }
      );
    }

    // Fetch metadata (required)
    let meta;
    try {
      meta = await fetchVideoMeta(videoId);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "YouTube metadata error";
      return NextResponse.json({ error: msg }, { status: 502 });
    }

    // Fetch transcript (optional — silently skip if not available)
    let transcript = "";
    if (manualTranscript && manualTranscript.trim().length > 0) {
      transcript = manualTranscript.trim();
    } else {
      try {
        transcript = await fetchTranscript(videoId);
      } catch {
        transcript = ""; // No transcript available — that's fine
      }
    }

    // Fetch thumbnail as base64 for Claude Vision (optional — if it fails, proceed without)
    let thumbnailImage;
    try {
      thumbnailImage = await fetchThumbnailAsBase64(meta.thumbnailUrl);
    } catch {
      thumbnailImage = undefined;
    }

    const pack = await generatePostUpload(
      meta,
      transcript,
      {
        audience: audienceOverride,
        location: locationOverride,
        visualContext,
      },
      thumbnailImage
    );

    return NextResponse.json({
      meta,
      pack,
      transcriptUsed: transcript.length > 0,
      thumbnailUsed: !!thumbnailImage,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Unknown server error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
