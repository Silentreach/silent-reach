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

export interface Segment {
  startSec: number;
  endSec: number;
  /** 0-1 horizontal subject center (where to bias the crop window). Default 0.5 = center. */
  cropBiasX?: number;
  /** 0-1 vertical subject center. Default 0.5. */
  cropBiasY?: number;
  /** Which transition to play when entering this segment. Default "dip". */
  transitionIn?: "dip" | "whip" | "crossfade";
}
export type OutputAspect = "9:16" | "1:1" | "16:9";
export type HookPosition = "top" | "bottom" | "auto";
export type HookBackground = "none" | "pill" | "box";
export type HookStyle = "stagger" | "typewriter";
export type LogoKind = "image" | "video";

export interface LogoSource {
  kind: LogoKind;
  /** Data URL for images, object URL for videos */
  url: string;
}

export interface RenderOptions {
  source: File;
  segments: Segment[];
  outputAspect: OutputAspect;
  hookLine?: string;
  hookPosition?: HookPosition;        // default "auto"
  hookBackground?: HookBackground;    // default "none"
  hookBackgroundColor?: string;       // hex, used when background != "none"
  hookStyle?: HookStyle;              // default "stagger"
  platform?: "instagram_reel" | "youtube_short" | "facebook_reel";
  logo?: LogoSource;                   // image or video logo
  musicFile?: File;
  brandName?: string;
  includeOutro?: boolean;
  outroDurationSec?: number;          // default 2.0
  fadeOutSec?: number;                // default 1.5
  /** Optional staged progress: stage label + 0-1 percent within the stage */
  onStage?: (stage: "decoding" | "analyzing" | "rendering" | "finalizing", pct: number) => void;
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
    source, segments, outputAspect, hookLine, musicFile, brandName,
    onProgress,
  } = opts;
  if (segments.length === 0) throw new Error("No cut segments provided.");
  const dims = ASPECT_DIMS[outputAspect];
  const hookPos = resolveHookPosition(opts.hookPosition, opts.platform);
  const fadeOutSec = opts.fadeOutSec ?? 0.4;
  const outroDurSec = opts.outroDurationSec ?? 2.0;
  const includeOutro = (opts.includeOutro ?? true) && !!opts.logo;

  const totalMainDur = segments.reduce((acc, s) => acc + Math.max(0, s.endSec - s.startSec), 0);
  const totalRenderDur = totalMainDur + (includeOutro ? outroDurSec : 0);

  /* Source video */
  const sourceUrl = URL.createObjectURL(source);
  opts.onStage?.("decoding", 0);
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

  /* Logo — image OR video (MP4/WebM) */
  let logoImg: HTMLImageElement | null = null;
  let logoVideo: HTMLVideoElement | null = null;
  if (opts.logo?.url) {
    if (opts.logo.kind === "video") {
      logoVideo = await loadLogoVideo(opts.logo.url).catch(() => null);
      if (logoVideo) {
        logoVideo.loop = true;
        logoVideo.muted = true;
        try { await logoVideo.play(); } catch {}
      }
    } else {
      logoImg = await loadImage(opts.logo.url).catch(() => null);
    }
  }

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
  // Try MP4 first — Chrome 119+, Edge 119+, Safari all support it natively.
  // When MP4 wins here, the ReelMultiplier render flow skips ffmpeg.wasm transcoding
  // entirely (see the mimeType.includes("mp4") branch in onRender).
  const candidates = [
    "video/mp4;codecs=avc1.42E01E,mp4a.40.2", // h264 baseline + AAC-LC, broadest playback
    "video/mp4;codecs=avc1,mp4a",
    "video/mp4;codecs=avc1",
    "video/mp4",
    "video/webm;codecs=vp9,opus",
    "video/webm;codecs=vp8,opus",
    "video/webm",
  ];
  const mimeType = candidates.find((m) => MediaRecorder.isTypeSupported(m)) || "video/webm";
  opts.onStage?.("analyzing", 0);
  const recorder = new MediaRecorder(outputStream, {
    mimeType,
    videoBitsPerSecond: 9_000_000,
    audioBitsPerSecond: 128_000,
  });
  const chunks: Blob[] = [];
  recorder.ondataavailable = (e) => { if (e.data && e.data.size > 0) chunks.push(e.data); };

  /* Phase-driven draw loop (main → outro → stopped) */
  type Phase = "main" | "outro" | "stopped";
  let phase: Phase = "main";
  const renderStartWall = performance.now();
  let outroStartWall = 0;

  // Per-segment tracking for transitions + Ken Burns
  let currentSegIdx = 0;
  let segmentStartedAt = renderStartWall;
  const TRANSITION_DUR = 0.18;       // dip-to-black fade in/out at cut boundaries
  const KEN_BURNS_AMOUNT = 0.04;     // 4% slow zoom over each segment

  const drawLoop = () => {
    if (phase === "stopped") return;
    const nowMs = performance.now();
    const elapsedTotalSec = (nowMs - renderStartWall) / 1000;

    if (phase === "main") {
      // Per-segment progress for Ken Burns + transition timing
      const seg = segments[currentSegIdx];
      const segDur = Math.max(0.001, seg.endSec - seg.startSec);
      const segElapsed = (nowMs - segmentStartedAt) / 1000;
      const segProgress = Math.min(1, Math.max(0, segElapsed / segDur));
      const segRemaining = segDur - segElapsed;

      // Ken Burns: gradual zoom into center over each cut. Subtle (4%) so it
      // adds life on still moments without fighting camera motion in moving shots.
      const kenZoom = 1 - KEN_BURNS_AMOUNT * segProgress;
      drawFrame(ctx, video, dims, kenZoom, seg.cropBiasX ?? 0.5, seg.cropBiasY ?? 0.5);

      // No intro fade-in — pro reels start ON the first frame of action.
      // Pre-seek (line ~282) ensures the first recorded frame is the chosen
      // start, so we can hit the ground running without a black flash.

      // Dip-to-black at cut boundaries (skip for the first cut's start and last cut's end).
      let transOpacity = 0;
      if (currentSegIdx > 0 && segElapsed < TRANSITION_DUR) {
        // Fading IN from black at start of new cut
        transOpacity = 1 - (segElapsed / TRANSITION_DUR);
      } else if (currentSegIdx < segments.length - 1 && segRemaining < TRANSITION_DUR) {
        // Fading OUT to black at end of cut (before next seek)
        transOpacity = 1 - (segRemaining / TRANSITION_DUR);
      }
      if (transOpacity > 0.01) {
        ctx.fillStyle = `rgba(0,0,0,${transOpacity.toFixed(3)})`;
        ctx.fillRect(0, 0, dims.w, dims.h);
      }

      if (hookLine && elapsedTotalSec < 3.0) {
        drawAnimatedHook(ctx, hookLine, dims, hookPos, elapsedTotalSec, opts.hookBackground || "none", opts.hookBackgroundColor, opts.hookStyle || "stagger");
      }

      // Visual fadeout in the last fadeOutSec seconds of MAIN (before outro)
      const remainingMain = totalMainDur - elapsedTotalSec;
      if (remainingMain < fadeOutSec && remainingMain > 0) {
        const a = (fadeOutSec - remainingMain) / fadeOutSec;
        ctx.fillStyle = `rgba(0,0,0,${a.toFixed(3)})`;
        ctx.fillRect(0, 0, dims.w, dims.h);
      }
    } else if (phase === "outro") {
      const elapsedOutro = (nowMs - outroStartWall) / 1000;
      if (logoVideo) drawOutroVideo(ctx, dims, logoVideo, brandName, elapsedOutro, outroDurSec);
      else if (logoImg) drawOutroFrame(ctx, dims, logoImg, brandName, elapsedOutro, outroDurSec);
    }

    if (onProgress) onProgress(Math.min(1, elapsedTotalSec / totalRenderDur));
    requestAnimationFrame(drawLoop);
  };
  opts.onStage?.("rendering", 0);
  requestAnimationFrame(drawLoop);

  /* Schedule audio fadeout to align with the visual one. Music continues
     into the outro at a lower volume; source audio fades to 0 at end of main. */
  const t0 = audioCtx.currentTime;
  // Music holds full volume through visuals + outro, fades only in the LAST 0.5s.
  // Source audio (when no music uploaded) fades with the visual end of main.
  const MUSIC_TAIL = 0.5;
  if (musicNode) {
    masterGain.gain.setValueAtTime(0.9, t0);
    masterGain.gain.setValueAtTime(0.9, t0 + totalRenderDur - MUSIC_TAIL);
    masterGain.gain.linearRampToValueAtTime(0, t0 + totalRenderDur - 0.05);
  } else if (mediaSourceNode) {
    masterGain.gain.setValueAtTime(0.9, t0);
    masterGain.gain.setValueAtTime(0.9, t0 + totalMainDur - fadeOutSec);
    masterGain.gain.linearRampToValueAtTime(0, t0 + totalMainDur);
  }

  /* Pre-seek + multi-paint stabilization: MediaRecorder will record black
     frames if the captureStream hasn't observed a stable canvas frame before
     recorder.start(). 80ms wasn't enough on slower devices — bump to 250ms
     plus a double-paint that spans two requestAnimationFrame ticks so the
     captureStream definitely has the frame in its buffer. */
  await seekTo(video, segments[0].startSec);
  await new Promise((r) => setTimeout(r, 250));
  drawFrame(ctx, video, dims, 1, segments[0].cropBiasX ?? 0.5, segments[0].cropBiasY ?? 0.5);
  await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
  drawFrame(ctx, video, dims, 1, segments[0].cropBiasX ?? 0.5, segments[0].cropBiasY ?? 0.5);
  await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
  await new Promise((r) => setTimeout(r, 60));

  recorder.start();
  if (musicNode) musicNode.start();

  /* Walk segments — first segment is already seeked, so just play it. */
  for (let i = 0; i < segments.length; i++) {
    currentSegIdx = i;
    const seg = segments[i];
    if (i > 0) {
      await seekTo(video, seg.startSec);
      await new Promise((r) => setTimeout(r, 60));
    }
    segmentStartedAt = performance.now();
    await playUntil(video, seg.endSec);
  }

  /* Outro phase */
  if (includeOutro && (logoImg || logoVideo)) {
    outroStartWall = performance.now();
    phase = "outro";
    await new Promise((r) => setTimeout(r, outroDurSec * 1000));
  }

  phase = "stopped";
  if (musicNode) try { musicNode.stop(); } catch {}
  opts.onStage?.("finalizing", 0);
  recorder.stop();

  await new Promise<void>((res) => { recorder.onstop = () => res(); });
  try { await audioCtx.close(); } catch {}
  URL.revokeObjectURL(sourceUrl);
  return { blob: new Blob(chunks, { type: mimeType }), mimeType, durationSec: totalRenderDur };
}

