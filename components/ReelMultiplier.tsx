"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { getBrandKit } from "@/lib/userContext";
import { renderReel, downloadBlob } from "@/lib/videoRender";
import { computeSubjectZone, inferTransition, type SubjectZone, type TransitionType } from "@/lib/frameAnalysis";
import MusicBrowser, { type PixabayTrack } from "@/components/MusicBrowser";
import { transcodeWebMToMP4 } from "@/lib/transcoder";
import { detectBPM, snapSegmentsToBeats } from "@/lib/audioAnalysis";
import {
  Upload, Sparkles, Loader2, Film, X, Music, Clock, MessageSquare,
  Hash, Image as ImageIcon, ArrowRight, Instagram, Youtube, Facebook, ExternalLink, Check, Download,
} from "lucide-react";
import { getUserContext } from "@/lib/userContext";
import type {
  ReelMultiplierOutput, ReelPackage, ReelPlatform,
} from "@/types";

const MAX_DURATION_SEC = 180; // accept up to 3 minutes
const FRAME_COUNT = 12; // 12 frames at 1080p quality gives the AI real context for cut selection
const FRAME_MAX_W = 640; // smaller per-frame so we can afford 12 of them in one Haiku call
const MOTION_SAMPLE_W = 96; // tiny resize for cheap pixel-diff motion calc



interface RenderedPreview {
  url: string;
  mime: string;
  filename: string;
  thumbUrl: string | null;
  thumbName: string;
  trackTitle?: string;
}

interface ExtractedFrame { data: string; mediaType: "image/jpeg"; timestampSec: number; motionDelta: number; subjectZone?: SubjectZone; }

/**
 * Extract N frames + compute motion delta between consecutive frames using a tiny
 * canvas pixel-diff. Motion delta tells the AI which frames are visually dynamic
 * (probable highlights / camera moves) vs static (probable B-roll filler).
 */
async function extractFramesFromFile(file: File, onProgress?: (done: number, total: number) => void): Promise<{ frames: ExtractedFrame[]; durationSec: number }> {
  const url = URL.createObjectURL(file);
  try {
    const video = document.createElement("video");
    video.src = url;
    video.muted = true;
    video.preload = "auto";
    video.crossOrigin = "anonymous";
    await new Promise<void>((res, rej) => {
      video.onloadedmetadata = () => res();
      video.onerror = () => rej(new Error("Couldn’t read this video file. Try MP4 or MOV."));
    });
    const duration = video.duration;
    if (!isFinite(duration) || duration < 2) throw new Error("Video is too short or its duration couldn’t be determined.");
    if (duration > MAX_DURATION_SEC) throw new Error(`Reel Multiplier currently accepts videos up to ${MAX_DURATION_SEC}s. Your video is ${Math.round(duration)}s.`);

    const aspect = video.videoHeight / video.videoWidth || 0.5625;
    const w = Math.min(FRAME_MAX_W, video.videoWidth || FRAME_MAX_W);
    const h = Math.round(w * aspect);
    const canvas = document.createElement("canvas");
    canvas.width = w; canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Browser canvas unavailable.");

    // Tiny canvas just for motion-delta calculation (cheap pixel diff)
    const motionCanvas = document.createElement("canvas");
    const motionH = Math.round(MOTION_SAMPLE_W * aspect);
    motionCanvas.width = MOTION_SAMPLE_W; motionCanvas.height = motionH;
    const motionCtx = motionCanvas.getContext("2d", { willReadFrequently: true });
    if (!motionCtx) throw new Error("Browser canvas unavailable.");

    const rawFrames: { data: string; timestampSec: number; pixels: Uint8ClampedArray }[] = [];
    for (let i = 0; i < FRAME_COUNT; i++) {
      onProgress?.(i, FRAME_COUNT);
      const t = (duration / (FRAME_COUNT + 1)) * (i + 1);
      video.currentTime = t;
      await new Promise<void>((res) => { video.onseeked = () => res(); });
      // Full-quality frame for AI vision input
      ctx.drawImage(video, 0, 0, w, h);
      const dataUrl = canvas.toDataURL("image/jpeg", 0.82);
      const base64 = dataUrl.split(",", 2)[1];
      // Tiny frame for motion-delta calc
      motionCtx.drawImage(video, 0, 0, MOTION_SAMPLE_W, motionH);
      const pixels = motionCtx.getImageData(0, 0, MOTION_SAMPLE_W, motionH).data;
      rawFrames.push({ data: base64, timestampSec: t, pixels });
    }

    // Compute motion delta: average per-pixel luminance diff vs previous frame.
    // First frame's delta is 0 (nothing to compare). Normalized 0-1 across the set
    // so the AI sees relative motion ("frame 7 moved 4x more than frame 1").
    const rawDeltas: number[] = [0];
    for (let i = 1; i < rawFrames.length; i++) {
      const a = rawFrames[i - 1].pixels;
      const b = rawFrames[i].pixels;
      let sum = 0;
      // Skip alpha channel; subsample every 4th pixel for speed
      for (let p = 0; p < a.length; p += 16) {
        const lumA = 0.299 * a[p] + 0.587 * a[p + 1] + 0.114 * a[p + 2];
        const lumB = 0.299 * b[p] + 0.587 * b[p + 1] + 0.114 * b[p + 2];
        sum += Math.abs(lumA - lumB);
      }
      rawDeltas.push(sum / (a.length / 16));
    }
    const maxDelta = Math.max(...rawDeltas, 1);
    const normalized = rawDeltas.map((d) => Math.round((d / maxDelta) * 100) / 100);

    // Subject-zone analysis: where in each frame is the subject (probably).
    // Used by the renderer to bias the 9:16 crop window so subjects don't
    // get amputated at frame edges. Cheap (64px sub-canvas, runs in parallel).
    const subjectZones = await Promise.all(
      rawFrames.map(async (f) => computeSubjectZone(`data:image/jpeg;base64,${f.data}`)),
    );

    const frames: ExtractedFrame[] = rawFrames.map((f, i) => ({
      data: f.data,
      mediaType: "image/jpeg",
      timestampSec: Math.round(f.timestampSec * 10) / 10,
      motionDelta: normalized[i],
      subjectZone: subjectZones[i],
    }));
    return { frames, durationSec: duration };
  } finally { URL.revokeObjectURL(url); }
}


// Find the frame whose timestamp is closest to a target time (for crop-bias lookup).
function pickClosestFrame(frames: ExtractedFrame[], targetSec: number): ExtractedFrame | undefined {
  if (frames.length === 0) return undefined;
  let best = frames[0];
  let bestDelta = Math.abs(best.timestampSec - targetSec);
  for (const f of frames) {
    const d = Math.abs(f.timestampSec - targetSec);
    if (d < bestDelta) { bestDelta = d; best = f; }
  }
  return best;
}




// Capture a single high-quality JPEG from a video file at a given timestamp.
// Used to produce a downloadable thumbnail companion alongside the rendered reel.

// Auto-fit a logo image: load → downsample to <=1080px on the longest side
// → output as PNG data URL (preserves transparency for logos with alpha).
// Why: GCs and realtors don't know about file size limits; they upload
// whatever raw export they have. Resize silently instead of rejecting.
async function autoFitLogoImage(file: File): Promise<string> {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const i = new Image();
      i.onload = () => resolve(i);
      i.onerror = () => reject(new Error("logo decode failed"));
      i.src = url;
    });
    const MAX_EDGE = 1080;
    const longSide = Math.max(img.naturalWidth, img.naturalHeight);
    const scale = longSide > MAX_EDGE ? MAX_EDGE / longSide : 1;
    const w = Math.round(img.naturalWidth * scale);
    const h = Math.round(img.naturalHeight * scale);
    const c = document.createElement("canvas");
    c.width = w;
    c.height = h;
    const ctx = c.getContext("2d");
    if (!ctx) throw new Error("canvas unavailable");
    // Use high-quality scaling.
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(img, 0, 0, w, h);
    // PNG to preserve transparency on logos that have alpha channels.
    return c.toDataURL("image/png");
  } finally {
    URL.revokeObjectURL(url);
  }
}

