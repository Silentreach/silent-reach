"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import {
  Upload,
  Download,
  Image as ImageIcon,
  Instagram,
  Facebook,
  Youtube,
  Sparkles,
  Lock,
  Eye,
  EyeOff,
} from "lucide-react";
import { toPng } from "html-to-image";
import { getBrandKit } from "@/lib/userContext";

/* ------------------------------------------------------------------ */
/*  TYPES + CONSTANTS                                                  */
/* ------------------------------------------------------------------ */

type PresetId = "editorial" | "impact" | "minimal";
type PlatformId = "ig-reel" | "fb-reel" | "yt-short" | "yt-standard";

interface Preset {
  id: PresetId;
  name: string;
  description: string;
  fonts: string;
}

interface Platform {
  id: PlatformId;
  name: string;
  ratio: "9/16" | "16/9";
  exportW: number;
  exportH: number;
  Icon: typeof Instagram;
}

const PRESETS: Preset[] = [
  {
    id: "editorial",
    name: "Editorial Estate",
    description: "Playfair serif headline, gold accent line, cinematic dark gradient.",
    fonts: "Playfair Display + Inter",
  },
  {
    id: "impact",
    name: "Bold Impact",
    description: "Bebas Neue uppercase block, high-contrast color slab.",
    fonts: "Bebas Neue + Inter",
  },
  {
    id: "minimal",
    name: "Minimal Modern",
    description: "Inter Tight bold, two-line stack, single accent dot.",
    fonts: "Inter",
  },
];

const PLATFORMS: Platform[] = [
  { id: "ig-reel",     name: "Instagram Reel",  ratio: "9/16", exportW: 1080, exportH: 1920, Icon: Instagram },
  { id: "fb-reel",     name: "Facebook Reel",   ratio: "9/16", exportW: 1080, exportH: 1920, Icon: Facebook  },
  { id: "yt-short",    name: "YouTube Short",   ratio: "9/16", exportW: 1080, exportH: 1920, Icon: Youtube   },
  { id: "yt-standard", name: "YouTube 16:9",    ratio: "16/9", exportW: 1280, exportH: 720,  Icon: Youtube   },
];

/* Roadmap notes — one is surfaced on every page load.               */
/* Edit this list as the product evolves; ordering randomized.       */
const ROADMAP_NOTES: { title: string; body: string; sellable: string }[] = [
  {
    title: "AI Auto-Headline from photo",
    body: "Drop the listing photo, Claude reads it and proposes 3 thumbnail headlines tuned for non-follower reach.",
    sellable: "Free tier: 2/day. Pro: unlimited + saved brand kit.",
  },
  {
    title: "Brand Kit (logo, colors, fonts)",
    body: "Lock in a Silent Story / SafeBuild palette + logo so every thumbnail stays on-brand without re-typing.",
    sellable: "Pro-only feature. Visible in every download = obvious upgrade trigger.",
  },
  {
    title: "Background remover for listing photos",
    body: "One-click cutout so you can stack the home over a bold gradient — same technique top realtors pay $40/mo for.",
    sellable: "Free tier: low-res preview. Pro: 4K export, no watermark.",
  },
  {
    title: "Auto-crop to all platforms in one click",
    body: "Generate IG Reel + FB Reel + YT Short + YT 16:9 + LinkedIn 1:1 + Pinterest 2:3 from a single design.",
    sellable: "Free: 1 platform per export. Pro: bulk export ZIP.",
  },
  {
    title: "TikTok cover + hook overlay",
    body: "TikTok-specific 1080x1920 cover with a separate 'in-feed hook frame' overlay timed to the first second.",
    sellable: "TikTok-first creators are an untapped buyer segment for Mintflow.",
  },
  {
    title: "Caption + Thumbnail bundle (cross-mode)",
    body: "Wire Thumbnail Studio into Post-Upload Pack so the same headline flows into IG/FB/LinkedIn captions.",
    sellable: "The 'all-in-one' moat — only Mintflow makes the thumbnail and the captions agree.",
  },
  {
    title: "A/B thumbnail tester",
    body: "Generate 3 variants, log which one shipped, paste 24h reach back in. Builds your private 'what works' dataset.",
    sellable: "Pro analytics tab — proves ROI every month, kills churn.",
  },
  {
    title: "Realtor white-label workspace",
    body: "Each invited realtor gets a sub-brand kit and pays you monthly. Mintflow becomes a SaaS, not just a tool.",
    sellable: "$29/mo per realtor seat. Pitch to 5 Victoria realtors = $145 MRR floor.",
  },
];