/* ───────── Drawing helpers ───────── */

function drawFrame(
  ctx: CanvasRenderingContext2D,
  video: HTMLVideoElement,
  dims: { w: number; h: number },
  kenZoom: number = 1,
  cropBiasX: number = 0.5,
  cropBiasY: number = 0.5,
) {
  const sw = video.videoWidth || 1920;
  const sh = video.videoHeight || 1080;
  const sourceAspect = sw / sh;
  const targetAspect = dims.w / dims.h;
  let sx = 0, sy = 0, scw = sw, sch = sh;

  if (sourceAspect > targetAspect) {
    // Source is wider than target (e.g. 16:9 → 9:16) — crop horizontally.
    scw = sh * targetAspect;
    // Position the crop window biased toward the subject's X center.
    const maxOffsetX = sw - scw;
    sx = Math.max(0, Math.min(maxOffsetX, cropBiasX * sw - scw / 2));
  } else if (sourceAspect < targetAspect) {
    // Source is taller — crop vertically.
    sch = sw / targetAspect;
    const maxOffsetY = sh - sch;
    sy = Math.max(0, Math.min(maxOffsetY, cropBiasY * sh - sch / 2));
  }

  // Ken Burns slow zoom into center of CURRENT crop window.
  if (kenZoom !== 1) {
    const adjW = scw * kenZoom;
    const adjH = sch * kenZoom;
    sx = sx + (scw - adjW) / 2;
    sy = sy + (sch - adjH) / 2;
    scw = adjW;
    sch = adjH;
  }

  // Cinematic color grade — applied as canvas filter (single GPU pass on most browsers).
  // saturate(108%): subtle pop. contrast(105%): gentle S-curve approximation.
  // brightness(101%): tiny lift. These are conservative — pro reels stay subtle.
  ctx.filter = "saturate(108%) contrast(105%) brightness(101%)";
  ctx.drawImage(video, sx, sy, scw, sch, 0, 0, dims.w, dims.h);
  ctx.filter = "none";

  // Radial vignette: cinematic darkening at the corners. Anchored to dims center.
  drawVignette(ctx, dims);
}

