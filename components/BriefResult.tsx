"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  Bookmark,
  BookmarkCheck,
  ChevronDown,
  ChevronRight,
  ChevronLeft,
  Image as ImageIcon,
  Camera,
  Sun,
  Mic,
  AlertTriangle,
  CheckCircle2,
  Shuffle,
  Star,
  ListChecks,
  Send,
  MapPin,
} from "lucide-react";
import CopyButton from "./CopyButton";
import { isSaved, toggleSaved } from "@/lib/library";
import OutcomeCapture from "./OutcomeCapture";
import type { PreShootOutput, Hook, ShotListItem } from "@/types";

type Tab = "plan" | "shoot" | "post";
type HookType = Hook["type"];

const HOOK_PRIORITY: HookType[] = [
  "curiosity",
  "contrarian",
  "stakes",
  "voyeur",
  "transformation",
];

interface BriefResultProps {
  output: PreShootOutput;
  itemId?: string;
  /** Subtitle line shown next to the breadcrumb — e.g. "414 Cook St · Just Listed · Move-Up Family" */
  subtitle?: string;
}

export default function BriefResult({ output, itemId, subtitle }: BriefResultProps) {
  // Tab state, persisted to URL hash so tabs are shareable / deep-linkable.
  const [tab, setTab] = useState<Tab>("plan");
  useEffect(() => {
    if (typeof window === "undefined") return;
    const m = window.location.hash.match(/tab=(plan|shoot|post)/);
    if (m) setTab(m[1] as Tab);
  }, []);
  useEffect(() => {
    if (typeof window === "undefined") return;
    const next = `#tab=${tab}`;
    if (window.location.hash !== next) {
      window.history.replaceState(null, "", `${window.location.pathname}${window.location.search}${next}`);
    }
  }, [tab]);

  // Hook selection — pick the strongest available type as hero.
  const orderedHooks = useMemo(() => orderHooks(output.hooks), [output.hooks]);
  const [heroIdx, setHeroIdx] = useState(0);
  const heroHook = orderedHooks[heroIdx];
  const altHooks = orderedHooks.filter((_, i) => i !== heroIdx);

  // Identify the hero shot — the one whose timestamp window contains the thumbnail moment.
  const heroShotIdx = useMemo(() => {
    return findHeroShotIndex(output.shotList, output.thumbnailDirection?.momentTimestamp);
  }, [output.shotList, output.thumbnailDirection]);

  // Plain-text "Copy all" payload — keeps the existing share affordance working.
  const allText = useMemo(() => buildPlainTextPayload(output, heroHook), [output, heroHook]);

  return (
    <div className="space-y-5">
      {/* Sticky header */}
      <div className="sticky top-[57px] z-20 -mx-5 border-b border-border/60 bg-bg/85 px-5 py-3 backdrop-blur-xl md:top-[59px]">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="text-[10px] font-semibold uppercase tracking-[0.22em] text-gold/70">Your brief</div>
            {subtitle && (
              <div className="mt-0.5 truncate text-[12px] text-muted">{subtitle}</div>
            )}
          </div>
          <CopyButton text={allText} label="Copy all" />
        </div>

        {/* Tab bar */}
        <div className="mt-3 flex items-center gap-1 text-[12px]">
          <TabButton active={tab === "plan"} onClick={() => setTab("plan")} label="Plan" />
          <TabButton active={tab === "shoot"} onClick={() => setTab("shoot")} label="Shoot" />
          <TabButton active={tab === "post"} onClick={() => setTab("post")} label="Post" />
        </div>
      </div>

      {/* Tab content */}
      {tab === "plan" && (
        <PlanTab
          output={output}
          heroHook={heroHook}
          altHooks={altHooks}
          heroShotIdx={heroShotIdx}
          onPickHook={(idx) => setHeroIdx(idx)}
          orderedHooks={orderedHooks}
          onGoShoot={() => setTab("shoot")}
        />
      )}
      {tab === "shoot" && (
        <ShootTab
          output={output}
          heroShotIdx={heroShotIdx}
          subtitle={subtitle}
          onDoneShooting={() => setTab("post")}
        />
      )}
      {tab === "post" && (
        <PostTab output={output} heroHook={heroHook} altHooks={altHooks} />
      )}

      {/* Outcome capture — only shows when itemId set, kept untouched */}
      {itemId && (
        <div className="pt-2">
          <OutcomeCapture itemId={itemId} itemKind="brief" />
        </div>
      )}
    </div>
  );
}

