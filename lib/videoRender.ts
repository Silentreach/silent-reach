"use client";

/* Browser-side reel renderer with cinematic finish:
   - 9:16 (or 1:1, 16:9) output via center-crop fit
   - Multi-segment stitching from AI cut markers
   - Hook overlay text — top OR bottom, platform-aware
   - Brand logo corner watermark throughout
   - Animated logo OUTRO (2s end card) if logo provided
   - Audio + video FADE OUT in last 1.5s of main timeline
   - Music upload OR source audio, both routed through Web Audio
     so both can be cleanly faded */

export interface Segment { startSec: number; endSec: number; }
export type OutputAspect = "9:16" | "1:1" | "16:9";
export type HookPosition = "top" | "bottom" | "auto";

export interface RenderOptions {
  source: File;
  segments: Segment[];
  outputAspect: OutputAspect;
  hookLine?: string;
  hookPosition?: HookPosition;        // default "auto"
  platform?: "instagram_reel" | "youtube_short" | "facebook_reel";
  logoDataUrl?: string;
  musicFile?: File;
  brandName?: string;
  includeOutro?: boolean;             // default true if logo present
  outroDurationSec?: number;          // default 2.0
  fadeOutSec?: number;                // default 1.5
  onProgress?: (pct: number) => void;
}

export interface RenderResult { blob: Blob; mimeType: string; durationSec: number; }

const ASPECT_DIMS: Record<OutputAspect, { w: number; h: number }> = {
  "9:16": { w: 1080, h: 1920 },
  "1:1":  { w: 1080, h: 1080 },
  "16:9": { w: 1920, h: 1080 },
};

/* Platform-tuned defaults for hook position. Modern IG reels anchor
   the hook line in the lower third (above the caption gradient).
   YT Shorts and FB Reels look better with top-third hooks. */
function resolveHookPosition(p?: HookPosition, platform?: RenderOptions["platform"]): "top" | "bottom" {
  if (p === "top") return "top";
  if (p === "bottom") return "bottom";
  if (platform === "instagram_reel") return "bottom";
  return "top";
}

