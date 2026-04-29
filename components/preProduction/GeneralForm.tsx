"use client";

import { useState } from "react";
import { ArrowLeft, ArrowRight, Loader2 } from "lucide-react";
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
import type { GeneralInputs, GeneralContentMode } from "@/types/preProduction";

const MODES: readonly ChipOption<GeneralContentMode>[] = [
  { id: "day_in_the_life", label: "Day-in-the-Life" },
  { id: "explainer",       label: "Explainer" },
  { id: "review",          label: "Review" },
  { id: "tutorial",        label: "Tutorial" },
  { id: "vlog",            label: "Vlog" },
  { id: "hot_take",        label: "Hot Take / POV" },
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

const DEFAULTS: GeneralInputs = {
  niche: "general",
  contentMode: "explainer",
  concept: "",
  heroShot: "",
  moods: [],
  platform: "instagram",
  videoLength: "30s",
  audience: "",
};

export default function GeneralForm({
  onBack,
  onSubmit,
  submitting,
}: {
  onBack: () => void;
  onSubmit: (inputs: GeneralInputs, extras: { geocode: { formattedAddress: string; lat: number; lng: number; neighborhood?: string; postalCode?: string } | null }) => void;
  submitting?: boolean;
}) {
  const [inputs, setInputs] = useState<GeneralInputs>(DEFAULTS);
  const [advancedOpen, setAdvancedOpen] = useState(false);

  const canSubmit = inputs.concept.trim().length >= 5 && !submitting;

  return (
    <div className="mx-auto max-w-3xl">
      <header className="mb-8">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-1 text-[12px] text-muted transition hover:text-text"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Pick a different niche
        </button>
        <h1 className="mt-3 font-display text-3xl tracking-tight text-text md:text-4xl">
          Something else
        </h1>
        <p className="mt-2 text-[13px] text-muted">
          A simpler form for personal brand, education, or anything that
          isn&rsquo;t a listing or a build.
        </p>
      </header>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (canSubmit) onSubmit(inputs, { geocode: null });
        }}
        className="grid gap-5"
      >
        <div className="rounded-2xl border border-border/70 bg-bg p-6">
          <SectionHead>The video</SectionHead>

          <div className="mt-4 grid gap-5">
            <Field label="Content mode" required>
              <ChipGroup
                options={MODES}
                value={[inputs.contentMode]}
                onChange={(v) => setInputs((s) => ({ ...s, contentMode: (v[0] ?? s.contentMode) as GeneralContentMode }))}
              />
            </Field>

            <Field label="Concept" required hint="One or two sentences. The angle, the subject, the why.">
              <Textarea
                rows={3}
                placeholder="What's the video, and why now?"
                value={inputs.concept}
                onChange={(e) => setInputs((s) => ({ ...s, concept: e.target.value }))}
              />
            </Field>
          </div>
        </div>

        <AdjustDetails open={advancedOpen} onToggle={() => setAdvancedOpen((v) => !v)}>
          <Field
            label="Hero shot"
            hint="The ONE shot you must get."
          >
            <TextInput
              type="text"
              placeholder="The single visual the whole video builds toward"
              value={inputs.heroShot ?? ""}
              onChange={(e) => setInputs((s) => ({ ...s, heroShot: e.target.value }))}
            />
          </Field>

          <Field label="Mood">
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

          <Field label="Audience" hint="Who is this for, in one line.">
            <TextInput
              type="text"
              placeholder="e.g. first-time renters in BC who don't know what to ask"
              value={inputs.audience ?? ""}
              onChange={(e) => setInputs((s) => ({ ...s, audience: e.target.value }))}
            />
          </Field>
        </AdjustDetails>

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
                Drafting…
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
