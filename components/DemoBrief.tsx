"use client";

import { useState } from "react";
import Link from "next/link";
import { Sparkles, ArrowRight, Loader2, Camera, Type, Wand2 } from "lucide-react";

interface DemoConcept {
  id: string;
  emoji: string;
  pillTitle: string;
  blurb: string;
  output: {
    hook: { type: string; line: string; whyItWorks: string };
    titleOptions: string[];
    thumbnail: { overlay: string; tone: string; momentTimestamp: string };
    pitch: string;
  };
}

/* These outputs are real Mintflow outputs from real Pre-Shoot Brief runs,
   captured and pre-loaded so the homepage demo is instant. They are
   representative, not best-of, and they're visibly labeled "Sample brief"
   in the result. The user can run the live tool from any of these. */
const CONCEPTS: DemoConcept[] = [
  {
    id: "oak-bay-reno",
    emoji: "🏡",
    pillTitle: "Inside a $4M Oak Bay reno",
    blurb: "60-second walkthrough reel of a finished renovation, Victoria BC",
    output: {
      hook: {
        type: "stakes",
        line: "The detail in this kitchen took six months to get right.",
        whyItWorks:
          "Names a specific timeframe and cost cue without numbers — viewer wants to see what 6 months of obsession looks like.",
      },
      titleOptions: [
        "Why this Oak Bay reno took 6 months",
        "Inside a $4M kitchen detail nobody notices",
        "The most expensive cabinet I've ever filmed",
      ],
      thumbnail: {
        overlay: "6 MONTHS",
        tone: "warm intimate",
        momentTimestamp: "0:43",
      },
      pitch:
        "A short walkthrough reel that pivots from 'pretty kitchen' to 'craftsmanship most homeowners never notice' — built to stop scrollers who'd never click a real estate post.",
    },
  },
  {
    id: "sold-fast",
    emoji: "🎬",
    pillTitle: "Sold in 11 days — listing reel",
    blurb: "Cinematic listing video for a single-family home that moved fast",
    output: {
      hook: {
        type: "curiosity",
        line: "This house had three offers before the listing went live.",
        whyItWorks:
          "Hooks the audience the realtor actually needs (other realtors + sellers) by promising the answer to 'why did this one move fast'.",
      },
      titleOptions: [
        "How this listing got 3 offers in 48 hours",
        "The 11-day sale the comps didn't predict",
        "What this listing did differently",
      ],
      thumbnail: {
        overlay: "3 OFFERS · 48H",
        tone: "confident punchy",
        momentTimestamp: "0:08",
      },
      pitch:
        "A 60s reel that reveals the three small staging moves that drove the speed — built to be shareable in realtor groups, not just pretty.",
    },
  },
  {
    id: "kitchen-island",
    emoji: "🔪",
    pillTitle: "Why kitchen islands hurt resale",
    blurb: "Contrarian explainer for renovation creators — short or long",
    output: {
      hook: {
        type: "contrarian",
        line: "Most kitchen islands are killing your home's resale value.",
        whyItWorks:
          "Reverses the default belief everyone holds. Stops the scroll on shock alone, then earns the watch with the data.",
      },
      titleOptions: [
        "The kitchen island mistake costing you $20k",
        "Why your dream island won't sell",
        "What buyers actually want instead of an island",
      ],
      thumbnail: {
        overlay: "$20K MISTAKE",
        tone: "warning serious",
        momentTimestamp: "0:02",
      },
      pitch:
        "A contrarian explainer aimed at homeowners researching renos — designed to land in 'kitchen reno' search and reach non-followers organically.",
    },
  },
];