async function captureThumbnailAt(file: File, timestampSec: number): Promise<Blob> {
  const url = URL.createObjectURL(file);
  try {
    const v = document.createElement("video");
    v.src = url;
    v.muted = true;
    v.playsInline = true;
    await new Promise<void>((resolve, reject) => {
      v.onloadedmetadata = () => resolve();
      v.onerror = () => reject(new Error("thumb decode failed"));
    });
    v.currentTime = Math.max(0, Math.min(v.duration - 0.05, timestampSec));
    await new Promise<void>((resolve) => { v.onseeked = () => resolve(); });
    // Square 1080x1080 — looks good as a feed thumbnail and works as YT custom thumbnail.
    const c = document.createElement("canvas");
    c.width = 1080;
    c.height = 1080;
    const ctx = c.getContext("2d")!;
    const sw = v.videoWidth, sh = v.videoHeight;
    const sourceAspect = sw / sh;
    let sx = 0, sy = 0, scw = sw, sch = sh;
    if (sourceAspect > 1) { scw = sh; sx = (sw - scw) / 2; }
    else if (sourceAspect < 1) { sch = sw; sy = (sh - sch) / 2; }
    ctx.filter = "saturate(108%) contrast(105%) brightness(101%)";
    ctx.drawImage(v, sx, sy, scw, sch, 0, 0, 1080, 1080);
    return await new Promise<Blob>((res, rej) =>
      c.toBlob((b) => (b ? res(b) : rej(new Error("toBlob failed"))), "image/jpeg", 0.92)
    );
  } finally {
    URL.revokeObjectURL(url);
  }
}


/* === Sophisticated AI thumbnail rendering ===
   Real-estate-luxury aesthetic: tall thin serif, generous letter-spacing,
   thin gold accent line, minimalist composition. Same draw logic powers
   both the inline preview canvas and the downloaded JPEG so the user
   never wonders "is this what I'll get?" */

interface ThumbDesignSpec {
  videoOrImage: HTMLVideoElement | HTMLImageElement;
  timestampSec: number;
  overlayText: string;
  reason?: string;
  brandName?: string;
}


// Ensure the luxury fonts are loaded BEFORE drawing to canvas. Without this,
// the canvas falls back to Georgia silently, killing the Sotheby's-tier feel.
async function ensureLuxeFontsLoaded(): Promise<void> {
  if (typeof document === "undefined" || !document.fonts) return;
  try {
    await Promise.all([
      document.fonts.load("500 92px 'Cormorant Garamond'"),
      document.fonts.load("700 92px 'Playfair Display'"),
      document.fonts.load("600 22px 'Inter'"),
    ]);
  } catch {
    // fonts may already be loaded or fail silently — that's fine
  }
}

function drawDesignedThumb(canvas: HTMLCanvasElement, spec: ThumbDesignSpec) {
  const W = canvas.width;
  const H = canvas.height;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  ctx.clearRect(0, 0, W, H);

  const src = spec.videoOrImage;
  const sw = (src as HTMLVideoElement).videoWidth || (src as HTMLImageElement).naturalWidth || 1920;
  const sh = (src as HTMLVideoElement).videoHeight || (src as HTMLImageElement).naturalHeight || 1080;

  // 1. Center-crop to canvas aspect.
  const targetAspect = W / H;
  const sourceAspect = sw / sh;
  let sx = 0, sy = 0, scw = sw, sch = sh;
  if (sourceAspect > targetAspect) {
    scw = sh * targetAspect;
    sx = (sw - scw) / 2;
  } else if (sourceAspect < targetAspect) {
    sch = sw / targetAspect;
    sy = (sh - sch) / 2;
  }

  // 2. Cinematic color grade — subtle saturation + contrast bump + slight warm shift.
  ctx.filter = "saturate(115%) contrast(108%) brightness(101%)";
  ctx.drawImage(src, sx, sy, scw, sch, 0, 0, W, H);
  ctx.filter = "none";

  // 3. Bottom-half soft dark gradient for legibility — starts higher (60% from top).
  const grad = ctx.createLinearGradient(0, H * 0.45, 0, H);
  grad.addColorStop(0,   "rgba(0,0,0,0)");
  grad.addColorStop(0.45,"rgba(0,0,0,0.30)");
  grad.addColorStop(1,   "rgba(0,0,0,0.85)");
  ctx.fillStyle = grad;
  ctx.fillRect(0, H * 0.45, W, H * 0.55);

  // 4. Top-edge soft fade for brand wordmark legibility.
  const topGrad = ctx.createLinearGradient(0, 0, 0, H * 0.18);
  topGrad.addColorStop(0, "rgba(0,0,0,0.45)");
  topGrad.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = topGrad;
  ctx.fillRect(0, 0, W, H * 0.18);

  // 5. Cinematic radial vignette (cool tint at edges).
  const cx = W / 2, cy = H / 2, r = Math.hypot(cx, cy);
  const vGrad = ctx.createRadialGradient(cx, cy, r * 0.55, cx, cy, r);
  vGrad.addColorStop(0, "rgba(0,0,0,0)");
  vGrad.addColorStop(1, "rgba(0,0,0,0.34)");
  ctx.fillStyle = vGrad;
  ctx.fillRect(0, 0, W, H);

  // 6. TYPOGRAPHY block, anchored bottom-left with 8% margin.
  const sidePad = Math.round(W * 0.075);
  const bottomPad = Math.round(H * 0.075);
  const maxWidth = W - sidePad * 2;

  // Headline: title-case from overlayText, rendered in tall thin serif.
  const headlineRaw = (spec.overlayText || "").trim();
  const headline = toTitleCase(headlineRaw);

  if (headline) {
    // Pick font size by edge length so longer headlines shrink gracefully.
    const fontFamily = "'Cormorant Garamond', 'Playfair Display', 'Didot', 'Bodoni 72', Georgia, serif";
    let fontSize = Math.round(W * 0.085);  // ~92px on 1080W
    let weight = 500;  // medium — feels luxe vs heavy bold
    ctx.font = `${weight} ${fontSize}px ${fontFamily}`;
    let lines = wrapText(ctx, headline, maxWidth);
    if (lines.length > 2) {
      fontSize = Math.round(W * 0.062);  // ~67px
      ctx.font = `${weight} ${fontSize}px ${fontFamily}`;
      lines = wrapText(ctx, headline, maxWidth);
    }

    const lineHeight = Math.round(fontSize * 1.05);

    // Position: total block height = lines + accent line + small subtle subtitle.
    const headlineH = lines.length * lineHeight;
    const subtitleH = Math.round(W * 0.022);
    const accentLineH = 6;
    const blockH = headlineH + 26 + accentLineH + 18 + subtitleH;
    let y = H - bottomPad - blockH + lineHeight; // first baseline

    // Soft drop shadow for legibility (instead of stroke which looks chunky).
    ctx.shadowColor = "rgba(0,0,0,0.55)";
    ctx.shadowBlur = 14;
    ctx.shadowOffsetY = 3;
    ctx.fillStyle = "#F5EFE7"; // off-white, warm
    ctx.textAlign = "left";
    ctx.textBaseline = "alphabetic";
    for (const line of lines) {
      ctx.fillText(line, sidePad, y);
      y += lineHeight;
    }
    ctx.shadowBlur = 0;
    ctx.shadowOffsetY = 0;

    // Thin gold accent line under headline.
    const accentY = y - lineHeight + 12;
    ctx.fillStyle = "#D4AF37";
    ctx.fillRect(sidePad, accentY, Math.round(W * 0.10), accentLineH);

    // Small uppercase subtitle/tagline below the accent line.
    // If brand name + reason fits, prefer it; else fallback.
    const tagline = (spec.brandName || "Mintflow").toUpperCase();
    ctx.font = `600 ${subtitleH}px ui-sans-serif, system-ui, sans-serif`;
    ctx.fillStyle = "rgba(212,175,55,0.95)";
    ctx.textBaseline = "top";
    const taglineY = accentY + accentLineH + 16;
    // Letterspaced effect via per-char draw.
    drawLetterspaced(ctx, tagline, sidePad, taglineY, Math.round(subtitleH * 0.16));
  }
}

function toTitleCase(s: string): string {
  // Simple title case: first letter of each word uppercase, rest lower.
  return s.split(/\s+/).map((w) => w.length > 2 || /^[A-Z]/.test(w)
    ? w[0].toUpperCase() + w.slice(1).toLowerCase()
    : w.toLowerCase()).join(" ");
}

function wrapText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let current = "";
  for (const w of words) {
    const test = current ? current + " " + w : w;
    if (ctx.measureText(test).width > maxWidth && current) {
      lines.push(current);
      current = w;
    } else {
      current = test;
    }
  }
  if (current) lines.push(current);
  return lines;
}

function drawLetterspaced(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, spacing: number) {
  let cx = x;
  for (const ch of text) {
    ctx.fillText(ch, cx, y);
    cx += ctx.measureText(ch).width + spacing;
  }
}

