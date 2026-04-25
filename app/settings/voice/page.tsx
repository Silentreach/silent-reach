"use client";

import { useEffect, useState } from "react";
import { Plus, Trash2, Save, Check, Lightbulb } from "lucide-react";
import {
  getVoiceSamples, setVoiceSamples,
  getVoiceNotes,   setVoiceNotes,
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

  useEffect(() => {
    const s = getVoiceSamples();
    setSamples(s.length > 0 ? s : [""]);
    setNotes(getVoiceNotes());
    setLoaded(true);
  }, []);

  const update = (i: number, v: string) => {
    setSamples((prev) => prev.map((s, idx) => (idx === i ? v : s)));
  };
  const addRow = () => setSamples((prev) => (prev.length < 8 ? [...prev, ""] : prev));
  const removeRow = (i: number) =>
    setSamples((prev) => (prev.length > 1 ? prev.filter((_, idx) => idx !== i) : prev));

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
          <h2 className="font-display text-2xl tracking-tight">Your voice samples</h2>
          <p className="mt-1 text-sm text-muted">
            Paste 3–8 captions or hooks you wrote yourself. Real ones, not aspirational. Mintflow uses
            these as the ground truth for how you actually write.
          </p>
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

          {samples.length < 8 && (
            <button
              onClick={addRow}
              className="inline-flex items-center gap-1.5 rounded-full border border-border-strong px-3 py-1.5 text-xs text-muted transition hover:border-gold/60 hover:text-gold"
            >
              <Plus className="h-3 w-3" /> Add another sample
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
