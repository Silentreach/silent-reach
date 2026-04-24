import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { generatePostUpload } from "@/lib/claude";
import { extractVideoId, fetchVideoMeta, fetchTranscript } from "@/lib/youtube";

const InputSchema = z.object({
  youtubeUrl: z.string().min(5),
  audienceOverride: z.string().optional(),
  locationOverride: z.string().optional(),
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
      manualTranscript,
    } = parsed.data;

    const videoId = extractVideoId(youtubeUrl);
    if (!videoId) {
      return NextResponse.json(
        { error: "Could not parse a YouTube video ID from that URL" },
        { status: 400 }
      );
    }

    // Fetch metadata + transcript in parallel
    const metaPromise = fetchVideoMeta(videoId);
    const transcriptPromise = manualTranscript
      ? Promise.resolve(manualTranscript)
      : fetchTranscript(videoId);

    let meta;
    try {
      meta = await metaPromise;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "YouTube metadata error";
      return NextResponse.json({ error: msg }, { status: 502 });
    }

    let transcript: string;
    try {
      transcript = await transcriptPromise;
    } catch (err: unknown) {
      if (manualTranscript) {
        const msg =
          err instanceof Error ? err.message : "Manual transcript error";
        return NextResponse.json({ error: msg }, { status: 500 });
      }
      return NextResponse.json(
        {
          error:
            "Transcript not found. Please paste the transcript manually and try again.",
          needManualTranscript: true,
          meta,
        },
        { status: 422 }
      );
    }

    const pack = await generatePostUpload(meta, transcript, {
      audience: audienceOverride,
      location: locationOverride,
    });

    return NextResponse.json({ meta, pack });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Unknown server error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
