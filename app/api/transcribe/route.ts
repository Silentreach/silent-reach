/**
 * POST /api/transcribe
 *
 * Accepts a multipart/form-data upload with an audio file under field "file"
 * (16 kHz mono WAV preferred, but Whisper accepts most formats), proxies it
 * to OpenAI Whisper with word-level timestamp granularity, and returns
 * caption cues + word timings the reel renderer can burn into the video.
 *
 * Cost: ~$0.006 per minute of audio. A 90 s reel ≈ $0.009.
 *
 * Auth: gated by middleware — only signed-in users can render reels, and
 * only render flows transcribe. We log usage to usage_log for cost tracking.
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const maxDuration = 60;

const WHISPER_URL = "https://api.openai.com/v1/audio/transcriptions";
const MAX_BYTES = 24 * 1024 * 1024; // Whisper hard cap is 25 MB; leave headroom for multipart.

export interface WordTimestamp {
  word: string;
  startSec: number;
  endSec: number;
}

export interface CaptionCue {
  /** The phrase displayed as one caption — typically 3-8 words. */
  text: string;
  startSec: number;
  endSec: number;
  /** Word-level timings inside this cue, used for active-word highlighting. */
  words: WordTimestamp[];
}

export async function POST(req: NextRequest) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "Transcription is not configured on this deployment. (OPENAI_API_KEY missing.)" },
      { status: 503 },
    );
  }

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: "Invalid multipart body" }, { status: 400 });
  }

  const file = form.get("file");
  if (!(file instanceof Blob)) {
    return NextResponse.json({ error: 'Missing "file" field' }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json(
      { error: `Audio too large (${(file.size / 1024 / 1024).toFixed(1)} MB). Max 24 MB.` },
      { status: 413 },
    );
  }
  if (file.size < 1024) {
    return NextResponse.json({ error: "Audio is empty or unreadable" }, { status: 400 });
  }

  // Record the authenticated user for usage tracking. Non-fatal on miss.
  let userId: string | null = null;
  let orgId: string | null = null;
  try {
    const sb = createClient();
    const { data: { user } } = await sb.auth.getUser();
    if (user) {
      userId = user.id;
      const { data: profile } = await sb.from("users").select("org_id").eq("id", user.id).single();
      orgId = profile?.org_id ?? null;
    }
  } catch {
    // Continue without usage tracking — transcription should still work.
  }

  // Proxy to Whisper. We pass timestamp_granularities so we get word-level
  // timings back, which the renderer needs for active-word highlighting.
  const upstream = new FormData();
  // Whisper sniffs by extension, so name the file something it understands.
  const filename = (file instanceof File && file.name) ? file.name : "audio.wav";
  upstream.append("file", file, filename);
  upstream.append("model", "whisper-1");
  upstream.append("response_format", "verbose_json");
  upstream.append("timestamp_granularities[]", "word");
  upstream.append("timestamp_granularities[]", "segment");

  let r: Response;
  try {
    r = await fetch(WHISPER_URL, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}` },
      body: upstream,
      signal: AbortSignal.timeout(55_000),
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json(
      { error: `Transcription upstream failed: ${msg}` },
      { status: 504 },
    );
  }

  if (!r.ok) {
    const txt = await r.text().catch(() => "");
    return NextResponse.json(
      { error: `Whisper returned ${r.status}: ${txt.slice(0, 300)}` },
      { status: 502 },
    );
  }

  const data = (await r.json()) as {
    text?: string;
    duration?: number;
    segments?: Array<{ id: number; start: number; end: number; text: string }>;
    words?: Array<{ word: string; start: number; end: number }>;
  };

  // Build cues: prefer segment grouping (Whisper's natural break points),
  // then attach word timings to each cue. Fall back to word-by-word if
  // segments are missing.
  const allWords: WordTimestamp[] = (data.words ?? []).map((w) => ({
    word: w.word.trim(),
    startSec: w.start,
    endSec: w.end,
  }));

  const cues: CaptionCue[] = [];
  if (data.segments && data.segments.length > 0) {
    for (const seg of data.segments) {
      const wordsInSeg = allWords.filter(
        (w) => w.startSec >= seg.start - 0.01 && w.endSec <= seg.end + 0.01,
      );
      cues.push({
        text: seg.text.trim(),
        startSec: seg.start,
        endSec: seg.end,
        words: wordsInSeg,
      });
    }
  } else if (allWords.length > 0) {
    // Fallback: group every 6 words into a cue.
    for (let i = 0; i < allWords.length; i += 6) {
      const chunk = allWords.slice(i, i + 6);
      cues.push({
        text: chunk.map((w) => w.word).join(" "),
        startSec: chunk[0].startSec,
        endSec: chunk[chunk.length - 1].endSec,
        words: chunk,
      });
    }
  }

  // Fire-and-forget usage log. Whisper bills per minute, rounded up.
  // Use service client so we can insert regardless of RLS policy on usage_log.
  if (userId && orgId && data.duration) {
    try {
      const admin = createServiceClient();
      const minutes = Math.max(1, Math.ceil(data.duration / 60));
      const cents = Math.ceil(minutes * 0.6); // $0.006/min = 0.6 cents/min
      await admin.from("usage_log").insert({
        org_id: orgId,
        user_id: userId,
        feature: "transcribe_reel_audio",
        model: "whisper-1",
        input_tokens: 0,
        output_tokens: 0,
        cost_usd_cents: cents,
      });
    } catch {
      // non-fatal
    }
  }

  return NextResponse.json({
    text: data.text ?? "",
    durationSec: data.duration ?? 0,
    cues,
  });
}
