"use client";

import React, { useState } from "react";
import BriefResult from "@/components/BriefResult";
import VoiceNudge from "@/components/VoiceNudge";
import NichePicker from "@/components/preProduction/NichePicker";
import RealEstateForm from "@/components/preProduction/RealEstateForm";
import ConstructionForm from "@/components/preProduction/ConstructionForm";
import GeneralForm from "@/components/preProduction/GeneralForm";
import { addToHistory } from "@/lib/storage";
import { getUserContext } from "@/lib/userContext";
import { newId } from "@/lib/utils";
import type { Niche, NicheInputs } from "@/types/preProduction";
import type { PreShootInput, PreShootOutput } from "@/types";

type Stage = "pick" | "form" | "loading" | "result" | "error";

export default function PreProductionPage() {
  const [stage, setStage] = useState<Stage>("pick");
  const [loadingPhase, setLoadingPhase] = useState<"thinking" | "geocoded" | "synthesizing">("thinking");
  const [niche, setNiche] = useState<Niche | null>(null);
  const [output, setOutput] = useState<PreShootOutput | null>(null);
  const [legacyInputForHistory, setLegacyInputForHistory] = useState<PreShootInput | null>(null);
  const [lastSubtitle, setLastSubtitle] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function pickNiche(n: Niche) {
    setNiche(n);
    setStage("form");
    setOutput(null);
    setError(null);
  }

  function backToPicker() {
    setStage("pick");
    setNiche(null);
    setOutput(null);
    setError(null);
  }

  async function generate(
    inputs: NicheInputs,
    extras: { geocode: { formattedAddress: string; lat: number; lng: number; neighborhood?: string; postalCode?: string } | null } = { geocode: null },
  ) {
    setStage("loading");
    setLoadingPhase(extras.geocode ? "geocoded" : "thinking");
    setError(null);
    try {
      // If we have a resolved address, fan out the nearby lookup in parallel
      // with the brief generation. The result is forwarded to the API so the
      // bridge can inject ENRICHMENT context into the prompt.
      let nearby: unknown = null;
      if (extras.geocode) {
        try {
          const r = await fetch("/api/enrichment/nearby", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ lat: extras.geocode.lat, lng: extras.geocode.lng }),
            signal: AbortSignal.timeout(20_000),
          });
          if (r.ok) {
            const d = await r.json();
            nearby = d.result ?? null;
            setLoadingPhase("synthesizing");
          }
        } catch {
          // Non-fatal — brief still generates without nearby context.
        }
      }

      const res = await fetch("/api/pre-production", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          input: inputs,
          userContext: getUserContext(),
          enrichment: extras.geocode ? { geocode: extras.geocode, nearby } : undefined,
        }),
      });

      let data: { error?: string; output?: PreShootOutput };
      const ct = res.headers.get("content-type") || "";
      if (ct.includes("application/json")) {
        data = await res.json();
      } else {
        const txt = await res.text();
        const isTimeout = /timed?\s*out|FUNCTION_INVOCATION_TIMEOUT|An error occurred/i.test(txt);
        throw new Error(
          isTimeout
            ? "The brief took longer than 60 seconds — usually a transient model slowdown. Try Regenerate."
            : `Server returned a non-JSON response (HTTP ${res.status}).`,
        );
      }

      if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
      if (!data.output) throw new Error("Empty response — please try again.");

      setOutput(data.output);
      setLastSubtitle(buildSubtitle(inputs));

      // Stash a legacy-shaped input for the history widget (it knows that schema only).
      const legacy: PreShootInput = legacyShapeFor(inputs);
      setLegacyInputForHistory(legacy);

      addToHistory({
        kind: "brief",
        id: newId(),
        createdAt: new Date().toISOString(),
        input: legacy,
        output: data.output,
      });

      setStage("result");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Unknown error");
      setStage("error");
    }
  }

  return (
    <div className="space-y-10">
      <VoiceNudge />

      {stage === "pick" && <NichePicker onPick={pickNiche} />}

      {stage === "form" && niche === "real_estate" && (
        <RealEstateForm onBack={backToPicker} onSubmit={generate} />
      )}
      {stage === "form" && niche === "construction" && (
        <ConstructionForm onBack={backToPicker} onSubmit={generate} />
      )}
      {stage === "form" && niche === "general" && (
        <GeneralForm onBack={backToPicker} onSubmit={generate} />
      )}

      {stage === "loading" && <LoadingPanel niche={niche} phase={loadingPhase} />}

      {stage === "error" && (
        <div className="mx-auto max-w-2xl rounded-2xl border border-red-500/30 bg-red-500/5 p-8 text-center">
          <h2 className="font-display text-xl text-text">Something went wrong</h2>
          <p className="mt-2 text-[14px] text-muted">{error}</p>
          <div className="mt-5 flex justify-center gap-3">
            <button
              type="button"
              onClick={() => setStage("form")}
              className="rounded-full border border-border-strong px-4 py-2 text-[13px] text-text transition hover:border-gold/60"
            >
              Edit inputs
            </button>
            <button
              type="button"
              onClick={backToPicker}
              className="rounded-full px-4 py-2 text-[13px] text-muted transition hover:text-text"
            >
              Pick a different niche
            </button>
          </div>
        </div>
      )}

      {stage === "result" && output && legacyInputForHistory && (
        <div>
          <div className="mb-6 flex items-center justify-between">
            <button
              type="button"
              onClick={() => setStage("form")}
              className="text-[13px] text-muted transition hover:text-text"
            >
              ← Edit inputs
            </button>
            <button
              type="button"
              onClick={backToPicker}
              className="text-[13px] text-muted transition hover:text-text"
            >
              New brief
            </button>
          </div>
          <BriefResult output={output} subtitle={lastSubtitle ?? undefined} />
        </div>
      )}
    </div>
  );
}

