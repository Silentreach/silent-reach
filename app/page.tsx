import Link from "next/link";
import {
  ArrowRight,
  Sparkles,
  Camera,
  Clapperboard,
  Send,
  Image as ImageIcon,
  Type,
  ListChecks,
  Wand2,
  Mic,
  Sun,
  Layers,
  Share2,
} from "lucide-react";

export default function Home() {
  return (
    <div className="-mt-10">
      {/* ============ HERO ============ */}
      <section className="hero-glow relative overflow-hidden">
        <div className="mx-auto max-w-5xl px-5 pt-28 pb-32 text-center md:pt-36 md:pb-40">
          <div className="inline-flex items-center gap-2 rounded-full border border-gold/30 bg-gold/5 px-3 py-1 text-[11px] uppercase tracking-[0.25em] text-gold animate-fade-up">
            <Sparkles className="h-3 w-3" />
            From design to distribution
          </div>

          <h1 className="mt-7 font-display text-[44px] leading-[0.98] tracking-[-0.025em] sm:text-6xl md:text-[80px] animate-fade-up">
            <span className="display-gradient">Plan it.</span>{" "}
            <span className="display-gradient">Shoot it.</span>{" "}
            <span className="display-gradient">Ship it.</span>
          </h1>

          <p className="mx-auto mt-7 max-w-xl text-balance text-base leading-relaxed text-muted md:text-lg animate-fade-up">
            The content production OS for creators who need to travel beyond their followers.
            One studio for the brief, the shoot, the cut, the cover, and the captions.
          </p>

          <div className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row animate-fade-up">
            <Link
              href="/pre-shoot"
              className="group inline-flex items-center gap-2 rounded-full bg-gold px-5 py-3 text-sm font-semibold text-black transition hover:bg-gold-light"
            >
              Start a project
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
            </Link>
            <Link
              href="/thumbnail-studio"
              className="inline-flex items-center gap-2 rounded-full border border-border-strong px-5 py-3 text-sm text-text transition hover:border-gold/60 hover:text-gold"
            >
              See the studio
            </Link>
          </div>

          {/* Mark watermark behind hero, very subtle */}
          <div
            aria-hidden
            className="pointer-events-none absolute left-1/2 top-1/2 -z-10 h-[640px] w-[640px] -translate-x-1/2 -translate-y-1/2 opacity-[0.06] animate-pulse-soft"
            style={{
              background:
                "radial-gradient(circle, rgba(212,175,55,0.6) 0%, transparent 55%)",
            }}
          />
        </div>
      </section>

      {/* ============ PILLARS ============ */}
      <section className="border-t border-border/60 bg-bg-deep">
        <div className="mx-auto max-w-6xl px-5 py-24">
          <div className="mb-14 max-w-2xl">
            <div className="text-[11px] uppercase tracking-[0.25em] text-gold/80">
              Three pillars · one platform
            </div>
            <h2 className="mt-3 font-display text-3xl leading-[1.05] tracking-tight text-text md:text-5xl">
              Every step of a piece of content,
              <span className="text-muted"> in one place.</span>
            </h2>
            <p className="mt-4 text-muted">
              Most creators stitch six tools together to ship one reel. Mintflow
              collapses that into a single workflow built around the actual job to be done.
            </p>
          </div>

          <div className="grid gap-5 md:grid-cols-3">
            <Pillar
              num="01"
              title="Pre-Production"
              kicker="Design the shoot"
              href="/pre-shoot"
              cta="Start a brief"
              description="A pasted concept becomes a hook, a shot list, three title options, a thumbnail direction, and a Victoria-specific relevance angle — before you pick up a camera."
              tools={[
                { icon: Type,       label: "Brief generator" },
                { icon: ListChecks, label: "Shot list", soon: true },
                { icon: Sun,        label: "Light planner", soon: true },
              ]}
            />
            <Pillar
              num="02"
              title="Production"
              kicker="Stay sharp on set"
              href="/production"
              cta="Open production tools"
              description="On-set companion. Your brief turns into an interactive shot checklist, with B-roll prompts, ambient capture cues, and a property-vibe note pad to feed the next pillar."
              tools={[
                { icon: Clapperboard, label: "Shot checklist", soon: true },
                { icon: Mic,          label: "Ambient cues", soon: true },
                { icon: Wand2,        label: "B-roll prompts", soon: true },
              ]}
              badge="Coming next"
            />
            <Pillar
              num="03"
              title="Post-Production"
              kicker="Ship to every surface"
              href="/post-upload"
              cta="Generate a pack"
              description="One YouTube URL becomes IG/FB/LinkedIn captions, five title variants, hook rewrites, chapter markers, three shareable clips, and a thumbnail that travels."
              tools={[
                { icon: Send,       label: "Caption pack" },
                { icon: ImageIcon,  label: "Thumbnail studio", href: "/thumbnail-studio" },
                { icon: Layers,     label: "Chapter markers" },
              ]}
            />
          </div>
        </div>
      </section>

      {/* ============ ONE-PLATFORM THESIS ============ */}
      <section className="border-t border-border/60">
        <div className="mx-auto max-w-5xl px-5 py-24 text-center">
          <div className="text-[11px] uppercase tracking-[0.25em] text-gold/80">
            The one-platform thesis
          </div>
          <h2 className="mx-auto mt-3 max-w-3xl font-display text-3xl leading-[1.1] tracking-tight md:text-5xl">
            <span className="text-text">Six tabs to ship one reel</span>{" "}
            <span className="text-muted">is not a workflow.</span>
            <br />
            <span className="display-gradient">It&apos;s a tax.</span>
          </h2>
          <p className="mx-auto mt-6 max-w-2xl text-muted">
            Adobe for the cut. Canva for the cover. ChatGPT for the caption. Notion for the
            brief. Premiere for the trim. A spreadsheet for the title test. Every context
            switch leaks an idea — and a follower you didn&apos;t convert. Mintflow is the
            single surface where the whole pipeline lives, so the next post ships before the
            last one is forgotten.
          </p>
          <div className="mt-10 flex flex-wrap items-center justify-center gap-4 text-xs text-muted">
            <Pill>One brief, every platform</Pill>
            <Pill>Voice-less video, fully captioned</Pill>
            <Pill>Reel + Short + 16:9 in one export</Pill>
            <Pill>Built for non-follower reach</Pill>
          </div>
        </div>
      </section>

      {/* ============ FINAL CTA ============ */}
      <section className="border-t border-border/60 bg-bg-deep">
        <div className="mx-auto max-w-4xl px-5 py-24 text-center">
          <h2 className="font-display text-3xl leading-[1.1] tracking-tight md:text-5xl">
            <span className="text-text">Open the studio.</span>{" "}
            <span className="display-gradient">Ship the reel.</span>
          </h2>
          <p className="mt-5 text-muted">
            Ninety seconds from blank screen to a brief that earns the next 60-second shoot.
          </p>
          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link
              href="/pre-shoot"
              className="group inline-flex items-center gap-2 rounded-full bg-gold px-6 py-3 text-sm font-semibold text-black transition hover:bg-gold-light"
            >
              Start a brief
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
            </Link>
            <Link
              href="/thumbnail-studio"
              className="inline-flex items-center gap-2 rounded-full border border-border-strong px-6 py-3 text-sm text-text transition hover:border-gold/60 hover:text-gold"
            >
              Or design a thumbnail
              <Share2 className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}

/* ---------- PILLAR CARD ---------- */
interface PillarTool {
  icon: typeof Camera;
  label: string;
  href?: string;
  soon?: boolean;
}
interface PillarProps {
  num: string;
  kicker: string;
  title: string;
  description: string;
  href: string;
  cta: string;
  tools: PillarTool[];
  badge?: string;
}
function Pillar({ num, kicker, title, description, href, cta, tools, badge }: PillarProps) {
  return (
    <Link
      href={href}
      className="pillar-card group flex flex-col rounded-2xl border border-border bg-surface p-7"
    >
      <div className="flex items-start justify-between">
        <div className="font-display text-[44px] font-light leading-none text-gold/40">
          {num}
        </div>
        {badge && (
          <span className="rounded-full border border-gold/30 bg-gold/5 px-2 py-0.5 text-[10px] uppercase tracking-widest text-gold/80">
            {badge}
          </span>
        )}
      </div>
      <div className="mt-6">
        <div className="text-[11px] uppercase tracking-[0.2em] text-muted">{kicker}</div>
        <h3 className="mt-1.5 font-display text-2xl tracking-tight text-text">{title}</h3>
      </div>
      <p className="mt-3 flex-1 text-sm leading-relaxed text-muted">{description}</p>

      <ul className="mt-6 space-y-2">
        {tools.map((t) => {
          const Icon = t.icon;
          return (
            <li key={t.label} className="flex items-center gap-2.5 text-[13px] text-text/85">
              <Icon className="h-3.5 w-3.5 text-gold/80" />
              <span>{t.label}</span>
              {t.soon && (
                <span className="ml-auto text-[10px] uppercase tracking-widest text-muted">Soon</span>
              )}
            </li>
          );
        })}
      </ul>

      <div className="mt-7 inline-flex items-center gap-1.5 text-sm font-medium text-gold transition-transform group-hover:translate-x-0.5">
        {cta}
        <ArrowRight className="h-3.5 w-3.5" />
      </div>
    </Link>
  );
}

function Pill({ children }: { children: React.ReactNode }) {
  return (
    <span className="rounded-full border border-border bg-surface px-3.5 py-1.5">
      {children}
    </span>
  );
}
