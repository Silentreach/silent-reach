"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Check, Clapperboard, RotateCcw, Sparkles, Plus, Trash2 } from "lucide-react";

interface Shot {
  id: string;
  timestamp: string;
  shot: string;
  retentionNote?: string;
  done: boolean;
}

const STATE_KEY = "mintflow_checklist_state";

/* The page accepts a brief's shotList via the URL hash:
   /production/checklist#data=<base64url(JSON.stringify({title, shots:[{timestamp, shot, retentionNote}]}))>
   This keeps it 100% client-side — no backend, works offline on a phone. */

function decodeHash(): { title?: string; shots?: Omit<Shot, "id" | "done">[] } | null {
  if (typeof window === "undefined") return null;
  const h = window.location.hash;
  const m = h.match(/data=([A-Za-z0-9_\-]+)/);
  if (!m) return null;
  try {
    // base64url → base64
    let b64 = m[1].replace(/-/g, "+").replace(/_/g, "/");
    while (b64.length % 4) b64 += "=";
    const json = decodeURIComponent(escape(atob(b64)));
    return JSON.parse(json);
  } catch {
    return null;
  }
}

function loadState(): { title: string; shots: Shot[] } | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(STATE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}
function saveState(s: { title: string; shots: Shot[] }) {
  if (typeof window === "undefined") return;
  localStorage.setItem(STATE_KEY, JSON.stringify(s));
}

