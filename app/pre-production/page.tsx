"use client";

import { useState } from "react";
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
  const [niche, setNiche] = useState<Niche | null>(null);
  const [output, setOutput] = useState<PreShootOutput | null>(null);
  const [legacyInputForHistory, setLegacyInputForHistory] = useState<PreShootInput | null>(null);
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

  async function generate(inputs: NicheInputs) {
    setStage("loading");
    setError(null);
    try {
      const res = await fetch("/api/pre-production", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ input: inputs, userContext: getUserContext() }),
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

      {stage === "loading" && <LoadingPanel niche={niche} />}

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
          <BriefResult output={output} />
        </div>
      )}
    </div>
  );
}

function LoadingPanel({ niche }: { niche: Niche | null }) {
  const phrase =
    niche === "real_estate"
      ? "Reading the neighborhood…"
      : niche === "construction"
        ? "Tuning to the phase…"
        : "Studying the angle…";
  return (
    <div className="mx-auto max-w-xl rounded-2xl border border-border/70 bg-bg p-12 text-center">
      <div className="mx-auto h-10 w-10 animate-spin rounded-full border-2 border-gold/30 border-t-gold" />
      <div className="mt-6 font-display text-xl tracking-tight text-text">{phrase}</div>
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
