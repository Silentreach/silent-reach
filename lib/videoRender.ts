"use client";

/* Browser-side reel renderer. Composes the final video by:
   - Forcing 9:16 (or 1:1, 16:9) output via center-crop fit
   - Stitching multiple AI-suggested cut segments in sequence
   - Burning the hook line as a text overlay during the first ~3s
   - Watermarking with the user's brand logo (corner mark)
   - Replacing source audio with the user's uploaded music track
     (or keeping source audio if no music provided) */

export interface Segment { startSec: number; endSec: number; }
export type OutputAspect = "9:16" | "1:1" | "16:9";

export interface RenderOptions {
  source: File;
  segments: Segment[];          // 1-N cuts, rendered in sequence
  outputAspect: OutputAspect;
  hookLine?: string;             // overlaid as text during first 3s of total output
  logoDataUrl?: string;          // corner watermark
  musicFile?: File;              // if provided, REPLACES source audio
  brandName?: string;            // small text mark, used if no logo
  onProgress?: (pct: number) => void;
}

export interface RenderResult {
  blob: Blob;
  mimeType: string;
  durationSec: number;
}

const ASPECT_DIMS: Record<OutputAspect, { w: number; h: number }> = {
  "9:16": { w: 1080, h: 1920 },
  "1:1":  { w: 1080, h: 1080 },
  "16:9": { w: 1920, h: 1080 },
};

export async function renderReel(opts: RenderOptions): Promise<RenderResult> {
  const { source, segments, outputAspect, hookLine, logoDataUrl, musicFile, brandName, onProgress } = opts;
  if (segments.length === 0) throw new Error("No cut segments provided.");
  const dims = ASPECT_DIMS[outputAspect];

  /* Source video setup — off-screen, muted (audio comes via captureStream OR is replaced by music) */
  const sourceUrl = URL.createObjectURL(source);
  const video = document.createElement("video");
  video.src = sourceUrl;
  video.crossOrigin = "anonymous";
  video.playsInline = true;
  video.muted = !!musicFile; // if music will replace, mute source
  video.volume = musicFile ? 0 : 0; // visually silent either way
  video.preload = "auto";
  await new Promise<void>((res, rej) => {
    video.onloadedmetadata = () => res();
    video.onerror = () => rej(new Error("Couldn’t read this video file."));
  });

  /* Output canvas at the target aspect — drawing maps source frames via center-crop fit */
  const canvas = document.createElement("canvas");
  canvas.width = dims.w; canvas.height = dims.h;
  const ctx = canvas.getContext("2d", { alpha: false });
  if (!ctx) throw new Error("Browser canvas unavailable.");
  ctx.fillStyle = "#000";
  ctx.fillRect(0, 0, dims.w, dims.h);

  /* Logo (optional) */
  let logoImg: HTMLImageElement | null = null;
  if (logoDataUrl) logoImg = await loadImage(logoDataUrl).catch(() => null);

  /* Compute total target duration of the output (sum of all segment lengths) */
  const totalDur = segments.reduce((acc, s) => acc + Math.max(0, s.endSec - s.startSec), 0);

  /* Audio path — music replaces source if provided, otherwise we use source */
  type CaptureCapableElement = HTMLVideoElement & {
    captureStream?: () => MediaStream;
    mozCaptureStream?: () => MediaStream;
  };
  const v = video as CaptureCapableElement;
  const canvasStream = canvas.captureStream(30);
  const outputStream = new MediaStream();
  for (const t of canvasStream.getVideoTracks()) outputStream.addTrack(t);

  let audioCtx: AudioContext | null = null;
  let musicSourceNode: AudioBufferSourceNode | null = null;
  if (musicFile) {
    audioCtx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
    const arr = await musicFile.arrayBuffer();
    const buf = await audioCtx.decodeAudioData(arr);
    musicSourceNode = audioCtx.createBufferSource();
    musicSourceNode.buffer = buf;
    musicSourceNode.loop = true; // loop in case music is shorter than total duration
    const gain = audioCtx.createGain();
    gain.gain.value = 0.85;
    const dest = audioCtx.createMediaStreamDestination();
    musicSourceNode.connect(gain).connect(dest);
    for (const t of dest.stream.getAudioTracks()) outputStream.addTrack(t);
  } else {
    const srcStream = typeof v.captureStream === "function" ? v.captureStream()
      : typeof v.mozCaptureStream === "function" ? v.mozCaptureStream() : null;
    if (srcStream) for (const t of srcStream.getAudioTracks()) outputStream.addTrack(t);
  }

  /* Recorder */
  const candidates = ["video/webm;codecs=vp9,opus", "video/webm;codecs=vp8,opus", "video/webm", "video/mp4"];
  const mimeType = candidates.find((m) => MediaRecorder.isTypeSupported(m)) || "video/webm";
  const recorder = new MediaRecorder(outputStream, {
    mimeType,
    videoBitsPerSecond: 6_000_000, // bumped for 1080x1920
    audioBitsPerSecond: 128_000,
  });
  const chunks: Blob[] = [];
  recorder.ondataavailable = (e) => { if (e.data && e.data.size > 0) chunks.push(e.data); };

  /* Continuous draw loop — runs the entire render */
  const startWall = performance.now();
  let elapsedOutputMs = 0;
  let drawing = true;
  const drawLoop = () => {
    if (!drawing) return;
    drawFrame(ctx, video, dims);
    // Hook overlay during first 3s of OUTPUT time
    if (hookLine && elapsedOutputMs < 3000) drawHookOverlay(ctx, hookLine, dims);
    if (logoImg) drawLogo(ctx, logoImg, dims);
    else if (brandName) drawBrandText(ctx, brandName, dims);
    requestAnimationFrame(drawLoop);
  };
  requestAnimationFrame(drawLoop);

  recorder.start();
  if (musicSourceNode && audioCtx) musicSourceNode.start();

  /* Walk through segments — seek + play each in sequence */
  for (const seg of segments) {
    await seekTo(video, seg.startSec);
    await new Promise((r) => setTimeout(r, 60)); // settle the seek
    await playUntil(video, seg.endSec, (currentSec) => {
      // Update elapsed output time + progress
      const segElapsed = currentSec - seg.startSec;
      elapsedOutputMs = (performance.now() - startWall);
      const pct = Math.min(1, (sumPriorSegs(segments, seg) + segElapsed) / Math.max(0.1, totalDur));
      onProgress?.(pct);
    });
  }

  drawing = false;
  recorder.stop();
  if (musicSourceNode) try { musicSourceNode.stop(); } catch {}
  if (audioCtx) try { await audioCtx.close(); } catch {}

  await new Promise<void>((res) => { recorder.onstop = () => res(); });
  URL.revokeObjectURL(sourceUrl);
  return { blob: new Blob(chunks, { type: mimeType }), mimeType, durationSec: totalDur };
}

