"use client";

import { useEffect, useState } from "react";
import { Plus, Trash2, Save, Check, Lightbulb, Loader2 } from "lucide-react";
import {
  listVoiceSamples,
  replaceAllVoiceSamples,
  computeVoiceStrength,
  VOICE_SAMPLE_MAX, VOICE_SAMPLE_RECOMMENDED,
  type VoiceStrength,
} from "@/lib/db/voiceSamples";
import { getVoiceNotes, setVoiceNotes } from "@/lib/db/voiceNotes";

const PLACEHOLDERS = [
  "When the light hits the kitchen at 6:14pm and you remember why you loved this house in the first place.",
  "Spent four hours on a single tracking shot for a 12-second reel. The shot you don't notice is the shot that worked.",
  "Three things every realtor underprices: north-facing exposure, a long driveway, and silence.",
];

export default function VoicePage() {
  const [samples, setSamples] = useState<string[]>([]);
  const [notes, setNotes]     = useState<string>("");
  const [strength, setStrength] = useState<VoiceStrength>("none");
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savedTick, setSavedTick] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function recompute(currentSamples: string[]) {
    setStrength(computeVoiceStrength(currentSamples));
  }

  useEffect(() => {
    (async () => {
      try {
        const [rows, n] = await Promise.all([listVoiceSamples(), getVoiceNotes()]);
        const texts = rows.map((r) => r.text);
        setSamples(texts.length > 0 ? texts : [""]);
        setNotes(n);
        recompute(texts);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load voice context");
      } finally {
        setLoaded(true);
      }
    })();
  }, []);

  const update = (i: number, v: string) => {
    setSamples((prev) => {
      const next = prev.map((s, idx) => (idx === i ? v : s));
      recompute(next);
      return next;
    });
  };
  const addRow = () =>
    setSamples((prev) => (prev.length < VOICE_SAMPLE_MAX ? [...prev, ""] : prev));
  const removeRow = (i: number) =>
    setSamples((prev) => {
      const next = prev.length > 1 ? prev.filter((_, idx) => idx !== i) : prev;
      recompute(next);
      return next;
    });

  async function save() {
    setSaving(true);
    setError(null);
    try {
      await Promise.all([
        replaceAllVoiceSamples(samples),
        setVoiceNotes(notes),
      ]);
      setSavedTick(true);
      setTimeout(() => setSavedTick(false), 1500);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  if (!loaded) {
    return (
      <div className="flex items-center gap-2 text-muted">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading your voice context…
      </div>
    );
  }

  return (
    <div className="space-y-10">
      <section>
        <header className="mb-4">
          <div className="flex items-end justify-between gap-4">
            <div>
              <h2 className="font-display text-2xl tracking-tight">Your voice samples</h2>
              <p className="mt-1 text-sm text-muted">
                Paste 3–{VOICE_SAMPLE_MAX} captions or hooks <em className="text-text/85 not-italic">you wrote yourself</em>. Real ones, not aspirational. The more you give, the more Mintflow&apos;s outputs sound like you wrote them.
              </p>
            </div>
            <VoiceStrengthBadge
              strength={strength}
              count={samples.filter((s) => s.trim().length >= 25).length}
            />
          </div>
        </header>

        <div className="space-y-3">
          {samples.map((s, i) => (
            <div key={i} className="flex gap-2">
              <textarea
                value={s}
                onChange={(e) => update(i, e.target.value)}
                placeholder={PLACEHOLDERS[i % PLACEHOLDERS.length]}
                className="min-h-[68px] flex-1 rounded-xl border border-border/70 bg-bg-deep/60 px-3 py-2 text-sm text-text placeholder:text-muted/60 focus:border-mint/50 focus:outline-none focus:ring-2 focus:ring-mint/20"
              />
              {samples.length > 1 && (
                <button
                  onClick={() => removeRow(i)}
                  className="self-start rounded-lg border border-border/60 p-2 text-muted hover:border-rose-500/40 hover:text-rose-300"
                  aria-label="Remove sample"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              )}
            </div>
          ))}
        </div>

        {samples.length < VOICE_SAMPLE_MAX && (
          <button
            onClick={addRow}
            className="mt-3 inline-flex items-center gap-1.5 rounded-lg border border-border/70 px-3 py-1.5 text-sm text-text/80 hover:border-mint/40 hover:text-text"
          >
            <Plus className="h-4 w-4" /> Add another
          </button>
        )}
      </section>

      <section>
        <header className="mb-3">
          <h2 className="font-display text-2xl tracking-tight">Voice notes</h2>
          <p className="mt-1 text-sm text-muted">
            Free text — words you avoid, phrases you use a lot, tone you want hit. The AI sees this every generation.
          </p>
        </header>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="e.g. Never use 'amazing'. Always undersell. Bias toward concrete numbers. Stay grounded — no influencer voice."
          className="min-h-[100px] w-full rounded-xl border border-border/70 bg-bg-deep/60 px-3 py-2 text-sm text-text placeholder:text-muted/60 focus:border-mint/50 focus:outline-none focus:ring-2 focus:ring-mint/20"
        />
      </section>

      {error && (
        <div className="rounded-lg border border-rose-900 bg-rose-950/50 px-4 py-3 text-sm text-rose-300">
          {error}
        </div>
      )}

      <div className="flex items-center gap-3">
        <button
          onClick={save}
          disabled={saving}
          className="inline-flex items-center gap-2 rounded-lg bg-mint px-4 py-2 text-sm font-medium text-black hover:bg-mint/90 disabled:bg-neutral-700 disabled:text-neutral-400"
        >
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : savedTick ? <Check className="h-4 w-4" /> : <Save className="h-4 w-4" />}
          {saving ? "Saving…" : savedTick ? "Saved" : "Save voice context"}
        </button>
        <p className="text-xs text-muted">Stored on your account — survives across browsers.</p>
      </div>
    </div>
  );
}

function VoiceStrengthBadge({ strength, count }: { strength: VoiceStrength; count: number }) {
  const tone =
    strength === "none"   ? "border-neutral-800 bg-neutral-900/60 text-neutral-500" :
    strength === "weak"   ? "border-amber-900/60 bg-amber-950/40 text-amber-300" :
    strength === "good"   ? "border-sky-900/60 bg-sky-950/40 text-sky-300" :
                            "border-emerald-900/60 bg-emerald-950/40 text-emerald-300";
  const label =
    strength === "none"   ? "no signal" :
    strength === "weak"   ? "weak"      :
    strength === "good"   ? "good"      :
                            "strong";
  const tip =
    strength === "none"   ? "Add 1+ real caption to start" :
    strength === "weak"   ? "Add 1–2 more for a solid signal" :
    strength === "good"   ? `Add ${VOICE_SAMPLE_RECOMMENDED - count} more for hard-constraint mode` :
                            "Hard-constraint mode — outputs will mimic your voice";
  return (
    <div className={`rounded-lg border px-3 py-2 text-right ${tone}`}>
      <div className="flex items-center justify-end gap-1.5 text-xs uppercase tracking-wider">
        <Lightbulb className="h-3.5 w-3.5" />
        Voice {label}
      </div>
      <div className="mt-0.5 text-[11px] opacity-80">{tip}</div>
    </div>
  );
}
