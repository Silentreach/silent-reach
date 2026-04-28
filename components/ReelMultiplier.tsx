"use client";

import { useRef, useState } from "react";
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

interface ExtractedFrame { data: string; mediaType: "image/jpeg"; timestampSec: number; motionDelta: number; subjectZone?: SubjectZone; }

/**
 * Extract N frames + compute motion delta between consecutive frames using a tiny
 * canvas pixel-diff. Motion delta tells the AI which frames are visually dynamic
 * (probable highlights / camera moves) vs static (probable B-roll filler).
 */
async function extractFramesFromFile(file: File): Promise<{ frames: ExtractedFrame[]; durationSec: number }> {
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
  const [description, setDescription] = useState<string>("");
  const [series, setSeries] = useState<string>("");
  const [stage, setStage] = useState<"idle" | "extracting" | "thinking" | "done" | "error">("idle");
  const [musicFile, setMusicFile] = useState<File | null>(null);
  const [pixabayTrackId, setPixabayTrackId] = useState<number | null>(null);
  const [musicBPM, setMusicBPM] = useState<number | null>(null);
  const [analyzingBPM, setAnalyzingBPM] = useState(false);
  const [customLogo, setCustomLogo] = useState<{kind: "image" | "video"; url: string} | null>(null);
  const musicInputRef = useRef<HTMLInputElement>(null);
  const logoInputRef = useRef<HTMLInputElement>(null);
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
    setError(null); setOutput(null); setStage("extracting");
    try {
      const { frames, durationSec } = await extractFramesFromFile(file);
      setExtractedFrames(frames);
      setStage("thinking");
      const res = await fetch("/api/reel-multiplier", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          input: { sourceDurationSec: durationSec, description: description || undefined, series: series || undefined, frames },
          userContext: getUserContext(),
        }),
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
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      setError(msg); setStage("error");
    }
  };

  const isBusy = stage === "extracting" || stage === "thinking";

  return (
    <div className="space-y-8">
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
            <div className="font-display text-xl tracking-tight text-text">Drop a 30 to 90 second video</div>
            <div className="text-sm text-muted">MP4, MOV, WEBM. Max 2 minutes. Max ~200&nbsp;MB.</div>
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

            {/* Optional: music + logo for the rendered output */}
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Music track (optional — replaces source audio + drives beat-synced cuts)">
                <div className="flex items-center gap-2 rounded-md border border-border bg-bg p-2">
                  {musicFile ? (
                    <>
                      <Music className="h-3.5 w-3.5 text-gold" />
                      <span className="flex-1 truncate text-xs text-text/85">{musicFile.name}</span>
                      <button type="button" onClick={() => { setMusicFile(null); setMusicBPM(null); }} className="text-xs text-muted hover:text-text"><X className="h-3 w-3" /></button>
                    </>
                  ) : (
                    <button type="button" onClick={() => musicInputRef.current?.click()} className="flex w-full items-center gap-2 text-xs text-muted hover:text-text">
                      <Upload className="h-3 w-3" /> Upload .mp3 / .wav / .m4a
                    </button>
                  )}
                  <input ref={musicInputRef} type="file" accept="audio/*" className="hidden"
                    onChange={async (e) => {
                      const f = e.target.files?.[0];
                      if (!f) return;
                      setMusicFile(f);
                      setMusicBPM(null);
                      setAnalyzingBPM(true);
                      const bpm = await detectBPM(f).catch(() => null);
                      setMusicBPM(bpm);
                      setAnalyzingBPM(false);
                    }} />
                </div>
                {musicFile && (
                  <div className="mt-1.5 flex items-center gap-1.5 text-[11px] text-muted">
                    {analyzingBPM ? (
                      <><Loader2 className="h-3 w-3 animate-spin text-gold" /> Detecting BPM…</>
                    ) : musicBPM ? (
                      <><span className="text-gold">♪ {musicBPM.toFixed(1)} BPM</span> · cuts auto-snap to beats (±0.25s)</>
                    ) : (
                      <>BPM not detected — cuts will use AI markers as-is</>
                    )}
                  </div>
                )}
              </Field>

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
                      <Upload className="h-3 w-3" /> PNG / SVG / MP4 motion logo (or use Brand Kit)
                    </button>
                  )}
                  <input ref={logoInputRef} type="file"
                    accept="image/*,video/*"
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0]; if (!f) return;
                      const isVid = f.type.startsWith("video/");
                      const cap = isVid ? 30 * 1024 * 1024 : 2 * 1024 * 1024;
                      if (f.size > cap) { alert(`Logo over ${isVid ? "30MB" : "2MB"} — please pick a smaller file. Got ${(f.size / (1024*1024)).toFixed(1)}MB.`); return; }
                      if (isVid) {
                        const url = URL.createObjectURL(f);
                        setCustomLogo({ kind: "video", url });
                      } else {
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
                {stage === "extracting" && <><Loader2 className="h-4 w-4 animate-spin" /> Reading frames…</>}
                {stage === "thinking" && <><Loader2 className="h-4 w-4 animate-spin" /> Generating 3 platform reels…</>}
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
      {output && <ReelResults output={output} sourceUrl={previewUrl} sourceFile={file} musicFile={musicFile} customLogo={customLogo} musicBPM={musicBPM} extractedFrames={extractedFrames} onPickMusic={(track, blob) => { const f = new File([blob], `pixabay_${track.id}.mp3`, { type: "audio/mpeg" }); setMusicFile(f); setPixabayTrackId(track.id); detectBPM(f).then((bpm) => setMusicBPM(bpm)); }} pixabayTrackId={pixabayTrackId} />}
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

function ReelResults({ output, sourceUrl, sourceFile, musicFile, customLogo, musicBPM, extractedFrames, onPickMusic, pixabayTrackId }: { output: ReelMultiplierOutput; sourceUrl: string | null; sourceFile: File | null; musicFile: File | null; customLogo: {kind: "image" | "video"; url: string} | null; musicBPM: number | null; extractedFrames: ExtractedFrame[]; onPickMusic: (track: PixabayTrack, blob: Blob) => void; pixabayTrackId: number | null }) {
  const [active, setActive] = useState<ReelPlatform>(output.packages[0]?.platform || "instagram_reel");
  const pkg = output.packages.find((p) => p.platform === active) || output.packages[0];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="rounded-2xl border border-gold/30 bg-gold/5 p-5">
        <div className="text-[11px] uppercase tracking-widest text-gold/80"><Sparkles className="mr-1 inline h-3 w-3" /> Three reels, ready to ship</div>
        <h2 className="mt-1 font-display text-2xl tracking-tight text-text md:text-3xl">One upload. Three platform-native packages.</h2>
        <p className="mt-2 text-sm text-muted">{output.globalNotes}</p>
      </div>

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

      {pkg && <PackageCard pkg={pkg} sourceUrl={sourceUrl} sourceFile={sourceFile} musicFile={musicFile} customLogo={customLogo} musicBPM={musicBPM} extractedFrames={extractedFrames} onPickMusic={onPickMusic} pixabayTrackId={pixabayTrackId} />}

      {/* Music licensing footer */}
      <div className="rounded-2xl border border-border bg-bg-deep p-5">
        <div className="flex items-start gap-3">
          <Music className="mt-0.5 h-4 w-4 shrink-0 text-gold" />
          <div className="flex-1">
            <div className="text-[11px] uppercase tracking-widest text-gold/80">Music licensing — read once</div>
            <p className="mt-1.5 text-sm leading-relaxed text-muted">{output.musicLicensingNote}</p>
            <div className="mt-3 flex flex-wrap gap-2">
              <ExtLink href="https://www.epidemicsound.com/search/" label="Epidemic Sound search" />
              <ExtLink href="https://artlist.io/songs" label="Artlist" />
              <ExtLink href="https://studio.youtube.com/channel/UC/music" label="YouTube Audio Library" />
              <ExtLink href="https://pixabay.com/music/" label="Pixabay Music (free)" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function PackageCard({ pkg, sourceUrl, sourceFile, musicFile, customLogo, musicBPM, extractedFrames, onPickMusic, pixabayTrackId }: { pkg: ReelPackage; sourceUrl: string | null; sourceFile: File | null; musicFile: File | null; customLogo: {kind: "image" | "video"; url: string} | null; musicBPM: number | null; extractedFrames: ExtractedFrame[]; onPickMusic: (track: PixabayTrack, blob: Blob) => void; pixabayTrackId: number | null }) {
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
  const [previewFilename, setPreviewFilename] = useState<string>("");
  const [previewThumbUrl, setPreviewThumbUrl] = useState<string | null>(null);
  const [previewThumbName, setPreviewThumbName] = useState<string>("");
  const [renderError, setRenderError] = useState<string | null>(null);
  const [hookPos, setHookPos] = useState<"auto" | "top" | "bottom">("auto");
  const [includeOutro, setIncludeOutro] = useState(true);
  const [hookBg, setHookBg] = useState<"none" | "pill" | "box">("none");

  // User-editable overrides — generator → tool. Default to AI's suggestions.
  const [editedHook, setEditedHook] = useState<string>(pkg.hookLine);
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
          transitionIn: i === 0 ? "dip" as const : inferTransition(prev?.motionDelta, closest?.motionDelta),
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

      // AI thumbnail companion — capture first-listed thumbnail moment from source.
      try {
        if (sourceFile && pkg.thumbnailMoments?.[0]?.timestampSec != null) {
          const thumbBlob = await captureThumbnailAt(sourceFile, pkg.thumbnailMoments[0].timestampSec);
          if (previewThumbUrl) URL.revokeObjectURL(previewThumbUrl);
          setPreviewThumbUrl(URL.createObjectURL(thumbBlob));
          setPreviewThumbName(`mintflow_${platformShort}_${tag}_thumb.jpg`);
        }
      } catch (thumbErr) {
        console.warn("Thumbnail capture failed (non-fatal)", thumbErr);
      }

      setRenderState("ready");
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
            <div className="text-[11px] uppercase tracking-widest text-gold/85"><Download className="mr-1 inline h-3 w-3" /> Render preview · review before downloading</div>
            <div className="mt-1 font-display text-lg tracking-tight text-text">
              {editedCuts.length} cut{editedCuts.length === 1 ? "" : "s"}, stitched to 9:16 · {customLogo?.kind === "video" ? "motion logo" : (customLogo || getBrandKit().logoDataUrl) ? "logo applied" : "no logo"} · {musicFile ? (musicBPM ? `music ${musicBPM.toFixed(0)} BPM · ${beatSnapsApplied} cut${beatSnapsApplied === 1 ? "" : "s"} snapped to beat` : `music: ${musicFile.name.slice(0, 24)}`) : "source audio"}
            </div>
            <p className="mt-1 text-xs text-muted">
              9:16 center-crop · multi-cut stitch · hook text burned in for 3s · audio + video fade out together over 1.5s · {includeOutro && (customLogo || getBrandKit().logoDataUrl) ? "animated logo outro at the end" : "no outro"} · WebM output (uploads to YT directly; IG/FB drop in CapCut → re-export as MP4)
            </p>
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
            disabled={renderState === "rendering" || !sourceFile}
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
                    if (previewUrl) URL.revokeObjectURL(previewUrl);
                    if (previewThumbUrl) URL.revokeObjectURL(previewThumbUrl);
                    setPreviewUrl(null);
                    setPreviewThumbUrl(null);
                    setRenderState("idle");
                  }}
                  className="inline-flex items-center justify-center gap-2 rounded-full border border-border bg-bg-deep/40 px-4 py-2 text-sm text-muted hover:text-text"
                >
                  Try a different cut → re-render
                </button>
              </div>
              <p className="text-[11px] text-muted leading-relaxed mt-2">
                Not happy with it? Nudge cuts/hook below and hit re-render. Or switch to a different platform tab and render that one too — keep the one you like.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Cut + hook + caption row */}
      <div className="grid gap-4 lg:grid-cols-[1fr_1.4fr]">
        {/* Left: cut + hook */}
        <div className="space-y-3">
          <div className="rounded-xl border border-border bg-surface p-5">
            <div className="flex items-center justify-between">
              <div className="text-[11px] uppercase tracking-widest text-gold/80">Cuts for this platform</div>
              <div className="text-[11px] text-muted">{editedCuts.length} cut{editedCuts.length === 1 ? "" : "s"} · {editedCuts.reduce((acc, c) => acc + Math.max(0, c.endSec - c.startSec), 0).toFixed(0)}s total</div>
            </div>
            <div className="mt-2 space-y-2">
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
            <p className="mt-2 text-[11px] text-muted">Nudge ±0.5s. The AI's reasoning: <span className="text-text/80">{editedCuts[0]?.reason || "—"}</span></p>
          </div>

          <div className="rounded-xl border border-border bg-surface p-5">
            <div className="flex items-center justify-between">
              <div className="text-[11px] uppercase tracking-widest text-gold/80">Hook (first 3s overlay) — edit to taste</div>
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
              <span>{editedHook.length}/80 chars · works without sound</span>
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
              {pkg.hashtags.map((h) => (
                <span key={h} className="rounded-full border border-border bg-bg-deep px-2.5 py-0.5 text-xs text-text/85">#{h.replace(/^#/, "")}</span>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Thumbnails */}
      <div className="rounded-xl border border-border bg-surface p-5">
        <div className="mb-3 flex items-center justify-between">
          <div className="text-[11px] uppercase tracking-widest text-gold/80"><ImageIcon className="mr-1 inline h-3 w-3" /> Thumbnail moments — pick one</div>
          {sourceUrl && <span className="text-[10px] text-muted">Frames pulled from your upload at the timestamps below</span>}
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          {pkg.thumbnailMoments.map((m, i) => (
            <a key={i} href={`/thumbnail-studio?headline=${encodeURIComponent(m.overlayText)}&subtitle=${encodeURIComponent(pkg.hookLine)}`}
               className="group block">
              <div className="relative aspect-[9/16] overflow-hidden rounded-lg border border-border-strong bg-bg-deep transition group-hover:border-gold/60">
                <FrameAt sourceUrl={sourceUrl} timeSec={m.timestampSec} />
                <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black via-black/60 to-transparent p-3">
                  <div className="text-[10px] uppercase tracking-widest text-gold">{fmtSec(m.timestampSec)}</div>
                  <div className="mt-0.5 font-display text-base leading-tight text-text">{m.overlayText}</div>
                </div>
              </div>
              <div className="mt-1.5 text-xs text-muted">{m.reason}</div>
              <div className="mt-1 inline-flex items-center gap-1 text-xs text-gold opacity-0 transition group-hover:opacity-100">
                Customize in Studio <ArrowRight className="h-3 w-3" />
              </div>
            </a>
          ))}
        </div>
      </div>

      {/* Music + posting time + first comment */}
      <div className="grid gap-3 lg:grid-cols-2">
        <div className="rounded-xl border border-border bg-surface p-5">
          <div className="text-[11px] uppercase tracking-widest text-gold/80"><Music className="mr-1 inline h-3 w-3" /> Music suggestions</div>
          <ul className="mt-3 space-y-3">
            {pkg.musicSuggestions.map((m, i) => (
              <li key={i} className="rounded-lg border border-border bg-bg-deep p-3">
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="rounded-full bg-gold/10 px-2 py-0.5 text-xs text-gold">{m.mood}</span>
                  <span className="rounded-full border border-border px-2 py-0.5 text-xs text-text/80">{m.genre}</span>
                  {m.bpm ? <span className="text-[10px] text-muted">~{m.bpm} BPM</span> : null}
                </div>
                <div className="mt-1.5 text-sm text-text/90">{m.instrumentation}</div>
                {m.similarTo && <div className="text-xs text-muted">Similar to: {m.similarTo}</div>}
                <div className="mt-2 flex flex-wrap gap-2">
                  <ExtLink href={`https://www.epidemicsound.com/search/?term=${encodeURIComponent(m.searchQuery)}`} label="Search Epidemic Sound" />
                  <ExtLink href={`https://artlist.io/royalty-free-music?terms=${encodeURIComponent(m.searchQuery)}`} label="Search Artlist" />
                </div>
                {m.licensingNote && <div className="mt-1 text-[11px] text-muted">{m.licensingNote}</div>}
              </li>
            ))}
          </ul>

          {/* Pixabay music browser — pick a track in-app, no leaving Mintflow. */}
          <div className="mt-4 rounded-lg border border-mint/40 bg-mint/5 p-3">
            <div className="text-[11px] uppercase tracking-widest text-mint/85 mb-2">
              <Music className="mr-1 inline h-3 w-3" /> Or pick a track right here (royalty-free)
            </div>
            <MusicBrowser
              defaultQuery={pkg.musicSuggestions?.[0]?.searchQuery || pkg.musicSuggestions?.[0]?.mood || ""}
              onSelect={onPickMusic}
              selectedId={pixabayTrackId}
              minDuration={20}
              maxDuration={120}
            />
          </div>
        </div>

        <div className="space-y-3">
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
    </div>
  );
}

/* Renders the source video as a thumbnail at the requested timestamp.
   Pure client side — no server upload needed for the preview. */
function FrameAt({ sourceUrl, timeSec }: { sourceUrl: string | null; timeSec: number }) {
  const ref = useRef<HTMLVideoElement>(null);
  if (!sourceUrl) return <div className="grid h-full w-full place-items-center bg-bg-deep text-xs text-muted">no preview</div>;
  return (
    <video ref={ref} src={sourceUrl} muted preload="metadata" className="h-full w-full object-cover"
      onLoadedMetadata={(e) => { try { (e.currentTarget as HTMLVideoElement).currentTime = Math.max(0.05, timeSec); } catch {} }} />
  );
}

function ExtLink({ href, label }: { href: string; label: string }) {
  return (
    <a href={href} target="_blank" rel="noopener noreferrer"
      className="inline-flex items-center gap-1 rounded-full border border-border-strong bg-bg px-2.5 py-1 text-xs text-muted transition hover:border-gold/60 hover:text-gold">
      {label} <ExternalLink className="h-3 w-3" />
    </a>
  );
}

function fmtSec(s: number): string {
  const m = Math.floor(s / 60);
  const r = Math.floor(s % 60);
  return `${m}:${String(r).padStart(2, "0")}`;
}
