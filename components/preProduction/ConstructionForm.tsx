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
import type {
  ConstructionInputs,
  ConstructionPhase,
  ConstructionArc,
  Trade,
} from "@/types/preProduction";

const PHASES: readonly ChipOption<ConstructionPhase>[] = [
  { id: "demo",          label: "Demo",          hint: "Lead with destruction / discovery" },
  { id: "framing",       label: "Framing",       hint: "Skeleton, scale, structure visible" },
  { id: "rough_in",      label: "Rough-In",      hint: "Mech / electrical / plumbing visible" },
  { id: "drywall",       label: "Drywall",       hint: "Walls closing — transition phase" },
  { id: "finish",        label: "Finish",        hint: "Cabinetry, tile, paint, hardware" },
  { id: "final_reveal",  label: "Final Reveal",  hint: "Hero shot territory; homeowner reactions" },
];

const ARCS: readonly ChipOption<ConstructionArc>[] = [
  { id: "problem_solution",  label: "Problem → Solution",  hint: "Lead with the issue, end with the fix" },
  { id: "before_after",      label: "Before → After",      hint: "Side-by-side or hard-cut transformation" },
  { id: "process_hero",      label: "Process Hero",        hint: "Single trade, single technique, deep" },
  { id: "time_lapse",        label: "Time-lapse",          hint: "Interval shots over time, math-aware" },
  { id: "trade_spotlight",   label: "Trade Spotlight",     hint: "One craftsperson at the center" },
];

