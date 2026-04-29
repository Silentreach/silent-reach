"use client";

/* Reel outcomes page — every rendered reel with an inline form to capture
   how it performed. The Day-3 capture loop's destination. */

import { useEffect, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { Loader2, Check, BarChart3 } from "lucide-react";
import Link from "next/link";
import { listReels, type ReelRow } from "@/lib/db/reels";
import { setReelOutcome, type OutcomeStatus } from "@/lib/db/outcomes";

function OutcomesBody() {
  const sp = useSearchParams();
  const focusId = sp.get("focus");
  const [reels, setReels] = useState<ReelRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    listReels(50).then((r) => { setReels(r); setLoading(false); }).catch(() => setLoading(false));
  }, []);

  // Scroll the focused reel into view once data lands
  useEffect(() => {
    if (!focusId || loading) return;
    const el = document.getElementById(`reel-${focusId}`);
    if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [focusId, loading]);

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-muted">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading your reels…
      </div>
    );
  }

  if (reels.length === 0) {
    return (
      <div className="rounded-2xl border border-border bg-surface p-8 text-center">
        <BarChart3 className="mx-auto mb-3 h-6 w-6 text-muted" />
        <h2 className="font-display text-xl text-text">No reels yet</h2>
        <p className="mt-2 text-sm text-muted">
          Render your first reel and come back here in 3 days to log how it performed.
        </p>
        <Link
          href="/reel-multiplier"
          className="mt-5 inline-flex items-center gap-1.5 rounded-full bg-gold px-4 py-2 text-sm font-medium text-black hover:bg-gold-light"
        >
          Open Reel Multiplier
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {reels.map((r) => (
        <OutcomeRow key={r.id} reel={r} highlighted={focusId === r.id} onUpdate={(updated) => {
          setReels((prev) => prev.map((x) => x.id === updated.id ? updated : x));
        }} />
      ))}
    </div>
  );
}

interface OutcomeRowProps {
  reel: ReelRow;
  highlighted: boolean;
  onUpdate: (r: ReelRow) => void;
}

function OutcomeRow({ reel, highlighted, onUpdate }: OutcomeRowProps) {
  const [status, setStatus] = useState<OutcomeStatus>(
    (reel.outcome_status as OutcomeStatus) || "pending"
  );
  const [reach, setReach] = useState<string>(reel.outcome_reach?.toString() || "");
  const [notes, setNotes] = useState<string>(reel.outcome_notes || "");
  const [saving, setSaving] = useState(false);
  const [savedTick, setSavedTick] = useState(false);

  const dirty =
    status !== (reel.outcome_status || "pending") ||
    (reach || "") !== (reel.outcome_reach?.toString() || "") ||
    (notes || "") !== (reel.outcome_notes || "");

  async function save() {
    setSaving(true);
    const ok = await setReelOutcome({
      reelId: reel.id,
      status,
      reach: reach ? Number(reach) : undefined,
      notes: notes || undefined,
    });
    if (ok) {
      setSavedTick(true);
      onUpdate({
        ...reel,
        outcome_status: status,
        outcome_reach: reach ? Number(reach) : null,
        outcome_notes: notes || null,
        outcome_updated_at: new Date().toISOString(),
      });
      setTimeout(() => setSavedTick(false), 1800);
    }
    setSaving(false);
  }

  const ago = Math.floor((Date.now() - new Date(reel.created_at).getTime()) / (24 * 60 * 60 * 1000));

  return (
    <div
      id={`reel-${reel.id}`}
      className={[
        "rounded-xl border p-4 transition",
        highlighted ? "border-emerald-500/60 bg-emerald-950/20 ring-2 ring-emerald-500/30" : "border-border bg-surface",
      ].join(" ")}
    >
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="min-w-0 flex-1">
          <div className="text-sm text-text font-medium truncate">{reel.title || "Untitled reel"}</div>
          <div className="text-[11px] text-muted mt-0.5">
            Rendered {ago === 0 ? "today" : ago === 1 ? "yesterday" : `${ago} days ago`}
            {reel.duration_sec ? ` · ${Math.round(reel.duration_sec)}s` : ""}
          </div>
        </div>
        {savedTick && (
          <span className="inline-flex items-center gap-1 text-xs text-emerald-400">
            <Check className="h-3.5 w-3.5" /> Saved
          </span>
        )}
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        {/* Status */}
        <div>
          <label className="text-[11px] uppercase tracking-widest text-muted">Status</label>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {(["pending", "shipped", "skipped"] as OutcomeStatus[]).map((s) => (
              <button
                key={s}
                onClick={() => setStatus(s)}
                className={[
                  "rounded-full px-3 py-1 text-xs transition",
                  status === s
                    ? s === "shipped" ? "bg-emerald-500 text-black"
                    : s === "skipped" ? "bg-neutral-600 text-white"
                    : "bg-amber-700 text-white"
                    : "border border-border bg-bg text-muted hover:text-text",
                ].join(" ")}
              >
                {s === "pending" ? "Pending" : s === "shipped" ? "Shipped" : "Skipped"}
              </button>
            ))}
          </div>
        </div>

        {/* Reach */}
        <div>
          <label htmlFor={`reach-${reel.id}`} className="text-[11px] uppercase tracking-widest text-muted">
            24h reach (non-followers)
          </label>
          <input
            id={`reach-${reel.id}`}
            type="number"
            min="0"
            value={reach}
            onChange={(e) => setReach(e.target.value)}
            placeholder="e.g. 12000"
            disabled={status !== "shipped"}
            className="mt-1.5 w-full rounded-md border border-border bg-bg-deep px-2 py-1.5 text-sm text-text placeholder:text-muted/60 focus:border-emerald-500 focus:outline-none disabled:opacity-40"
          />
        </div>

        {/* Notes */}
        <div>
          <label htmlFor={`notes-${reel.id}`} className="text-[11px] uppercase tracking-widest text-muted">
            Notes <span className="text-muted/60">(optional)</span>
          </label>
          <input
            id={`notes-${reel.id}`}
            type="text"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="What worked / didn't"
            className="mt-1.5 w-full rounded-md border border-border bg-bg-deep px-2 py-1.5 text-sm text-text placeholder:text-muted/60 focus:border-emerald-500 focus:outline-none"
          />
        </div>
      </div>

      {dirty && (
        <div className="mt-3 flex justify-end">
          <button
            onClick={save}
            disabled={saving}
            className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500 px-3 py-1.5 text-xs font-medium text-black hover:bg-emerald-400 disabled:opacity-60"
          >
            {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />}
            {saving ? "Saving…" : "Save"}
          </button>
        </div>
      )}
    </div>
  );
}

export default function OutcomesPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl tracking-tight text-text">How are your reels performing?</h1>
        <p className="mt-2 text-sm text-muted max-w-2xl">
          Tell Mintflow what shipped and how each reel did. Over time this becomes the data that makes your AI generations smarter — what hooks land, what cuts convert, what music actually moves a Victoria audience.
        </p>
      </div>
      <Suspense fallback={<div className="text-muted text-sm">Loading…</div>}>
        <OutcomesBody />
      </Suspense>
    </div>
  );
}