async function renderDesignedThumbnail(
  file: File,
  timestampSec: number,
  overlayText: string,
  brandName?: string,
  reason?: string,
): Promise<Blob> {
  const url = URL.createObjectURL(file);
  try {
    const v = document.createElement("video");
    v.src = url;
    v.muted = true;
    v.playsInline = true;
    await new Promise<void>((resolve, reject) => {
      v.onloadedmetadata = () => resolve();
      v.onerror = () => reject(new Error("thumb decode failed"));
    });
    v.currentTime = Math.max(0, Math.min(v.duration - 0.05, timestampSec));
    await new Promise<void>((resolve) => { v.onseeked = () => resolve(); });

    const W = 1080, H = 1920;
    const c = document.createElement("canvas");
    c.width = W;
    c.height = H;
    await ensureLuxeFontsLoaded();
    drawDesignedThumb(c, { videoOrImage: v, timestampSec, overlayText, reason, brandName });

    return await new Promise<Blob>((res, rej) =>
      c.toBlob((b) => (b ? res(b) : rej(new Error("toBlob failed"))), "image/jpeg", 0.94)
    );
  } finally {
    URL.revokeObjectURL(url);
  }
}

function stageLabel(stage: "decoding" | "analyzing" | "rendering" | "finalizing"): string {
  switch (stage) {
    case "decoding":   return "Decoding video";
    case "analyzing":  return "Analyzing audio";
    case "rendering":  return "Rendering frames";
    case "finalizing": return "Finalizing";
  }
}

export default function ReelMultiplier() {
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [duration, setDuration] = useState<number>(0);
  const [audioRoutingWarning, setAudioRoutingWarning] = useState<string | null>(null);
  const [extractProgress, setExtractProgress] = useState<string>("");
  const [thinkingPhrase, setThinkingPhrase] = useState<string>("Studying your footage…");

  // Listen for audio routing failures from videoRender so we can surface them
  // — better than a silent muted reel.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const handler = () => setAudioRoutingWarning("Audio routing hit a browser limitation — your reel rendered without audio. This can happen on Safari. Try a fresh tab or desktop Chrome.");
    window.addEventListener("mintflow-audio-routing-failed", handler);
    return () => window.removeEventListener("mintflow-audio-routing-failed", handler);
  }, []);
  const [description, setDescription] = useState<string>("");
  const [series, setSeries] = useState<string>("");
  const [stage, setStage] = useState<"idle" | "extracting" | "thinking" | "done" | "error">("idle");

  // M3: Rotate AI-thinking copy so users don't stare at a static spinner.
  useEffect(() => {
    if (stage !== "thinking") return;
    const phrases = [
      "Studying your footage…",
      "Picking the moments that stop a scroll…",
      "Drafting hooks in your voice…",
      "Tuning music + posting time…",
      "Almost there — finalizing 3 reels…",
    ];
    let i = 0;
    setThinkingPhrase(phrases[0]);
    const id = setInterval(() => {
      i = (i + 1) % phrases.length;
      setThinkingPhrase(phrases[i]);
    }, 3500);
    return () => clearInterval(id);
  }, [stage]);
  const [customLogo, setCustomLogo] = useState<{kind: "image" | "video"; url: string} | null>(null);
  const logoInputRef = useRef<HTMLInputElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  // Abort the Claude fetch if the user navigates away mid-generation.
  useEffect(() => () => { abortRef.current?.abort(); }, []);

  // Lock against double-click on the generate button (state updates aren't
  // synchronous; useRef gives us a sub-50ms guard).
  const generateLockRef = useRef(false);
  const [error, setError] = useState<string | null>(null);
  const [output, setOutput] = useState<ReelMultiplierOutput | null>(null);
  const [extractedFrames, setExtractedFrames] = useState<ExtractedFrame[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);

  const onFile = (f: File | undefined) => {
    if (!f) return;
    setError(null);
    setOutput(null);
    setFile(f);
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    const url = URL.createObjectURL(f);
    setPreviewUrl(url);
    const v = document.createElement("video");
    v.src = url;
    v.onloadedmetadata = () => setDuration(v.duration || 0);
  };

  const reset = () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setFile(null); setPreviewUrl(null); setDuration(0);
    setOutput(null); setError(null); setStage("idle");
  };

  const generate = async () => {
    if (!file) return;
    if (generateLockRef.current) return;       // I2: kill double-click race
    generateLockRef.current = true;
    setError(null); setOutput(null); setStage("extracting"); setExtractProgress("");
    try {
      const { frames, durationSec } = await extractFramesFromFile(file, (done, total) => setExtractProgress(`Reading frame ${done + 1} of ${total}…`));
      setExtractedFrames(frames);
      setStage("thinking");
      const ctrl = new AbortController();
      abortRef.current = ctrl;
      const res = await fetch("/api/reel-multiplier", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          input: { sourceDurationSec: durationSec, description: description || undefined, series: series || undefined, frames },
          userContext: getUserContext(),
        }),
        signal: ctrl.signal,
      });
      let data: { error?: string; output?: ReelMultiplierOutput };
      const ct = res.headers.get("content-type") || "";
      if (ct.includes("application/json")) data = await res.json();
      else {
        const txt = await res.text();
        const isTimeout = /timed?\s*out|FUNCTION_INVOCATION_TIMEOUT|An error occurred/i.test(txt);
        throw new Error(isTimeout ? "The reel generator took longer than 60 seconds — usually a transient slowdown. Try again." : `Server returned a non-JSON response (HTTP ${res.status}). ${txt.slice(0, 120)}`);
      }
      if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
      if (!data.output) throw new Error("Empty response. Please try again.");
      setOutput(data.output); setStage("done");
      generateLockRef.current = false;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      setError(msg); setStage("error");
    }
  };

  const isBusy = stage === "extracting" || stage === "thinking";

  return (
    <div className="space-y-8">
      {audioRoutingWarning && (
        <div className="mb-3 rounded-lg border border-amber-700/50 bg-amber-950/30 p-3 text-xs text-amber-200">
          <strong>Audio:</strong> {audioRoutingWarning}
          <button onClick={() => setAudioRoutingWarning(null)} className="ml-3 text-muted hover:text-text">dismiss</button>
        </div>
      )}
      {/* Upload card */}
      <div className="rounded-2xl border border-border bg-surface p-6">
        {!file && (
          <div
            onClick={() => fileRef.current?.click()}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => { e.preventDefault(); onFile(e.dataTransfer.files?.[0]); }}
            className="flex cursor-pointer flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-border-strong p-12 text-center transition hover:border-gold/60"
          >
            <Upload className="h-6 w-6 text-gold" />
            <div className="font-display text-xl tracking-tight text-text">Drop a 30 second to 3 minute video</div>
            <div className="text-sm text-muted">MP4, MOV, WEBM. Up to 3 minutes, ~500 MB.</div>
            <input ref={fileRef} type="file" accept="video/*" className="hidden" onChange={(e) => onFile(e.target.files?.[0])} />
          </div>
        )}

        {file && previewUrl && (
          <div className="space-y-4">
            <div className="flex items-start gap-4">
              <video src={previewUrl} className="h-32 w-48 rounded-lg border border-border bg-bg-deep object-cover" controls muted />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 text-[11px] uppercase tracking-widest text-gold/80"><Film className="h-3 w-3" /> Source</div>
                <div className="mt-1 truncate font-medium text-text">{file.name}</div>
                <div className="text-xs text-muted">
                  {duration ? `${Math.round(duration)}s` : "—"} · {(file.size / (1024 * 1024)).toFixed(1)} MB
                </div>
                <button onClick={reset} className="mt-2 inline-flex items-center gap-1 text-xs text-muted hover:text-text">
                  <X className="h-3 w-3" /> Replace
                </button>
              </div>
            </div>

            <Field label="Describe the video (optional, ~1 sentence — sharper if you do)">
              <textarea rows={2} value={description} onChange={(e) => setDescription(e.target.value)}
                placeholder="Walk-through of a basement reno suite. Drone opener, kitchen detail at 0:20, payoff shot of patio at 0:45." />
            </Field>

            <Field label="Series / project (optional)">
              <input type="text" value={series} onChange={(e) => setSeries(e.target.value)} placeholder="e.g. 868 Orono Avenue" />
            </Field>

            {/* Brand logo for the rendered output — music is now per-platform inside each reel card */}
            <div className="grid gap-3 sm:grid-cols-1">
              <Field label="Brand logo (PNG / SVG / MP4 motion logo)">
                <div className="flex items-center gap-2 rounded-md border border-border bg-bg p-2">
                  {customLogo ? (
                    <>
                      {customLogo.kind === "video" ? (
                        <video src={customLogo.url} className="h-7 w-7 rounded object-contain" muted playsInline autoPlay loop />
                      ) : (
                        <img src={customLogo.url} alt="" className="h-7 w-7 rounded object-contain" />
                      )}
                      <span className="flex-1 truncate text-xs text-text/85">{customLogo.kind === "video" ? "Motion logo" : "Static logo"} loaded</span>
                      <button type="button" onClick={() => setCustomLogo(null)} className="text-xs text-muted hover:text-text"><X className="h-3 w-3" /></button>
                    </>
                  ) : (
                    <button type="button" onClick={() => logoInputRef.current?.click()} className="flex w-full items-center gap-2 text-xs text-muted hover:text-text">
                      <Upload className="h-3 w-3" /> Drop any logo — auto-resized · PNG / SVG / JPG / MP4 OK
                    </button>
                  )}
                  <input ref={logoInputRef} type="file"
                    accept="image/*,video/*"
                    className="hidden"
                    onChange={async (e) => {
                      const f = e.target.files?.[0]; if (!f) return;
                      const isVid = f.type.startsWith("video/");
                      // Motion logos: still cap at 50MB to avoid OOM during render.
                      if (isVid) {
                        if (f.size > 50 * 1024 * 1024) {
                          alert(`Motion logo over 50MB — render would run out of memory. Got ${(f.size / (1024*1024)).toFixed(1)}MB. Please use a shorter / lower-res clip.`);
                          return;
                        }
                        const url = URL.createObjectURL(f);
                        setCustomLogo({ kind: "video", url });
                        return;
                      }
                      // Image logos: auto-fit to 1080x1080 max, downscale via canvas.
                      // No size rejection — we resize whatever the user drops.
                      try {
                        const url = await autoFitLogoImage(f);
                        setCustomLogo({ kind: "image", url });
                      } catch {
                        // Fallback: load original (may be huge but won't crash the render).
                        const r = new FileReader();
                        r.onload = (ev) => setCustomLogo({ kind: "image", url: String(ev.target?.result || "") });
                        r.readAsDataURL(f);
                      }
                    }} />
                </div>
              </Field>
            </div>

            <div className="flex justify-end">
              <button onClick={generate} disabled={isBusy}
                className="inline-flex items-center gap-2 rounded-full bg-gold px-5 py-2.5 text-sm font-semibold text-black transition hover:bg-gold-light disabled:opacity-60">
                {stage === "extracting" && <><Loader2 className="h-4 w-4 animate-spin" /> {extractProgress || "Reading frames…"}</>}
                {stage === "thinking" && <><Loader2 className="h-4 w-4 animate-spin" /> {thinkingPhrase}</>}
                {!isBusy && <><Sparkles className="h-4 w-4" /> Multiply this video</>}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Friendly error */}
      {error && (
        <div className="rounded-2xl border border-amber-700/40 bg-amber-950/20 p-4">
          <div className="flex items-start gap-3">
            <svg viewBox="0 0 24 24" className="mt-0.5 h-5 w-5 shrink-0 text-amber-400" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 9v4M12 17h.01M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/></svg>
            <div className="flex-1">
              <div className="font-display text-base text-text">Reel Multiplier hiccup</div>
              <div className="mt-1 text-sm text-amber-100/90">{error}</div>
              <div className="mt-3 flex gap-2">
                <button onClick={() => { setError(null); generate(); }} disabled={isBusy}
                  className="inline-flex items-center gap-1.5 rounded-full bg-gold px-4 py-1.5 text-xs font-semibold text-black transition hover:bg-gold-light disabled:opacity-50">
                  Try again
                </button>
                <button onClick={() => setError(null)} className="inline-flex items-center gap-1.5 rounded-full border border-border-strong px-4 py-1.5 text-xs text-muted transition hover:text-text">Dismiss</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Result */}
      {output && <ReelResults output={output} sourceUrl={previewUrl} sourceFile={file} customLogo={customLogo} extractedFrames={extractedFrames} />}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <div className="mb-1 text-[11px] uppercase tracking-widest text-muted">{label}</div>
      {children}
    </label>
  );
}

