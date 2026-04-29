"use client";

import { useState } from "react";
import { ArrowLeft, ArrowRight, Loader2, MapPin } from "lucide-react";
import {
  Field,
  ChipGroup,
  MoodPicker,
  TextInput,
  Textarea,
  Select,
  AdjustDetails,
  SectionHead,
  type ChipOption,
} from "./FormPrimitives";
import type {
  RealEstateInputs,
  RealEstateListingStage,
  RealEstateBuyerPersona,
  Mood,
} from "@/types/preProduction";

const STAGES: readonly ChipOption<RealEstateListingStage>[] = [
  { id: "coming_soon",       label: "Coming Soon",          hint: "Tease, withhold, build anticipation" },
  { id: "just_listed",       label: "Just Listed",          hint: "Active, available, urgency-aware" },
  { id: "open_house",        label: "Open House",           hint: "This-weekend driver, date-anchored" },
  { id: "price_improvement", label: "Price Improvement",    hint: "Address objections, second-look framing" },
  { id: "sold",              label: "Sold (Case Study)",    hint: "Flex, credibility, what-it-did" },
];

const PERSONAS: readonly ChipOption<RealEstateBuyerPersona>[] = [
  { id: "first_time",        label: "First-Time Buyer" },
  { id: "move_up_family",    label: "Move-Up Family" },
  { id: "downsizer",         label: "Downsizer" },
  { id: "investor",          label: "Investor" },
  { id: "out_of_province",   label: "Out-of-Province" },
  { id: "luxury",            label: "Luxury" },
];

const PLATFORMS = [
  { id: "instagram" as const,        label: "Instagram" },
  { id: "youtube_shorts" as const,   label: "YouTube Shorts" },
  { id: "youtube" as const,          label: "YouTube (long)" },
  { id: "linkedin" as const,         label: "LinkedIn" },
  { id: "all" as const,              label: "Multi-platform" },
];

const LENGTHS = [
  { id: "15s" as const, label: "15 seconds" },
  { id: "30s" as const, label: "30 seconds" },
  { id: "45s" as const, label: "45 seconds" },
  { id: "60s" as const, label: "60 seconds" },
  { id: "90s" as const, label: "90 seconds" },
];

const DEFAULTS: RealEstateInputs = {
  niche: "real_estate",
  address: "",
  listingStage: "just_listed",
  buyerPersonas: ["move_up_family"],
  heroShot: "",
  moods: [],
  platform: "instagram",
  videoLength: "30s",
  conceptOverride: "",
  mlsText: "",
};

