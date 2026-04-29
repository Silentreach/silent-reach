import Link from "next/link";
import { Check, Sparkles, ArrowRight, Minus } from "lucide-react";

export const metadata = {
  title: "Pricing — Mintflow",
  description:
    "Free for personal use. Creator for solo pros. Studio for agencies. The content production OS, priced like a tool you actually want to keep.",
};

interface Plan {
  name: string;
  price: string;
  cadence: string;
  blurb: string;
  cta: string;
  href: string;
  featured?: boolean;
  features: { label: string; included: boolean | string }[];
}

const PLANS: Plan[] = [
  {
    name: "Starter",
    price: "$0",
    cadence: "forever",
    blurb: "Get the workflow into your hands. Real outputs. Real downloads. Mintflow watermark on shared assets.",
    cta: "Start free",
    href: "/pre-production",
    features: [
      { label: "5 Pre-Shoot briefs / month",            included: true },
      { label: "5 Post-Upload caption packs / month",   included: true },
      { label: "Unlimited thumbnails (watermarked)",    included: true },
      { label: "All 3 typography presets",              included: true },
      { label: "History — last 20 items",               included: true },
      { label: "Brand kit (logo, fonts, palette)",      included: false },
      { label: "Production tools (when shipped)",       included: false },
      { label: "White-label / no watermark",            included: false },
    ],
  },
  {
    name: "Creator",
    price: "$24",
    cadence: "per month",
    blurb: "For solo pros who ship every week. Unlimited generations, no watermarks, your brand kit baked in.",
    cta: "Start 14-day trial",
    href: "/pre-production",
    featured: true,
    features: [
      { label: "Unlimited briefs + caption packs",      included: true },
      { label: "Unlimited thumbnails, no watermark",    included: true },
      { label: "Brand kit — saved logo, fonts, palette",included: true },
      { label: "Production tools (as they ship)",       included: true },
      { label: "Priority generation queue",             included: true },
      { label: "1-click export pack (IG + FB + YT)",    included: true },
      { label: "Saved hooks library",                   included: true },
      { label: "Multi-brand workspaces",                included: false },
    ],
  },
  {
    name: "Studio",
    price: "$79",
    cadence: "per month",
    blurb: "For agencies and realtor white-labels. Multi-brand workspaces, team seats, and the data that compounds.",
    cta: "Talk to founder",
    href: "mailto:hello@mintflowai.com?subject=Mintflow%20Studio%20—%20intro",
    features: [
      { label: "Everything in Creator",                 included: true },
      { label: "5 multi-brand workspaces",              included: true },
      { label: "3 team seats (add more for $12/seat)",  included: true },
      { label: "White-label client exports",            included: true },
      { label: "A/B thumbnail tester + private dataset",included: true },
      { label: "API access (when shipped)",             included: true },
      { label: "1:1 onboarding with founder",           included: true },
      { label: "Roadmap input + early access",          included: true },
    ],
  },
];

const FAQ = [
  {
    q: "What happens to my work if I downgrade?",
    a: "Your saved briefs, packs, and thumbnails stay. You just lose the generation quota for the new month. No data is deleted.",
  },
  {
    q: "Why a watermark on the free tier instead of a feature lock?",
    a: "Honest answer: watermark-on-share is the cheapest, most legible signal that you're using Mintflow. Every free user posting their thumbnail is a passive ad. The Pro tier removes it. Both sides win.",
  },
  {
    q: "Do I own what I generate?",
    a: "Yes. You own all outputs unconditionally — captions, thumbnails, briefs. Mintflow does not retain commercial rights to your content. Ever.",
  },
  {
    q: "Is there a yearly plan?",
    a: "Yes — 2 months free. Toggle on the checkout page. Wired into the Creator and Studio tiers.",
  },
  {
    q: "Built for what kind of creator, exactly?",
    a: "Real estate and renovation video creators are the wedge — voice-less reels with a strong visual story. The IG creator, the realtor running their own marketing, the renovation contractor pitching their builds. The platform expands from there as the pillar tools ship.",
  },
];

