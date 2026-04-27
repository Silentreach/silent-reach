// lib/transcoder.ts
// Browser-side WebM → MP4 transcoding via ffmpeg.wasm.
// Loaded lazily on first render so the wasm only downloads when the user actually
// clicks Render. Single-thread build only — multi-thread had reliability issues
// in production (worker construction races, missing progress events).

"use client";

import { FFmpeg } from "@ffmpeg/ffmpeg";
import { fetchFile, toBlobURL } from "@ffmpeg/util";

let ffmpegInstance: FFmpeg | null = null;
let loadingPromise: Promise<FFmpeg> | null = null;

const CORE_VERSION = "0.12.10";
const CORE_BASE = `https://unpkg.com/@ffmpeg/core@${CORE_VERSION}/dist/umd`;

async function getFFmpeg(): Promise<FFmpeg> {
  if (ffmpegInstance) return ffmpegInstance;
  if (loadingPromise) return loadingPromise;

  loadingPromise = (async () => {
    const ffmpeg = new FFmpeg();
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

export async function transcodeWebMToMP4(
  webm: Blob,
  onProgress?: (pct: number) => void,
): Promise<Blob> {
  const ffmpeg = await getFFmpeg();

  const handleProgress = ({ progress }: { progress: number }) => {
    if (!onProgress) return;
    const pct = Math.max(0, Math.min(100, Math.round(progress * 100)));
    onProgress(pct);
  };
  ffmpeg.on("progress", handleProgress);

  // Estimated-progress fallback. ffmpeg.wasm progress events fire inconsistently —
  // sometimes not at all for short clips. We poll wall-clock time and synthesize a
  // smooth 0-95% curve based on a typical encode rate so the UI doesn't sit at 0.
  let estimateTimer: ReturnType<typeof setInterval> | null = null;
  let lastReported = 0;
  if (onProgress) {
    const t0 = performance.now();
    const ESTIMATED_TOTAL_MS = 35_000;
    estimateTimer = setInterval(() => {
      const elapsed = performance.now() - t0;
      const pct = Math.min(95, Math.round((elapsed / ESTIMATED_TOTAL_MS) * 100));
      if (pct > lastReported) {
        lastReported = pct;
        onProgress(pct);
      }
    }, 400);
  }

  const inputName = "input.webm";
  const outputName = "output.mp4";

  try {
    await ffmpeg.writeFile(inputName, await fetchFile(webm));

    // -preset veryfast: fast enough to feel responsive, clean output.
    // -crf 23: visually transparent for typical reel content.
    // -pix_fmt yuv420p: maximum mobile/social compatibility.
    // -movflags +faststart: moov atom up front so previews start instantly.
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
    const u8 = data as Uint8Array;
    const ab = u8.buffer.slice(u8.byteOffset, u8.byteOffset + u8.byteLength) as ArrayBuffer;
    const mp4 = new Blob([ab], { type: "video/mp4" });

    try { await ffmpeg.deleteFile(inputName); } catch {}
    try { await ffmpeg.deleteFile(outputName); } catch {}

    if (onProgress) onProgress(100);
    return mp4;
  } finally {
    ffmpeg.off("progress", handleProgress);
    if (estimateTimer) clearInterval(estimateTimer);
  }
}

export function isMultiThreaded(): boolean {
  return false;
}

export async function warmUpTranscoder(): Promise<boolean> {
  try {
    await getFFmpeg();
    return true;
  } catch {
    return false;
  }
}
