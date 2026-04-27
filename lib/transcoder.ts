// lib/transcoder.ts
// Browser-side WebM → MP4 transcoding via ffmpeg.wasm.
// Loaded lazily so the ~30MB wasm only downloads when the user actually renders.
// Uses the single-thread build (`@ffmpeg/core`) hosted on unpkg — sends correct CORS,
// no SharedArrayBuffer / COEP / COOP headers required.

"use client";

import { FFmpeg } from "@ffmpeg/ffmpeg";
import { fetchFile, toBlobURL } from "@ffmpeg/util";

let ffmpegInstance: FFmpeg | null = null;
let loadingPromise: Promise<FFmpeg> | null = null;

// Pin a version so deploys are reproducible.
const CORE_VERSION = "0.12.10";
const CORE_BASE = `https://unpkg.com/@ffmpeg/core@${CORE_VERSION}/dist/umd`;

async function getFFmpeg(): Promise<FFmpeg> {
  if (ffmpegInstance) return ffmpegInstance;
  if (loadingPromise) return loadingPromise;

  loadingPromise = (async () => {
    const ffmpeg = new FFmpeg();
    // toBlobURL fetches the file with CORS and turns it into a same-origin blob: URL.
    // That sidesteps every Worker / scriptloader cross-origin restriction.
    const [coreURL, wasmURL] = await Promise.all([
      toBlobURL(`${CORE_BASE}/ffmpeg-core.js`, "text/javascript"),
      toBlobURL(`${CORE_BASE}/ffmpeg-core.wasm`, "application/wasm"),
    ]);
    await ffmpeg.load({ coreURL, wasmURL });
    ffmpegInstance = ffmpeg;
    return ffmpeg;
  })();

  try {
    return await loadingPromise;
  } catch (err) {
    loadingPromise = null;
    throw err;
  }
}

/**
 * Transcode a WebM blob to MP4 (H.264 + AAC, faststart for streaming).
 * Returns the MP4 blob. Caller should fall back to the original WebM blob if this rejects.
 */
export async function transcodeWebMToMP4(
  webm: Blob,
  onProgress?: (pct: number) => void,
): Promise<Blob> {
  const ffmpeg = await getFFmpeg();

  // Wire progress (0..1 -> 0..100). The ffmpeg.wasm progress event fires periodically.
  const handleProgress = ({ progress }: { progress: number }) => {
    if (!onProgress) return;
    const pct = Math.max(0, Math.min(100, Math.round(progress * 100)));
    onProgress(pct);
  };
  ffmpeg.on("progress", handleProgress);

  const inputName = "input.webm";
  const outputName = "output.mp4";

  try {
    await ffmpeg.writeFile(inputName, await fetchFile(webm));

    // -preset veryfast keeps wasm CPU sane.
    // -crf 23 = good visual quality at reasonable file size.
    // -movflags +faststart puts moov atom at the front so previews start instantly.
    // -pix_fmt yuv420p maximises mobile/social compatibility.
    await ffmpeg.exec([
      "-i", inputName,
      "-c:v", "libx264",
      "-preset", "veryfast",
      "-crf", "23",
      "-pix_fmt", "yuv420p",
      "-c:a", "aac",
      "-b:a", "160k",
      "-movflags", "+faststart",
      outputName,
    ]);

    const data = await ffmpeg.readFile(outputName);
    // data is Uint8Array. Convert to a plain ArrayBuffer to satisfy BlobPart typing
    // across builds where Uint8Array is generic over its underlying buffer.
    const u8 = data as Uint8Array;
    const ab = u8.buffer.slice(u8.byteOffset, u8.byteOffset + u8.byteLength) as ArrayBuffer;
    const mp4 = new Blob([ab], { type: "video/mp4" });

    // Clean the virtual filesystem so subsequent renders don't accumulate.
    try { await ffmpeg.deleteFile(inputName); } catch {}
    try { await ffmpeg.deleteFile(outputName); } catch {}

    return mp4;
  } finally {
    ffmpeg.off("progress", handleProgress);
  }
}

/** Optional pre-warm — call on idle so the first render is faster. */
export async function warmUpTranscoder(): Promise<boolean> {
  try {
    await getFFmpeg();
    return true;
  } catch {
    return false;
  }
}
