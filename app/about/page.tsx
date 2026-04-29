import Link from "next/link";
import { ArrowRight, Compass, Camera, Scissors, Send, MapPin, Mountain, Quote } from "lucide-react";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "About",
  description:
    "Mintflow is the production OS for BC real estate, renovation, and small-business video creators. Built in Victoria by a working filmmaker.",
};

export default function AboutPage() {
  return (
    <div className="-mt-10">
      {/* ============ HERO ============ */}
      <section className="hero-glow relative overflow-hidden">
        <div className="mx-auto max-w-5xl px-5 pt-24 pb-20 text-center md:pt-32 md:pb-24">
          <div className="inline-flex items-center gap-2 rounded-full border border-gold/30 bg-gold/5 px-3 py-1 text-[11px] uppercase tracking-[0.25em] text-gold animate-fade-up">
            <Mountain className="h-3 w-3" />
            Built in Victoria, BC
          </div>

          <h1 className="mt-7 font-display text-[42px] leading-[1.02] tracking-[-0.025em] sm:text-5xl md:text-[68px] animate-fade-up">
            <span className="display-gradient">A filmmaker&rsquo;s brain,</span>{" "}
            <span className="display-gradient">made local to BC.</span>
          </h1>

          <p className="mx-auto mt-7 max-w-2xl text-balance text-base leading-relaxed text-muted md:text-lg animate-fade-up">
            Most listing videos look the same because nobody hands a creator a clear plan.
            Mintflow is the plan we wished someone had handed us on our first shoot — the
            brief, the shot list, the on-set direction, the edit playbook, and the
            platform-ready cuts. One studio. Available before sunrise on shoot day.
          </p>

          <div className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row animate-fade-up">
            <Link
              href="/pre-production"
              className="group inline-flex items-center gap-2 rounded-full bg-gold px-5 py-3 text-sm font-semibold text-black transition hover:bg-gold-light"
            >
              Try a brief
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
            </Link>
            <Link
              href="/pricing"
              className="inline-flex items-center gap-2 rounded-full border border-border-strong px-5 py-3 text-sm text-text transition hover:border-gold/60 hover:text-gold"
            >
              See pricing
            </Link>
          </div>

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

      {/* ============ FOUR PILLARS ============ */}
      <section className="border-y border-border/60 bg-bg-deep/40">
        <div className="mx-auto max-w-6xl px-5 py-16 md:py-20">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="font-display text-3xl tracking-tight text-text md:text-4xl">
              From design to distribution.
            </h2>
            <p className="mt-4 text-base leading-relaxed text-muted">
              Four stages, one app. The same shot list moves from brief to set to edit to
              the platform-ready cut — no copy-paste between tools.
            </p>
          </div>

          <div className="mt-12 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <Pillar
              num="01"
              title="Pre-Production"
              icon={<Compass className="h-4 w-4" />}
              body="Paste an address. Mintflow finds the schools, parks, transit, and landmarks worth filming, then generates a brief grounded in the actual neighborhood — hooks, USPs, shot list, titles, opener variants, pre-publish checks."
              href="/pre-production"
            />
            <Pillar
              num="02"
              title="Production"
              icon={<Camera className="h-4 w-4" />}
              body="A swipeable shot deck for the day of the shoot. Each card carries the framing, duration, gear, lens, movement, and audio cues — gear-aware, so a no-drone user never sees aerial shots they can't capture."
              href="/production"
            />
            <Pillar
              num="03"
              title="Post-Production"
              icon={<Scissors className="h-4 w-4" />}
              body="An editor's playbook for the project — pacing prescriptions, color grading numbers, music recommendations, SFX cues, motion direction, voice-over scripts, and per-platform export specs."
              href="/post-production"
            />
            <Pillar
              num="04"
              title="Distribution"
              icon={<Send className="h-4 w-4" />}
              body="Drop the finished cut in. Mintflow renders three platform-tuned reels — Instagram, YouTube Short, Facebook — with hooks, captions, hashtags, thumbnails, and the right music. Browser-rendered, no upload to a server."
              href="/distribution"
            />
          </div>
        </div>
      </section>

      {/* ============ FOUNDER VISION ============ */}
      <section className="mx-auto max-w-4xl px-5 py-20 md:py-28">
        <div className="mb-8 flex items-center gap-3">
          <span className="text-[11px] font-semibold uppercase tracking-[0.25em] text-gold/80">
            Founder vision
          </span>
          <span className="h-px flex-1 bg-border/60" />
        </div>

        <Quote className="h-8 w-8 text-gold/40" />

        <div className="mt-6 space-y-5 text-lg leading-[1.7] text-text/90 md:text-xl md:leading-[1.65]">
          <p>
            I&rsquo;m Deloar Hossain, a filmmaker in Victoria. For ten years I&rsquo;ve
            shot listings, weddings, and short films across British Columbia, and I kept
            watching realtors and homeowners spend a thousand dollars on a video that
            looks like every other video on the same street.
          </p>
          <p>
            The problem isn&rsquo;t budget — it&rsquo;s that nobody hands a creator a
            clear plan.
          </p>
          <p>
            Mintflow is the plan I wished someone had handed me on my first listing
            shoot: paste the address, get the unique selling points grounded in the
            actual neighborhood, the shot list, the on-set direction, the edit playbook,
            and the platform-ready cuts.
          </p>
          <p>
            It is a filmmaker&rsquo;s brain, made local to BC, available before sunrise
            on shoot day. I built it because Silent Story can only film one house per
            weekend. <span className="text-gold">Mintflow can help film a thousand.</span>
          </p>
        </div>

        <div className="mt-10 flex items-center gap-4 border-t border-border/60 pt-6">
          <div className="flex h-12 w-12 items-center justify-center rounded-full border border-gold/30 bg-gold/10 text-gold">
            <span className="text-sm font-semibold">DH</span>
          </div>
          <div>
            <div className="text-sm font-medium text-text">Deloar Hossain</div>
            <div className="text-[12px] text-muted">
              Founder, Mintflow · Director, Silent Story
            </div>
          </div>
        </div>
      </section>

      {/* ============ VALUES STRIP ============ */}
      <section className="border-y border-border/60 bg-bg-deep/40">
        <div className="mx-auto grid max-w-6xl gap-6 px-5 py-14 md:grid-cols-3">
          <Value
            label="BC-first"
            body="Trained on the BC market — VREB, OCP zoning, foreshore vs waterfront, neighborhood by neighborhood. Generic AI tools say &lsquo;walkable&rsquo;; we say &lsquo;380m to Cordova Bay Elementary via Walema Ave.&rsquo;"
          />
          <Value
            label="Evidence-driven"
            body="Every selling point cites a real number, a real distance, or a real name. The banned-phrases list — stunning, elevated, walkable, moments from — is enforced by the prompt, not just the founder."
          />
          <Value
            label="Filmmaker-grade"
            body="Real cinematography language. Shot direction that knows your gear. Color grading with concrete numbers, not vibes. Built by a working DP who actually shoots listings."
          />
        </div>
      </section>

      {/* ============ CTA ============ */}
      <section className="mx-auto max-w-3xl px-5 py-20 text-center md:py-28">
        <MapPin className="mx-auto h-7 w-7 text-gold/70" />
        <h3 className="mt-5 font-display text-3xl tracking-tight text-text md:text-4xl">
          Drop in a Victoria address.
        </h3>
        <p className="mx-auto mt-4 max-w-xl text-base leading-relaxed text-muted">
          The fastest way to see what Mintflow does is to try it. Free for your first
          brief — no credit card.
        </p>
        <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <Link
            href="/pre-production"
            className="group inline-flex items-center gap-2 rounded-full bg-gold px-5 py-3 text-sm font-semibold text-black transition hover:bg-gold-light"
          >
            Start a brief
            <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
          </Link>
          <Link
            href="/pricing"
            className="inline-flex items-center gap-2 rounded-full border border-border-strong px-5 py-3 text-sm text-text transition hover:border-gold/60 hover:text-gold"
          >
            See pricing
          </Link>
        </div>
      </section>
    </div>
  );
}

