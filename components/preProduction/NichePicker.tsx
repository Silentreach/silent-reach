"use client";

import { Home, HardHat, ArrowRight } from "lucide-react";
import type { Niche } from "@/types/preProduction";

interface NichePickerProps {
  onPick: (niche: Niche) => void;
}

export default function NichePicker({ onPick }: NichePickerProps) {
  return (
    <div className="mx-auto max-w-5xl">
      <header className="mb-12 text-center">
        <div className="inline-flex items-center gap-2 rounded-full border border-gold/30 bg-gold/5 px-3 py-1 text-[11px] uppercase tracking-[0.25em] text-gold">
          Pre-Production
        </div>
        <h1 className="mt-6 font-display text-[36px] leading-[1.05] tracking-[-0.02em] text-text md:text-5xl">
          <span className="display-gradient">What are we shooting?</span>
        </h1>
        <p className="mx-auto mt-4 max-w-xl text-base leading-relaxed text-muted">
          Pick the project type. Mintflow tunes the brief to how that work
          actually gets made &mdash; different hooks, different cuts, different
          questions for different shoots.
        </p>
      </header>

      <div className="grid gap-5 md:grid-cols-2">
        <NicheCard
          niche="real_estate"
          title="Real Estate Listing"
          icon={<Home className="h-6 w-6" />}
          tagline="Address-driven."
          body="USPs from the actual neighborhood. Hooks tuned to the listing stage. Buyer-persona-aware shot priorities."
          onPick={onPick}
        />
        <NicheCard
          niche="construction"
          title="Construction Project"
          icon={<HardHat className="h-6 w-6" />}
          tagline="Phase-aware."
          body="Demo to final reveal — the brief swaps with the phase. Trade-specific B-roll vocabulary. Time-lapse math when you need it."
          onPick={onPick}
        />
      </div>

      <div className="mt-8 flex justify-end">
        <button
          type="button"
          onClick={() => onPick("general")}
          className="group inline-flex items-center gap-1.5 text-[13px] text-muted transition hover:text-gold"
        >
          Something else
          <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
        </button>
      </div>
    </div>
  );
}

function NicheCard({
  niche,
  title,
  icon,
  tagline,
  body,
  onPick,
}: {
  niche: Niche;
  title: string;
  icon: React.ReactNode;
  tagline: string;
  body: string;
  onPick: (n: Niche) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onPick(niche)}
      className="group relative flex flex-col rounded-2xl border border-border/70 bg-bg p-7 text-left transition-all duration-200 ease-out hover:-translate-y-0.5 hover:border-gold/50 hover:bg-bg-deep/30 hover:shadow-[0_0_0_1px_rgba(212,175,55,0.15),0_8px_32px_-12px_rgba(212,175,55,0.18)] focus:outline-none focus-visible:border-gold/60 focus-visible:ring-2 focus-visible:ring-gold/30"
    >
      <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-border/70 bg-bg-deep/50 text-muted transition group-hover:border-gold/40 group-hover:text-gold">
        {icon}
      </div>

      <div className="mt-6">
        <h2 className="font-display text-2xl tracking-tight text-text md:text-[28px]">
          {title}
        </h2>
        <div className="mt-1.5 text-[13px] font-medium text-gold/85">{tagline}</div>
      </div>

      <p className="mt-4 text-[14px] leading-relaxed text-muted">{body}</p>

      <div className="mt-6 inline-flex items-center gap-1.5 text-[13px] font-medium text-gold transition group-hover:text-gold-light">
        Start
        <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
      </div>
    </button>
  );
}