/* ───────── Results: 3 platform cards ───────── */

const PLATFORM_META: Record<ReelPlatform, { label: string; icon: typeof Instagram; color: string }> = {
  instagram_reel: { label: "Instagram Reel", icon: Instagram, color: "from-pink-500/30 to-purple-500/30" },
  youtube_short:  { label: "YouTube Short",  icon: Youtube,   color: "from-red-500/30 to-rose-500/30" },
  facebook_reel:  { label: "Facebook Reel",  icon: Facebook,  color: "from-blue-500/30 to-sky-500/30" },
};

function ReelResults({ output, sourceUrl, sourceFile, customLogo, extractedFrames }: { output: ReelMultiplierOutput; sourceUrl: string | null; sourceFile: File | null; customLogo: {kind: "image" | "video"; url: string} | null; extractedFrames: ExtractedFrame[] }) {
  // Per-platform rendered previews so the user can render IG + YT both, see them
  // side-by-side in the gallery, and pick a winner without losing the other.
  const [renderedByPlatform, setRenderedByPlatform] = useState<Record<string, RenderedPreview>>({});
  const onPreviewReady = (platform: string, info: RenderedPreview) => setRenderedByPlatform((m) => ({ ...m, [platform]: info }));

  // Track which Jamendo IDs have been picked across ALL platform cards so each
  // platform's auto-pick chooses a DIFFERENT track. Keys = platform, values = trackId.
  const [musicIdByPlatform, setMusicIdByPlatform] = useState<Record<string, number | null>>({});
  const onTrackPicked = (platform: string, trackId: number | null) => setMusicIdByPlatform((m) => ({ ...m, [platform]: trackId }));
  const usedIds = Object.entries(musicIdByPlatform)
    .filter(([, id]) => typeof id === "number")
    .map(([, id]) => id as number);
  const [active, setActive] = useState<ReelPlatform>(output.packages[0]?.platform || "instagram_reel");
  const pkg = output.packages.find((p) => p.platform === active) || output.packages[0];

  return (
    <div className="space-y-6">
        {/* B7: iOS Safari render reliability disclaimer */}
        {typeof navigator !== "undefined" && /iPad|iPhone|iPod/.test(navigator.userAgent) && !/CriOS|EdgiOS/.test(navigator.userAgent) && (
          <div className="rounded-lg border border-amber-700/40 bg-amber-950/20 p-3 text-xs text-amber-200">
            <strong>iOS Safari note:</strong> Reel rendering is unreliable on iPhone/iPad Safari. For best results use desktop Chrome, desktop Safari 17+, or Edge. iOS Chrome works the same as Safari.
          </div>
        )}


      {/* Platform tabs */}
      <div className="flex flex-wrap gap-2">
        {output.packages.map((p) => {
          const m = PLATFORM_META[p.platform];
          const Icon = m.icon;
          const on = active === p.platform;
          return (
            <button key={p.platform} onClick={() => setActive(p.platform)}
              className={["inline-flex items-center gap-1.5 rounded-full border px-4 py-2 text-sm transition",
                on ? "border-gold bg-gold/10 text-gold" : "border-border text-muted hover:border-border-strong hover:text-text"].join(" ")}>
              <Icon className="h-3.5 w-3.5" /> {m.label}
            </button>
          );
        })}
      </div>



      {/* Rendered Reels gallery — shows all platforms the user has rendered.
          Stacks side-by-side once 2+ platforms are rendered. */}
      {Object.keys(renderedByPlatform).length > 0 && (
        <div className="rounded-2xl border border-mint/40 bg-mint/5 p-5">
          <div className="text-[11px] uppercase tracking-widest text-mint/85 mb-3">
            <Check className="mr-1 inline h-3 w-3" /> Your rendered reels — pick a winner ({Object.keys(renderedByPlatform).length} ready)
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            {Object.entries(renderedByPlatform).map(([platform, info]) => {
              const meta = PLATFORM_META[platform as ReelPlatform];
              const Icon = meta?.icon || Music;
              return (
                <div key={platform} className="rounded-xl border border-border bg-bg-deep/40 p-3">
                  <div className="flex items-center justify-between mb-2">
                    <div className="inline-flex items-center gap-1.5 text-xs text-text/85">
                      <Icon className="h-3.5 w-3.5 text-gold" /> {meta?.label || platform}
                    </div>
                    <button
                      onClick={() => {
                        URL.revokeObjectURL(info.url);
                        if (info.thumbUrl) URL.revokeObjectURL(info.thumbUrl);
                        setRenderedByPlatform((m) => {
                          const n = { ...m };
                          delete n[platform];
                          return n;
                        });
                      }}
                      className="text-xs text-muted hover:text-rose-400"
                      aria-label="Remove this preview"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                  <video
                    src={info.url}
                    controls
                    playsInline
                    className="w-full rounded-lg bg-black aspect-[9/16] object-contain border border-border/60"
                  />
                  <div className="mt-2 flex flex-wrap gap-2">
                    <button
                      onClick={() => {
                        const a = document.createElement("a");
                        a.href = info.url;
                        a.download = info.filename;
                        document.body.appendChild(a);
                        a.click();
                        a.remove();
                      }}
                      className="inline-flex items-center gap-1.5 rounded-full bg-gold px-3 py-1.5 text-xs font-medium text-black hover:bg-gold-light"
                    >
                      <Download className="h-3 w-3" /> Reel
                    </button>
                    {info.thumbUrl && (
                      <button
                        onClick={() => {
                          const a = document.createElement("a");
                          a.href = info.thumbUrl as string;
                          a.download = info.thumbName || "thumbnail.jpg";
                          document.body.appendChild(a);
                          a.click();
                          a.remove();
                        }}
                        className="inline-flex items-center gap-1.5 rounded-full border border-border-strong bg-bg px-3 py-1.5 text-xs text-text hover:border-mint/60"
                      >
                        <Download className="h-3 w-3" /> Thumbnail
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
          <p className="mt-3 text-[11px] text-muted">
            Render another platform from the tabs below — it&apos;ll appear here next to this one. Use the X to remove a preview if you want to re-render it with different cuts or music.
          </p>
        </div>
      )}

      {pkg && <PackageCard pkg={pkg} sourceUrl={sourceUrl} sourceFile={sourceFile} customLogo={customLogo} extractedFrames={extractedFrames} onPreviewReady={onPreviewReady} excludeMusicIds={usedIds.filter(id => id !== musicIdByPlatform[pkg.platform])} onTrackPicked={(id) => onTrackPicked(pkg.platform, id)} stillInGallery={pkg.platform in renderedByPlatform} />}

    </div>
  );
}


// Build a platform-specific Jamendo query by mixing the AI's suggested mood
// with a platform energy tag. Each platform queries a DIFFERENT pool of music
// so the auto-pick draws from genuinely distinct buckets.
//
//   IG  → punchy / energetic
//   YT  → cinematic / atmospheric
//   FB  → warm / smooth
//
// This is on top of the excludeIds filter, which dedupes within results.
function buildPlatformMusicQuery(pkg: ReelPackage): string {
  const mood = pkg.musicSuggestions?.[0]?.mood?.split(",")[0].trim().toLowerCase() || "";
  const genre = pkg.musicSuggestions?.[0]?.genre?.toLowerCase() || "";
  const platformTag =
    pkg.platform === "instagram_reel" ? "energetic" :
    pkg.platform === "youtube_short"  ? "cinematic" :
                                        "warm";
  // Prefer mood; fall back to genre; always combine with platform tag for variety.
  const base = mood || genre || "cinematic";
  // If the AI's mood already contains the platform tag's vibe, just use base.
  if (base.includes(platformTag)) return base;
  return `${platformTag} ${base}`;
}

function PackageCard({ pkg, sourceUrl, sourceFile, customLogo, extractedFrames, onPreviewReady, excludeMusicIds, onTrackPicked, stillInGallery }: { pkg: ReelPackage; sourceUrl: string | null; sourceFile: File | null; customLogo: {kind: "image" | "video"; url: string} | null; extractedFrames: ExtractedFrame[]; onPreviewReady: (platform: string, info: RenderedPreview) => void; excludeMusicIds: number[]; onTrackPicked: (id: number | null) => void; stillInGallery: boolean }) {
  // Per-platform music state — each platform tab keeps its own track so the
  // user can render IG with one mood and YT with a different mood and compare.
  const [musicFile, setMusicFile] = useState<File | null>(null);
  const [musicBPM, setMusicBPM] = useState<number | null>(null);
  const [pixabayTrackId, setPixabayTrackId] = useState<number | null>(null);
  const onPickMusic = (track: PixabayTrack, blob: Blob) => {
    const f = new File([blob], `jamendo_${track.id}.mp3`, { type: "audio/mpeg" });
    setMusicFile(f);
    setPixabayTrackId(track.id);
    onTrackPicked(track.id); // tell parent so other platforms exclude this id
    detectBPM(f).then((bpm) => setMusicBPM(bpm));
  };
  const [copied, setCopied] = useState<string | null>(null);
  const copy = async (label: string, text: string) => {
    try { await navigator.clipboard.writeText(text); setCopied(label); setTimeout(() => setCopied(null), 1500); } catch {}
  };

  const cut = pkg.cutMarkers[0];
  const cutLen = cut ? Math.max(0, cut.endSec - cut.startSec) : 0;

  // Render & Download state
  const [renderState, setRenderState] = useState<"idle" | "rendering" | "ready" | "error">("idle");
  const [renderPct, setRenderPct] = useState(0);
  const [renderPhase, setRenderPhase] = useState<"render" | "convert">("render");
  const [renderStage, setRenderStage] = useState<"decoding" | "analyzing" | "rendering" | "finalizing">("decoding");
  const [beatSnapsApplied, setBeatSnapsApplied] = useState<number>(0);
  // Preview-before-download state
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewMime, setPreviewMime] = useState<string>("");

  // If parent gallery dropped this platform, reset the local preview so the
  // child's "Preview ready" panel doesn\'t point at a revoked URL.
  useEffect(() => {
    if (!stillInGallery && previewUrl) {
      URL.revokeObjectURL(previewUrl);
      if (previewThumbUrl) URL.revokeObjectURL(previewThumbUrl);
      setPreviewUrl(null);
      setPreviewThumbUrl(null);
      setRenderState("idle");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stillInGallery]);
  const [previewFilename, setPreviewFilename] = useState<string>("");
  const [previewThumbUrl, setPreviewThumbUrl] = useState<string | null>(null);
  const [previewThumbName, setPreviewThumbName] = useState<string>("");
  const [renderError, setRenderError] = useState<string | null>(null);
  const [hookPos, setHookPos] = useState<"auto" | "top" | "bottom">("auto");
  const [includeOutro, setIncludeOutro] = useState(true);
  const [hookBg, setHookBg] = useState<"none" | "pill" | "box">("none");

  // User-editable overrides — generator → tool. Default to AI's suggestions.
  const [editedHook, setEditedHook] = useState<string>(pkg.hookLine);
  const brandKit = useMemo(() => getBrandKit(), []); // P6: don't run every keystroke
  const [musicResetCount, setMusicResetCount] = useState(0); // bumps to remount MusicBrowser → fresh auto-pick
  const [previousTrackIds, setPreviousTrackIds] = useState<number[]>([]); // tracks ALREADY picked on this platform — exclude them on re-roll
  const [cutsExpanded, setCutsExpanded] = useState(false);
  const [editedCuts, setEditedCuts] = useState<{ startSec: number; endSec: number; reason?: string }[]>(
    pkg.cutMarkers.map((c) => ({ startSec: c.startSec, endSec: c.endSec, reason: c.reason }))
  );

  function nudgeCut(i: number, field: "startSec" | "endSec", deltaSec: number) {
    setEditedCuts((prev) => {
      const next = [...prev];
      const cur = { ...next[i] };
      const newVal = Math.max(0, +(cur[field] + deltaSec).toFixed(1));
      // Sanity: keep start < end with at least 1s between them
      if (field === "startSec") cur.startSec = Math.min(newVal, cur.endSec - 1);
      else cur.endSec = Math.max(newVal, cur.startSec + 1);
      next[i] = cur;
      return next;
    });
  }
  function deleteCut(i: number) {
    setEditedCuts((prev) => prev.filter((_, idx) => idx !== i));
  }
  function resetEdits() {
    setEditedHook(pkg.hookLine);
    setEditedCuts(pkg.cutMarkers.map((c) => ({ startSec: c.startSec, endSec: c.endSec, reason: c.reason })));
  }

  const onRender = async () => {
    if (!sourceFile || editedCuts.length === 0) return;
    setRenderState("rendering"); setRenderPct(0); setRenderError(null); setRenderPhase("render");
    try {
      const kit = getBrandKit();
      const outputAspect = "9:16" as const;
      // Pick the logo source: inline upload wins, else Brand Kit (always image), else none
      const logo = customLogo
        ? customLogo
        : kit.logoDataUrl
          ? { kind: "image" as const, url: kit.logoDataUrl }
          : undefined;
      // Build segments with subject-aware crop bias + AI-inferred transitions.
      // For each cut, find the closest extracted frame (by timestamp) and use
      // its subjectZone to set cropBiasX/Y. inferTransition compares motion of
      // adjacent cuts to pick whip / crossfade / dip per cut.
      const rawSegments = editedCuts.map((c, i) => {
        const midpoint = (c.startSec + c.endSec) / 2;
        const closest = pickClosestFrame(extractedFrames, midpoint);
        const prev = i > 0 ? pickClosestFrame(extractedFrames, (editedCuts[i - 1].startSec + editedCuts[i - 1].endSec) / 2) : undefined;
        return {
          startSec: c.startSec,
          endSec: c.endSec,
          cropBiasX: closest?.subjectZone?.confidence && closest.subjectZone.confidence > 0.3 ? closest.subjectZone.centerX : 0.5,
          cropBiasY: closest?.subjectZone?.confidence && closest.subjectZone.confidence > 0.3 ? closest.subjectZone.centerY : 0.5,
          transitionIn: "dip" as const, // whip/crossfade not yet implemented in renderer
        };
      });
      // Tighter beat snap (was 0.4, now 0.25 — only snap if VERY close to a beat).
      const { adjusted: segments, snapsApplied } = snapSegmentsToBeats(rawSegments, musicBPM, 0.25);
      setBeatSnapsApplied(snapsApplied);
      const { blob, mimeType } = await renderReel({
        source: sourceFile,
        segments,
        outputAspect,
        hookLine: editedHook,
        hookPosition: hookPos,
        hookBackground: hookBg,
        hookBackgroundColor: kit.primaryColor,
        // Typewriter for YT setup-arc pacing; word-stagger for IG/FB fast scrolls.
        hookStyle: pkg.platform === "youtube_short" ? "typewriter" : "stagger",
        platform: pkg.platform,
        logo,
        musicFile: musicFile || undefined,
        brandName: kit.name,
        includeOutro: includeOutro && !!logo,
        outroDurationSec: 2.0,
        fadeOutSec: 1.5,
        onStage: (stage, p) => setRenderStage(stage),
        onProgress: (p) => setRenderPct(p),
      });
      const platformShort = pkg.platform === "instagram_reel" ? "ig" : pkg.platform === "youtube_short" ? "yt" : "fb";
      const tag = (pkg.title || pkg.hookLine || "reel").slice(0, 32).replace(/[^a-z0-9]+/gi, "-").toLowerCase();

      // Hand off to preview state — user reviews before downloading.
      let finalBlob = blob;
      let finalExt = "webm";
      if (mimeType.includes("mp4")) {
        finalExt = "mp4";
      } else {
        // Best-effort transcode to MP4. Falls back to WebM on failure.
        setRenderPhase("convert");
        setRenderPct(0);
        try {
          finalBlob = await transcodeWebMToMP4(blob, (pct) => setRenderPct(pct / 100));
          finalExt = "mp4";
        } catch (transcodeErr) {
          console.warn("Transcode failed, keeping WebM", transcodeErr);
        }
      }

      // Free any previous preview URL before swapping.
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      const newUrl = URL.createObjectURL(finalBlob);
      setPreviewUrl(newUrl);
      setPreviewMime(finalBlob.type);
      setPreviewFilename(`mintflow_${platformShort}_${tag}.${finalExt}`);

      setRenderState("ready");
      // Bubble up so parent gallery can show this preview alongside other platforms.
      // Capture thumb URL into a local variable (state isn\'t guaranteed flushed yet).
      let freshThumbUrl: string | null = null;
      let freshThumbName: string = "";
      try {
        if (sourceFile && pkg.thumbnailMoments?.[0]?.timestampSec != null) {
          const thumbBlob = await captureThumbnailAt(sourceFile, pkg.thumbnailMoments[0].timestampSec);
          freshThumbUrl = URL.createObjectURL(thumbBlob);
          freshThumbName = `mintflow_${platformShort}_${tag}_thumb.jpg`;
          if (previewThumbUrl) URL.revokeObjectURL(previewThumbUrl);
          setPreviewThumbUrl(freshThumbUrl);
          setPreviewThumbName(freshThumbName);
        }
      } catch (thumbErr) {
        console.warn("Thumbnail capture failed (non-fatal)", thumbErr);
      }

      onPreviewReady(pkg.platform, {
        url: newUrl,
        mime: finalBlob.type,
        filename: `mintflow_${platformShort}_${tag}_${Date.now().toString(36).slice(-5)}.${finalExt}`,
        thumbUrl: freshThumbUrl,
        thumbName: freshThumbName,
      });
    } catch (err: unknown) {
      setRenderError(err instanceof Error ? err.message : "Couldn’t render the reel.");
      setRenderState("error");
    }
  };

  return (
    <div className="space-y-4">
      {/* Render & Download bar — the centerpiece for Pro users */}
      <div className="rounded-2xl border border-gold/40 bg-gradient-to-br from-gold/10 to-transparent p-5">
        <div className="flex flex-col items-start gap-3 md:flex-row md:items-center md:justify-between">
          <div className="flex-1">
            <div className="text-[11px] uppercase tracking-widest text-gold/85"><Download className="mr-1 inline h-3 w-3" /> Render preview</div>
            <div className="mt-1 font-display text-lg tracking-tight text-text">
              {musicResetCount > 0 && !musicFile ? "Re-rolling music… " : ""}{editedCuts.length} cut{editedCuts.length === 1 ? "" : "s"}, stitched to 9:16 · {customLogo?.kind === "video" ? "motion logo" : (customLogo || getBrandKit().logoDataUrl) ? "logo applied" : "no logo"} · {musicFile ? (musicBPM ? `music ${musicBPM.toFixed(0)} BPM · ${beatSnapsApplied} cut${beatSnapsApplied === 1 ? "" : "s"} snapped to beat` : `music: ${musicFile.name.slice(0, 24)}`) : "source audio"}
            </div>
            
            <div className="mt-3 flex flex-wrap items-center gap-3 text-xs">
              <label className="flex items-center gap-1.5 text-muted">
                Hook position:
                <select value={hookPos} onChange={(e) => setHookPos(e.target.value as "auto" | "top" | "bottom")} className="!w-auto !rounded !border !border-border !bg-bg !px-2 !py-1 !text-xs">
                  <option value="auto">Auto</option>
                  <option value="top">Top</option>
                  <option value="bottom">Bottom</option>
                </select>
              </label>
              <label className="flex items-center gap-1.5 text-muted">
                Hook background:
                <select value={hookBg} onChange={(e) => setHookBg(e.target.value as "none" | "pill" | "box")} className="!w-auto !rounded !border !border-border !bg-bg !px-2 !py-1 !text-xs">
                  <option value="none">Transparent</option>
                  <option value="pill">Pill (brand color)</option>
                  <option value="box">Box (brand color)</option>
                </select>
              </label>
              <label className="flex items-center gap-1.5 text-muted">
                <input type="checkbox" checked={includeOutro} onChange={(e) => setIncludeOutro(e.target.checked)} className="!h-3 !w-3 !rounded !border !border-border-strong" />
                Logo outro
              </label>
            </div>
          </div>
          <button
            onClick={onRender}
            disabled={renderState === "rendering" || !sourceFile || editedCuts.length === 0 || !editedHook.trim() || (musicResetCount > 0 && !musicFile)}
            className="inline-flex items-center gap-2 rounded-full bg-gold px-5 py-2.5 text-sm font-semibold text-black transition hover:bg-gold-light disabled:opacity-60"
          >
            {renderState === "rendering" && <><Loader2 className="h-4 w-4 animate-spin" /> {renderPhase === "convert" ? "Converting" : stageLabel(renderStage)} {(renderPct * 100).toFixed(0)}%</>}
            {renderState === "ready" && <><Check className="h-4 w-4" /> Preview ready</>}
            {renderState === "error" && <><Download className="h-4 w-4" /> Try again</>}
            {renderState === "idle" && <><Download className="h-4 w-4" /> Render preview</>}
          </button>
        </div>
        {renderState === "rendering" && (
          <div className="mt-3 h-1 overflow-hidden rounded-full bg-border">
            <div className="h-full bg-gold transition-[width] duration-300" style={{ width: `${(renderPct * 100).toFixed(0)}%` }} />
          </div>
        )}
        {renderError && (
          <div className="mt-3 text-xs text-amber-300">{renderError}</div>
        )}
      </div>


      {/* Preview-before-download — the cinematographer's review pass */}
      {renderState === "ready" && previewUrl && (
        <div className="rounded-2xl border border-mint/40 bg-mint/5 p-5">
          <div className="text-[11px] uppercase tracking-widest text-mint/85 mb-3">
            <Check className="mr-1 inline h-3 w-3" /> Preview · download when you&apos;re happy with it
          </div>
          <div className="grid gap-4 md:grid-cols-[2fr_1fr]">
            <div>
              <video
                src={previewUrl}
                controls
                playsInline
                className="w-full max-w-[400px] mx-auto rounded-xl bg-black aspect-[9/16] object-contain border border-border/60"
              />
            </div>
            <div className="space-y-3">
              {previewThumbUrl && (
                <div>
                  <div className="text-xs text-muted mb-1.5">AI thumbnail</div>
                  <img src={previewThumbUrl} alt="thumbnail" className="w-full max-w-[200px] rounded-lg border border-border/60" />
                </div>
              )}
              <div className="flex flex-col gap-2">
                <button
                  onClick={() => {
                    if (!previewUrl || !previewFilename) return;
                    const a = document.createElement("a");
                    a.href = previewUrl;
                    a.download = previewFilename;
                    document.body.appendChild(a);
                    a.click();
                    a.remove();
                  }}
                  className="inline-flex items-center justify-center gap-2 rounded-full bg-gold px-4 py-2.5 text-sm font-semibold text-black hover:bg-gold-light"
                >
                  <Download className="h-4 w-4" /> Download reel
                </button>
                {previewThumbUrl && (
                  <button
                    onClick={() => {
                      const a = document.createElement("a");
                      a.href = previewThumbUrl;
                      a.download = previewThumbName || "thumbnail.jpg";
                      document.body.appendChild(a);
                      a.click();
                      a.remove();
                    }}
                    className="inline-flex items-center justify-center gap-2 rounded-full border border-border-strong bg-bg-deep/40 px-4 py-2 text-sm text-text hover:bg-bg-deep"
                  >
                    <Download className="h-4 w-4" /> Download thumbnail
                  </button>
                )}
                <button
                  onClick={() => {
                    // Clear the preview so the user knows it's gone
                    if (previewUrl) URL.revokeObjectURL(previewUrl);
                    if (previewThumbUrl) URL.revokeObjectURL(previewThumbUrl);
                    setPreviewUrl(null);
                    setPreviewThumbUrl(null);
                    setRenderState("idle");

                    // Reset music — MusicBrowser autoPick will randomize from
                    // top 4 search results (different track each time). Bump
                    // musicResetCount → MusicBrowser remounts → useEffect runs
                    // doSearch → autoPick fires for a fresh track.
                    if (pixabayTrackId) {
                      setPreviousTrackIds((prev) => [...prev, pixabayTrackId]);
                    }
                    setMusicFile(null);
                    setMusicBPM(null);
                    setPixabayTrackId(null);
                    onTrackPicked(null);
                    setMusicResetCount((c) => c + 1);

                    // Re-shuffle cut times by ±0.3s within their original range
                    // so the next render has visibly different in/out points
                    // even if the underlying AI cuts are the same.
                    setEditedCuts((prev) => prev.map((c) => {
                      const jitter = () => (Math.random() - 0.5) * 0.6; // ±0.3s
                      const newStart = Math.max(0, c.startSec + jitter());
                      const newEnd   = Math.max(newStart + 1.5, c.endSec + jitter());
                      return { ...c, startSec: Math.round(newStart * 10) / 10, endSec: Math.round(newEnd * 10) / 10 };
                    }));
                  }}
                  className="inline-flex items-center justify-center gap-2 rounded-full border border-mint/40 bg-mint/10 px-4 py-2 text-sm text-mint hover:bg-mint/20"
                >
                  ↻ Try a different version
                </button>
              </div>
              <p className="text-[11px] text-muted leading-relaxed mt-2">
                Click above to re-roll music and shuffle cut timings — gets you a genuinely different version, not the same render again.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Music for this reel — single-source picker, replaces the old AI-suggestion card */}
      {sourceFile && (
        <div className="rounded-xl border border-border bg-surface p-4">
          <div className="flex flex-wrap items-center gap-2 mb-2">
            <div className="text-[11px] uppercase tracking-widest text-gold/85">
              <Music className="mr-1 inline h-3 w-3" /> Music for this reel
            </div>
            {pkg.musicSuggestions?.[0]?.mood && !pixabayTrackId && (
              <span className="text-[11px] text-muted">
                · AI suggests: {pkg.musicSuggestions[0].mood.split(",")[0].trim()}
                {pkg.musicSuggestions[0].bpm ? ` · ~${pkg.musicSuggestions[0].bpm} BPM` : ""}
              </span>
            )}
            <label className="ml-auto inline-flex cursor-pointer items-center gap-1.5 rounded-full border border-gold/50 bg-gold/10 px-3 py-1.5 text-xs font-medium text-gold hover:bg-gold/20">
              <Upload className="h-3 w-3" /> Use my own
              <input
                type="file"
                accept="audio/*"
                className="hidden"
                onChange={async (e) => {
                  const f = e.target.files?.[0];
                  if (!f) return;
                  setMusicFile(f);
                  setPixabayTrackId(null);
                  onTrackPicked(null);
                  setMusicBPM(null);
                  const bpm = await detectBPM(f).catch(() => null);
                  setMusicBPM(bpm);
                }}
              />
            </label>
          </div>
          {musicFile && !pixabayTrackId && (
            <div className="mb-2 flex items-center gap-2 rounded-md border border-mint/40 bg-mint/5 px-2 py-1.5 text-xs">
              <Music className="h-3 w-3 text-mint" />
              <span className="flex-1 truncate text-text/85">{musicFile.name}</span>
              {musicBPM && <span className="text-[10px] text-muted">{musicBPM.toFixed(0)} BPM</span>}
              <button
                type="button"
                onClick={() => { setMusicFile(null); setMusicBPM(null); }}
                className="text-muted hover:text-rose-400"
                aria-label="Remove uploaded track"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          )}
          <MusicBrowser
            key={musicResetCount}
            defaultQuery={buildPlatformMusicQuery(pkg)}
            onSelect={onPickMusic}
            selectedId={pixabayTrackId}
            minDuration={20}
            maxDuration={600}
            autoPick={true}
            excludeIds={[...excludeMusicIds, ...previousTrackIds]}
          />
          <div className="mt-2 flex items-center justify-between gap-2 text-[10px] text-muted">
            <span>CC-BY · commercial-OK with credit in caption.</span>
            <button
              onClick={async () => {
                const trackTitle = "Track Name";
                const credit = `Music: "${trackTitle}" via jamendo.com`;
                try { await navigator.clipboard.writeText(credit); } catch {}
              }}
              className="rounded border border-border-strong bg-bg px-2 py-0.5 hover:border-gold/60 hover:text-gold"
            >
              Copy credit
            </button>
          </div>
        </div>
      )}

      {/* Cut + hook + caption row */}
      <div className="grid gap-4 lg:grid-cols-[1fr_1.4fr]">
        {/* Left: cut + hook */}
        <div className="space-y-3">
          <div className="rounded-xl border border-border bg-surface p-5">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-[11px] uppercase tracking-widest text-gold/80">Cuts</div>
                <div className="mt-1 text-sm text-text">{editedCuts.length} cut{editedCuts.length === 1 ? "" : "s"} · {editedCuts.reduce((acc, c) => acc + Math.max(0, c.endSec - c.startSec), 0).toFixed(0)}s total</div>
              </div>
              <button
                onClick={() => setCutsExpanded((v) => !v)}
                className="text-[11px] text-muted hover:text-text"
              >
                {cutsExpanded ? "Done" : "Adjust"}
              </button>
            </div>
            {cutsExpanded && (
              <div className="mt-3 space-y-2">
                {editedCuts.map((c, i) => (
                  <div key={i} className="flex items-center gap-2 font-mono text-xs">
                    <span className="w-5 text-muted">#{i + 1}</span>
                    <button onClick={() => nudgeCut(i, "startSec", -0.5)} className="rounded bg-bg px-1.5 py-0.5 text-muted hover:text-text" aria-label="Move start earlier">−</button>
                    <span className="w-12 text-center text-gold">{fmtSec(c.startSec)}</span>
                    <button onClick={() => nudgeCut(i, "startSec", 0.5)} className="rounded bg-bg px-1.5 py-0.5 text-muted hover:text-text" aria-label="Move start later">+</button>
                    <span className="text-muted">→</span>
                    <button onClick={() => nudgeCut(i, "endSec", -0.5)} className="rounded bg-bg px-1.5 py-0.5 text-muted hover:text-text" aria-label="Move end earlier">−</button>
                    <span className="w-12 text-center text-gold">{fmtSec(c.endSec)}</span>
                    <button onClick={() => nudgeCut(i, "endSec", 0.5)} className="rounded bg-bg px-1.5 py-0.5 text-muted hover:text-text" aria-label="Move end later">+</button>
                    <span className="text-[10px] text-muted">({Math.max(0, c.endSec - c.startSec).toFixed(1)}s)</span>
                    {editedCuts.length > 1 && (
                      <button onClick={() => deleteCut(i)} className="ml-auto text-[10px] text-muted hover:text-amber-400" title="Remove this cut">remove</button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="rounded-xl border border-border bg-surface p-5">
            <div className="flex items-center justify-between">
              <div className="text-[11px] uppercase tracking-widest text-gold/80">Hook (first 3s overlay)</div>
              {editedHook !== pkg.hookLine && (
                <button onClick={resetEdits} className="text-[10px] text-muted hover:text-text">reset</button>
              )}
            </div>
            <textarea
              value={editedHook}
              onChange={(e) => setEditedHook(e.target.value.slice(0, 80))}
              rows={2}
              className="mt-2 w-full resize-none rounded-md border border-border-strong bg-bg p-3 font-display text-xl leading-snug tracking-tight text-text outline-none focus:border-gold/60"
              placeholder="Hook line..."
            />
            <div className="mt-1.5 flex items-center justify-between text-[10px] text-muted">
              <span></span>
              <button onClick={() => copy("hook", editedHook)} className="hover:text-text">
                {copied === "hook" ? <><Check className="inline h-3 w-3 text-gold" /> Copied</> : "Copy hook"}
              </button>
            </div>
          </div>

          {pkg.title && (
            <div className="rounded-xl border border-border bg-surface p-5">
              <div className="text-[11px] uppercase tracking-widest text-gold/80">Title</div>
              <div className="mt-2 text-sm text-text">{pkg.title}</div>
              <button onClick={() => copy("title", pkg.title!)} className="mt-2 inline-flex items-center gap-1 text-xs text-muted hover:text-text">
                {copied === "title" ? <><Check className="h-3 w-3 text-gold" /> Copied</> : "Copy title"}
              </button>
            </div>
          )}
        </div>

        {/* Right: caption + hashtags */}
        <div className="space-y-3">
          <div className="rounded-xl border border-border bg-surface p-5">
            <div className="flex items-center justify-between">
              <div className="text-[11px] uppercase tracking-widest text-gold/80"><MessageSquare className="mr-1 inline h-3 w-3" /> Caption</div>
              <button onClick={() => copy("caption", pkg.caption)} className="text-xs text-muted hover:text-text">
                {copied === "caption" ? <><Check className="inline h-3 w-3 text-gold" /> Copied</> : "Copy"}
              </button>
            </div>
            <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-text/90">{pkg.caption}</p>
          </div>

          {pkg.description && (
            <div className="rounded-xl border border-border bg-surface p-5">
              <div className="flex items-center justify-between">
                <div className="text-[11px] uppercase tracking-widest text-gold/80">Description</div>
                <button onClick={() => copy("desc", pkg.description!)} className="text-xs text-muted hover:text-text">
                  {copied === "desc" ? <><Check className="inline h-3 w-3 text-gold" /> Copied</> : "Copy"}
                </button>
              </div>
              <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-text/90">{pkg.description}</p>
            </div>
          )}

          <div className="rounded-xl border border-border bg-surface p-5">
            <div className="flex items-center justify-between">
              <div className="text-[11px] uppercase tracking-widest text-gold/80"><Hash className="mr-1 inline h-3 w-3" /> Hashtags</div>
              <button onClick={() => copy("tags", pkg.hashtags.map((h) => `#${h.replace(/^#/, "")}`).join(" "))} className="text-xs text-muted hover:text-text">
                {copied === "tags" ? <><Check className="inline h-3 w-3 text-gold" /> Copied</> : "Copy all"}
              </button>
            </div>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {Array.from(new Set(pkg.hashtags.map((h) => h.replace(/^#/, "").toLowerCase()))).map((h) => (
                <span key={h} className="rounded-full border border-border bg-bg-deep px-2.5 py-0.5 text-xs text-text/85">#{h.replace(/^#/, "")}</span>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Thumbnails */}
      <div className="rounded-xl border border-border bg-surface p-5">
        <div className="mb-3 flex items-center justify-between">
          <div className="text-[11px] uppercase tracking-widest text-gold/80"><ImageIcon className="mr-1 inline h-3 w-3" /> Thumbnail moments</div>
          
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          {pkg.thumbnailMoments.map((m, i) => (
            <div key={i} className="group">
              <div className="relative overflow-hidden rounded-lg border border-border-strong transition group-hover:border-gold/60">
                <DesignedThumbPreview
                  sourceFile={sourceFile}
                  timestampSec={m.timestampSec}
                  overlayText={m.overlayText}
                  reason={m.reason}
                  brandName={getBrandKit().name}
                />
              </div>
              <div className="mt-2 flex items-center justify-between gap-2">
                <button
                  onClick={async () => {
                    if (!sourceFile) return;
                    try {
                      const blob = await renderDesignedThumbnail(sourceFile, m.timestampSec, m.overlayText, getBrandKit().name);
                      const url = URL.createObjectURL(blob);
                      const a = document.createElement("a");
                      a.href = url;
                      a.download = `mintflow_thumb_${(m.overlayText || "frame").slice(0, 24).replace(/[^a-z0-9]+/gi, "-").toLowerCase()}.jpg`;
                      document.body.appendChild(a);
                      a.click();
                      a.remove();
                      setTimeout(() => URL.revokeObjectURL(url), 5000);
                    } catch (err) {
                      alert(err instanceof Error ? err.message : "Couldn't render thumbnail");
                    }
                  }}
                  className="inline-flex items-center gap-1 rounded-full bg-gold px-3 py-1 text-xs font-medium text-black hover:bg-gold-light"
                >
                  <Download className="h-3 w-3" /> Download
                </button>
                <a
                  href={`/thumbnail-studio?headline=${encodeURIComponent(m.overlayText)}&subtitle=${encodeURIComponent(pkg.hookLine)}`}
                  className="text-[11px] text-muted hover:text-gold"
                >
                  Customize →
                </a>
              </div>
              <div className="mt-1 text-[11px] text-muted leading-snug">{m.reason}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Posting time + first comment — music moved up to the render area */}
      <div className="grid gap-3 lg:grid-cols-2">
        <div className="rounded-xl border border-border bg-surface p-5">
          <div className="text-[11px] uppercase tracking-widest text-gold/80"><Clock className="mr-1 inline h-3 w-3" /> Best time to post</div>
          <div className="mt-2 font-display text-lg text-text">{pkg.postingTime.window}</div>
          <p className="mt-1 text-sm text-muted">{pkg.postingTime.rationale}</p>
        </div>
        <div className="rounded-xl border border-border bg-surface p-5">
          <div className="flex items-center justify-between">
            <div className="text-[11px] uppercase tracking-widest text-gold/80"><MessageSquare className="mr-1 inline h-3 w-3" /> Drop this as the first comment</div>
            <button onClick={() => copy("first", pkg.firstComment)} className="text-xs text-muted hover:text-text">
              {copied === "first" ? <><Check className="inline h-3 w-3 text-gold" /> Copied</> : "Copy"}
            </button>
          </div>
          <p className="mt-2 text-sm text-text/90">{pkg.firstComment}</p>
        </div>
      </div>
    </div>
  );
}

/* Renders the source video as a thumbnail at the requested timestamp.
   Pure client side — no server upload needed for the preview. */

/* On-page preview that renders to a canvas using drawDesignedThumb — same
   draw logic as the downloadable JPEG. WYSIWYG: what you see is what you get. */
function DesignedThumbPreview({
  sourceFile,
  timestampSec,
  overlayText,
  reason,
  brandName,
}: {
  sourceFile: File | null;
  timestampSec: number;
  overlayText: string;
  reason?: string;
  brandName?: string;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!sourceFile || !canvasRef.current) return;
    let cancelled = false;
    const url = URL.createObjectURL(sourceFile);
    const v = document.createElement("video");
    v.src = url;
    v.muted = true;
    v.playsInline = true;
    (async () => {
      try {
        await new Promise<void>((resolve, reject) => {
          v.onloadedmetadata = () => resolve();
          v.onerror = () => reject(new Error("decode"));
        });
        v.currentTime = Math.max(0, Math.min(v.duration - 0.05, timestampSec));
        await new Promise<void>((resolve) => { v.onseeked = () => resolve(); });
        if (cancelled || !canvasRef.current) return;
        await ensureLuxeFontsLoaded();
        if (cancelled || !canvasRef.current) return;
        canvasRef.current.width = 540;
        canvasRef.current.height = 960;
        drawDesignedThumb(canvasRef.current, { videoOrImage: v, timestampSec, overlayText, reason, brandName });
        setReady(true);
      } catch {
        // ignore
      } finally {
        URL.revokeObjectURL(url);
      }
    })();
    return () => { cancelled = true; URL.revokeObjectURL(url); };
  }, [sourceFile, timestampSec, overlayText, brandName]);

  return (
    <div className="relative aspect-[9/16] w-full overflow-hidden rounded-lg bg-bg-deep">
      <canvas ref={canvasRef} className={"h-full w-full object-cover transition-opacity " + (ready ? "opacity-100" : "opacity-0")} />
      {!ready && <div className="absolute inset-0 grid place-items-center text-xs text-muted">designing…</div>}
    </div>
  );
}

function fmtSec(s: number): string {
  const m = Math.floor(s / 60);
  const r = Math.floor(s % 60);
  return `${m}:${String(r).padStart(2, "0")}`;
}
