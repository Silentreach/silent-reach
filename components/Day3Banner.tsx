"use client";

/* Banner that surfaces reels rendered ≥3 days ago with outcome_status='pending'.
   Mounts in the dashboard. Lets the user mark how each performed inline.

   The "Day 3 capture loop" is the thing that turns Mintflow from an AI tool
   into a data moat — every reel a realtor ships becomes training data for
   what works in BC. Without it, voice-training stays generic. */

import { useEffect, useState } from "react";
import { Bell, X, Check } from "lucide-react";
import Link from "next/link";
import { listPendingDay3Reels, type ReelRow } from "@/lib/db/reels";
import { setReelOutcome } from "@/lib/db/outcomes";

const DISMISS_KEY = "mintflow_day3_dismissed_at";
const REDISMISS_AFTER_MS = 24 * 60 * 60 * 1000;

export default function Day3Banner() {
  const [reels, setReels] = useState<ReelRow[]>([]);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const last = localStorage.getItem(DISMISS_KEY);
      if (last && Date.now() - parseInt(last, 10) < REDISMISS_AFTER_MS) {
        setDismissed(true);
        return;
      }
    }
    listPendingDay3Reels().then(setReels).catch(() => undefined);
  }, []);

  if (dismissed || reels.length === 0) return null;

  async function quickMark(reelId: string, status: "shipped" | "skipped") {
    setBusyId(reelId);
    const ok = await setReelOutcome({ reelId, status });
    if (ok) {
      setReels((r) => r.filter((x) => x.id !== reelId));
    }
    setBusyId(null);
  }

  function dismiss() {
    if (typeof window !== "undefined") {
      localStorage.setItem(DISMISS_KEY, String(Date.now()));
    }
    setDismissed(true);
  }

  // Show the FIRST pending reel as the focal one; the rest are listed compactly.
  const [focus, ...rest] = reels;
  const daysOld = Math.floor((Date.now() - new Date(focus.created_at).getTime()) / (24 * 60 * 60 * 1000));

  return (
    <div className="rounded-2xl border border-emerald-700/40 bg-emerald-950/20 p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3 flex-1 min-w-0">
          <Bell className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" />
          <div className="flex-1 min-w-0">
            <div className="text-[11px] uppercase tracking-widest text-emerald-300">
              Day-{daysOld} check-in
            </div>
            <div className="mt-1 text-sm text-text">
              How did <span className="font-medium">&ldquo;{focus.title || "your reel"}&rdquo;</span> perform?
            </div>
            <p className="mt-1 text-xs text-muted">
              Telling Mintflow what worked makes the next reel sharper. Takes 5 seconds.
            </p>
          </div>
        </div>
        <button onClick={dismiss} className="text-muted hover:text-text" aria-label="Dismiss for today">
          <X className="h-4 w-4" />
        </button>
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        <Link
          href={`/distribution/analytics?focus=${focus.id}`}
          className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500 px-3 py-1.5 text-xs font-medium text-black hover:bg-emerald-400"
        >
          Tell Mintflow how it did
        </Link>
        <button
          onClick={() => quickMark(focus.id, "shipped")}
          disabled={busyId === focus.id}
          className="inline-flex items-center gap-1.5 rounded-full border border-emerald-700/60 bg-emerald-950/40 px-3 py-1.5 text-xs text-emerald-200 hover:bg-emerald-950/60"
        >
          <Check className="h-3 w-3" /> Shipped (skip details)
        </button>
        <button
          onClick={() => quickMark(focus.id, "skipped")}
          disabled={busyId === focus.id}
          className="text-xs text-muted hover:text-text"
        >
          Didn&apos;t ship this one
        </button>
      </div>
      {rest.length > 0 && (
        <div className="mt-3 text-[11px] text-muted">
          + {rest.length} other reel{rest.length === 1 ? "" : "s"} waiting for outcome data.{" "}
          <Link href="/distribution/analytics" className="text-emerald-300 hover:underline">View all →</Link>
        </div>
      )}
    </div>
  );
}