function Pillar({
  num,
  title,
  icon,
  body,
  href,
}: {
  num: string;
  title: string;
  icon: React.ReactNode;
  body: string;
  href: string;
}) {
  return (
    <Link
      href={href}
      className="group relative flex flex-col rounded-2xl border border-border/70 bg-bg p-6 transition hover:border-gold/40 hover:bg-bg-deep/30"
    >
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-semibold tracking-[0.25em] text-gold/70">
          {num}
        </span>
        <span className="flex h-7 w-7 items-center justify-center rounded-full border border-border/70 bg-bg-deep/50 text-muted transition group-hover:border-gold/40 group-hover:text-gold">
          {icon}
        </span>
      </div>
      <h3 className="mt-5 font-display text-xl tracking-tight text-text">{title}</h3>
      <p className="mt-3 text-[13px] leading-relaxed text-muted">{body}</p>
      <span className="mt-4 inline-flex items-center gap-1 text-[12px] text-gold/80 transition group-hover:text-gold">
        Open
        <ArrowRight className="h-3 w-3 transition-transform group-hover:translate-x-0.5" />
      </span>
    </Link>
  );
}

function Value({ label, body }: { label: string; body: string }) {
  return (
    <div>
      <div className="text-[11px] font-semibold uppercase tracking-[0.25em] text-gold/80">
        {label}
      </div>
      <p className="mt-3 text-sm leading-relaxed text-muted">{body}</p>
    </div>
  );
}
