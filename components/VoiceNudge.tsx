"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Mic, ArrowRight, X } from "lucide-react";
import { getVoiceSamples } from "@/lib/userContext";

const DISMISS_KEY = "mintflow_voice_nudge_dismissed";

export default function VoiceNudge() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const dismissed = localStorage.getItem(DISMISS_KEY) === "1";
    if (dismissed) return;
    if (getVoiceSamples().length === 0) setShow(true);
  }, []);

  if (!show) return null;

  const dismiss = () => {
    localStorage.setItem(DISMISS_KEY, "1");
    setShow(false);
  };

  return (
    <div className="relative rounded-2xl border border-gold/30 bg-gold/5 p-5">
      <button
        onClick={dismiss}
        aria-label="Dismiss"
        className="absolute right-3 top-3 rounded-md p-1 text-muted/70 transition hover:text-text"
      >
        <X className="h-3.5 w-3.5" />
      </button>
      <div className="flex items-start gap-3 pr-6">
        <Mic className="mt-0.5 h-4 w-4 shrink-0 text-gold" />
        <div className="flex-1">
          <div className="text-[11px] uppercase tracking-widest text-gold/80">
            Make the output sound like you
          </div>
          <div className="mt-1 font-display text-lg tracking-tight text-text">
            Mintflow sounds 10× more like you with 3 voice samples.
          </div>
          <p className="mt-2 text-sm text-muted">
            Paste 3 of your real captions or hooks once. Every brief from then on uses your
            vocabulary, rhythm, and emoji policy. Two-minute setup. Biggest single output-quality gain.
          </p>
          <div className="mt-3">
            <Link
              href="/settings/voice"
              className="inline-flex items-center gap-1.5 rounded-full bg-gold px-4 py-2 text-sm font-semibold text-black transition hover:bg-gold-light"
            >
              Set up your voice
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