export async function renderReel(opts: RenderOptions): Promise<RenderResult> {
  const {
    source, segments, outputAspect, hookLine, logoDataUrl, musicFile, brandName,
    onProgress,
  } = opts;
  if (segments.length === 0) throw new Error("No cut segments provided.");
  const dims = ASPECT_DIMS[outputAspect];
  const hookPos = resolveHookPosition(opts.hookPosition, opts.platform);
  const fadeOutSec = opts.fadeOutSec ?? 1.5;
  const outroDurSec = opts.outroDurationSec ?? 2.0;
  const includeOutro = (opts.includeOutro ?? true) && !!logoDataUrl;

  const totalMainDur = segments.reduce((acc, s) => acc + Math.max(0, s.endSec - s.startSec), 0);
  const totalRenderDur = totalMainDur + (includeOutro ? outroDurSec : 0);

  /* Source video */
  const sourceUrl = URL.createObjectURL(source);
  const video = document.createElement("video");
  video.src = sourceUrl;
  video.crossOrigin = "anonymous";
  video.playsInline = true;
  video.preload = "auto";
  // Mute the element so it doesn't double-output to speakers — audio is routed through Web Audio
  video.muted = false;
  video.volume = 0;
  await new Promise<void>((res, rej) => {
    video.onloadedmetadata = () => res();
    video.onerror = () => rej(new Error("Couldn’t read this video file."));
  });

  /* Canvas */
  const canvas = document.createElement("canvas");
  canvas.width = dims.w; canvas.height = dims.h;
  const ctx = canvas.getContext("2d", { alpha: false });
  if (!ctx) throw new Error("Browser canvas unavailable.");
  ctx.fillStyle = "#000"; ctx.fillRect(0, 0, dims.w, dims.h);

  /* Logo */
  let logoImg: HTMLImageElement | null = null;
  if (logoDataUrl) logoImg = await loadImage(logoDataUrl).catch(() => null);

  /* Audio path — both music and source go through Web Audio so we can fade either */
  type AudioCtxCtor = typeof AudioContext;
  const AudioCtx = (window.AudioContext || (window as unknown as { webkitAudioContext: AudioCtxCtor }).webkitAudioContext);
  const audioCtx = new AudioCtx();
  const masterGain = audioCtx.createGain();
  masterGain.gain.value = 0.9;
  const audioDest = audioCtx.createMediaStreamDestination();
  masterGain.connect(audioDest);

  let musicNode: AudioBufferSourceNode | null = null;
  let mediaSourceNode: MediaElementAudioSourceNode | null = null;
  if (musicFile) {
    const buf = await audioCtx.decodeAudioData(await musicFile.arrayBuffer());
    musicNode = audioCtx.createBufferSource();
    musicNode.buffer = buf;
    musicNode.loop = true;
    musicNode.connect(masterGain);
  } else {
    // Route the video element's audio through Web Audio so we can fade it
    try {
      mediaSourceNode = audioCtx.createMediaElementSource(video);
      mediaSourceNode.connect(masterGain);
    } catch {
      // Some browsers throw if createMediaElementSource is called twice — fall back to no audio
    }
  }

  /* Build output stream — canvas video + Web Audio audio */
  const canvasStream = canvas.captureStream(30);
  const outputStream = new MediaStream();
  for (const t of canvasStream.getVideoTracks()) outputStream.addTrack(t);
  for (const t of audioDest.stream.getAudioTracks()) outputStream.addTrack(t);

  /* MediaRecorder */
  const candidates = ["video/webm;codecs=vp9,opus", "video/webm;codecs=vp8,opus", "video/webm", "video/mp4"];
  const mimeType = candidates.find((m) => MediaRecorder.isTypeSupported(m)) || "video/webm";
  const recorder = new MediaRecorder(outputStream, {
    mimeType,
    videoBitsPerSecond: 6_000_000,
    audioBitsPerSecond: 128_000,
  });
  const chunks: Blob[] = [];
  recorder.ondataavailable = (e) => { if (e.data && e.data.size > 0) chunks.push(e.data); };

  /* Phase-driven draw loop (main → outro → stopped) */
  type Phase = "main" | "outro" | "stopped";
  let phase: Phase = "main";
  const renderStartWall = performance.now();
  let outroStartWall = 0;

  const drawLoop = () => {
    if (phase === "stopped") return;
    const nowMs = performance.now();
    const elapsedTotalSec = (nowMs - renderStartWall) / 1000;

    if (phase === "main") {
      drawFrame(ctx, video, dims);
      if (hookLine && elapsedTotalSec < 3.0) {
        drawHookOverlay(ctx, hookLine, dims, hookPos);
      }
      if (logoImg) drawLogo(ctx, logoImg, dims);
      else if (brandName) drawBrandText(ctx, brandName, dims);

      // Visual fadeout in the last fadeOutSec seconds of MAIN (before outro)
      const remainingMain = totalMainDur - elapsedTotalSec;
      if (remainingMain < fadeOutSec && remainingMain > 0) {
        const a = (fadeOutSec - remainingMain) / fadeOutSec;
        ctx.fillStyle = `rgba(0,0,0,${a.toFixed(3)})`;
        ctx.fillRect(0, 0, dims.w, dims.h);
      }
    } else if (phase === "outro" && logoImg) {
      drawOutroFrame(ctx, dims, logoImg, brandName, (nowMs - outroStartWall) / 1000, outroDurSec);
    }

    if (onProgress) onProgress(Math.min(1, elapsedTotalSec / totalRenderDur));
    requestAnimationFrame(drawLoop);
  };
  requestAnimationFrame(drawLoop);

  /* Schedule audio fadeout to align with the visual one. Music continues
     into the outro at a lower volume; source audio fades to 0 at end of main. */
  const t0 = audioCtx.currentTime;
  if (musicNode) {
    masterGain.gain.setValueAtTime(0.9, t0);
    masterGain.gain.setValueAtTime(0.9, t0 + totalMainDur - fadeOutSec);
    masterGain.gain.linearRampToValueAtTime(includeOutro ? 0.4 : 0, t0 + totalMainDur);
    if (includeOutro) {
      masterGain.gain.setValueAtTime(0.4, t0 + totalMainDur);
      masterGain.gain.linearRampToValueAtTime(0, t0 + totalRenderDur - 0.1);
    }
  } else if (mediaSourceNode) {
    masterGain.gain.setValueAtTime(0.9, t0);
    masterGain.gain.setValueAtTime(0.9, t0 + totalMainDur - fadeOutSec);
    masterGain.gain.linearRampToValueAtTime(0, t0 + totalMainDur);
  }

  recorder.start();
  if (musicNode) musicNode.start();

  /* Walk segments */
  for (const seg of segments) {
    await seekTo(video, seg.startSec);
    await new Promise((r) => setTimeout(r, 60));
    await playUntil(video, seg.endSec);
  }

  /* Outro phase */
  if (includeOutro && logoImg) {
    outroStartWall = performance.now();
    phase = "outro";
    await new Promise((r) => setTimeout(r, outroDurSec * 1000));
  }

  phase = "stopped";
  if (musicNode) try { musicNode.stop(); } catch {}
  recorder.stop();

  await new Promise<void>((res) => { recorder.onstop = () => res(); });
  try { await audioCtx.close(); } catch {}
  URL.revokeObjectURL(sourceUrl);
  return { blob: new Blob(chunks, { type: mimeType }), mimeType, durationSec: totalRenderDur };
}

