"use client";

import { useEffect, useState } from "react";
import { Check, Clock, X, TrendingUp, Edit2 } from "lucide-react";
import { getOutcome, setOutcome, type OutcomeStatus } from "@/lib/outcomes";

interface Props {
  itemId: string;
  itemKind: "brief" | "pack";
  /** "compact" mode is for the history list; default is the larger inline footer */
  variant?: "default" | "compact";
}

export default function OutcomeCapture({ itemId, itemKind, variant = "default" }: Props) {
  const [status, setStatus] = useState<OutcomeStatus>("pending");
  const [reach, setReach]   = useState<string>("");
  const [editing, setEditing] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const o = getOutcome(itemId);
    if (o) {
      setStatus(o.status);
      if (typeof o.reach === "number") setReach(String(o.reach));
    }
    setLoaded(true);
  }, [itemId]);

  if (!loaded) return null;

  const persist = (next: OutcomeStatus, nextReach?: number) => {
    setOutcome({
      itemId,
      itemKind,
      status: next,
      reach: nextReach,
    });
    setStatus(next);
  };

  const submitReach = () => {
    const n = parseInt(reach.replace(/[^0-9]/g, ""), 10);
    if (Number.isFinite(n) && n > 0) {
      persist("shipped", n);
      setEditing(false);
    }
  };

  const compact = variant === "compact";

  /* Already shipped + has reach — show the proud line */
  if (status === "shipped" && !editing) {
    const o = getOutcome(itemId);
    return (
      <div className={[
        "flex items-center gap-2 rounded-full border border-gold/40 bg-gold/5 px-3 py-1.5",
        compact ? "text-xs" : "text-sm",
      ].join(" ")}>
        <TrendingUp className="h-3.5 w-3.5 text-gold" />
        <span className="text-text/90">
          Shipped
          {typeof o?.reach === "number" && (
            <span className="ml-1.5 text-gold">· {o.reach.toLocaleString()} reach in 24h</span>
          )}
        </span>
        <button
          onClick={() => setEditing(true)}
          className="ml-1 text-muted hover:text-text"
          aria-label="Edit"
        >
          <Edit2 className="h-3 w-3" />
        </button>
      </div>
    );
  }

  /* Skipped */
  if (status === "skipped") {
    return (
      <div className={[
        "flex items-center gap-2 rounded-full border border-border px-3 py-1.5",
        compact ? "text-xs" : "text-sm",
      ].join(" ")}>
        <X className="h-3.5 w-3.5 text-muted" />
        <span className="text-muted">Skipped</span>
        <button
          onClick={() => setStatus("pending")}
          className="ml-1 text-muted hover:text-text"
        >
          Undo
        </button>
      </div>
    );
  }

  /* Editing reach (or first-time submit) */
  if (editing || (status === "shipped")) {
    return (
      <div className={[
        "flex items-center gap-2 rounded-full border border-gold/40 bg-gold/5 px-3 py-1.5",
        compact ? "text-xs" : "text-sm",
      ].join(" ")}>
        <TrendingUp className="h-3.5 w-3.5 text-gold" />
        <span className="text-muted">24h reach:</span>
        <input
          type="text"
          inputMode="numeric"
          value={reach}
          onChange={(e) => setReach(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && submitReach()}
          placeholder="e.g. 12400"
          className="!w-24 !border-0 !bg-transparent !p-0 !text-sm font-mono text-text !shadow-none"
          style={{ outline: "none" }}
          autoFocus
        />
        <button
          onClick={submitReach}
          disabled={!reach}
          className="rounded-full bg-gold px-2.5 py-0.5 text-xs font-semibold text-black transition hover:bg-gold-light disabled:opacity-50"
        >
          Save
        </button>
        <button
          onClick={() => { setEditing(false); if (status !== "shipped") setReach(""); }}
          className="text-muted hover:text-text"
          aria-label="Cancel"
        >
          <X className="h-3 w-3" />
        </button>
      </div>
    );
  }

  /* Default: pending — present the question */
  return (
    <div className={[
      "rounded-2xl border border-border bg-surface",
      compact ? "px-3 py-2" : "p-4",
    ].join(" ")}>
      <div className="flex flex-wrap items-center gap-2">
        <Clock className="h-4 w-4 text-gold/70" />
        <span className={compact ? "text-xs text-muted" : "text-sm text-text/90"}>
          {itemKind === "pack" ? "Did you ship this pack?" : "Did you film this brief?"}
        </span>
        <div className="ml-auto flex flex-wrap gap-1.5">
          {itemKind === "pack" && (
            <button
              onClick={() => setEditing(true)}
              className="inline-flex items-center gap-1 rounded-full bg-gold px-3 py-1 text-xs font-semibold text-black transition hover:bg-gold-light"
            >
              <Check className="h-3 w-3" />
              Yes — paste reach
            </button>
          )}
          {itemKind === "brief" && (
            <button
              onClick={() => persist("shipped")}
              className="inline-flex items-center gap-1 rounded-full bg-gold px-3 py-1 text-xs font-semibold text-black transition hover:bg-gold-light"
            >
              <Check className="h-3 w-3" />
              Yes
            </button>
          )}
          <button
            onClick={() => persist("skipped")}
            className="inline-flex items-center gap-1 rounded-full border border-border-strong px-3 py-1 text-xs text-muted transition hover:border-gold/60 hover:text-text"
          >
            Skipped
          </button>
        </div>
      </div>
      {!compact && itemKind === "pack" && (
        <p className="mt-2 text-[11px] leading-relaxed text-muted">
          Logging shipped packs + their 24h non-follower reach builds your private &ldquo;what hooks travel&rdquo; dataset. After 30 packs Mintflow can tell you which patterns outperform yours.
        </p>
      )}
    </div>
  );
}
