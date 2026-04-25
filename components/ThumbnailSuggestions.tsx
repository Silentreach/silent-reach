"use client";

import Link from "next/link";
import { Sparkles, ArrowRight, Wand2 } from "lucide-react";
import { PRESETS, renderPreset, type PresetId } from "./ThumbnailPresets";
import { getBrandKit } from "@/lib/userContext";
import { useEffect, useState } from "react";

interface Props {
  /** YouTube thumbnail URL — used as the background image */
  imageUrl: string;
  /** AI-suggested overlay text (becomes the headline) */
  overlayText: string;
  /** AI-suggested color palette — first hex becomes the accent color */
  palette: string[];
  /** AI-suggested mood — used as the subtitle */
  mood: string;
  /** Channel name from YouTube meta — used as brand if no brand kit set */
  channelName?: string;
}

export default function ThumbnailSuggestions({
  imageUrl, overlayText, palette, mood, channelName,
}: Props) {
  const [brand, setBrand] = useState<string>("");

  useEffect(() => {
    const kit = getBrandKit();
    setBrand(kit.name || channelName || "");
  }, [channelName]);

  const accent = palette?.[0] || "#d4af37";
  const secondary = palette?.[1] || "#ffffff";

  const presetProps = {
    image: imageUrl,
    headline: overlayText,
    subtitle: mood,
    brand,
    accentColor: accent,
    secondaryColor: secondary,
  };

  const studioHref = (preset: PresetId) =>
    `/thumbnail-studio?` +
    `image=${encodeURIComponent(imageUrl)}` +
    `&headline=${encodeURIComponent(overlayText)}` +
    `&subtitle=${encodeURIComponent(mood)}` +
    `&preset=${preset}`;

  return (
    <section className="rounded-2xl border border-gold/30 bg-gold/5 p-5 md:p-6">
      <link
        rel="stylesheet"
        href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;500;600;700&family=Bebas+Neue&family=Inter+Tight:wght@500;600;700;800&display=swap"
      />

      {/* Header */}
      <div className="mb-5 flex items-start justify-between gap-3">
        <div>
          <div className="text-[11px] uppercase tracking-widest text-gold/80">
            <Sparkles className="mr-1 inline h-3 w-3" />
            Auto-designed for you
          </div>
          <h3 className="mt-1 font-display text-xl tracking-tight text-text">
            Three live previews using the AI&apos;s overlay + palette.
          </h3>
          <p className="mt-1 text-sm text-muted">
            Click any one to customize in Thumbnail Studio with this image, headline, and colors pre-loaded.
          </p>
        </div>
      </div>

      {/* Three live preset renders — 9:16 ratio (Reel/Short) */}
      <div className="grid gap-4 sm:grid-cols-3">
        {PRESETS.map((p) => (
          <Link
            key={p.id}
            href={studioHref(p.id)}
            className="group block"
          >
            <div
              className="relative overflow-hidden rounded-xl border border-border-strong bg-black shadow-[0_20px_60px_-20px_rgba(0,0,0,0.7)] transition group-hover:border-gold/60 group-hover:shadow-[0_30px_80px_-20px_rgba(212,175,55,0.3)]"
              style={{ aspectRatio: "9 / 16", containerType: "inline-size" }}
            >
              {renderPreset(p.id, presetProps)}
            </div>
            <div className="mt-2 flex items-center justify-between">
              <div>
                <div className="text-[13px] font-medium text-text">{p.name}</div>
                <div className="text-[10px] uppercase tracking-widest text-muted">{p.fonts}</div>
              </div>
              <span className="inline-flex items-center gap-1 text-xs text-gold opacity-0 transition group-hover:opacity-100">
                Customize <ArrowRight className="h-3 w-3" />
              </span>
            </div>
          </Link>
        ))}
      </div>

      {/* Footer hint */}
      <div className="mt-5 flex items-center gap-2 text-xs text-muted">
        <Wand2 className="h-3 w-3 text-gold/70" />
        These designs use the AI&apos;s recommended overlay text and palette. The Studio lets you tweak both.
      </div>
    </section>
  );
}
