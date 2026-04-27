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

// Pin versions so deploys are reproducible.
const ST_VERSION = "0.12.10";
const MT_VERSION = "0.12.10";

const ST_BASE = `https://unpkg.com/@ffmpeg/core@${ST_VERSION}/dist/umd`;
const MT_BASE = `https://unpkg.com/@ffmpeg/core-mt@${MT_VERSION}/dist/umd`;

function canRunMultiThread(): boolean {
  // window.crossOriginIsolated is true only when the page sent COEP/COOP headers
  // AND all cross-origin resources opted in. SharedArrayBuffer existence is a
  // secondary sanity check (Firefox + Safari old versions).
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

    // toBlobURL fetches each file and converts to a same-origin blob: URL,
    // which sidesteps COEP/CORP issues for the worker bootstrap.
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

/**
 * Transcode a WebM blob to MP4 (H.264 + AAC, faststart).
 * Returns the MP4 blob. Caller should fall back to the original WebM blob if this rejects.
 */
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

    // -preset ultrafast: fastest libx264 preset that still ships acceptable quality.
    // -crf 25: slightly more compression than 23, ~15% smaller files, marginal quality loss.
    // -threads 0: let libx264 use all available pthreads in MT mode (no-op in ST).
    // -pix_fmt yuv420p: maximum mobile/social compatibility.
    // -movflags +faststart: moov atom up front so previews start instantly.
    await ffmpeg.exec([
      "-i", inputName,
      "-c:v", "libx264",
      "-preset", "ultrafast",
      "-crf", "25",
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

/** True when the multi-threaded build is in use — useful for UI hints. */
export function isMultiThreaded(): boolean {
  return canRunMultiThread();
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