export default function RealEstateForm({
  onBack,
  onSubmit,
  submitting,
}: {
  onBack: () => void;
  onSubmit: (inputs: RealEstateInputs) => void;
  submitting?: boolean;
}) {
  const [inputs, setInputs] = useState<RealEstateInputs>(DEFAULTS);
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [propertyOpen, setPropertyOpen] = useState(false);

  // Auto-bump length to 60s when Luxury is chosen, and auto-add cinematic mood.
  function setPersonas(personas: RealEstateBuyerPersona[]) {
    const luxuryPicked = personas.includes("luxury") && !inputs.buyerPersonas.includes("luxury");
    setInputs((s) => ({
      ...s,
      buyerPersonas: personas,
      videoLength: luxuryPicked ? "60s" : s.videoLength,
      moods: luxuryPicked && !s.moods.includes("cinematic") ? ([...s.moods.slice(0, 1), "cinematic"] as Mood[]) : s.moods,
    }));
  }

  const canSubmit = inputs.address.trim().length > 0 && !submitting;

  return (
    <div className="mx-auto max-w-3xl">
      <FormHeader title="Real Estate Listing" onBack={onBack} />

      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (canSubmit) onSubmit(inputs);
        }}
        className="grid gap-5"
      >
        {/* Row 1 — the magic */}
        <div className="rounded-2xl border border-border/70 bg-bg p-6">
          <SectionHead>The shot</SectionHead>

          <div className="mt-4 grid gap-5">
            <Field
              label="Address"
              required
              hint="Type a Victoria-area address. Mintflow will look up the actual neighborhood, schools, parks, and transit nearby."
            >
              <div className="relative">
                <MapPin className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted/60" />
                <TextInput
                  type="text"
                  placeholder="868 Orono Ave, Saanich BC"
                  value={inputs.address}
                  onChange={(e) => setInputs((s) => ({ ...s, address: e.target.value }))}
                  autoComplete="off"
                  className="pl-9"
                />
              </div>
            </Field>

            <Field
              label="Listing stage"
              required
              hint="Different stages call for different hooks. Coming Soon teases; Open House drives a date; Sold flexes."
            >
              <ChipGroup
                options={STAGES}
                value={[inputs.listingStage]}
                onChange={(v) => setInputs((s) => ({ ...s, listingStage: (v[0] ?? s.listingStage) as RealEstateListingStage }))}
              />
              {inputs.listingStage === "open_house" && (
                <div className="mt-3 grid gap-1.5">
                  <span className="text-[11px] text-muted/80">Open house date</span>
                  <TextInput
                    type="date"
                    value={inputs.openHouseDate ?? ""}
                    onChange={(e) => setInputs((s) => ({ ...s, openHouseDate: e.target.value }))}
                  />
                </div>
              )}
            </Field>

            <Field
              label="Buyer persona"
              required
              hint="Pick up to 2. Mintflow re-ranks shot priorities to fit the buyer pool."
            >
              <ChipGroup options={PERSONAS} value={inputs.buyerPersonas} onChange={setPersonas} multi max={2} />
            </Field>
          </div>
        </div>

        {/* Row 2 — adjust details */}
        <AdjustDetails open={advancedOpen} onToggle={() => setAdvancedOpen((v) => !v)}>
          <Field
            label="Hero shot"
            hint="The ONE shot you must get. Example: sunset hitting the kitchen island as the doors open."
          >
            <TextInput
              type="text"
              placeholder="The single visual the whole reel builds toward"
              value={inputs.heroShot ?? ""}
              onChange={(e) => setInputs((s) => ({ ...s, heroShot: e.target.value }))}
            />
          </Field>

          <Field label="Mood" hint="Pick up to 2. Drives pacing, color, and shot rhythm.">
            <MoodPicker value={inputs.moods} onChange={(m) => setInputs((s) => ({ ...s, moods: m }))} />
          </Field>

          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Platform">
              <Select value={inputs.platform} onChange={(p) => setInputs((s) => ({ ...s, platform: p }))} options={PLATFORMS} />
            </Field>
            <Field label="Length">
              <Select value={inputs.videoLength} onChange={(l) => setInputs((s) => ({ ...s, videoLength: l }))} options={LENGTHS} />
            </Field>
          </div>

          <Field label="Concept override" hint="Leave empty to let Mintflow infer from address + persona.">
            <Textarea
              rows={2}
              placeholder="One line — the angle you want, if you already know"
              value={inputs.conceptOverride ?? ""}
              onChange={(e) => setInputs((s) => ({ ...s, conceptOverride: e.target.value }))}
            />
          </Field>

          <button
            type="button"
            onClick={() => setPropertyOpen((v) => !v)}
            className="text-left text-[12px] font-medium uppercase tracking-[0.15em] text-muted transition hover:text-text"
            aria-expanded={propertyOpen}
          >
            {propertyOpen ? "▾" : "▸"} Property facts (paste MLS or fill manually)
          </button>

          {propertyOpen && (
            <div className="grid gap-4">
              <Field label="MLS listing — paste URL or text" hint="If you have it, Mintflow extracts beds / baths / sqft / features automatically.">
                <Textarea
                  rows={3}
                  placeholder="Paste the listing description here, or skip and fill the manual fields below."
                  value={inputs.mlsText ?? ""}
                  onChange={(e) => setInputs((s) => ({ ...s, mlsText: e.target.value }))}
                />
              </Field>

              <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
                <ManualField
                  label="Beds"
                  value={inputs.manualPropertyFacts?.beds}
                  onChange={(beds) => setInputs((s) => ({ ...s, manualPropertyFacts: { ...s.manualPropertyFacts, beds } }))}
                />
                <ManualField
                  label="Baths"
                  value={inputs.manualPropertyFacts?.baths}
                  onChange={(baths) => setInputs((s) => ({ ...s, manualPropertyFacts: { ...s.manualPropertyFacts, baths } }))}
                />
                <ManualField
                  label="Sqft"
                  value={inputs.manualPropertyFacts?.sqft}
                  onChange={(sqft) => setInputs((s) => ({ ...s, manualPropertyFacts: { ...s.manualPropertyFacts, sqft } }))}
                />
                <ManualField
                  label="Year built"
                  value={inputs.manualPropertyFacts?.yearBuilt}
                  onChange={(yearBuilt) => setInputs((s) => ({ ...s, manualPropertyFacts: { ...s.manualPropertyFacts, yearBuilt } }))}
                />
                <ManualField
                  label="Lot sqft"
                  value={inputs.manualPropertyFacts?.lotSqft}
                  onChange={(lotSqft) => setInputs((s) => ({ ...s, manualPropertyFacts: { ...s.manualPropertyFacts, lotSqft } }))}
                />
                <ManualField
                  label="Asking $CAD"
                  value={inputs.manualPropertyFacts?.askingPriceCad}
                  onChange={(askingPriceCad) => setInputs((s) => ({ ...s, manualPropertyFacts: { ...s.manualPropertyFacts, askingPriceCad } }))}
                />
              </div>
            </div>
          )}
        </AdjustDetails>

        {/* Submit */}
        <div className="flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={onBack}
            className="rounded-full px-4 py-2 text-[13px] text-muted transition hover:text-text"
          >
            Back
          </button>
          <button
            type="submit"
            disabled={!canSubmit}
            className="group inline-flex items-center gap-1.5 rounded-full bg-gold px-5 py-2.5 text-[13px] font-semibold text-black transition hover:bg-gold-light disabled:cursor-not-allowed disabled:opacity-60"
          >
            {submitting ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Drafting three angles…
              </>
            ) : (
              <>
                Generate brief
                <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}

function FormHeader({ title, onBack }: { title: string; onBack: () => void }) {
  return (
    <header className="mb-8">
      <button
        type="button"
        onClick={onBack}
        className="inline-flex items-center gap-1 text-[12px] text-muted transition hover:text-text"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        Pick a different niche
      </button>
      <h1 className="mt-3 font-display text-3xl tracking-tight text-text md:text-4xl">{title}</h1>
    </header>
  );
}

function ManualField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number | undefined;
  onChange: (v: number | undefined) => void;
}) {
  return (
    <Field label={label}>
      <TextInput
        type="number"
        inputMode="numeric"
        value={value ?? ""}
        onChange={(e) => {
          const v = e.target.value;
          onChange(v === "" ? undefined : Number(v));
        }}
      />
    </Field>
  );
}
