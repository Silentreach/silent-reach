import Link from "next/link";
import {
  Clapperboard,
  ListChecks,
  Mic,
  Sun,
  Wand2,
  StickyNote,
  ArrowRight,
  Sparkles,
} from "lucide-react";

export const metadata = {
  title: "Production — Mintflow",
  description:
    "On-set companion tools for Mintflow: shot checklist, ambient cues, B-roll prompts, and on-site notes that feed straight into Post-Production.",
};

const TOOLS = [
  {
    icon: ListChecks,
    title: "Shot Checklist",
    blurb:
      "Your Pre-Shoot Brief becomes a tappable, time-stamped checklist on set. Tick each shot as you film. The brief, the call sheet, and the reality of the day — same screen.",
    eta: "Live",
  },
  {
    icon: Wand2,
    title: "B-Roll Prompts",
    blurb:
      "Six contextual B-roll suggestions surface for the property type you're filming — kitchen detail, light through curtains, the doorknob, the long pull-back. Built for voice-less reels that need to breathe.",
    eta: "Q2",
  },
  {
    icon: Sun,
    title: "Light Planner",
    blurb:
      "Drop the listing address, get the golden-hour window, the side of the house that catches it, and the safe shoot blocks for that day. Stop driving 40 minutes for blown-out exteriors.",
    eta: "Q3",
  },
  {
    icon: Mic,
    title: "Ambient Capture Cues",
    blurb:
      "Reminds you to capture the sounds your reel will need in the cut — fireplace crackle, hardwood footsteps, the kettle, the front door. Pulls them straight into the Post-Upload Pack.",
    eta: "Q3",
  },
  {
    icon: StickyNote,
    title: "Property Vibe Notes",
    blurb:
      "A voice-memo + text pad that timestamps your impressions of the home as you film. The exact phrasing the realtor wants in the LinkedIn caption, captured in the moment, not three days later.",
    eta: "Q3",
  },
  {
    icon: Clapperboard,
    title: "On-Set Watermark Layer",
    blurb:
      "Tag the take with the listing slug, the agent, and the date. Keeps the project tree clean when ten reels stack up in a week.",
    eta: "Q4",
  },
];

export default function ProductionPage() {
  return (
    <div className="-mt-10">
      {/* Hero */}
      <section className="hero-glow relative overflow-hidden">
        <div className="mx-auto max-w-5xl px-5 pt-24 pb-20 text-center md:pt-32">
          <div className="inline-flex items-center gap-2 rounded-full border border-gold/30 bg-gold/5 px-3 py-1 text-[11px] uppercase tracking-[0.25em] text-gold">
            <Sparkles className="h-3 w-3" />
            Pillar 02 · Production
          </div>
          <h1 className="mt-7 font-display text-5xl leading-[1.02] tracking-[-0.02em] md:text-7xl">
            <span className="display-gradient">Stay sharp on set.</span>
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-balance text-muted md:text-lg">
            The on-set layer of Mintflow. Your brief follows you to the property,
            your checklist follows the brief, and every observation you capture flows
            straight into Post-Production without a single copy-paste.
          </p>
        </div>
      </section>

      {/* Currently shipping */}
      <section className="border-t border-border/60 bg-bg-deep">
        <div className="mx-auto max-w-5xl px-5 py-14">
          <div className="rounded-2xl border border-border bg-surface p-7 md:p-10">
            <div className="flex flex-col gap-6 md:flex-row md:items-start md:justify-between">
              <div className="max-w-2xl">
                <div className="text-[11px] uppercase tracking-[0.25em] text-gold/80">
                  What you can use today
                </div>
                <h2 className="mt-2 font-display text-2xl tracking-tight md:text-3xl">
                  Pre-Production and Post-Production already ship.
                </h2>
                <p className="mt-3 text-sm leading-relaxed text-muted">
                  The Pre-Shoot Brief gives you the on-set checklist in plain language;
                  print it or have it open on your phone while you film. When the day&apos;s
                  cards are off-loaded, the Post-Upload Pack turns the upload into every
                  caption, title, and clip you need. Production tools below land throughout
                  the year and slot into the same workspace.
                </p>
              </div>
              <div className="flex flex-shrink-0 flex-col gap-2">
                <Link
                  href="/pre-production"
                  className="inline-flex items-center justify-center gap-1.5 rounded-full bg-gold px-5 py-2.5 text-sm font-semibold text-black transition hover:bg-gold-light"
                >
                  Open a brief
                  <ArrowRight className="h-3.5 w-3.5" />
                </Link>
                <Link
                  href="/post-production"
                  className="inline-flex items-center justify-center gap-1.5 rounded-full border border-border-strong px-5 py-2.5 text-sm text-text transition hover:border-gold/60 hover:text-gold"
                >
                  Generate a pack
                </Link>
                <Link
                  href="/production/checklist"
                  className="inline-flex items-center justify-center gap-1.5 rounded-full border border-gold/60 px-5 py-2.5 text-sm text-gold transition hover:bg-gold/5"
                >
                  Open Shot Checklist →
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Roadmap grid */}
      <section className="border-t border-border/60">
        <div className="mx-auto max-w-6xl px-5 py-20">
          <div className="mb-10 flex items-end justify-between">
            <div>
              <div className="text-[11px] uppercase tracking-[0.25em] text-gold/80">Coming next</div>
              <h2 className="mt-2 font-display text-3xl tracking-tight md:text-4xl">
                The on-set layer.
              </h2>
            </div>
            <p className="hidden max-w-sm text-sm text-muted md:block">
              Each tool is in the queue. Priority is shaped by what Silent Story needs on the next shoot — and what early users vote up.
            </p>
          </div>

          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {TOOLS.map((t) => {
              const Icon = t.icon;
              return (
                <div
                  key={t.title}
                  className="pillar-card group rounded-2xl border border-border bg-surface p-6"
                >
                  <div className="flex items-start justify-between">
                    <Icon className="h-5 w-5 text-gold" />
                    <span className="rounded-full border border-border-strong bg-bg-deep px-2 py-0.5 text-[10px] uppercase tracking-widest text-muted">
                      ETA {t.eta}
                    </span>
                  </div>
                  <h3 className="mt-5 font-display text-lg tracking-tight text-text">{t.title}</h3>
                  <p className="mt-2 text-[13px] leading-relaxed text-muted">{t.blurb}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>
    </div>
  );
}