function LoadingPanel({ niche, phase }: { niche: Niche | null; phase: "thinking" | "geocoded" | "synthesizing" }) {
  // Three-step cinematic phrase rotation. We cycle within "thinking" while
  // we wait on Claude, but if address resolved we lead with the neighborhood beat.
  const RE_PHRASES = [
    "Reading the neighborhood…",
    "Picking the hero shot…",
    "Drafting three angles…",
  ];
  const CONST_PHRASES = [
    "Tuning to the phase…",
    "Building the cut hierarchy…",
    "Drafting three angles…",
  ];
  const GEN_PHRASES = [
    "Studying the angle…",
    "Tightening the hook…",
    "Drafting three angles…",
  ];

  const phrases =
    niche === "real_estate" ? RE_PHRASES :
    niche === "construction" ? CONST_PHRASES :
    GEN_PHRASES;

  const [idx, setIdx] = React.useState(0);
  React.useEffect(() => {
    const t = setInterval(() => setIdx((i) => (i + 1) % phrases.length), 1800);
    return () => clearInterval(t);
  }, [phrases.length]);

  return (
    <div className="mx-auto max-w-xl rounded-2xl border border-border/70 bg-gradient-to-b from-bg to-bg-deep/40 p-12 text-center">
      {/* Pulse Mark — gold concentric arcs */}
      <div className="relative mx-auto h-16 w-16">
        <div className="absolute inset-0 animate-ping rounded-full border border-gold/30" />
        <div className="absolute inset-2 animate-pulse rounded-full border-2 border-gold/50" />
        <div className="absolute inset-5 rounded-full bg-gold" />
      </div>
      <div className="mt-7 font-display text-xl tracking-tight text-text transition-all duration-500" key={idx}>
        {phrases[idx]}
      </div>
      <p className="mt-2 text-[13px] text-muted">
        Drafting hooks, shot list, opener variants, thumbnail direction.
        Usually 15–30 seconds.
      </p>
    </div>
  );
}