/* ============ TAB CONTENT ============ */

function PlanTab({
  output,
  heroHook,
  altHooks,
  heroShotIdx,
  orderedHooks,
  onPickHook,
  onGoShoot,
}: {
  output: PreShootOutput;
  heroHook: Hook;
  altHooks: Hook[];
  heroShotIdx: number;
  orderedHooks: Hook[];
  onPickHook: (idx: number) => void;
  onGoShoot: () => void;
}) {
  const [altsOpen, setAltsOpen] = useState(false);

  return (
    <div className="space-y-5 pb-24 md:pb-5">
      {/* Hero hook + thumbnail (desktop side-by-side, mobile stacked) */}
      <div className="grid gap-5 md:grid-cols-[1.5fr_1fr]">
        <HeroHook
          hook={heroHook}
          altsCount={altHooks.length}
          altsOpen={altsOpen}
          onToggleAlts={() => setAltsOpen((v) => !v)}
        />
        <ThumbnailCard
          direction={output.thumbnailDirection}
          startShoot={onGoShoot}
        />
      </div>

      {/* Alternate hooks reveal */}
      {altsOpen && (
        <div className="rounded-xl border border-border/70 bg-bg-deep/30 p-4">
          <div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.2em] text-muted/80">Other angles</div>
          <div className="grid gap-2">
            {orderedHooks.map((h, i) => {
              const isHero = h === heroHook;
              return (
                <button
                  key={i}
                  type="button"
                  onClick={() => {
                    onPickHook(i);
                  }}
                  disabled={isHero}
                  className={[
                    "group flex items-start gap-3 rounded-lg border px-3 py-2 text-left transition",
                    isHero
                      ? "border-gold/40 bg-gold/5 cursor-default"
                      : "border-border/60 bg-bg hover:border-gold/40 hover:bg-bg-deep/40",
                  ].join(" ")}
                >
                  <span className={`text-[10px] font-semibold uppercase tracking-[0.2em] ${isHero ? "text-gold" : "text-muted/70"}`}>
                    {h.type}
                  </span>
                  <span className={`flex-1 text-[13px] leading-snug ${isHero ? "text-text" : "text-text/85"}`}>
                    {h.line}
                  </span>
                  {isHero && <span className="text-[10px] uppercase tracking-[0.2em] text-gold/80">on now</span>}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Compact shot list */}
      <CompactShotList shots={output.shotList} heroShotIdx={heroShotIdx} onGoShoot={onGoShoot} />

      {/* Why this works in your market — collapsed by default */}
      {output.localRelevanceNotes?.length > 0 && (
        <CollapsibleNotes notes={output.localRelevanceNotes} />
      )}

      {/* Sticky bottom CTA — mobile only */}
      <StickyMobileCta label="Start shoot" onClick={onGoShoot} />
    </div>
  );
}

function ShootTab({
  output,
  heroShotIdx,
  subtitle,
  onDoneShooting,
}: {
  output: PreShootOutput;
  heroShotIdx: number;
  subtitle?: string;
  onDoneShooting: () => void;
}) {
  const handoff = useMemo(
    () => buildChecklistHashUrl(output, subtitle),
    [output, subtitle],
  );

  return (
    <div className="space-y-5 pb-24 md:pb-5">
      {/* Open in checklist CTA */}
      <div className="rounded-2xl border border-gold/40 bg-gradient-to-br from-gold/10 to-transparent p-5 md:flex md:items-center md:justify-between">
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-gold/80">On set</div>
          <div className="mt-1 font-display text-xl text-text">Open the checklist on your phone.</div>
          <p className="mt-1 text-[13px] text-muted">
            Mobile-first, offline-aware. Each shot has a tap-to-mark checkbox + your filming notes pinned at the top.
          </p>
        </div>
        <Link
          href={handoff}
          target="_blank"
          rel="noopener"
          className="mt-4 inline-flex items-center gap-1.5 rounded-full bg-gold px-4 py-2.5 text-[13px] font-semibold text-black transition hover:bg-gold-light md:mt-0"
        >
          <ListChecks className="h-3.5 w-3.5" />
          Open checklist
          <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </div>

      {/* Detailed shot list — full retention notes visible here */}
      <DetailedShotList shots={output.shotList} heroShotIdx={heroShotIdx} />

      {/* B-roll list */}
      {output.bRollList && output.bRollList.length > 0 && (
        <Section title="B-roll · also grab while on site">
          <div className="grid gap-2">
            {output.bRollList.map((b, i) => (
              <div key={i} className="rounded-lg border border-border/60 bg-bg p-3">
                <div className="text-[14px] text-text">{b.shot}</div>
                {b.whyItHelps && (
                  <div className="mt-1 text-[11px] italic text-muted/80">↳ {b.whyItHelps}</div>
                )}
              </div>
            ))}
          </div>
        </Section>
      )}

      {/* Filming notes — accordion, collapsed by default (also passed to checklist) */}
      {output.filmingNotes && hasFilmingNotes(output.filmingNotes) && (
        <FilmingNotesAccordion notes={output.filmingNotes} />
      )}

      <StickyMobileCta label="Done shooting" onClick={onDoneShooting} />
    </div>
  );
}

function PostTab({
  output,
  heroHook,
  altHooks,
}: {
  output: PreShootOutput;
  heroHook: Hook;
  altHooks: Hook[];
}) {
  return (
    <div className="space-y-5 pb-24 md:pb-5">
      {/* Title options */}
      {output.titleOptions?.length > 0 && (
        <Section title="Title options">
          <div className="grid gap-2">
            {output.titleOptions.map((t, i) => (
              <CopyableLine key={i} text={t} kind="title" />
            ))}
          </div>
        </Section>
      )}

      {/* Opener variants — fold under as "alt openers" since they're hook-family */}
      {output.openerVariants && output.openerVariants.length > 0 && (
        <Section title="Alt openers · film both, A/B in editing">
          <div className="grid gap-2 md:grid-cols-2">
            {output.openerVariants.map((v, i) => (
              <div key={i} className="rounded-lg border border-border/60 bg-bg p-3">
                <div className="text-[10px] font-semibold uppercase tracking-[0.2em] text-gold/80">{v.feel}</div>
                <div className="mt-1.5 text-[14px] text-text">{v.line}</div>
              </div>
            ))}
          </div>
        </Section>
      )}

      {/* Pre-publish checks */}
      {output.successChecks && output.successChecks.length > 0 && (
        <Section title="Pre-publish checks">
          <div className="grid gap-2">
            {output.successChecks.map((c, i) => (
              <div key={i} className="flex items-start gap-2 rounded-lg border border-border/60 bg-bg p-3">
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-gold/70" />
                <div className="text-[13px] text-text/90">{c}</div>
              </div>
            ))}
          </div>
        </Section>
      )}

      {/* Caption hand-off CTA */}
      <div className="rounded-2xl border border-gold/40 bg-gradient-to-br from-gold/10 to-transparent p-5 md:flex md:items-center md:justify-between">
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-gold/80">Ready to ship</div>
          <div className="mt-1 font-display text-xl text-text">Drop the cut into Distribution.</div>
          <p className="mt-1 text-[13px] text-muted">
            Mintflow will tune captions, hashtags, and a thumbnail per platform.
          </p>
        </div>
        <Link
          href="/distribution"
          className="mt-4 inline-flex items-center gap-1.5 rounded-full bg-gold px-4 py-2.5 text-[13px] font-semibold text-black transition hover:bg-gold-light md:mt-0"
        >
          <Send className="h-3.5 w-3.5" />
          Open Distribution
          <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </div>
    </div>
  );
}

/* ============ COMPONENTS ============ */

function TabButton({ active, onClick, label }: { active: boolean; onClick: () => void; label: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      role="tab"
      aria-selected={active}
      className={[
        "relative rounded-full px-3.5 py-1.5 font-medium transition",
        active ? "bg-gold/15 text-gold" : "text-muted hover:text-text",
      ].join(" ")}
    >
      {label}
    </button>
  );
}

function HeroHook({
  hook,
  altsCount,
  altsOpen,
  onToggleAlts,
}: {
  hook: Hook;
  altsCount: number;
  altsOpen: boolean;
  onToggleAlts: () => void;
}) {
  const [saved, setSaved] = useState(false);
  useEffect(() => setSaved(isSaved(hook.line, "hook")), [hook.line]);

  return (
    <div className="rounded-2xl border border-gold/40 bg-gradient-to-br from-gold/[0.07] to-transparent p-6 md:p-7">
      <div className="text-[10px] font-semibold uppercase tracking-[0.25em] text-gold/85">
        Hook · {hook.type}
      </div>
      <p className="mt-3 font-display text-[26px] leading-[1.18] tracking-[-0.01em] text-text md:text-[32px]">
        &ldquo;{hook.line}&rdquo;
      </p>
      <p className="mt-3 text-[13px] leading-relaxed text-muted">↳ {hook.whyItWorks}</p>

      <div className="mt-5 flex flex-wrap items-center gap-2 text-[12px]">
        <CopyButton text={hook.line} label="Copy" />
        <button
          type="button"
          onClick={() => {
            toggleSaved({ kind: "hook", text: hook.line });
            setSaved(isSaved(hook.line, "hook"));
          }}
          className="inline-flex items-center gap-1 rounded-full border border-border/60 px-2.5 py-1 text-muted transition hover:text-text"
        >
          {saved ? (
            <>
              <BookmarkCheck className="h-3.5 w-3.5 text-gold" />
              Saved
            </>
          ) : (
            <>
              <Bookmark className="h-3.5 w-3.5" />
              Save
            </>
          )}
        </button>
        {altsCount > 0 && (
          <button
            type="button"
            onClick={onToggleAlts}
            aria-expanded={altsOpen}
            className="inline-flex items-center gap-1 rounded-full border border-border/60 px-2.5 py-1 text-muted transition hover:text-text"
          >
            <Shuffle className="h-3.5 w-3.5" />
            Try another angle
            <ChevronDown className={`h-3 w-3 transition-transform ${altsOpen ? "rotate-180" : ""}`} />
          </button>
        )}
      </div>
    </div>
  );
}

function ThumbnailCard({
  direction,
  startShoot,
}: {
  direction: PreShootOutput["thumbnailDirection"];
  startShoot: () => void;
}) {
  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-2xl border border-border/70 bg-bg p-5">
        <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.22em] text-gold/80">
          <ImageIcon className="h-3 w-3" />
          Thumbnail
        </div>
        <div className="mt-3 grid gap-2 text-[13px]">
          <div className="flex items-baseline justify-between">
            <span className="text-muted">Frame at</span>
            <span className="font-mono text-text">{direction.momentTimestamp}</span>
          </div>
          <div className="flex items-start justify-between gap-3">
            <span className="text-muted">Overlay</span>
            <span className="text-right font-display text-[13px] tracking-tight text-text">
              &ldquo;{direction.overlayText}&rdquo;
            </span>
          </div>
          <div className="flex items-baseline justify-between">
            <span className="text-muted">Tone</span>
            <span className="text-right text-text/85">{direction.emotionalTone}</span>
          </div>
        </div>
        <Link
          href="/thumbnail-studio"
          className="mt-4 inline-flex items-center gap-1 text-[12px] text-gold/85 transition hover:text-gold"
        >
          Open in Studio
          <ArrowRight className="h-3 w-3" />
        </Link>
      </div>

      {/* Desktop start-shoot CTA */}
      <button
        type="button"
        onClick={startShoot}
        className="hidden items-center justify-center gap-1.5 rounded-full bg-gold px-4 py-3 text-[13px] font-semibold text-black transition hover:bg-gold-light md:inline-flex"
      >
        <Camera className="h-3.5 w-3.5" />
        Start shoot
        <ArrowRight className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

function CompactShotList({
  shots,
  heroShotIdx,
  onGoShoot,
}: {
  shots: ShotListItem[];
  heroShotIdx: number;
  onGoShoot: () => void;
}) {
  const [openRow, setOpenRow] = useState<number | null>(null);

  return (
    <div className="rounded-2xl border border-border/70 bg-bg">
      <div className="flex items-center justify-between border-b border-border/60 px-5 py-3">
        <div className="text-[10px] font-semibold uppercase tracking-[0.22em] text-gold/80">
          Shot list · {shots.length} shots · ~{estimateDuration(shots)}
        </div>
        <button
          type="button"
          onClick={onGoShoot}
          className="inline-flex items-center gap-1 text-[12px] text-gold/85 transition hover:text-gold"
        >
          On-set view
          <ArrowRight className="h-3 w-3" />
        </button>
      </div>
      <ul className="divide-y divide-border/50">
        {shots.map((s, i) => {
          const isHero = i === heroShotIdx;
          const isOpen = openRow === i;
          return (
            <li
              key={i}
              className={[
                "px-5 py-2.5",
                isHero ? "border-l-2 border-l-gold bg-gold/[0.04]" : "",
              ].join(" ")}
            >
              <button
                type="button"
                onClick={() => setOpenRow(isOpen ? null : i)}
                className="grid w-full grid-cols-[20px_60px_1fr_16px] items-center gap-3 text-left"
                aria-expanded={isOpen}
              >
                <span aria-hidden className="flex h-4 w-4 items-center justify-center text-muted/60">
                  {isHero ? <Star className="h-3.5 w-3.5 text-gold" fill="currentColor" /> : <span className="block h-3 w-3 rounded-sm border border-border/70" />}
                </span>
                <span className="font-mono text-[11px] text-gold/80">{s.timestamp}</span>
                <span className="truncate text-[13px] text-text/90">{s.shot}</span>
                {s.retentionNote ? (
                  <ChevronRight className={`h-3.5 w-3.5 text-muted/50 transition-transform ${isOpen ? "rotate-90" : ""}`} />
                ) : (
                  <span aria-hidden className="block h-3.5 w-3.5" />
                )}
              </button>
              {isOpen && s.retentionNote && (
                <div className="ml-[80px] mt-2 text-[11px] italic leading-relaxed text-muted/85">
                  ↳ {s.retentionNote}
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function DetailedShotList({ shots, heroShotIdx }: { shots: ShotListItem[]; heroShotIdx: number }) {
  return (
    <Section title={`Shot list · ${shots.length} shots · ~${estimateDuration(shots)}`}>
      <div className="grid gap-2">
        {shots.map((s, i) => {
          const isHero = i === heroShotIdx;
          return (
            <div
              key={i}
              className={[
                "rounded-lg border bg-bg p-3",
                isHero ? "border-l-2 border-l-gold border-r-border/60 border-y-border/60" : "border-border/60",
              ].join(" ")}
            >
              <div className="flex items-baseline gap-3">
                {isHero ? (
                  <Star className="mt-0.5 h-3.5 w-3.5 shrink-0 text-gold" fill="currentColor" />
                ) : (
                  <span className="mt-0.5 inline-block h-3 w-3 shrink-0 rounded-sm border border-border/70" aria-hidden />
                )}
                <span className="font-mono text-[11px] text-gold/80">{s.timestamp}</span>
                <span className="text-[13px] text-text/90">{s.shot}</span>
              </div>
              {s.retentionNote && (
                <div className="mt-1.5 ml-[34px] text-[11px] italic leading-relaxed text-muted/85">
                  ↳ {s.retentionNote}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </Section>
  );
}

function CollapsibleNotes({ notes }: { notes: string[] }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="rounded-2xl border border-border/60 bg-bg-deep/30">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-center justify-between px-5 py-3 text-left"
      >
        <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.2em] text-muted">
          <MapPin className="h-3 w-3" />
          Why this works in your market — {notes.length} {notes.length === 1 ? "note" : "notes"}
        </div>
        <ChevronDown className={`h-4 w-4 text-muted transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <div className="border-t border-border/50 px-5 py-4">
          <ul className="grid gap-2.5">
            {notes.map((n, i) => (
              <li key={i} className="text-[12.5px] leading-relaxed text-text/85">
                {n}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function FilmingNotesAccordion({ notes }: { notes: NonNullable<PreShootOutput["filmingNotes"]> }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="rounded-2xl border border-border/60 bg-bg-deep/30">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-center justify-between px-5 py-3 text-left"
      >
        <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.2em] text-muted">
          <Camera className="h-3 w-3" />
          Filming notes
        </div>
        <ChevronDown className={`h-4 w-4 text-muted transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <div className="grid gap-3 border-t border-border/50 px-5 py-4 md:grid-cols-2">
          {notes.gear && <NoteCard icon={<Camera className="h-3 w-3" />} label="Gear">{notes.gear}</NoteCard>}
          {notes.lighting && <NoteCard icon={<Sun className="h-3 w-3" />} label="Lighting">{notes.lighting}</NoteCard>}
          {notes.timeOfDay && <NoteCard icon={<Sun className="h-3 w-3" />} label="Time of day">{notes.timeOfDay}</NoteCard>}
          {notes.soundCapture && <NoteCard icon={<Mic className="h-3 w-3" />} label="Sound">{notes.soundCapture}</NoteCard>}
          {notes.riskCalls && <NoteCard icon={<AlertTriangle className="h-3 w-3" />} label="Risks">{notes.riskCalls}</NoteCard>}
        </div>
      )}
    </div>
  );
}

function NoteCard({ icon, label, children }: { icon: React.ReactNode; label: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-border/60 bg-bg p-3">
      <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.2em] text-gold/80">
        {icon}
        {label}
      </div>
      <div className="mt-1.5 text-[12.5px] leading-relaxed text-text/85">{children}</div>
    </div>
  );
}

function CopyableLine({ text, kind }: { text: string; kind: "title" }) {
  const [saved, setSaved] = useState(false);
  useEffect(() => setSaved(isSaved(text, kind)), [text, kind]);
  return (
    <div className="flex items-center gap-3 rounded-lg border border-border/60 bg-bg px-3 py-2">
      <span className="flex-1 text-[13px] text-text/90">{text}</span>
      <button
        type="button"
        onClick={() => {
          toggleSaved({ kind, text });
          setSaved(isSaved(text, kind));
        }}
        aria-label={saved ? "Unsave" : "Save"}
        className="text-muted transition hover:text-text"
      >
        {saved ? <BookmarkCheck className="h-3.5 w-3.5 text-gold" /> : <Bookmark className="h-3.5 w-3.5" />}
      </button>
      <CopyButton text={text} />
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="mb-2.5 text-[10px] font-semibold uppercase tracking-[0.22em] text-gold/80">{title}</div>
      {children}
    </div>
  );
}

function StickyMobileCta({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <div className="fixed inset-x-0 bottom-0 z-30 border-t border-border/60 bg-bg/95 px-5 py-3 backdrop-blur-xl md:hidden">
      <button
        type="button"
        onClick={onClick}
        className="flex w-full items-center justify-center gap-1.5 rounded-full bg-gold px-4 py-3 text-[13px] font-semibold text-black transition hover:bg-gold-light"
      >
        {label}
        <ArrowRight className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

/* ============ HELPERS ============ */

function orderHooks(hooks: Hook[]): Hook[] {
  // Order by hero priority. Falls back to original order if a type is missing.
  const byType = new Map<HookType, Hook>();
  for (const h of hooks) byType.set(h.type, h);
  const ordered: Hook[] = [];
  for (const t of HOOK_PRIORITY) {
    const h = byType.get(t);
    if (h) ordered.push(h);
  }
  // Append any unexpected types at the end.
  for (const h of hooks) if (!ordered.includes(h)) ordered.push(h);
  return ordered;
}

function findHeroShotIndex(shots: ShotListItem[], thumbnailMoment?: string): number {
  if (!thumbnailMoment || !shots?.length) return 0;
  // thumbnailMoment can be "0:08" or "8s" — normalize to seconds.
  const sec = parseTimestampToSec(thumbnailMoment);
  if (sec == null) return 0;
  for (let i = 0; i < shots.length; i++) {
    const range = parseRangeToSec(shots[i].timestamp);
    if (!range) continue;
    if (sec >= range[0] && sec <= range[1]) return i;
  }
  return 0;
}

function parseTimestampToSec(t: string): number | null {
  const trimmed = t.trim();
  // "0:08" / "1:23"
  const colonMatch = trimmed.match(/^(\d+):(\d+)$/);
  if (colonMatch) return Number(colonMatch[1]) * 60 + Number(colonMatch[2]);
  // "8s" / "8 sec"
  const sMatch = trimmed.match(/^(\d+)\s*s/);
  if (sMatch) return Number(sMatch[1]);
  // bare integer
  const n = Number(trimmed);
  return Number.isFinite(n) ? n : null;
}

function parseRangeToSec(range: string): [number, number] | null {
  // "0-3s" / "8-14s" / "0:00-0:08"
  const m = range.match(/(\d+(?::\d+)?)\s*[\-–]\s*(\d+(?::\d+)?)/);
  if (!m) return null;
  const a = parseTimestampToSec(m[1]);
  const b = parseTimestampToSec(m[2]);
  if (a == null || b == null) return null;
  return [a, b];
}

function estimateDuration(shots: ShotListItem[]): string {
  const last = shots[shots.length - 1];
  if (!last) return "";
  const r = parseRangeToSec(last.timestamp);
  if (r) return `${r[1]}s`;
  return "";
}

function hasFilmingNotes(n: NonNullable<PreShootOutput["filmingNotes"]>): boolean {
  return Boolean(n.gear || n.lighting || n.timeOfDay || n.soundCapture || n.riskCalls);
}

/** Build a base64url-encoded payload for /production/checklist. Includes filming notes
 *  so the on-set companion can pin them above the checklist. */
function buildChecklistHashUrl(output: PreShootOutput, subtitle?: string): string {
  const payload = {
    title: subtitle || "Today's shoot",
    shots: output.shotList.map((s) => ({
      timestamp: s.timestamp,
      shot: s.shot,
      retentionNote: s.retentionNote,
    })),
    filmingNotes: output.filmingNotes,
  };
  const json = JSON.stringify(payload);
  // base64url
  const b64 = typeof window === "undefined"
    ? Buffer.from(json, "utf8").toString("base64")
    : btoa(unescape(encodeURIComponent(json)));
  const b64url = b64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  return `/production/checklist#data=${b64url}`;
}

function buildPlainTextPayload(output: PreShootOutput, heroHook: Hook): string {
  return [
    `HERO HOOK · ${heroHook.type.toUpperCase()}`,
    heroHook.line,
    `↳ ${heroHook.whyItWorks}`,
    "",
    "SHOT LIST",
    ...output.shotList.map(
      (s, i) =>
        `${i + 1}. [${s.timestamp}] ${s.shot}${s.retentionNote ? `\n   ↳ ${s.retentionNote}` : ""}`,
    ),
    "",
    "THUMBNAIL",
    `  moment:  ${output.thumbnailDirection.momentTimestamp}`,
    `  overlay: "${output.thumbnailDirection.overlayText}"`,
    `  tone:    ${output.thumbnailDirection.emotionalTone}`,
    "",
    "TITLES",
    ...(output.titleOptions ?? []).map((t, i) => `${i + 1}. ${t}`),
  ].join("\n");
}