/* Cached vignette gradient — built once per dims. Drawing the gradient
   each frame is cheap; computing it isn't. */
let _vignetteCache: { w: number; h: number; grad: CanvasGradient | null } | null = null;
function drawVignette(ctx: CanvasRenderingContext2D, dims: { w: number; h: number }) {
  if (!_vignetteCache || _vignetteCache.w !== dims.w || _vignetteCache.h !== dims.h) {
    const cx = dims.w / 2;
    const cy = dims.h / 2;
    const r = Math.hypot(cx, cy);
    const grad = ctx.createRadialGradient(cx, cy, r * 0.6, cx, cy, r);
    grad.addColorStop(0, "rgba(0,0,0,0)");
    grad.addColorStop(1, "rgba(0,0,0,0.32)");
    _vignetteCache = { w: dims.w, h: dims.h, grad };
  }
  if (_vignetteCache.grad) {
    ctx.fillStyle = _vignetteCache.grad;
    ctx.fillRect(0, 0, dims.w, dims.h);
  }
}

/* Motion hook overlay — word-by-word stagger reveal:
   each word fades in + slides up + scales over 0.55s with 90ms stagger between words.
   Holds, then everything floats up + fades out together over the last 0.5s.
   Optional rounded-pill or box background behind the text using the brand color. */
