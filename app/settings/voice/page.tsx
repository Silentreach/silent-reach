"use client";

import { useEffect, useState } from "react";
import { Plus, Trash2, Save, Check, Lightbulb } from "lucide-react";
import {
  getVoiceSamples, setVoiceSamples,
  getVoiceNotes,   setVoiceNotes,
  getVoiceStrength,
  VOICE_SAMPLE_MAX, VOICE_SAMPLE_RECOMMENDED,
  type VoiceStrength,
} from "@/lib/userContext";

const PLACEHOLDERS = [
  "When the light hits the kitchen at 6:14pm and you remember why you loved this house in the first place.",
  "Spent four hours on a single tracking shot for a 12-second reel. The shot you don't notice is the shot that worked.",
  "Three things every realtor underprices: north-facing exposure, a long driveway, and silence.",
];

export default function VoicePage() {
  const [samples, setSamples] = useState<string[]>([]);
  const [notes, setNotes]     = useState<string>("");
  const [savedTick, setSavedTick] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [strength, setStrength] = useState<VoiceStrength>("none");

  function recomputeStrength(currentSamples: string[]) {
    const valid = currentSamples.filter((s) => s.trim().length >= 25).length;
    if (valid === 0) return setStrength("none");
    if (valid < 3) return setStrength("weak");
    if (valid < VOICE_SAMPLE_RECOMMENDED) return setStrength("good");
    setStrength("strong");
  }

  useEffect(() => {
    const s = getVoiceSamples();
    setSamples(s.length > 0 ? s : [""]);
    setNotes(getVoiceNotes());
    setStrength(getVoiceStrength());
    setLoaded(true);
  }, []);

  const update = (i: number, v: string) => {
    setSamples((prev) => {
      const next = prev.map((s, idx) => (idx === i ? v : s));
      recomputeStrength(next);
      return next;
    });
  };
  const addRow = () => setSamples((prev) => (prev.length < VOICE_SAMPLE_MAX ? [...prev, ""] : prev));
  const removeRow = (i: number) =>
    setSamples((prev) => {
      const next = prev.length > 1 ? prev.filter((_, idx) => idx !== i) : prev;
      recomputeStrength(next);
      return next;
    });

  const save = () => {
    setVoiceSamples(samples);
    setVoiceNotes(notes);
    setSavedTick(true);
    setTimeout(() => setSavedTick(false), 1500);
  };

  if (!loaded) return null;

  return (
    <div className="space-y-10">
      {/* Voice samples */}
      <section>
        <header className="mb-4">
          <div className="flex items-end justify-between gap-4">
            <div>
              <h2 className="font-display text-2xl tracking-tight">Your voice samples</h2>
              <p className="mt-1 text-sm text-muted">
                Paste 3–{VOICE_SAMPLE_MAX} captions or hooks <em className="text-text/85 not-italic">you wrote yourself</em>. Real ones, not aspirational. The more you give, the more Mintflow's outputs sound like you wrote them.
              </p>
            </div>
            <VoiceStrengthBadge strength={strength} count={samples.filter((s) => s.trim().length >= 25).length} />
          </div>
        </header>

        <div className="space-y-3">
          {samples.map((s, i) => (
            <div key={i} className="flex items-start gap-2">
              <span className="mt-3 w-6 shrink-0 text-right font-display text-sm text-gold/50">
                {String(i + 1).padStart(2, "0")}
              </span>
              <textarea
                value={s}
                onChange={(e) => update(i, e.target.value)}
                rows={2}
                placeholder={PLACEHOLDERS[i % PLACEHOLDERS.length]}
                className="flex-1 resize-y"
              />
              <button
                onClick={() => removeRow(i)}
                disabled={samples.length === 1}
                className="mt-2.5 rounded-md p-1.5 text-muted transition hover:text-text disabled:opacity-30"
                aria-label={`Remove sample ${i + 1}`}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}

          {samples.length < VOICE_SAMPLE_MAX && (
            <button
              onClick={addRow}
              className="inline-flex items-center gap-1.5 rounded-full border border-border-strong px-3 py-1.5 text-xs text-muted transition hover:border-gold/60 hover:text-gold"
            >
              <Plus className="h-3 w-3" /> Add another sample <span className="text-[10px] text-muted/60">({samples.length}/{VOICE_SAMPLE_MAX})</span>
            </button>
          )}
        </div>
      </section>

      {/* Voice notes */}
      <section>
        <header className="mb-3">
          <h2 className="font-display text-2xl tracking-tight">Voice rules</h2>
          <p className="mt-1 text-sm text-muted">
            One per line. Treated as binding instructions on every generation.
          </p>
        </header>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={6}
          placeholder={
            "Never use the word 'elevated' or 'stunning'.\n" +
            "Never start a caption with 'In today's market'.\n" +
            "On LinkedIn: no emoji, no hashtags, end with a question.\n" +
            "On Instagram: max 2 emoji, never the heart-eyes one."
          }
          className="w-full resize-y"
        />
      </section>

      {/* Save bar */}
      <div className="flex items-center justify-between border-t border-border/60 pt-6">
        <div className="flex items-center gap-2 text-xs text-muted">
          <Lightbulb className="h-3.5 w-3.5 text-gold/70" />
          Stored locally in your browser. Sent with each generation only.
        </div>
        <button
          onClick={save}
          className="inline-flex items-center gap-1.5 rounded-full bg-gold px-5 py-2.5 text-sm font-semibold text-black transition hover:bg-gold-light"
        >
          {savedTick ? <Check className="h-4 w-4" /> : <Save className="h-4 w-4" />}
          {savedTick ? "Saved" : "Save voice"}
        </button>
      </div>
    </div>
  );
}
function VoiceStrengthBadge({ strength, count }: { strength: VoiceStrength; count: number }) {
  const meta: Record<VoiceStrength, { label: string; tone: string; bar: string; tip: string }> = {
    none: {
      label: "No voice yet",
      tone: "border-border bg-bg-deep text-muted",
      bar: "w-0 bg-border",
      tip: "Add your first 3 captions",
    },
    weak: {
      label: "Weak signal",
      tone: "border-amber-700/50 bg-amber-950/30 text-amber-300",
      bar: "w-1/4 bg-amber-500",
      tip: "Add a few more",
    },
    good: {
      label: "Good voice",
      tone: "border-gold/40 bg-gold/10 text-gold",
      bar: "w-2/3 bg-gold",
      tip: "Push to 12+ for STRONG",
    },
    strong: {
      label: "Strong voice",
      tone: "border-emerald-700/50 bg-emerald-950/30 text-emerald-300",
      bar: "w-full bg-emerald-400",
      tip: "Outputs will sound like you",
    },
  };
  const m = meta[strength];
  return (
    <div className={`flex w-44 shrink-0 flex-col gap-1.5 rounded-lg border ${m.tone} px-3 py-2`}>
      <div className="flex items-baseline justify-between">
        <span className="text-[11px] font-semibold uppercase tracking-widest">{m.label}</span>
        <span className="text-[10px] opacity-70">{count}/{VOICE_SAMPLE_RECOMMENDED}+</span>
      </div>
      <div className="h-1 overflow-hidden rounded-full bg-border/60">
        <div className={`h-full transition-[width] duration-500 ${m.bar}`} />
      </div>
      <div className="text-[10px] opacity-80">{m.tip}</div>
    </div>
  );
}
