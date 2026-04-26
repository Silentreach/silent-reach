"use client";

/* Browser-side video rendering for Reel Multiplier.
   Uses HTMLVideoElement + canvas + MediaRecorder — zero server cost,
   zero ffmpeg complexity. Output is WebM (universal browser codec).
   For IG/FB upload, users convert WebM → MP4 in CapCut (drag-drop, 10s).
   For YouTube, WebM uploads natively. */

export interface RenderOptions {
  source: File;
  startSec: number;
  endSec: number;
  /** Optional logo (data URL) overlaid as corner watermark */
  logoDataUrl?: string;
  /** Optional progress callback 0..1 */
  onProgress?: (pct: number) => void;
}

export interface RenderResult {
  blob: Blob;
  mimeType: string;
  durationSec: number;
}

const TARGET_W = 720;   // standard reel width — keeps file size sane

export async function renderTrimmedReel(opts: RenderOptions): Promise<RenderResult> {
  const { source, startSec, endSec, logoDataUrl, onProgress } = opts;
  const trimDur = Math.max(0.5, endSec - startSec);

  /* Set up the source video element (off-screen but real). */
  const sourceUrl = URL.createObjectURL(source);
  const video = document.createElement("video");
  video.src = sourceUrl;
  video.crossOrigin = "anonymous";
  video.playsInline = true;
  // We DO want the audio so MediaRecorder can pick it up via the stream
  video.muted = false;
  video.volume = 0; // silent to the user, but the stream still carries audio
  video.preload = "auto";

  await new Promise<void>((res, rej) => {
    video.onloadedmetadata = () => res();
    video.onerror = () => rej(new Error("Couldn't read this video file."));
  });

  /* Canvas sized to the source aspect (preserves orientation). */
  const aspect = (video.videoHeight || 1280) / (video.videoWidth || 720);
  const W = TARGET_W;
  const H = Math.round(W * aspect);
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d", { alpha: false });
  if (!ctx) throw new Error("Browser canvas unavailable.");

  /* Optional logo */
  let logoImg: HTMLImageElement | null = null;
  if (logoDataUrl) {
    logoImg = await loadImage(logoDataUrl);
  }

  /* Build the output stream:
     - Video track from canvas at 30fps
     - Audio track captured from the video element via captureStream() */
  const canvasStream = canvas.captureStream(30);

  // captureStream on video gives us BOTH video and audio — we only want the audio
  type CaptureCapableElement = HTMLVideoElement & {
    captureStream?: () => MediaStream;
    mozCaptureStream?: () => MediaStream;
  };
  const v = video as CaptureCapableElement;
  const sourceStream =
    typeof v.captureStream === "function" ? v.captureStream()
    : typeof v.mozCaptureStream === "function" ? v.mozCaptureStream()
    : null;

  const outputStream = new MediaStream();
  for (const track of canvasStream.getVideoTracks()) outputStream.addTrack(track);
  if (sourceStream) {
    for (const track of sourceStream.getAudioTracks()) outputStream.addTrack(track);
  }

  /* Recorder — pick the best supported MIME type the browser offers */
  const candidates = [
    "video/webm;codecs=vp9,opus",
    "video/webm;codecs=vp8,opus",
    "video/webm",
    "video/mp4",
  ];
  const mimeType = candidates.find((m) => MediaRecorder.isTypeSupported(m)) || "video/webm";

  const recorder = new MediaRecorder(outputStream, {
    mimeType,
    videoBitsPerSecond: 4_000_000, // 4 Mbps — solid quality at 720p
    audioBitsPerSecond: 128_000,
  });

  const chunks: Blob[] = [];
  recorder.ondataavailable = (e) => { if (e.data && e.data.size > 0) chunks.push(e.data); };

  /* Seek to start, then play, draw frames into canvas, stop when we hit end. */
  await seekTo(video, startSec);
  recorder.start();

  const renderPromise = new Promise<void>((resolve, reject) => {
    let raf = 0;
    const tick = () => {
      if (video.ended || video.currentTime >= endSec) {
        cancelAnimationFrame(raf);
        recorder.stop();
        return;
      }
      ctx.drawImage(video, 0, 0, W, H);
      if (logoImg) {
        // Bottom-right corner mark, ~14% width, with a little padding
        const lw = Math.round(W * 0.14);
        const lh = Math.round(lw * (logoImg.naturalHeight / logoImg.naturalWidth));
        const pad = Math.round(W * 0.025);
        ctx.globalAlpha = 0.92;
        ctx.drawImage(logoImg, W - lw - pad, H - lh - pad, lw, lh);
        ctx.globalAlpha = 1;
      }
      const pct = Math.min(1, Math.max(0, (video.currentTime - startSec) / trimDur));
      onProgress?.(pct);
      raf = requestAnimationFrame(tick);
    };
    recorder.onstop = () => {
      URL.revokeObjectURL(sourceUrl);
      resolve();
    };
    recorder.onerror = (e: Event) => reject(new Error("Recorder error: " + ((e as ErrorEvent).message || "unknown")));
    video.onerror = () => reject(new Error("Source video playback failed."));
    video.play().then(() => { tick(); }).catch(reject);
  });

  await renderPromise;
  const blob = new Blob(chunks, { type: mimeType });
  return { blob, mimeType, durationSec: trimDur };
}

function seekTo(video: HTMLVideoElement, t: number): Promise<void> {
  return new Promise((res) => {
    const handler = () => { video.removeEventListener("seeked", handler); res(); };
    video.addEventListener("seeked", handler);
    video.currentTime = Math.max(0, t);
  });
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((res, rej) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => res(img);
    img.onerror = () => rej(new Error("Couldn't load logo."));
    img.src = src;
  });
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => { document.body.removeChild(a); URL.revokeObjectURL(url); }, 100);
}