function drawAnimatedHook(
  ctx: CanvasRenderingContext2D,
  text: string,
  dims: { w: number; h: number },
  position: "top" | "bottom",
  elapsedSec: number,
  bgStyle: HookBackground,
  bgColor?: string,
  style: HookStyle = "stagger",
) {
  if (style === "typewriter") {
    drawTypewriterHook(ctx, text, dims, position, elapsedSec, bgStyle, bgColor);
    return;
  }
  const HOLD_END = 2.5;
  const TOTAL = 3.0;
  const REVEAL_DUR = 0.55;     // each word reveals over this duration
  const STAGGER = 0.07;        // delay between consecutive words (tighter for snappier reveal)
  const FADE_OUT_DUR = TOTAL - HOLD_END; // 0.5s tail fade

  const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3);

  // Group fade-out: applies to all words at the end of the hook
  let groupOpacity = 1;
  let groupYOffset = 0;
  if (elapsedSec > HOLD_END) {
    const k = Math.min(1, (elapsedSec - HOLD_END) / FADE_OUT_DUR);
    groupOpacity = 1 - easeOutCubic(k);
    groupYOffset = -k * 24 * (position === "top" ? 0.5 : 1);
  }
  if (groupOpacity <= 0.01) return;

  const padding = Math.round(dims.w * 0.06);
  const fontSize = Math.round(dims.w * 0.062);
  const lineH = fontSize * 1.18;
  const maxW = dims.w - padding * 2;

  ctx.save();
  ctx.font = `700 ${fontSize}px "Inter Tight", Inter, Helvetica, Arial, sans-serif`;
  ctx.textBaseline = "top";

  // Layout: split into words, then word-wrap into lines preserving word indices
  const wordsRaw = text.split(/\s+/).filter(Boolean);
  const spaceW = ctx.measureText(" ").width;

  type LaidWord = { word: string; lineIdx: number; x: number; idxInText: number };
  const laid: LaidWord[] = [];
  let lineIdx = 0;
  let xCursor = 0;
  let lineStarts: number[] = [0];
  for (let i = 0; i < wordsRaw.length; i++) {
    const word = wordsRaw[i];
    const wordW = ctx.measureText(word).width;
    const isFirstOnLine = xCursor === 0;
    const advance = isFirstOnLine ? wordW : spaceW + wordW;
    if (!isFirstOnLine && xCursor + advance > maxW) {
      lineIdx++;
      xCursor = 0;
      lineStarts.push(lineIdx);
      laid.push({ word, lineIdx, x: 0, idxInText: i });
      xCursor = wordW;
    } else {
      const x = isFirstOnLine ? 0 : xCursor + spaceW;
      laid.push({ word, lineIdx, x, idxInText: i });
      xCursor = x + wordW;
    }
  }
  const numLines = lineIdx + 1;
  const blockH = numLines * lineH;
  const baseTop = position === "top"
    ? Math.round(dims.h * 0.16)
    : Math.round(dims.h * 0.78) - blockH;
  const top = baseTop + groupYOffset;

  // Background pill / box — sized to widest line, drawn behind text
  if (bgStyle !== "none") {
    const pad = Math.round(fontSize * 0.5);
    const lineWidths: number[] = new Array(numLines).fill(0);
    for (const lw of laid) {
      const wordW = ctx.measureText(lw.word).width;
      const right = lw.x + wordW;
      if (right > lineWidths[lw.lineIdx]) lineWidths[lw.lineIdx] = right;
    }
    const widest = Math.max(...lineWidths);
    const bgX = padding - pad;
    const bgY = top - pad * 0.55;
    const bgW = widest + pad * 2;
    const bgH = blockH + pad * 1.1;
    const radius = bgStyle === "pill" ? Math.min(bgH / 2, fontSize) : Math.round(fontSize * 0.2);
    ctx.globalAlpha = groupOpacity * 0.92;
    ctx.fillStyle = bgColor || "#0a0a0a";
    roundRect(ctx, bgX, bgY, bgW, bgH, radius);
    ctx.fill();
  } else {
    // Transparent bg: paint a soft vertical gradient band behind the text region
    // so the type is readable on any background without a hard pill.
    const bandPadV = Math.round(fontSize * 0.9);
    const bandTop = Math.max(0, top - bandPadV);
    const bandH = blockH + bandPadV * 2;
    const grad = position === "top"
      ? ctx.createLinearGradient(0, bandTop, 0, bandTop + bandH)
      : ctx.createLinearGradient(0, bandTop + bandH, 0, bandTop);
    grad.addColorStop(0, `rgba(0,0,0,${(0.55 * groupOpacity).toFixed(3)})`);
    grad.addColorStop(0.6, `rgba(0,0,0,${(0.35 * groupOpacity).toFixed(3)})`);
    grad.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = grad;
    ctx.fillRect(0, bandTop, dims.w, bandH);
  }

  // Per-word stagger draw
  for (const lw of laid) {
    const wordStart = lw.idxInText * STAGGER;
    const wordProgress = Math.min(1, Math.max(0, (elapsedSec - wordStart) / REVEAL_DUR));
    if (wordProgress <= 0) continue; // not yet revealed
    const eased = easeOutCubic(wordProgress); // smooth, no overshoot — feels more cinematic
    const wordOpacity = easeOutCubic(wordProgress) * groupOpacity;
    // Slide-up by 0.55em, easing back slightly past the rest position
    const slide = (1 - eased) * fontSize * 0.55 * (position === "top" ? -0.4 : 1);
    // Subtle scale 0.92 -> 1.0 during reveal
    const scale = 0.92 + 0.08 * easeOutCubic(wordProgress);

    const wordX = padding + lw.x;
    const wordY = top + lw.lineIdx * lineH + slide;
    const wordW = ctx.measureText(lw.word).width;

    ctx.save();
    // Center scale around the word's center
    ctx.translate(wordX + wordW / 2, wordY + fontSize / 2);
    ctx.scale(scale, scale);
    ctx.translate(-(wordX + wordW / 2), -(wordY + fontSize / 2));

    ctx.globalAlpha = wordOpacity;
    if (bgStyle === "none") {
      ctx.shadowColor = "rgba(0,0,0,0.85)";
      ctx.shadowBlur = 18;
      ctx.shadowOffsetY = 4;
    }
    ctx.fillStyle = "#fff";
    ctx.fillText(lw.word, wordX, wordY);
    ctx.restore();
  }
  ctx.restore();
}