function sumPriorSegs(all: Segment[], current: Segment): number {
  let acc = 0;
  for (const s of all) {
    if (s === current) break;
    acc += Math.max(0, s.endSec - s.startSec);
  }
  return acc;
}

function drawFrame(ctx: CanvasRenderingContext2D, video: HTMLVideoElement, dims: { w: number; h: number }) {
  const sw = video.videoWidth || 1920;
  const sh = video.videoHeight || 1080;
  const sourceAspect = sw / sh;
  const targetAspect = dims.w / dims.h;
  let sx = 0, sy = 0, scw = sw, sch = sh;
  if (sourceAspect > targetAspect) {
    // Source wider than target — center-crop horizontally
    scw = sh * targetAspect;
    sx = (sw - scw) / 2;
  } else if (sourceAspect < targetAspect) {
    // Source narrower — center-crop vertically (zoom to fill)
    sch = sw / targetAspect;
    sy = (sh - sch) / 2;
  }
  ctx.drawImage(video, sx, sy, scw, sch, 0, 0, dims.w, dims.h);
}

function drawHookOverlay(ctx: CanvasRenderingContext2D, text: string, dims: { w: number; h: number }) {
  // Sits in the upper third — typical reel hook placement
  const padding = Math.round(dims.w * 0.06);
  const fontSize = Math.round(dims.w * 0.062);
  ctx.save();
  ctx.font = `700 ${fontSize}px "Inter Tight", Inter, Helvetica, Arial, sans-serif`;
  ctx.textBaseline = "top";
  ctx.fillStyle = "#fff";
  ctx.shadowColor = "rgba(0,0,0,0.85)";
  ctx.shadowBlur = 18;
  ctx.shadowOffsetY = 4;
  // Word-wrap manually
  const maxW = dims.w - padding * 2;
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let line = "";
  for (const w of words) {
    const test = line ? `${line} ${w}` : w;
    if (ctx.measureText(test).width > maxW && line) {
      lines.push(line); line = w;
    } else {
      line = test;
    }
  }
  if (line) lines.push(line);
  const lineH = fontSize * 1.15;
  const top = Math.round(dims.h * 0.18);
  for (let i = 0; i < lines.length; i++) {
    ctx.fillText(lines[i], padding, top + i * lineH, maxW);
  }
  ctx.restore();
}

function drawLogo(ctx: CanvasRenderingContext2D, img: HTMLImageElement, dims: { w: number; h: number }) {
  const lw = Math.round(dims.w * 0.14);
  const lh = Math.round(lw * (img.naturalHeight / img.naturalWidth));
  const pad = Math.round(dims.w * 0.03);
  ctx.save();
  ctx.globalAlpha = 0.92;
  ctx.drawImage(img, dims.w - lw - pad, dims.h - lh - pad, lw, lh);
  ctx.restore();
}

function drawBrandText(ctx: CanvasRenderingContext2D, text: string, dims: { w: number; h: number }) {
  const fs = Math.round(dims.w * 0.022);
  const pad = Math.round(dims.w * 0.04);
  ctx.save();
  ctx.font = `600 ${fs}px Inter, Helvetica, Arial, sans-serif`;
  ctx.fillStyle = "rgba(255,255,255,0.85)";
  ctx.textAlign = "right";
  ctx.textBaseline = "bottom";
  ctx.shadowColor = "rgba(0,0,0,0.6)";
  ctx.shadowBlur = 8;
  ctx.fillText(text.toUpperCase(), dims.w - pad, dims.h - pad);
  ctx.restore();
}

function seekTo(video: HTMLVideoElement, t: number): Promise<void> {
  return new Promise((res) => {
    const handler = () => { video.removeEventListener("seeked", handler); res(); };
    video.addEventListener("seeked", handler);
    video.currentTime = Math.max(0, Math.min(video.duration - 0.05, t));
  });
}

function playUntil(video: HTMLVideoElement, endSec: number, onTick: (currentSec: number) => void): Promise<void> {
  return new Promise((res, rej) => {
    let raf = 0;
    const tick = () => {
      onTick(video.currentTime);
      if (video.ended || video.currentTime >= endSec) {
        cancelAnimationFrame(raf);
        try { video.pause(); } catch {}
        res();
        return;
      }
      raf = requestAnimationFrame(tick);
    };
    video.play().then(() => { raf = requestAnimationFrame(tick); }).catch(rej);
  });
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((res, rej) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => res(img);
    img.onerror = () => rej(new Error("Couldn’t load logo."));
    img.src = src;
  });
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click();
  setTimeout(() => { document.body.removeChild(a); URL.revokeObjectURL(url); }, 100);
}