function pickRoadmapNote() {
  // deterministic-per-day so the same idea sits on the page for ~24h
  const day = Math.floor(Date.now() / (1000 * 60 * 60 * 24));
  return ROADMAP_NOTES[day % ROADMAP_NOTES.length];
}

/* ------------------------------------------------------------------ */
/*  PRESET RENDERERS                                                   */
/*  Each renders into a fixed-aspect container that uses container    */
/*  query units (cqw) so type scales with the preview size.           */
/* ------------------------------------------------------------------ */

interface PresetProps {
  image: string | null;
  headline: string;
  subtitle: string;
  brand: string;
}

function EditorialPreset({ image, headline, subtitle, brand }: PresetProps) {
  return (
    <div className="absolute inset-0 overflow-hidden bg-neutral-900">
      {image ? (
        <img src={image} alt="" className="absolute inset-0 h-full w-full object-cover" />
      ) : (
        <div className="absolute inset-0 bg-gradient-to-br from-neutral-700 via-neutral-800 to-neutral-950" />
      )}
      <div className="absolute inset-0 bg-gradient-to-t from-black via-black/55 to-black/10" />
      <div
        className="absolute"
        style={{ left: "8%", right: "8%", bottom: "30%", height: "1px", background: "#d4af37" }}
      />
      {brand && (
        <div
          className="absolute text-gold uppercase"
          style={{
            top: "5%",
            left: "8%",
            fontFamily: "Inter, sans-serif",
            fontSize: "2.4cqw",
            letterSpacing: "0.32em",
            fontWeight: 300,
          }}
        >
          {brand}
        </div>
      )}
      <h2
        className="absolute text-white"
        style={{
          left: "8%",
          right: "8%",
          bottom: "14%",
          fontFamily: "'Playfair Display', Georgia, serif",
          fontSize: "8.5cqw",
          lineHeight: 0.98,
          fontWeight: 400,
          letterSpacing: "-0.01em",
        }}
      >
        {headline}
      </h2>
      {subtitle && (
        <div
          className="absolute uppercase text-white/85"
          style={{
            left: "8%",
            right: "8%",
            bottom: "7%",
            fontFamily: "Inter, sans-serif",
            fontSize: "2.2cqw",
            letterSpacing: "0.28em",
            fontWeight: 400,
          }}
        >
          {subtitle}
        </div>
      )}
    </div>
  );
}

function ImpactPreset({ image, headline, subtitle, brand }: PresetProps) {
  return (
    <div className="absolute inset-0 overflow-hidden bg-black">
      {image ? (
        <img src={image} alt="" className="absolute inset-0 h-full w-full object-cover" />
      ) : (
        <div className="absolute inset-0 bg-gradient-to-br from-neutral-600 to-neutral-900" />
      )}
      <div className="absolute inset-0 bg-black/35" />
      {/* yellow color slab bottom-left */}
      <div
        className="absolute"
        style={{ left: 0, bottom: 0, width: "78%", background: "#d4af37", padding: "5cqw 6cqw 5cqw 6cqw" }}
      >
        <h2
          className="text-black uppercase"
          style={{
            fontFamily: "'Bebas Neue', 'Barlow Condensed', Impact, sans-serif",
            fontSize: "11cqw",
            lineHeight: 0.92,
            fontWeight: 400,
            letterSpacing: "0.005em",
          }}
        >
          {headline}
        </h2>
        {subtitle && (
          <div
            className="text-black/75 uppercase mt-[1.5cqw]"
            style={{
              fontFamily: "Inter, sans-serif",
              fontSize: "2.2cqw",
              letterSpacing: "0.22em",
              fontWeight: 600,
            }}
          >
            {subtitle}
          </div>
        )}
      </div>
      {brand && (
        <div
          className="absolute text-white uppercase"
          style={{
            top: "5%",
            right: "6%",
            fontFamily: "Inter, sans-serif",
            fontSize: "2.4cqw",
            letterSpacing: "0.3em",
            fontWeight: 700,
          }}
        >
          {brand}
        </div>
      )}
    </div>
  );
}