const TRADES: readonly ChipOption<Trade>[] = [
  { id: "gc",            label: "GC" },
  { id: "carpenter",     label: "Carpenter" },
  { id: "mason",         label: "Mason" },
  { id: "electrician",   label: "Electrician" },
  { id: "plumber",       label: "Plumber" },
  { id: "tile_finish",   label: "Tile / Finish" },
  { id: "landscape",     label: "Landscape" },
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

const DEFAULTS: ConstructionInputs = {
  niche: "construction",
  projectPhase: "framing",
  transformationArc: "problem_solution",
  tradeFocus: [],
  audienceMode: "client_facing",
  heroShot: "",
  moods: [],
  platform: "instagram",
  videoLength: "60s",
  droneAvailable: false,
  siteSafetyConstraints: "",
  conceptOverride: "",
};

export default function ConstructionForm({
  onBack,
  onSubmit,
  submitting,
}: {
  onBack: () => void;
  onSubmit: (inputs: ConstructionInputs) => void;
  submitting?: boolean;
}) {
  const [inputs, setInputs] = useState<ConstructionInputs>(DEFAULTS);
  const [advancedOpen, setAdvancedOpen] = useState(false);

  // When user picks Time-lapse, default length to 90s.
  function setArc(arc: ConstructionArc) {
    setInputs((s) => ({
      ...s,
      transformationArc: arc,
      videoLength: arc === "time_lapse" ? "90s" : s.videoLength,
    }));
  }

  const canSubmit = !submitting;

  return (
    <div className="mx-auto max-w-3xl">
      <FormHeader title="Construction Project" onBack={onBack} />

      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (canSubmit) onSubmit(inputs);
        }}
        className="grid gap-5"
      >
        {/* Row 1 — the magic */}
        <div className="rounded-2xl border border-border/70 bg-bg p-6">
          <SectionHead>The phase</SectionHead>

          <div className="mt-4 grid gap-5">
            <Field
              label="Project phase"
              required
              hint="Each phase rewires the brief. Demo and Final Reveal are different videos."
            >
              <ChipGroup
                options={PHASES}
                value={[inputs.projectPhase]}
                onChange={(v) => setInputs((s) => ({ ...s, projectPhase: (v[0] ?? s.projectPhase) as ConstructionPhase }))}
              />
            </Field>

            <Field
              label="Transformation arc"
              required
              hint="The narrative spine. Time-lapse swaps the brief to interval math + lighting consistency."
            >
              <ChipGroup
                options={ARCS}
                value={[inputs.transformationArc]}
                onChange={(v) => v[0] && setArc(v[0] as ConstructionArc)}
              />
            </Field>

            <Field
              label="Trade focus"
              hint="Pick up to 2. Drives B-roll specificity — torque-wrench-on-copper, not generic tool detail."
            >
              <ChipGroup
                options={TRADES}
                value={inputs.tradeFocus}
                onChange={(t) => setInputs((s) => ({ ...s, tradeFocus: t }))}
                multi
                max={2}
              />
            </Field>
          </div>
        </div>

        {/* Audience mode toggle — visible up here because it changes everything */}
        <div className="rounded-2xl border border-border/70 bg-bg p-5">
          <SectionHead>Audience</SectionHead>
          <div className="mt-3 grid gap-3 md:grid-cols-2">
            <AudienceCard
              active={inputs.audienceMode === "client_facing"}
              title="Client-facing"
              body="Homeowners, prospective buyers. Emphasis: lifestyle, finish, pride."
              onClick={() => setInputs((s) => ({ ...s, audienceMode: "client_facing" }))}
            />
            <AudienceCard
              active={inputs.audienceMode === "trade_facing"}
              title="Trade-facing"
              body="Other contractors, sub-trades. Emphasis: process detail, technique, gear."
              onClick={() => setInputs((s) => ({ ...s, audienceMode: "trade_facing" }))}
            />
          </div>
        </div>

        {/* Row 2 — adjust details */}
        <AdjustDetails open={advancedOpen} onToggle={() => setAdvancedOpen((v) => !v)}>
          <Field
            label="Hero shot"
            hint="The ONE shot you must get. Example: a 28-foot beam landing as the framing crew steps back."
          >
            <TextInput
              type="text"
              placeholder="The single visual the whole reel builds toward"
              value={inputs.heroShot ?? ""}
              onChange={(e) => setInputs((s) => ({ ...s, heroShot: e.target.value }))}
            />
          </Field>

          <Field label="Mood" hint="Pick up to 2.">
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

          <Field label="Site address (optional)" hint="Lighter neighborhood lookup than Real Estate. Useful for golden-hour scheduling.">
            <TextInput
              type="text"
              placeholder="e.g. 414 Cook St, Victoria BC"
              value={inputs.address ?? ""}
              onChange={(e) => setInputs((s) => ({ ...s, address: e.target.value }))}
              autoComplete="off"
            />
          </Field>

          <Field label="Drone available?" hint="If off, no aerial shots in the brief.">
            <label className="inline-flex items-center gap-2 text-[13px] text-text">
              <input
                type="checkbox"
                checked={inputs.droneAvailable}
                onChange={(e) => setInputs((s) => ({ ...s, droneAvailable: e.target.checked }))}
                className="h-4 w-4 rounded border-border bg-bg text-gold focus:ring-gold"
              />
              Yes, I&rsquo;ll have a drone on site
            </label>
          </Field>

          <Field label="Site safety constraints" hint="PPE rules, working hours, neighbor sensitivities — fed into the filming notes.">
            <Textarea
              rows={2}
              placeholder="e.g. respiratory PPE required during demo; no aerial after 6pm (school across the street)"
              value={inputs.siteSafetyConstraints ?? ""}
              onChange={(e) => setInputs((s) => ({ ...s, siteSafetyConstraints: e.target.value }))}
            />
          </Field>

          <Field label="Concept override" hint="Leave empty to let Mintflow infer from phase + arc.">
            <Textarea
              rows={2}
              placeholder="One line — the angle you want, if you already know"
              value={inputs.conceptOverride ?? ""}
              onChange={(e) => setInputs((s) => ({ ...s, conceptOverride: e.target.value }))}
            />
          </Field>
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

function AudienceCard({
  active,
  title,
  body,
  onClick,
}: {
  active: boolean;
  title: string;
  body: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={[
        "rounded-xl border p-4 text-left text-[13px] transition",
        active
          ? "border-gold/50 bg-gold/5 text-text"
          : "border-border/70 bg-bg-deep/30 text-muted hover:border-gold/30 hover:text-text",
      ].join(" ")}
    >
      <div className="text-[14px] font-semibold text-text">{title}</div>
      <div className="mt-1 leading-relaxed">{body}</div>
    </button>
  );
}