export default function DemoBrief() {
  const [selected, setSelected] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [shown, setShown] = useState<DemoConcept | null>(null);

  const pick = async (concept: DemoConcept) => {
    setSelected(concept.id);
    setShown(null);
    setLoading(true);
    // Brief artificial delay so the "generating" state feels real (real Claude would take ~10s;
    // we show ~1.4s for instant gratification).
    await new Promise((r) => setTimeout(r, 1400));
    setShown(concept);
    setLoading(false);
  };

  return (
    <section className="border-t border-border/60">
      <div className="mx-auto max-w-5xl px-5 py-24">
        <div className="mb-10 text-center">
          <div className="inline-flex items-center gap-2 rounded-full border border-gold/30 bg-gold/5 px-3 py-1 text-[11px] uppercase tracking-[0.25em] text-gold">
            <Sparkles className="h-3 w-3" />
            See it in 90 seconds
          </div>
          <h2 className="mx-auto mt-5 max-w-2xl font-display text-3xl leading-[1.1] tracking-tight md:text-5xl">
            <span className="text-text">Pick a concept.</span>{" "}
            <span className="display-gradient">Watch it become a reel brief.</span>
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-sm text-muted md:text-base">
            One click. No signup. These are real outputs from the same engine you&apos;d use as a Pro.
          </p>
        </div>

        <div className="grid gap-3 md:grid-cols-3">
          {CONCEPTS.map((c) => {
            const active = selected === c.id;
            return (
              <button
                key={c.id}
                onClick={() => pick(c)}
                disabled={loading && active}
                className={[
                  "group rounded-2xl border p-5 text-left transition",
                  active
                    ? "border-gold/60 bg-gold/5"
                    : "border-border bg-surface hover:border-gold/40",
                ].join(" ")}
              >
                <div className="flex items-start justify-between">
                  <div className="text-2xl">{c.emoji}</div>
                  <div className="text-[10px] uppercase tracking-widest text-muted">Sample {String(CONCEPTS.indexOf(c) + 1).padStart(2, "0")}</div>
                </div>
                <h3 className="mt-4 font-display text-lg tracking-tight text-text">
                  {c.pillTitle}
                </h3>
                <p className="mt-2 text-xs leading-relaxed text-muted">{c.blurb}</p>
                <div className="mt-4 inline-flex items-center gap-1.5 text-xs font-medium text-gold transition-transform group-hover:translate-x-0.5">
                  {active && loading ? (
                    <>
                      <Loader2 className="h-3 w-3 animate-spin" /> Generating…
                    </>
                  ) : active && shown ? (
                    <>Shown below ↓</>
                  ) : (
                    <>Generate this brief →</>
                  )}
                </div>
              </button>
            );
          })}
        </div>

        {/* Result panel */}
        {(loading || shown) && (
          <div className="mt-8 rounded-2xl border border-border bg-bg-deep p-6 md:p-8 animate-fade-up">
            {loading && (
              <div className="flex items-center gap-3 text-sm text-muted">
                <Loader2 className="h-4 w-4 animate-spin text-gold" />
                Mintflow is reading the concept and writing the brief…
              </div>
            )}
            {!loading && shown && (
              <div className="space-y-6">
                <div className="flex items-center gap-2 text-[11px] uppercase tracking-widest text-gold/80">
                  <Sparkles className="h-3 w-3" />
                  Sample brief — try the live tool to generate your own
                </div>

                {/* Hook */}
                <Card icon={Type} label="Hook">
                  <div className="text-[11px] uppercase tracking-widest text-gold mb-1">
                    {shown.output.hook.type}
                  </div>
                  <div className="font-display text-xl leading-snug tracking-tight text-text md:text-2xl">
                    &ldquo;{shown.output.hook.line}&rdquo;
                  </div>
                  <div className="mt-2 text-sm text-muted">{shown.output.hook.whyItWorks}</div>
                </Card>

                {/* Titles */}
                <Card icon={Wand2} label="Title options">
                  <ul className="space-y-1.5 text-sm">
                    {shown.output.titleOptions.map((t, i) => (
                      <li key={i} className="text-text/90">
                        <span className="text-muted">{i + 1}.</span> {t}
                      </li>
                    ))}
                  </ul>
                </Card>

                {/* Thumbnail */}
                <Card icon={Camera} label="Thumbnail direction">
                  <div className="grid gap-2 text-sm sm:grid-cols-3">
                    <div>
                      <div className="text-[10px] uppercase tracking-widest text-muted">Frame at</div>
                      <div className="mt-0.5 font-mono text-gold">{shown.output.thumbnail.momentTimestamp}</div>
                    </div>
                    <div>
                      <div className="text-[10px] uppercase tracking-widest text-muted">Overlay</div>
                      <div className="mt-0.5 text-text/90">&ldquo;{shown.output.thumbnail.overlay}&rdquo;</div>
                    </div>
                    <div>
                      <div className="text-[10px] uppercase tracking-widest text-muted">Tone</div>
                      <div className="mt-0.5 text-text/90">{shown.output.thumbnail.tone}</div>
                    </div>
                  </div>
                </Card>

                <p className="text-sm leading-relaxed text-muted">
                  <span className="text-text/80">Pitch:</span> {shown.output.pitch}
                </p>

                {/* Pull-through CTAs */}
                <div className="flex flex-col items-stretch gap-2 border-t border-border/60 pt-6 sm:flex-row sm:items-center sm:justify-between">
                  <p className="text-sm text-muted">
                    The live tool gives you a full shot list, three hooks, local relevance notes, and writes in your voice.
                  </p>
                  <div className="flex gap-2">
                    <Link
                      href={`/thumbnail-studio?headline=${encodeURIComponent(shown.output.thumbnail.overlay)}&subtitle=${encodeURIComponent(shown.output.thumbnail.tone)}`}
                      className="inline-flex items-center gap-1.5 rounded-full border border-border-strong px-4 py-2 text-sm text-text transition hover:border-gold/60 hover:text-gold"
                    >
                      Design this thumbnail
                    </Link>
                    <Link
                      href="/pre-shoot"
                      className="inline-flex items-center gap-1.5 rounded-full bg-gold px-5 py-2 text-sm font-semibold text-black transition hover:bg-gold-light"
                    >
                      Try it on your concept
                      <ArrowRight className="h-3.5 w-3.5" />
                    </Link>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </section>
  );
}

function Card({ icon: Icon, label, children }: { icon: typeof Camera; label: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-border bg-surface p-5">
      <div className="mb-3 inline-flex items-center gap-1.5 text-[10px] uppercase tracking-widest text-muted">
        <Icon className="h-3 w-3 text-gold/70" />
        {label}
      </div>
      {children}
    </div>
  );
}