/* ───────── Drawing helpers ───────── */

function drawFrame(ctx: CanvasRenderingContext2D, video: HTMLVideoElement, dims: { w: number; h: number }) {
  const sw = video.videoWidth || 1920;
  const sh = video.videoHeight || 1080;
  const sourceAspect = sw / sh;
  const targetAspect = dims.w / dims.h;
  let sx = 0, sy = 0, scw = sw, sch = sh;
  if (sourceAspect > targetAspect) {
    scw = sh * targetAspect;
    sx = (sw - scw) / 2;
  } else if (sourceAspect < targetAspect) {
    sch = sw / targetAspect;
    sy = (sh - sch) / 2;
  }
  ctx.drawImage(video, sx, sy, scw, sch, 0, 0, dims.w, dims.h);
}

function drawHookOverlay(ctx: CanvasRenderingContext2D, text: string, dims: { w: number; h: number }, position: "top" | "bottom") {
  const padding = Math.round(dims.w * 0.06);
  const fontSize = Math.round(dims.w * 0.062);
  ctx.save();
  ctx.font = `700 ${fontSize}px "Inter Tight", Inter, Helvetica, Arial, sans-serif`;
  ctx.fillStyle = "#fff";
  ctx.shadowColor = "rgba(0,0,0,0.85)";
  ctx.shadowBlur = 18;
  ctx.shadowOffsetY = 4;
  const maxW = dims.w - padding * 2;
  const lines: string[] = [];
  const words = text.split(/\s+/);
  let line = "";
  for (const w of words) {
    const test = line ? `${line} ${w}` : w;
    if (ctx.measureText(test).width > maxW && line) { lines.push(line); line = w; }
    else line = test;
  }
  if (line) lines.push(line);
  const lineH = fontSize * 1.15;
  if (position === "top") {
    ctx.textBaseline = "top";
    const top = Math.round(dims.h * 0.16);
    for (let i = 0; i < lines.length; i++) ctx.fillText(lines[i], padding, top + i * lineH, maxW);
  } else {
    ctx.textBaseline = "bottom";
    const blockH = lines.length * lineH;
    const bottom = Math.round(dims.h * 0.78);
    for (let i = 0; i < lines.length; i++) {
      ctx.fillText(lines[i], padding, bottom - blockH + (i + 1) * lineH, maxW);
    }
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

/* The motion logo outro: black background, logo zooms in (0.85 → 1),
   holds, then fades to black. Brand name optionally below. */
function drawOutroFrame(
  ctx: CanvasRenderingContext2D,
  dims: { w: number; h: number },
  logo: HTMLImageElement,
  brandName: string | undefined,
  elapsedSec: number,
  totalSec: number,
) {
  // Background
  ctx.fillStyle = "#000";
  ctx.fillRect(0, 0, dims.w, dims.h);

  const t = Math.min(1, Math.max(0, elapsedSec / totalSec));
  let alpha: number, scale: number;
  if (t < 0.25) {
    // Fade in + zoom in
    const k = t / 0.25;
    alpha = k;
    scale = 0.85 + k * 0.15;
  } else if (t < 0.7) {
    // Hold
    alpha = 1;
    scale = 1;
  } else {
    // Fade out
    alpha = Math.max(0, 1 - (t - 0.7) / 0.3);
    scale = 1;
  }

  const targetW = Math.round(dims.w * 0.42 * scale);
  const targetH = Math.round(targetW * (logo.naturalHeight / logo.naturalWidth));
  const x = Math.round((dims.w - targetW) / 2);
  const y = Math.round((dims.h - targetH) / 2 - dims.w * 0.04); // slightly above center

  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.drawImage(logo, x, y, targetW, targetH);

  if (brandName) {
    const fs = Math.round(dims.w * 0.028);
    ctx.font = `500 ${fs}px Inter, Helvetica, Arial, sans-serif`;
    ctx.fillStyle = "rgba(255,255,255,0.85)";
    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    ctx.fillText(brandName.toUpperCase(), dims.w / 2, y + targetH + dims.w * 0.025);
  }
  ctx.restore();
}

/* ───────── Utilities ───────── */

function seekTo(video: HTMLVideoElement, t: number): Promise<void> {
  return new Promise((res) => {
    const handler = () => { video.removeEventListener("seeked", handler); res(); };
    video.addEventListener("seeked", handler);
    video.currentTime = Math.max(0, Math.min((video.duration || 9999) - 0.05, t));
  });
}

function playUntil(video: HTMLVideoElement, endSec: number): Promise<void> {
  return new Promise((res, rej) => {
    let raf = 0;
    const tick = () => {
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