/* Typewriter variant — letters appear one by one with a blinking caret.
   Used for YT Shorts where the setup arc benefits from a slower, more
   deliberate reveal. Same 3s timeline (reveal -> hold -> fade out). */
function drawTypewriterHook(
  ctx: CanvasRenderingContext2D,
  text: string,
  dims: { w: number; h: number },
  position: "top" | "bottom",
  elapsedSec: number,
  bgStyle: HookBackground,
  bgColor?: string,
) {
  const HOLD_END = 2.5;
  const TOTAL = 3.0;
  // Reveal 0 -> all chars over the first ~1.4s, then hold, then fade out.
  const REVEAL_END = Math.min(1.4, Math.max(0.6, text.length * 0.07));

  // Group fade-out: applies at end of hook
  let groupOpacity = 1;
  let groupYOffset = 0;
  if (elapsedSec > HOLD_END) {
    const k = Math.min(1, (elapsedSec - HOLD_END) / (TOTAL - HOLD_END));
    groupOpacity = 1 - k;
    groupYOffset = -k * 18 * (position === "top" ? 0.5 : 1);
  }
  if (groupOpacity <= 0.01) return;

  // How many chars are visible right now
  const revealProgress = Math.min(1, Math.max(0, elapsedSec / REVEAL_END));
  const charsVisible = Math.floor(text.length * revealProgress);
  const visible = text.slice(0, charsVisible);
  const isStillTyping = charsVisible < text.length;

  const padding = Math.round(dims.w * 0.06);
  const fontSize = Math.round(dims.w * 0.062);
  const lineH = fontSize * 1.18;
  const maxW = dims.w - padding * 2;

  ctx.save();
  ctx.font = `700 ${fontSize}px "Inter Tight", Inter, Helvetica, Arial, sans-serif`;
  ctx.textBaseline = "top";

  // Word-wrap on the visible substring
  const words = visible.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let line = "";
  for (const w of words) {
    const test = line ? `${line} ${w}` : w;
    if (ctx.measureText(test).width > maxW && line) { lines.push(line); line = w; }
    else line = test;
  }
  if (line) lines.push(line);

  const numLines = Math.max(1, lines.length);
  const blockH = numLines * lineH;
  const baseTop = position === "top"
    ? Math.round(dims.h * 0.16)
    : Math.round(dims.h * 0.78) - blockH;
  const top = baseTop + groupYOffset;

  // Gradient band behind text for readability
  const bandPadV = Math.round(fontSize * 0.9);
  const bandTop = Math.max(0, top - bandPadV);
  const bandH = blockH + bandPadV * 2;
  const grad = position === "top"
    ? ctx.createLinearGradient(0, bandTop, 0, bandTop + bandH)
    : ctx.createLinearGradient(0, bandTop + bandH, 0, bandTop);
  grad.addColorStop(0, `rgba(0,0,0,${(0.55 * groupOpacity).toFixed(3)})`);
  grad.addColorStop(0.6, `rgba(0,0,0,${(0.35 * groupOpacity).toFixed(3)})`);
  grad.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = grad;
  ctx.fillRect(0, bandTop, dims.w, bandH);

  // Optional pill/box background
  if (bgStyle !== "none" && lines.length > 0) {
    const pad = Math.round(fontSize * 0.5);
    let widest = 0;
    for (const l of lines) widest = Math.max(widest, ctx.measureText(l).width);
    const bgX = padding - pad;
    const bgY = top - pad * 0.55;
    const bgW = widest + pad * 2;
    const bgH = blockH + pad * 1.1;
    const radius = bgStyle === "pill" ? Math.min(bgH / 2, fontSize) : Math.round(fontSize * 0.2);
    ctx.globalAlpha = groupOpacity * 0.92;
    ctx.fillStyle = bgColor || "#0a0a0a";
    roundRect(ctx, bgX, bgY, bgW, bgH, radius);
    ctx.fill();
  }

  ctx.shadowColor = "rgba(0,0,0,0.85)";
  ctx.shadowBlur = 18;
  ctx.shadowOffsetY = 4;
  ctx.fillStyle = "#fff";
  ctx.globalAlpha = groupOpacity;
  for (let i = 0; i < lines.length; i++) {
    ctx.fillText(lines[i], padding, top + i * lineH, maxW);
  }

  // Blinking caret while still typing
  if (isStillTyping) {
    const caretBlink = Math.floor(elapsedSec * 2.5) % 2 === 0;
    if (caretBlink && lines.length > 0) {
      const lastLine = lines[lines.length - 1];
      const caretX = padding + ctx.measureText(lastLine).width + Math.round(fontSize * 0.08);
      const caretY = top + (lines.length - 1) * lineH;
      ctx.shadowBlur = 0;
      ctx.shadowOffsetY = 0;
      ctx.fillRect(caretX, caretY + fontSize * 0.05, Math.round(fontSize * 0.08), fontSize * 0.95);
    }
  }
  ctx.restore();
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
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

function drawLogoVideo(ctx: CanvasRenderingContext2D, video: HTMLVideoElement, dims: { w: number; h: number }) {
  const naturalW = video.videoWidth || 1; const naturalH = video.videoHeight || 1;
  const lw = Math.round(dims.w * 0.18);
  const lh = Math.round(lw * (naturalH / naturalW));
  const pad = Math.round(dims.w * 0.03);
  ctx.save();
  ctx.globalAlpha = 0.95;
  ctx.drawImage(video, dims.w - lw - pad, dims.h - lh - pad, lw, lh);
  ctx.restore();
}

function drawOutroVideo(
  ctx: CanvasRenderingContext2D,
  dims: { w: number; h: number },
  video: HTMLVideoElement,
  brandName: string | undefined,
  elapsedSec: number,
  totalSec: number,
) {
  ctx.fillStyle = "#000";
  ctx.fillRect(0, 0, dims.w, dims.h);
  const t = Math.min(1, Math.max(0, elapsedSec / totalSec));
  let alpha = 1;
  if (t < 0.18) alpha = t / 0.18;
  else if (t > 0.82) alpha = Math.max(0, 1 - (t - 0.82) / 0.18);
  const naturalW = video.videoWidth || 1; const naturalH = video.videoHeight || 1;
  const targetW = Math.round(dims.w * 0.6);
  const targetH = Math.round(targetW * (naturalH / naturalW));
  const x = Math.round((dims.w - targetW) / 2);
  const y = Math.round((dims.h - targetH) / 2 - dims.w * 0.04);
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.drawImage(video, x, y, targetW, targetH);
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

function loadLogoVideo(src: string): Promise<HTMLVideoElement> {
  return new Promise((res, rej) => {
    const v = document.createElement("video");
    v.src = src;
    v.muted = true;
    v.loop = true;
    v.playsInline = true;
    v.crossOrigin = "anonymous";
    v.onloadedmetadata = () => res(v);
    v.onerror = () => rej(new Error("Couldn’t load logo video."));
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
