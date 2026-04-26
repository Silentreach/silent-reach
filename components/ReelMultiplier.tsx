"use client";

import { useRef, useState } from "react";
import { getBrandKit } from "@/lib/userContext";
import { renderReel, downloadBlob } from "@/lib/videoRender";
import { detectBPM, snapSegmentsToBeats } from "@/lib/audioAnalysis";
import {
  Upload, Sparkles, Loader2, Film, X, Music, Clock, MessageSquare,
  Hash, Image as ImageIcon, ArrowRight, Instagram, Youtube, Facebook, ExternalLink, Check, Download,
} from "lucide-react";
import { getUserContext } from "@/lib/userContext";
import type {
  ReelMultiplierOutput, ReelPackage, ReelPlatform,
} from "@/types";

const MAX_DURATION_SEC = 120; // accept up to 2 minutes
const FRAME_COUNT = 4;  // Reduced from 6 to fit Haiku call inside Vercel 60s budget
const FRAME_MAX_W = 720; // resize on capture

interface ExtractedFrame { data: string; mediaType: "image/jpeg" }

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
    const frames: ExtractedFrame[] = [];
    for (let i = 0; i < FRAME_COUNT; i++) {
      const t = (duration / (FRAME_COUNT + 1)) * (i + 1);
      video.currentTime = t;
      await new Promise<void>((res) => { video.onseeked = () => res(); });
      ctx.drawImage(video, 0, 0, w, h);
      const dataUrl = canvas.toDataURL("image/jpeg", 0.82);
      const base64 = dataUrl.split(",", 2)[1];
      frames.push({ data: base64, mediaType: "image/jpeg" });
    }
    return { frames, durationSec: duration };
  } finally { URL.revokeObjectURL(url); }
}