export default function ChecklistPage() {
  const [title, setTitle] = useState<string>("Today's shoot");
  const [shots, setShots] = useState<Shot[]>([]);
  const [loaded, setLoaded] = useState(false);

  // Hydrate: prefer hash data (fresh handoff from a brief) over saved state
  useEffect(() => {
    const fromHash = decodeHash();
    if (fromHash?.shots && fromHash.shots.length > 0) {
      const next = {
        title: fromHash.title || "Today's shoot",
        shots: fromHash.shots.map((s, i) => ({
          id: `${i}-${Math.random().toString(36).slice(2, 8)}`,
          timestamp: s.timestamp,
          shot: s.shot,
          retentionNote: s.retentionNote,
          done: false,
        })),
      };
      setTitle(next.title);
      setShots(next.shots);
      saveState(next);
    } else {
      const saved = loadState();
      if (saved) { setTitle(saved.title); setShots(saved.shots); }
    }
    setLoaded(true);
  }, []);

  // Persist on every change
  useEffect(() => {
    if (loaded) saveState({ title, shots });
  }, [title, shots, loaded]);

  const toggle = (id: string) => setShots((prev) => prev.map((s) => s.id === id ? { ...s, done: !s.done } : s));
  const remove = (id: string) => setShots((prev) => prev.filter((s) => s.id !== id));
  const reset  = () => {
    if (!confirm("Reset all check marks? Shot list stays.")) return;
    setShots((prev) => prev.map((s) => ({ ...s, done: false })));
  };
  const addShot = () => {
    setShots((prev) => [...prev, {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      timestamp: "—",
      shot: "",
      done: false,
    }]);
  };
  const editShot = (id: string, key: "timestamp" | "shot", v: string) => {
    setShots((prev) => prev.map((s) => s.id === id ? { ...s, [key]: v } : s));
  };

  const done = shots.filter((s) => s.done).length;
  const pct = useMemo(() => shots.length === 0 ? 0 : Math.round(100 * done / shots.length), [done, shots.length]);

  if (!loaded) return null;

  return (
    <div className="-mt-10 pb-20">
      {/* Compact mobile-first header (designed to be useful on a phone on set) */}
      <header className="sticky top-[57px] z-20 -mx-5 border-b border-border/60 bg-bg/95 px-5 py-4 backdrop-blur-xl">
        <Link href="/production" className="inline-flex items-center gap-1 text-xs text-muted hover:text-text">
          <ArrowLeft className="h-3 w-3" /> Production tools
        </Link>
        <div className="mt-2 flex items-baseline justify-between gap-3">
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="!border-0 !bg-transparent !p-0 font-display text-2xl tracking-tight !shadow-none"
            style={{ outline: "none" }}
          />
          <div className="shrink-0 text-sm tabular-nums text-muted">
            {done}/{shots.length}
          </div>
        </div>
        {/* Progress bar */}
        <div className="mt-3 h-1 overflow-hidden rounded-full bg-border">
          <div
            className="h-full bg-gold transition-[width] duration-300"
            style={{ width: `${pct}%` }}
          />
        </div>
      </header>

      <div className="mx-auto max-w-2xl pt-6">
        {shots.length === 0 ? (
          <EmptyState />
        ) : (
          <ul className="space-y-2">
            {shots.map((s, i) => (
              <li
                key={s.id}
                className={[
                  "rounded-xl border bg-surface p-4 transition",
                  s.done ? "border-gold/30 bg-gold/5 opacity-70" : "border-border",
                ].join(" ")}
              >
                <div className="flex items-start gap-3">
                  <button
                    onClick={() => toggle(s.id)}
                    className={[
                      "mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-full border-2 transition",
                      s.done
                        ? "border-gold bg-gold text-black"
                        : "border-border-strong text-transparent hover:border-gold/60",
                    ].join(" ")}
                    aria-label={s.done ? "Mark as not done" : "Mark as done"}
                  >
                    <Check className="h-3.5 w-3.5" strokeWidth={3} />
                  </button>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <input
                        value={s.timestamp}
                        onChange={(e) => editShot(s.id, "timestamp", e.target.value)}
                        className="!w-20 !border-0 !bg-transparent !p-0 font-mono text-xs text-gold !shadow-none"
                        style={{ outline: "none" }}
                      />
                      <span className="text-[10px] uppercase tracking-widest text-muted">Shot {String(i + 1).padStart(2, "0")}</span>
                    </div>
                    <input
                      value={s.shot}
                      onChange={(e) => editShot(s.id, "shot", e.target.value)}
                      placeholder="Describe the shot…"
                      className={[
                        "!mt-1 !w-full !border-0 !bg-transparent !p-0 text-base !shadow-none",
                        s.done ? "line-through text-muted" : "text-text",
                      ].join(" ")}
                      style={{ outline: "none" }}
                    />
                    {s.retentionNote && (
                      <div className="mt-1 text-xs text-muted">↳ {s.retentionNote}</div>
                    )}
                  </div>
                  <button
                    onClick={() => remove(s.id)}
                    className="rounded-md p-1.5 text-muted/60 hover:text-text"
                    aria-label="Remove"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}

        {/* Footer actions */}
        <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-border/60 pt-6">
          <button
            onClick={addShot}
            className="inline-flex items-center gap-1.5 rounded-full border border-border-strong px-3 py-1.5 text-sm text-text transition hover:border-gold/60 hover:text-gold"
          >
            <Plus className="h-3.5 w-3.5" /> Add a shot
          </button>
          {shots.length > 0 && (
            <button
              onClick={reset}
              className="inline-flex items-center gap-1.5 rounded-full text-sm text-muted hover:text-text"
            >
              <RotateCcw className="h-3.5 w-3.5" /> Reset checks
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="rounded-2xl border border-border bg-surface p-8 text-center">
      <Clapperboard className="mx-auto h-6 w-6 text-gold/60" />
      <h2 className="mt-3 font-display text-xl tracking-tight">No shot list loaded</h2>
      <p className="mx-auto mt-2 max-w-md text-sm text-muted">
        Generate a Pre-Shoot Brief, then click <span className="text-gold">&ldquo;Open as on-set checklist&rdquo;</span> on the result.
        Your shot list lands here, tappable, with a progress bar — designed for the phone in your pocket while you film.
      </p>
      <div className="mt-5 inline-flex items-center gap-2">
        <Link href="/pre-production" className="inline-flex items-center gap-1.5 rounded-full bg-gold px-4 py-2 text-sm font-semibold text-black transition hover:bg-gold-light">
          <Sparkles className="h-3.5 w-3.5" /> Generate a brief
        </Link>
      </div>
    </div>
  );
}
