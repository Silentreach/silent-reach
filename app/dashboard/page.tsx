"use client";

import { useEffect, useState } from "react";
import Day3Banner from "@/components/Day3Banner";
import Link from "next/link";
import { Sparkles, Clock, BookmarkCheck, TrendingUp, Mic, ArrowRight, Zap, Target } from "lucide-react";
import { getHistory } from "@/lib/storage";
import { getLibrary } from "@/lib/library";
import { computeStats, getAllOutcomes, type Outcome } from "@/lib/outcomes";
import { computeOutcomeStats } from "@/lib/db/outcomes";
import { getVoiceSamples, getBrandKit } from "@/lib/userContext";
import type { HistoryItem } from "@/types";

/* Time-saved estimates per kind. Conservative; the founder said
   '30min brief, 30min pack' as the baseline at the user-evaluation pass. */
const MIN_PER_KIND: Record<HistoryItem["kind"], number> = {
  brief: 30,
  pack:  25,
};
const HOURLY_RATE_DEFAULT = 200; // creator hourly rate; could become a setting later

export default function DashboardPage() {
  const [items, setItems] = useState<HistoryItem[]>([]);
  const [outcomes, setOutcomes] = useState<Outcome[]>([]);
  const [stats, setStats] = useState(computeStats());
  const [librarySize, setLibrarySize] = useState(0);
  const [voiceCount, setVoiceCount] = useState(0);
  const [hasBrand, setHasBrand] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    setItems(getHistory());
    setOutcomes(getAllOutcomes());
    setStats(computeStats());
    // Day 11: also fetch DB-backed stats — prefer those if they have data,
    // fall back to legacy localStorage stats for unmigrated/anon users.
    computeOutcomeStats().then((db) => {
      if (db.total > 0) setStats(db);
    }).catch(() => undefined);
    setLibrarySize(getLibrary().length);
    setVoiceCount(getVoiceSamples().length);
    setHasBrand(!!getBrandKit().name);
    setLoaded(true);
  }, []);

  if (!loaded) return null;

  // This month's items
  const startOfMonth = new Date();
  startOfMonth.setDate(1);
  startOfMonth.setHours(0, 0, 0, 0);
  const monthItems = items.filter((i) => new Date(i.createdAt).getTime() >= startOfMonth.getTime());
  const monthBriefs = monthItems.filter((i) => i.kind === "brief").length;
  const monthPacks  = monthItems.filter((i) => i.kind === "pack").length;
  const minutesSaved = monthBriefs * MIN_PER_KIND.brief + monthPacks * MIN_PER_KIND.pack;
  const hoursSaved = (minutesSaved / 60).toFixed(1);
  const dollarsSaved = Math.round((minutesSaved / 60) * HOURLY_RATE_DEFAULT);

  /* Top performing items (by reach) */
  const topReach = outcomes
    .filter((o) => o.status === "shipped" && typeof o.reach === "number")
    .sort((a, b) => (b.reach || 0) - (a.reach || 0))
    .slice(0, 3);

  /* Onboarding completeness — tells the user what's still unset */
  const onboarding = [
    { done: voiceCount > 0,       label: "Voice samples saved",  href: "/settings/voice",     hint: `${voiceCount}/3 minimum for best results` },
    { done: hasBrand,             label: "Brand kit set",        href: "/settings/brand-kit", hint: "Brand name + colors" },
    { done: items.length > 0,     label: "First brief or pack",  href: "/pre-production",          hint: "Generate your first" },
    { done: librarySize > 0,      label: "First saved hook",     href: "/library",            hint: "Bookmark a hook from any brief" },
    { done: outcomes.length > 0,  label: "First outcome logged", href: "/history",            hint: "Mark a pack as shipped + reach" },
  ];
  const onboardingDone = onboarding.filter((o) => o.done).length;

  return (
    <div className="-mt-10">
      {/* Hero */}
      <section className="hero-glow border-b border-border/60">
        <div className="mx-auto max-w-5xl px-5 pt-20 pb-10 text-center md:pt-24">
          <div className="inline-flex items-center gap-2 rounded-full border border-gold/30 bg-gold/5 px-3 py-1 text-[11px] uppercase tracking-[0.25em] text-gold">
            <Sparkles className="h-3 w-3" />
            Dashboard
          </div>
          <h1 className="mt-5 font-display text-4xl leading-[1.05] tracking-tight md:text-5xl">
            <span className="display-gradient">Your month with Mintflow.</span>
          </h1>
          <p className="mx-auto mt-3 max-w-xl text-balance text-sm text-muted md:text-base">
            What you shipped, what it saved you, and what your hooks actually traveled.
          </p>
        </div>
      </section>

      {/* Day-3 outcome reminder — only renders if there are pending reels */}
      <section className="mx-auto max-w-5xl px-5 pt-6">
        <Day3Banner />
      </section>

      {/* Stats grid */}
      <section className="mx-auto max-w-5xl px-5 py-12">
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <Stat
            icon={Zap}
            label="Generations this month"
            value={String(monthItems.length)}
            sub={`${monthBriefs} briefs · ${monthPacks} packs`}
          />
          <Stat
            icon={Clock}
            label="Time saved"
            value={`${hoursSaved}h`}
            sub={`≈ $${dollarsSaved.toLocaleString()} at $${HOURLY_RATE_DEFAULT}/hr`}
            tone="gold"
          />
          <Stat
            icon={BookmarkCheck}
            label="Library size"
            value={String(librarySize)}
            sub="Hooks + titles saved"
          />
          <Stat
            icon={Target}
            label="Ship rate"
            value={`${Math.round(stats.shipRate * 100)}%`}
            sub={`${stats.shipped} shipped · ${stats.pending} pending`}
          />
        </div>
      </section>

      {/* Reach insights */}
      {topReach.length > 0 && (
        <section className="border-t border-border/60 bg-bg-deep">
          <div className="mx-auto max-w-5xl px-5 py-12">
            <div className="mb-6 flex items-end justify-between">
              <div>
                <div className="text-[11px] uppercase tracking-[0.25em] text-gold/80">
                  What traveled
                </div>
                <h2 className="mt-2 font-display text-3xl tracking-tight md:text-4xl">
                  Your top reach this month.
                </h2>
              </div>
              {stats.meanReach && (
                <div className="text-right">
                  <div className="text-[11px] uppercase tracking-widest text-muted">Mean reach</div>
                  <div className="font-display text-2xl text-gold">{stats.meanReach.toLocaleString()}</div>
                </div>
              )}
            </div>
            <ul className="space-y-2">
              {topReach.map((o, i) => {
                const item = items.find((it) => it.id === o.itemId);
                const title =
                  item?.kind === "pack" ? item.meta.title :
                  item?.kind === "brief" ? item.input.concept :
                  "(deleted from history)";
                return (
                  <li key={o.itemId} className="flex items-center gap-4 rounded-xl border border-border bg-surface p-4">
                    <span className="font-display text-2xl text-gold/50 tabular-nums">{String(i + 1).padStart(2, "0")}</span>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-medium text-text">{title}</div>
                      <div className="text-xs text-muted">{new Date(o.updatedAt).toLocaleDateString()}</div>
                    </div>
                    <div className="text-right">
                      <div className="font-display text-xl text-gold tabular-nums">{(o.reach || 0).toLocaleString()}</div>
                      <div className="text-[10px] uppercase tracking-widest text-muted">24h reach</div>
                    </div>
                  </li>
                );
              })}
            </ul>
            {stats.withReach < 5 && (
              <p className="mt-4 text-xs text-muted">
                After 5+ outcomes with reach, Mintflow can start surfacing patterns — which hook types travel, what time of day ships best, which thumbnail presets land. Currently {stats.withReach}/5.
              </p>
            )}
          </div>
        </section>
      )}

      {/* Onboarding checklist */}
      <section className="border-t border-border/60">
        <div className="mx-auto max-w-3xl px-5 py-12">
          <div className="mb-6">
            <div className="text-[11px] uppercase tracking-[0.25em] text-gold/80">
              Get the most out of Mintflow
            </div>
            <h2 className="mt-2 font-display text-2xl tracking-tight md:text-3xl">
              {onboardingDone}/{onboarding.length} set up
            </h2>
            {onboardingDone < onboarding.length && (
              <p className="mt-2 text-sm text-muted">
                Each step compounds. Voice + brand kit alone make every output sound 10× more like you.
              </p>
            )}
          </div>
          <ul className="space-y-2">
            {onboarding.map((item) => (
              <li key={item.label}>
                <Link
                  href={item.href}
                  className={[
                    "flex items-center gap-3 rounded-xl border p-4 transition",
                    item.done
                      ? "border-gold/30 bg-gold/5 hover:border-gold/60"
                      : "border-border bg-surface hover:border-gold/40",
                  ].join(" ")}
                >
                  <div className={[
                    "grid h-7 w-7 shrink-0 place-items-center rounded-full border-2",
                    item.done ? "border-gold bg-gold text-black" : "border-border-strong text-transparent",
                  ].join(" ")}>
                    <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="3"><path d="M3 8.5l3.5 3.5L13 5"/></svg>
                  </div>
                  <div className="flex-1">
                    <div className={item.done ? "text-sm text-text" : "text-sm font-medium text-text"}>
                      {item.label}
                    </div>
                    <div className="text-xs text-muted">{item.hint}</div>
                  </div>
                  {!item.done && (
                    <ArrowRight className="h-4 w-4 text-gold" />
                  )}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* Footer reminder if no outcomes yet */}
      {outcomes.length === 0 && items.length > 0 && (
        <section className="border-t border-border/60 bg-bg-deep">
          <div className="mx-auto max-w-3xl px-5 py-12 text-center">
            <TrendingUp className="mx-auto h-6 w-6 text-gold/60" />
            <h3 className="mt-3 font-display text-2xl tracking-tight">Start logging outcomes.</h3>
            <p className="mx-auto mt-2 max-w-md text-sm text-muted">
              Open <Link href="/history" className="text-gold hover:text-gold-light">History</Link> and tap &ldquo;Yes — paste reach&rdquo; on packs you&apos;ve shipped. After 5–10 entries this dashboard becomes a reach intelligence tool, not just a counter.
            </p>
          </div>
        </section>
      )}
    </div>
  );
}

function Stat({ icon: Icon, label, value, sub, tone }: {
  icon: typeof Sparkles;
  label: string;
  value: string;
  sub?: string;
  tone?: "gold";
}) {
  return (
    <div className={[
      "rounded-xl border p-4",
      tone === "gold" ? "border-gold/40 bg-gold/5" : "border-border bg-surface",
    ].join(" ")}>
      <div className="flex items-start justify-between">
        <div className="text-[11px] uppercase tracking-widest text-muted">{label}</div>
        <Icon className={`h-3.5 w-3.5 ${tone === "gold" ? "text-gold" : "text-gold/70"}`} />
      </div>
      <div className={`mt-2 font-display text-3xl tracking-tight tabular-nums ${tone === "gold" ? "text-gold" : "text-text"}`}>
        {value}
      </div>
      {sub && <div className="mt-1 text-[11px] text-muted">{sub}</div>}
    </div>
  );
}