export default function ReelMultiplier() {
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [duration, setDuration] = useState<number>(0);
  const [description, setDescription] = useState<string>("");
  const [series, setSeries] = useState<string>("");
  const [stage, setStage] = useState<"idle" | "extracting" | "thinking" | "done" | "error">("idle");
  const [musicFile, setMusicFile] = useState<File | null>(null);
  const [musicBPM, setMusicBPM] = useState<number | null>(null);
  const [analyzingBPM, setAnalyzingBPM] = useState(false);
  const [customLogo, setCustomLogo] = useState<{kind: "image" | "video"; url: string} | null>(null);
  const musicInputRef = useRef<HTMLInputElement>(null);
  const logoInputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [output, setOutput] = useState<ReelMultiplierOutput | null>(null);
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
                      <><span className="text-gold">♪ {musicBPM.toFixed(1)} BPM</span> · cuts will snap to beats (±0.4s tolerance)</>
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
                      const cap = isVid ? 10 * 1024 * 1024 : 500 * 1024;
                      if (f.size > cap) { alert(`Logo over ${isVid ? "10MB" : "500KB"} — please pick a smaller file. Got ${(f.size / (1024*1024)).toFixed(1)}MB.`); return; }
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
      {output && <ReelResults output={output} sourceUrl={previewUrl} sourceFile={file} musicFile={musicFile} customLogo={customLogo} musicBPM={musicBPM} />}
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

function ReelResults({ output, sourceUrl, sourceFile, musicFile, customLogo, musicBPM }: { output: ReelMultiplierOutput; sourceUrl: string | null; sourceFile: File | null; musicFile: File | null; customLogo: {kind: "image" | "video"; url: string} | null; musicBPM: number | null }) {
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

      {pkg && <PackageCard pkg={pkg} sourceUrl={sourceUrl} sourceFile={sourceFile} musicFile={musicFile} customLogo={customLogo} musicBPM={musicBPM} />}

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

function PackageCard({ pkg, sourceUrl, sourceFile, musicFile, customLogo, musicBPM }: { pkg: ReelPackage; sourceUrl: string | null; sourceFile: File | null; musicFile: File | null; customLogo: {kind: "image" | "video"; url: string} | null; musicBPM: number | null }) {
  const [copied, setCopied] = useState<string | null>(null);
  const copy = async (label: string, text: string) => {
    try { await navigator.clipboard.writeText(text); setCopied(label); setTimeout(() => setCopied(null), 1500); } catch {}
  };

  const cut = pkg.cutMarkers[0];
  const cutLen = cut ? Math.max(0, cut.endSec - cut.startSec) : 0;

  // Render & Download state
  const [renderState, setRenderState] = useState<"idle" | "rendering" | "done" | "error">("idle");
  const [renderPct, setRenderPct] = useState(0);
  const [renderError, setRenderError] = useState<string | null>(null);
  const [hookPos, setHookPos] = useState<"auto" | "top" | "bottom">("auto");
  const [includeOutro, setIncludeOutro] = useState(true);
  const [hookBg, setHookBg] = useState<"none" | "pill" | "box">("none");

  const onRender = async () => {
    if (!sourceFile || pkg.cutMarkers.length === 0) return;
    setRenderState("rendering"); setRenderPct(0); setRenderError(null);
    try {
      const kit = getBrandKit();
      const outputAspect = "9:16" as const;
      // Pick the logo source: inline upload wins, else Brand Kit (always image), else none
      const logo = customLogo
        ? customLogo
        : kit.logoDataUrl
          ? { kind: "image" as const, url: kit.logoDataUrl }
          : undefined;
      const rawSegments = pkg.cutMarkers.map((c) => ({ startSec: c.startSec, endSec: c.endSec }));
      const { adjusted: segments, snapsApplied } = snapSegmentsToBeats(rawSegments, musicBPM, 0.4);
      void snapsApplied; // surfaced via UI badge; reserved for future logging
      const { blob, mimeType } = await renderReel({
        source: sourceFile,
        segments,
        outputAspect,
        hookLine: pkg.hookLine,
        hookPosition: hookPos,
        hookBackground: hookBg,
        hookBackgroundColor: kit.primaryColor,
        platform: pkg.platform,
        logo,
        musicFile: musicFile || undefined,
        brandName: kit.name,
        includeOutro: includeOutro && !!logo,
        outroDurationSec: 2.0,
        fadeOutSec: 1.5,
        onProgress: (p) => setRenderPct(p),
      });
      const ext = mimeType.includes("mp4") ? "mp4" : "webm";
      const platformShort = pkg.platform === "instagram_reel" ? "ig" : pkg.platform === "youtube_short" ? "yt" : "fb";
      const tag = (pkg.title || pkg.hookLine || "reel").slice(0, 32).replace(/[^a-z0-9]+/gi, "-").toLowerCase();
      downloadBlob(blob, `mintflow_${platformShort}_${tag}.${ext}`);
      setRenderState("done");
      setTimeout(() => setRenderState("idle"), 2500);
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
            <div className="text-[11px] uppercase tracking-widest text-gold/85"><Download className="mr-1 inline h-3 w-3" /> Render &amp; download this reel</div>
            <div className="mt-1 font-display text-lg tracking-tight text-text">
              {pkg.cutMarkers.length} cut{pkg.cutMarkers.length === 1 ? "" : "s"}, stitched to 9:16 · {customLogo?.kind === "video" ? "motion logo" : (customLogo || getBrandKit().logoDataUrl) ? "logo applied" : "no logo"} · {musicFile ? (musicBPM ? `music ${musicBPM.toFixed(0)} BPM (beat-synced cuts)` : `music: ${musicFile.name.slice(0, 24)}`) : "source audio"}
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
            {renderState === "rendering" && <><Loader2 className="h-4 w-4 animate-spin" /> Rendering {(renderPct * 100).toFixed(0)}%</>}
            {renderState === "done" && <><Check className="h-4 w-4" /> Downloaded</>}
            {renderState === "error" && <><Download className="h-4 w-4" /> Try again</>}
            {renderState === "idle" && <><Download className="h-4 w-4" /> Render &amp; download</>}
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

      {/* Cut + hook + caption row */}
      <div className="grid gap-4 lg:grid-cols-[1fr_1.4fr]">
        {/* Left: cut + hook */}
        <div className="space-y-3">
          <div className="rounded-xl border border-border bg-surface p-5">
            <div className="text-[11px] uppercase tracking-widest text-gold/80">Cut for this platform</div>
            {pkg.cutMarkers.map((c, i) => (
              <div key={i} className="mt-2 flex items-baseline gap-2 font-mono text-sm">
                <span className="text-gold">{fmtSec(c.startSec)}</span>
                <span className="text-muted">→</span>
                <span className="text-gold">{fmtSec(c.endSec)}</span>
                <span className="text-xs text-muted">({Math.max(0, c.endSec - c.startSec).toFixed(0)}s)</span>
              </div>
            ))}
            {cut?.reason && <p className="mt-2 text-sm text-muted">{cut.reason}</p>}
          </div>

          <div className="rounded-xl border border-border bg-surface p-5">
            <div className="text-[11px] uppercase tracking-widest text-gold/80">Hook (first 3s overlay)</div>
            <div className="mt-2 font-display text-2xl leading-snug tracking-tight text-text">&ldquo;{pkg.hookLine}&rdquo;</div>
            <button onClick={() => copy("hook", pkg.hookLine)} className="mt-3 inline-flex items-center gap-1 text-xs text-muted hover:text-text">
              {copied === "hook" ? <><Check className="h-3 w-3 text-gold" /> Copied</> : "Copy hook"}
            </button>
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
