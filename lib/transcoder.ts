// lib/transcoder.ts
// Browser-side WebM → MP4 transcoding via ffmpeg.wasm.
// Loaded lazily on first render so the wasm only downloads when the user actually
// clicks Render. Picks the multi-threaded build when the page is cross-origin
// isolated (COEP/COOP set in next.config.js), else falls back to single-thread.

"use client";

import { FFmpeg } from "@ffmpeg/ffmpeg";
import { fetchFile, toBlobURL } from "@ffmpeg/util";

let ffmpegInstance: FFmpeg | null = null;
let loadingPromise: Promise<FFmpeg> | null = null;

const ST_VERSION = "0.12.10";
const MT_VERSION = "0.12.10";

const ST_BASE = `https://unpkg.com/@ffmpeg/core@${ST_VERSION}/dist/umd`;
const MT_BASE = `https://unpkg.com/@ffmpeg/core-mt@${MT_VERSION}/dist/umd`;

function canRunMultiThread(): boolean {
  return (
    typeof window !== "undefined" &&
    !!(window as unknown as { crossOriginIsolated?: boolean }).crossOriginIsolated &&
    typeof SharedArrayBuffer !== "undefined"
  );
}

async function getFFmpeg(): Promise<FFmpeg> {
  if (ffmpegInstance) return ffmpegInstance;
  if (loadingPromise) return loadingPromise;

  loadingPromise = (async () => {
    const ffmpeg = new FFmpeg();
    const useMT = canRunMultiThread();
    const base = useMT ? MT_BASE : ST_BASE;

    const coreURL = await toBlobURL(`${base}/ffmpeg-core.js`, "text/javascript");
    const wasmURL = await toBlobURL(`${base}/ffmpeg-core.wasm`, "application/wasm");

    if (useMT) {
      const workerURL = await toBlobURL(`${base}/ffmpeg-core.worker.js`, "text/javascript");
      await ffmpeg.load({ coreURL, wasmURL, workerURL });
    } else {
      await ffmpeg.load({ coreURL, wasmURL });
    }
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

  const inputName = "input.webm";
  const outputName = "output.mp4";

  try {
    await ffmpeg.writeFile(inputName, await fetchFile(webm));

    // -preset fast: balanced preset. Combined with multi-thread it stays much
    // faster than veryfast/single-thread used to be, but produces clean output
    // without ultrafast's blockiness on detail-heavy frames.
    // -crf 23: visually transparent for typical reel content.
    await ffmpeg.exec([
      "-i", inputName,
      "-c:v", "libx264",
      "-preset", "fast",
      "-crf", "23",
      "-pix_fmt", "yuv420p",
      "-threads", "0",
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

    return mp4;
  } finally {
    ffmpeg.off("progress", handleProgress);
  }
}

export function isMultiThreaded(): boolean {
  return canRunMultiThread();
}

export async function warmUpTranscoder(): Promise<boolean> {
  try {
    await getFFmpeg();
    return true;
  } catch {
    return false;
  }
}
