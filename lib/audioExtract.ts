"use client";

/**
 * audioExtract — pulls a 16 kHz mono WAV out of a video file using the
 * already-loaded ffmpeg.wasm singleton from transcoder.ts.
 *
 * Why WAV at 16 kHz mono:
 *   - Whisper API expects audio it can decode; WAV is universally OK.
 *   - 16 kHz mono is what Whisper internally resamples to anyway, so we
 *     skip the upstream re-encode and minimize upload size (90 s ≈ 2.9 MB).
 *   - Single-thread ffmpeg.wasm can do this in ~3–6 s on a typical Mac.
 *
 * Callers should already have the FFmpeg singleton warmed (renderReel
 * triggers `warmUpTranscoder()` on mount in ReelMultiplier).
 */

import { fetchFile } from "@ffmpeg/util";
import { getFFmpeg } from "./transcoder";

export interface AudioExtractResult {
  blob: Blob;
  /** Total duration in seconds (best-effort; may be 0 if ffmpeg can't probe). */
  durationSec: number;
}

export async function extractAudioWav(
  source: File | Blob,
  onProgress?: (pct: number) => void,
): Promise<AudioExtractResult> {
  const ffmpeg = await getFFmpeg();

  const handleProgress = ({ progress }: { progress: number }) => {
    if (!onProgress) return;
    const pct = Math.max(0, Math.min(100, Math.round(progress * 100)));
    onProgress(pct);
  };
  ffmpeg.on("progress", handleProgress);

  const inputName = "extract_in." + guessExt(source);
  const outputName = "extract_out.wav";

  try {
    await ffmpeg.writeFile(inputName, await fetchFile(source));

    // -vn: drop video stream.
    // -acodec pcm_s16le, -ar 16000, -ac 1: 16-bit mono PCM at 16 kHz.
    // -f wav: explicit WAV container so headers are valid.
    await ffmpeg.exec([
      "-i", inputName,
      "-vn",
      "-acodec", "pcm_s16le",
      "-ar", "16000",
      "-ac", "1",
      "-f", "wav",
      outputName,
    ]);

    const data = await ffmpeg.readFile(outputName);
    const u8 = data as Uint8Array;
    const ab = u8.buffer.slice(u8.byteOffset, u8.byteOffset + u8.byteLength) as ArrayBuffer;
    const blob = new Blob([ab], { type: "audio/wav" });

    try { await ffmpeg.deleteFile(inputName); } catch {}
    try { await ffmpeg.deleteFile(outputName); } catch {}

    // Best-effort duration probe from the WAV header.
    const durationSec = estimateWavDuration(ab);

    if (onProgress) onProgress(100);
    return { blob, durationSec };
  } finally {
    ffmpeg.off("progress", handleProgress);
  }
}

function guessExt(source: File | Blob): string {
  const name = (source as File).name || "";
  const m = name.toLowerCase().match(/\.([a-z0-9]{2,4})$/);
  if (m) return m[1];
  // Fall back from MIME type.
  const mime = source.type || "";
  if (mime.includes("webm")) return "webm";
  if (mime.includes("mp4")) return "mp4";
  if (mime.includes("quicktime")) return "mov";
  return "mp4";
}

function estimateWavDuration(ab: ArrayBuffer): number {
  try {
    const view = new DataView(ab);
    // WAV: bytes 24-27 = sample rate, 34-35 = bits/sample, 22-23 = channels.
    // data chunk size at byte 40 (after the "data" tag at 36-39).
    const sampleRate = view.getUint32(24, true);
    const bitsPerSample = view.getUint16(34, true);
    const channels = view.getUint16(22, true);
    const dataSize = view.getUint32(40, true);
    if (!sampleRate || !bitsPerSample || !channels) return 0;
    const bytesPerSec = (sampleRate * bitsPerSample * channels) / 8;
    return Math.round((dataSize / bytesPerSec) * 100) / 100;
  } catch {
    return 0;
  }
}
