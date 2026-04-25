"use client";

/* Three preset thumbnail renderers, extracted so both the
   Thumbnail Studio and the auto-Suggestions panel in PackResult
   render the same designs identically. */

export type PresetId = "editorial" | "impact" | "minimal";

export interface PresetMeta {
  id: PresetId;
  name: string;
  description: string;
  fonts: string;
}

export const PRESETS: PresetMeta[] = [
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

export interface PresetProps {
  image: string | null;       // URL or data URL
  headline: string;
  subtitle: string;
  brand: string;
  /** Optional accent color (overrides default gold). Hex string. */
  accentColor?: string;
  /** Optional secondary color for backgrounds / fills. Hex string. */
  secondaryColor?: string;
}

const GOLD = "#d4af37";

function img(props: { image: string | null }) {
  return props.image ? (
    <img
      src={props.image}
      alt=""
      crossOrigin="anonymous"
      className="absolute inset-0 h-full w-full object-cover"
    />
  ) : null;
}

export function EditorialPreset({ image, headline, subtitle, brand, accentColor }: PresetProps) {
  const accent = accentColor || GOLD;
  return (
    <div className="absolute inset-0 overflow-hidden bg-neutral-900">
      {img({ image }) || (
        <div className="absolute inset-0 bg-gradient-to-br from-neutral-700 via-neutral-800 to-neutral-950" />
      )}
      <div className="absolute inset-0 bg-gradient-to-t from-black via-black/55 to-black/10" />
      <div
        className="absolute"
        style={{ left: "8%", right: "8%", bottom: "30%", height: "1px", background: accent }}
      />
      {brand && (
        <div
          className="absolute uppercase"
          style={{
            top: "5%",
            left: "8%",
            color: accent,
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

export function ImpactPreset({ image, headline, subtitle, brand, accentColor }: PresetProps) {
  const accent = accentColor || GOLD;
  return (
    <div className="absolute inset-0 overflow-hidden bg-black">
      {img({ image }) || (
        <div className="absolute inset-0 bg-gradient-to-br from-neutral-600 to-neutral-900" />
      )}
      <div className="absolute inset-0 bg-black/35" />
      <div
        className="absolute"
        style={{ left: 0, bottom: 0, width: "78%", background: accent, padding: "5cqw 6cqw 5cqw 6cqw" }}
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

export function MinimalPreset({ image, headline, subtitle, brand, accentColor }: PresetProps) {
  const accent = accentColor || GOLD;
  return (
    <div className="absolute inset-0 overflow-hidden bg-neutral-950">
      {img({ image }) || (
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
              background: accent,
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
            className="mt-[2cqw]"
            style={{
              color: accent,
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

export function renderPreset(id: PresetId, props: PresetProps) {
  if (id === "editorial") return <EditorialPreset {...props} />;
  if (id === "impact") return <ImpactPreset {...props} />;
  return <MinimalPreset {...props} />;
}