function legacyShapeFor(inputs: NicheInputs): PreShootInput {
  // Minimal shape so BriefResult / history can render. The full magic-field
  // context was already injected into the prompt server-side.
  if (inputs.niche === "real_estate") {
    return {
      contentType: "listing_tour",
      targetAudience: "BC buyers",
      location: inputs.address || "Greater Victoria, BC",
      videoLength: inputs.videoLength,
      platform: inputs.platform === "youtube_shorts" ? "youtube_shorts" :
                inputs.platform === "youtube" ? "youtube" :
                inputs.platform === "linkedin" ? "linkedin" :
                inputs.platform === "all" ? "all" : "instagram",
      concept: inputs.conceptOverride?.trim() || `Listing video for ${inputs.address}`,
    };
  }
  if (inputs.niche === "construction") {
    return {
      contentType:
        inputs.projectPhase === "final_reveal" ? "before_after" :
        inputs.transformationArc === "trade_spotlight" ? "contractor_feature" :
        "renovation_walkthrough",
      targetAudience: inputs.audienceMode === "trade_facing" ? "Contractors" : "Homeowners",
      location: inputs.address ?? "Greater Victoria, BC",
      videoLength: inputs.videoLength,
      platform: inputs.platform === "youtube_shorts" ? "youtube_shorts" :
                inputs.platform === "youtube" ? "youtube" :
                inputs.platform === "linkedin" ? "linkedin" :
                inputs.platform === "all" ? "all" : "instagram",
      concept: inputs.conceptOverride?.trim() || `Construction project — ${inputs.projectPhase}`,
    };
  }
  return {
    contentType: "explainer",
    targetAudience: inputs.audience?.trim() || "general audience",
    location: "n/a",
    videoLength: inputs.videoLength,
    platform: inputs.platform === "youtube_shorts" ? "youtube_shorts" :
              inputs.platform === "youtube" ? "youtube" :
              inputs.platform === "linkedin" ? "linkedin" :
              inputs.platform === "all" ? "all" : "instagram",
    concept: inputs.concept,
  };
}


function buildSubtitle(inputs: NicheInputs): string {
  if (inputs.niche === "real_estate") {
    const stageLabels: Record<typeof inputs.listingStage, string> = {
      coming_soon: "Coming Soon",
      just_listed: "Just Listed",
      open_house: "Open House",
      price_improvement: "Price Improvement",
      sold: "Sold",
    };
    const personaLabels: Record<string, string> = {
      first_time: "First-Time",
      move_up_family: "Move-Up Family",
      downsizer: "Downsizer",
      investor: "Investor",
      out_of_province: "Out-of-Province",
      luxury: "Luxury",
    };
    const personas = inputs.buyerPersonas.map((p) => personaLabels[p] ?? p).join(" + ");
    return [inputs.address || "", stageLabels[inputs.listingStage], personas].filter(Boolean).join(" · ");
  }
  if (inputs.niche === "construction") {
    const phaseLabels: Record<typeof inputs.projectPhase, string> = {
      demo: "Demo",
      framing: "Framing",
      rough_in: "Rough-In",
      drywall: "Drywall",
      finish: "Finish",
      final_reveal: "Final Reveal",
    };
    const arcLabels: Record<typeof inputs.transformationArc, string> = {
      problem_solution: "Problem→Solution",
      before_after: "Before→After",
      process_hero: "Process Hero",
      time_lapse: "Time-lapse",
      trade_spotlight: "Trade Spotlight",
    };
    return [
      "Construction",
      phaseLabels[inputs.projectPhase],
      arcLabels[inputs.transformationArc],
      inputs.audienceMode === "trade_facing" ? "Trade-facing" : "Client-facing",
    ].join(" · ");
  }
  // general
  const modeLabels: Record<typeof inputs.contentMode, string> = {
    day_in_the_life: "Day-in-the-Life",
    explainer: "Explainer",
    review: "Review",
    tutorial: "Tutorial",
    vlog: "Vlog",
    hot_take: "Hot Take",
  };
  return modeLabels[inputs.contentMode];
}