function MinimalPreset({ image, headline, subtitle, brand }: PresetProps) {
  return (
    <div className="absolute inset-0 overflow-hidden bg-neutral-950">
      {image ? (
        <img src={image} alt="" className="absolute inset-0 h-full w-full object-cover" />
      ) : (
        <div className="absolute inset-0 bg-gradient-to-b from-neutral-700 to-neutral-950" />
      )}
      <div className="absolute inset-0 bg-gradient-to-b from-black/0 via-black/10 to-black/85" />
      {brand && (
        <div
          className="absolute text-white/90 flex items-center gap-[1.5cqw]"
          style={{ top: "6%", left: "7%" }}
        >
          <span
            style={{
              width: "1.6cqw",
              height: "1.6cqw",
              borderRadius: "50%",
              background: "#d4af37",
              display: "inline-block",
            }}
          />
          <span
            style={{
              fontFamily: "Inter, sans-serif",
              fontSize: "2.2cqw",
              letterSpacing: "0.18em",
              fontWeight: 600,
              textTransform: "uppercase",
            }}
          >
            {brand}
          </span>
        </div>
      )}
      <div className="absolute" style={{ left: "7%", right: "7%", bottom: "9%" }}>
        <h2
          className="text-white"
          style={{
            fontFamily: "'Inter Tight', Inter, sans-serif",
            fontSize: "9cqw",
            lineHeight: 1.0,
            fontWeight: 800,
            letterSpacing: "-0.025em",
          }}
        >
          {headline}
        </h2>
        {subtitle && (
          <div
            className="text-gold mt-[2cqw]"
            style={{
              fontFamily: "Inter, sans-serif",
              fontSize: "2.4cqw",
              letterSpacing: "0.05em",
              fontWeight: 500,
            }}
          >
            {subtitle}
          </div>
        )}
      </div>
    </div>
  );
}

function renderPreset(id: PresetId, props: PresetProps) {
  if (id === "editorial") return <EditorialPreset {...props} />;
  if (id === "impact") return <ImpactPreset {...props} />;
  return <MinimalPreset {...props} />;
}

/* ------------------------------------------------------------------ */
/*  PLATFORM CHROME (fake UI overlay around the preview)              */
/* ------------------------------------------------------------------ */