export default function PricingPage() {
  return (
    <div className="-mt-10">
      {/* Hero */}
      <section className="hero-glow relative overflow-hidden">
        <div className="mx-auto max-w-4xl px-5 pt-24 pb-14 text-center md:pt-32">
          <div className="inline-flex items-center gap-2 rounded-full border border-gold/30 bg-gold/5 px-3 py-1 text-[11px] uppercase tracking-[0.25em] text-gold">
            <Sparkles className="h-3 w-3" />
            Honest pricing
          </div>
          <h1 className="mt-7 font-display text-5xl leading-[1.02] tracking-[-0.02em] md:text-7xl">
            <span className="display-gradient">Priced like a tool</span>
            <br />
            <span className="display-gradient">you want to keep.</span>
          </h1>
          <p className="mx-auto mt-6 max-w-xl text-balance text-muted md:text-lg">
            Free for the workflow. Pro to remove the watermark, save your brand,
            and ship faster than you can context-switch. Studio when one creator
            becomes a team.
          </p>
        </div>
      </section>

      {/* Plans */}
      <section className="border-t border-border/60 bg-bg-deep">
        <div className="mx-auto max-w-6xl px-5 py-20">
          <div className="grid gap-5 lg:grid-cols-3">
            {PLANS.map((p) => (
              <div
                key={p.name}
                className={[
                  "relative flex flex-col rounded-2xl border bg-surface p-7",
                  p.featured
                    ? "border-gold/60 shadow-[0_0_60px_-20px_rgba(212,175,55,0.35)]"
                    : "border-border",
                ].join(" ")}
              >
                {p.featured && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full border border-gold/40 bg-bg px-3 py-1 text-[10px] uppercase tracking-[0.25em] text-gold">
                    Most chosen
                  </div>
                )}
                <div className="text-[11px] uppercase tracking-[0.25em] text-muted">
                  {p.name}
                </div>
                <div className="mt-3 flex items-baseline gap-1.5">
                  <span className="font-display text-5xl tracking-tight text-text">
                    {p.price}
                  </span>
                  <span className="text-sm text-muted">/ {p.cadence}</span>
                </div>
                <p className="mt-3 text-sm leading-relaxed text-muted">{p.blurb}</p>

                <ul className="mt-7 flex-1 space-y-2.5">
                  {p.features.map((f) => (
                    <li key={f.label} className="flex items-start gap-2 text-[13px]">
                      {f.included ? (
                        <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-gold" />
                      ) : (
                        <Minus className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted/50" />
                      )}
                      <span className={f.included ? "text-text/90" : "text-muted/60"}>
                        {f.label}
                      </span>
                    </li>
                  ))}
                </ul>

                <Link
                  href={p.href}
                  className={[
                    "mt-7 inline-flex items-center justify-center gap-1.5 rounded-full px-5 py-3 text-sm font-semibold transition",
                    p.featured
                      ? "bg-gold text-black hover:bg-gold-light"
                      : "border border-border-strong text-text hover:border-gold/60 hover:text-gold",
                  ].join(" ")}
                >
                  {p.cta}
                  <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </div>
            ))}
          </div>

          {/* fair-trade note */}
          <p className="mx-auto mt-10 max-w-2xl text-center text-xs leading-relaxed text-muted">
            Built in Victoria, BC. No usage-based surprise bills. No hidden seat fees.
            If a generation fails, it doesn&apos;t count against your quota. Cancel anytime —
            we&apos;ll keep your work for 90 days in case you come back.
          </p>
        </div>
      </section>

      {/* FAQ */}
      <section className="border-t border-border/60">
        <div className="mx-auto max-w-3xl px-5 py-20">
          <div className="mb-10">
            <div className="text-[11px] uppercase tracking-[0.25em] text-gold/80">
              Common questions
            </div>
            <h2 className="mt-2 font-display text-3xl tracking-tight md:text-4xl">
              Before you click subscribe.
            </h2>
          </div>
          <div className="divide-y divide-border/60">
            {FAQ.map((f) => (
              <details key={f.q} className="group py-5">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4">
                  <span className="font-display text-lg text-text">{f.q}</span>
                  <span className="text-gold transition-transform group-open:rotate-45">+</span>
                </summary>
                <p className="mt-3 text-[15px] leading-relaxed text-muted">{f.a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="border-t border-border/60 bg-bg-deep">
        <div className="mx-auto max-w-4xl px-5 py-20 text-center">
          <h2 className="font-display text-3xl leading-[1.1] tracking-tight md:text-5xl">
            <span className="text-text">Start free.</span>{" "}
            <span className="display-gradient">Stay because it works.</span>
          </h2>
          <p className="mx-auto mt-5 max-w-xl text-muted">
            No card on Starter. Trial Creator for 14 days. Cancel by replying to any email.
          </p>
          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link
              href="/pre-production"
              className="inline-flex items-center gap-2 rounded-full bg-gold px-6 py-3 text-sm font-semibold text-black transition hover:bg-gold-light"
            >
              Start free
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