function PlatformChrome({ platform, children }: { platform: PlatformId; children: React.ReactNode }) {
  // Reels chrome
  if (platform === "ig-reel" || platform === "fb-reel" || platform === "yt-short") {
    const label =
      platform === "ig-reel" ? "Instagram" : platform === "fb-reel" ? "Facebook" : "YouTube Shorts";
    return (
      <div className="relative h-full w-full">
        {children}
        {/* top bar */}
        <div className="pointer-events-none absolute inset-x-0 top-0 flex items-center justify-between px-3 py-2 text-[10px] text-white/90">
          <span className="font-semibold">{label}</span>
          <span>•••</span>
        </div>
        {/* right rail icons */}
        <div className="pointer-events-none absolute right-1.5 bottom-16 flex flex-col items-center gap-3 text-white">
          {["♥", "💬", "↗", "♬"].map((g, i) => (
            <div
              key={i}
              className="flex h-7 w-7 items-center justify-center rounded-full bg-black/35 text-[12px] backdrop-blur-sm"
            >
              {g}
            </div>
          ))}
        </div>
        {/* bottom caption */}
        <div className="pointer-events-none absolute inset-x-0 bottom-0 px-3 pb-3 text-[10px] text-white/90">
          <div className="font-semibold">@silent.story</div>
          <div className="text-white/75">A new Victoria listing reel ↗</div>
        </div>
      </div>
    );
  }
  // YouTube standard — show as a "watch page" thumb card
  return (
    <div className="relative h-full w-full">
      {children}
      <div className="pointer-events-none absolute right-2 bottom-2 rounded bg-black/85 px-1.5 py-0.5 text-[10px] font-semibold text-white">
        0:42
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  MAIN COMPONENT                                                     */
/* ------------------------------------------------------------------ */

export default function ThumbnailStudio() {
  const [preset, setPreset] = useState<PresetId>("editorial");
  const [platform, setPlatform] = useState<PlatformId>("ig-reel");
  const [image, setImage] = useState<string | null>(null);
  const [headline, setHeadline] = useState("Inside a Quiet Oak Bay Reno");
  const [subtitle, setSubtitle] = useState("Victoria, BC");
  const [brand, setBrand] = useState("Silent Story");
  const [brandLogoUrl, setBrandLogoUrl] = useState<string | null>(null);
  // Hydrate from saved brand kit on mount — overrides the placeholder if user has set one.
  const [showChrome, setShowChrome] = useState(true);
  const [downloading, setDownloading] = useState(false);

  const fileRef = useRef<HTMLInputElement>(null);

  // Pre-fill brand kit on mount so users stop retyping their brand on every download.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useMemo(() => {
    if (typeof window === "undefined") return;
    const kit = getBrandKit();
    if (kit.name) setBrand(kit.name);
    if (kit.logoDataUrl) setBrandLogoUrl(kit.logoDataUrl);
  }, []);
  const exportRef = useRef<HTMLDivElement>(null);
  const note = useMemo(pickRoadmapNote, []);

  const onPickImage = useCallback(() => fileRef.current?.click(), []);

  const onFile = useCallback((f: File | undefined) => {
    if (!f) return;
    const r = new FileReader();
    r.onload = (e) => setImage(String(e.target?.result ?? ""));
    r.readAsDataURL(f);
  }, []);

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    onFile(e.dataTransfer.files?.[0]);
  }, [onFile]);

  const currentPlatform = PLATFORMS.find((p) => p.id === platform)!;

  const download = useCallback(async () => {
    const node = exportRef.current;
    if (!node) return;
    setDownloading(true);
    try {
      // ensure web fonts are loaded so the PNG doesn't fall back to Times
      if (typeof document !== "undefined" && (document as any).fonts?.ready) {
        await (document as any).fonts.ready;
      }
      // double-tap toPng — first call sometimes captures pre-paint
      await toPng(node, { cacheBust: true, pixelRatio: 1 });
      const dataUrl = await toPng(node, {
        cacheBust: true,
        pixelRatio: 3,
        backgroundColor: "#000000",
      });
      const link = document.createElement("a");
      link.download = `mintflow_${preset}_${platform}.png`;
      link.href = dataUrl;
      link.click();
    } catch (err) {
      console.error(err);
      alert("Download failed — try a smaller image or a different browser.");
    } finally {
      setDownloading(false);
    }
  }, [preset, platform]);

  const presetProps: PresetProps = { image, headline, subtitle, brand };

  return (
    <div className="text-text">
      {/* fonts */}
      <link
        rel="stylesheet"
        href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;500;600;700&family=Bebas+Neue&family=Inter+Tight:wght@500;600;700;800&display=swap"
      />

      {/* header */}
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Thumbnail Studio</h1>
          <p className="mt-1 text-sm text-muted">
            Pick a preset, drop a photo, drop a headline. Preview on every reel surface, download a clean PNG.
          </p>
        </div>
      </div>

      {/* roadmap note */}
      <div className="mb-8 rounded-lg border border-border bg-surface p-4">
        <div className="mb-1 flex items-center gap-2 text-xs uppercase tracking-widest text-gold">
          <Sparkles className="h-3.5 w-3.5" />
          What to add next
        </div>
        <div className="text-sm font-semibold text-text">{note.title}</div>
        <div className="mt-1 text-sm text-muted">{note.body}</div>
        <div className="mt-2 text-xs text-gold/90">
          <Lock className="mr-1 inline h-3 w-3" />
          Sellability angle: {note.sellable}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[380px_1fr]">
        {/* ---------------- LEFT: CONTROLS ---------------- */}
        <div className="space-y-6">
          {/* upload */}
          <div>
            <label className="mb-2 block text-xs uppercase tracking-widest text-muted">
              Background image
            </label>
            <div
              onClick={onPickImage}
              onDragOver={(e) => e.preventDefault()}
              onDrop={onDrop}
              className="flex cursor-pointer items-center justify-center rounded-lg border border-dashed border-border bg-surface p-6 text-center transition hover:border-gold/60"
            >
              {image ? (
                <div className="flex w-full items-center gap-3 text-left">
                  <img src={image} alt="" className="h-14 w-14 rounded object-cover" />
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium">Image loaded</div>
                    <div className="truncate text-xs text-muted">Click to replace</div>
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setImage(null);
                    }}
                    className="text-xs text-muted hover:text-white"
                  >
                    Clear
                  </button>
                </div>
              ) : (
                <div>
                  <Upload className="mx-auto mb-2 h-5 w-5 text-muted" />
                  <div className="text-sm">Drop a photo or click to upload</div>
                  <div className="mt-1 text-xs text-muted">JPG / PNG / WEBP — max ~10MB</div>
                </div>
              )}
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => onFile(e.target.files?.[0])}
              />
            </div>
          </div>

          {/* preset picker */}
          <div>
            <label className="mb-2 block text-xs uppercase tracking-widest text-muted">
              Preset
            </label>
            <div className="space-y-2">
              {PRESETS.map((p) => {
                const active = p.id === preset;
                return (
                  <button
                    key={p.id}
                    onClick={() => setPreset(p.id)}
                    className={[
                      "w-full rounded-lg border p-3 text-left transition",
                      active
                        ? "border-gold bg-gold/5"
                        : "border-border bg-surface hover:border-neutral-700",
                    ].join(" ")}
                  >
                    <div className="flex items-center justify-between">
                      <div className="text-sm font-semibold">{p.name}</div>
                      <div className="text-[10px] uppercase tracking-widest text-muted">
                        {p.fonts}
                      </div>
                    </div>
                    <div className="mt-1 text-xs text-muted">{p.description}</div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* text fields */}
          <div className="space-y-3">
            <div>
              <label className="mb-1 block text-xs uppercase tracking-widest text-muted">
                Headline
              </label>
              <textarea
                value={headline}
                onChange={(e) => setHeadline(e.target.value)}
                rows={2}
                className="w-full resize-none rounded-md border border-border bg-bg p-2 text-sm outline-none focus:border-gold"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs uppercase tracking-widest text-muted">
                Subtitle
              </label>
              <input
                value={subtitle}
                onChange={(e) => setSubtitle(e.target.value)}
                className="w-full rounded-md border border-border bg-bg p-2 text-sm outline-none focus:border-gold"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs uppercase tracking-widest text-muted">
                Brand
              </label>
              <input
                value={brand}
                onChange={(e) => setBrand(e.target.value)}
                className="w-full rounded-md border border-border bg-bg p-2 text-sm outline-none focus:border-gold"
              />
            </div>
          </div>

          {/* download */}
          <button
            onClick={download}
            disabled={downloading}
            className="flex w-full items-center justify-center gap-2 rounded-md bg-gold py-3 text-sm font-semibold text-black transition hover:bg-[#e6c14d] disabled:opacity-60"
          >
            <Download className="h-4 w-4" />
            {downloading
              ? "Rendering..."
              : `Download ${currentPlatform.exportW}×${currentPlatform.exportH} PNG`}
          </button>
          <p className="-mt-3 text-center text-[11px] text-muted">
            Free downloads include a tiny corner watermark. Pro removes it. (placeholder for future paywall)
          </p>
        </div>

        {/* ---------------- RIGHT: PREVIEW ---------------- */}
        <div>
          {/* platform tabs */}
          <div className="mb-4 flex flex-wrap items-center gap-2">
            {PLATFORMS.map((p) => {
              const active = p.id === platform;
              const Icon = p.Icon;
              return (
                <button
                  key={p.id}
                  onClick={() => setPlatform(p.id)}
                  className={[
                    "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs transition",
                    active
                      ? "border-gold bg-gold/10 text-gold"
                      : "border-border text-muted hover:border-neutral-700 hover:text-white",
                  ].join(" ")}
                >
                  <Icon className="h-3.5 w-3.5" />
                  {p.name}
                </button>
              );
            })}
            <div className="ml-auto">
              <button
                onClick={() => setShowChrome((s) => !s)}
                className="inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-xs text-muted hover:text-white"
              >
                {showChrome ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                {showChrome ? "Hide app UI" : "Show app UI"}
              </button>
            </div>
          </div>

          {/* preview frame */}
          <div className="flex items-start justify-center rounded-lg border border-border bg-bg p-6">
            <div
              className={[
                "relative overflow-hidden rounded-xl shadow-[0_30px_80px_-20px_rgba(0,0,0,0.7)]",
                "bg-black",
                showChrome ? "ring-1 ring-white/10" : "",
              ].join(" ")}
              style={{
                aspectRatio: currentPlatform.ratio.replace("/", " / "),
                width: currentPlatform.ratio === "9/16" ? 320 : 560,
                containerType: "inline-size",
              }}
            >
              {showChrome ? (
                <PlatformChrome platform={platform}>
                  {renderPreset(preset, presetProps)}
                </PlatformChrome>
              ) : (
                renderPreset(preset, presetProps)
              )}
            </div>
          </div>

          <p className="mt-3 text-center text-xs text-muted">
            {currentPlatform.name} • {currentPlatform.ratio} • exports at {currentPlatform.exportW}×
            {currentPlatform.exportH}
          </p>
        </div>
      </div>

      {/* hidden export node — clean (no chrome), at native aspect, captured at 3x */}
      <div
        aria-hidden
        style={{
          position: "fixed",
          left: -99999,
          top: 0,
          width: currentPlatform.exportW / 3,
          aspectRatio: currentPlatform.ratio.replace("/", " / "),
          containerType: "inline-size",
        }}
      >
        <div ref={exportRef} className="relative h-full w-full bg-black">
          {renderPreset(preset, presetProps)}
          {/* free-tier watermark */}
          <div
            className="absolute right-[3%] bottom-[3%] text-white/65"
            style={{
              fontFamily: "Inter, sans-serif",
              fontSize: "1.6cqw",
              letterSpacing: "0.25em",
              textTransform: "uppercase",
              fontWeight: 600,
            }}
          >
            mintflow
          </div>
        </div>
      </div>
    </div>
  );
}
