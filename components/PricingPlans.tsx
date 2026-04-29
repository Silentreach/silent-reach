"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Check, X, ArrowRight, Loader2 } from "lucide-react";

type Cadence = "monthly" | "annual";
type Tier = "free" | "creator" | "studio" | "brokerage";

interface Plan {
  id: Tier;
  name: string;
  headline: string;
  monthly: number | null; // null = custom / free
  blurb: string;
  features: { label: string; included: boolean | string }[];
  cta: { label: string; mode: "free" | "waitlist" | "contact" };
  featured?: boolean;
}

const PLANS: Plan[] = [
  {
    id: "free",
    name: "Free",
    headline: "See the magic.",
    monthly: 0,
    blurb: "1 brief per month. Full Pre-Production. One watermarked reel.",
    features: [
      { label: "1 brief / month",                          included: true },
      { label: "Address-driven Pre-Production",            included: true },
      { label: "1 watermarked Distribution reel",          included: true },
      { label: "Shot list, hooks, opener variants",        included: true },
      { label: "Brand kit (logo, fonts, palette)",         included: false },
      { label: "Production deck + gear profile",           included: false },
      { label: "Editor's playbook",                        included: false },
      { label: "Shot Review (v2)",                         included: false },
    ],
    cta: { label: "Start free", mode: "free" },
  },
  {
    id: "creator",
    name: "Creator",
    headline: "Ship a video a week.",
    monthly: 29,
    blurb: "For solo realtors and creators who post 3+ reels a week.",
    featured: true,
    features: [
      { label: "15 briefs / month",                        included: true },
      { label: "Address-driven Pre-Production",            included: true },
      { label: "30 reels / month, no watermark",           included: true },
      { label: "Production deck + gear profile",           included: true },
      { label: "Editor's playbook + signature look",       included: true },
      { label: "Brand kit (1)",                            included: true },
      { label: "Saved hooks library",                      included: true },
      { label: "3-Direction Brainstorm",                   included: true },
    ],
    cta: { label: "Get Creator", mode: "waitlist" },
  },
  {
    id: "studio",
    name: "Studio",
    headline: "Run a real business.",
    monthly: 79,
    blurb: "Unlimited everything, plus the v2 features when they ship.",
    features: [
      { label: "Unlimited briefs",                         included: true },
      { label: "Unlimited reels, no watermark",            included: true },
      { label: "Everything in Creator",                    included: true },
      { label: "Shot Review (v2)",                         included: true },
      { label: "LUT pack — BC Coastal Warm + 2 (v2)",     included: true },
      { label: "Voice-over scripts (v2.5: ElevenLabs)",   included: true },
      { label: "Brand kits (3)",                           included: true },
      { label: "Team seats (2)",                           included: true },
    ],
    cta: { label: "Get Studio", mode: "waitlist" },
  },
  {
    id: "brokerage",
    name: "Brokerage",
    headline: "Equip a whole team.",
    monthly: null,
    blurb: "Ten seats, white-label, priority support, API path.",
    features: [
      { label: "10 seats included",                        included: true },
      { label: "White-label brand kit",                    included: true },
      { label: "Priority support",                         included: true },
      { label: "API access (v3)",                          included: true },
      { label: "Custom onboarding session",                included: true },
      { label: "Brokerage admin role",                     included: true },
      { label: "SSO (v3)",                                 included: true },
      { label: "Dedicated account manager",                included: true },
    ],
    cta: { label: "Talk to us", mode: "contact" },
  },
];

const ANNUAL_DISCOUNT = 2 / 12; // 2 months free

export default function PricingPlans() {
  const [cadence, setCadence] = useState<Cadence>("annual");
  const [modal, setModal] = useState<{ tier: Exclude<Tier, "free" | "brokerage"> } | null>(null);

  return (
    <div className="mx-auto max-w-7xl px-5 py-16">
      {/* Cadence toggle */}
      <div className="flex justify-center">
        <div
          role="tablist"
          aria-label="Billing cadence"
          className="inline-flex items-center rounded-full border border-border/70 bg-bg-deep/40 p-1 text-[12px]"
        >
          <CadenceButton
            active={cadence === "monthly"}
            onClick={() => setCadence("monthly")}
            label="Monthly"
          />
          <CadenceButton
            active={cadence === "annual"}
            onClick={() => setCadence("annual")}
            label="Annual"
            badge="2 months free"
          />
        </div>
      </div>

      {/* Plan grid */}
      <div className="mt-12 grid gap-5 md:grid-cols-2 xl:grid-cols-4">
        {PLANS.map((plan) => (
          <PlanCard
            key={plan.id}
            plan={plan}
            cadence={cadence}
            onWaitlist={(tier) => setModal({ tier })}
          />
        ))}
      </div>

      <p className="mt-10 text-center text-[12px] text-muted/80">
        All prices in CAD. Taxes added at checkout. No charges until June 1, 2026.
      </p>

      {modal && (
        <WaitlistModal
          tier={modal.tier}
          cadence={cadence}
          onClose={() => setModal(null)}
        />
      )}
    </div>
  );
}

function CadenceButton({
  active,
  onClick,
  label,
  badge,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  badge?: string;
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={[
        "flex items-center gap-2 rounded-full px-4 py-1.5 transition",
        active ? "bg-gold text-black" : "text-muted hover:text-text",
      ].join(" ")}
    >
      {label}
      {badge && (
        <span
          className={[
            "rounded-full px-1.5 py-0.5 text-[10px] uppercase tracking-[0.15em]",
            active ? "bg-black/15 text-black" : "bg-gold/15 text-gold",
          ].join(" ")}
        >
          {badge}
        </span>
      )}
    </button>
  );
}

function PlanCard({
  plan,
  cadence,
  onWaitlist,
}: {
  plan: Plan;
  cadence: Cadence;
  onWaitlist: (tier: Exclude<Tier, "free" | "brokerage">) => void;
}) {
  const monthlyEffective =
    plan.monthly === null
      ? null
      : cadence === "annual"
        ? plan.monthly * (1 - ANNUAL_DISCOUNT)
        : plan.monthly;

  const handleCta = () => {
    if (plan.cta.mode === "waitlist") {
      onWaitlist(plan.id as "creator" | "studio");
    }
  };

  return (
    <div
      className={[
        "relative flex flex-col rounded-2xl border bg-bg p-6 transition",
        plan.featured
          ? "border-gold/50 bg-gradient-to-b from-gold/[0.06] to-transparent"
          : "border-border/70 hover:border-gold/30",
      ].join(" ")}
    >
      {plan.featured && (
        <div className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full border border-gold/40 bg-gold px-3 py-1 text-[10px] uppercase tracking-[0.2em] text-black">
          Most popular
        </div>
      )}

      <div>
        <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-gold/80">
          {plan.name}
        </div>
        <div className="mt-2 text-[13px] text-muted">{plan.headline}</div>
      </div>

      <div className="mt-5 flex items-baseline gap-1.5">
        {plan.monthly === null ? (
          <span className="font-display text-3xl text-text">Custom</span>
        ) : (
          <>
            <span className="font-display text-4xl text-text">
              ${monthlyEffective!.toFixed(monthlyEffective! % 1 === 0 ? 0 : 2)}
            </span>
            <span className="text-[13px] text-muted">
              CAD&thinsp;/&thinsp;mo
            </span>
          </>
        )}
      </div>
      {plan.monthly !== null && plan.monthly > 0 && cadence === "annual" && (
        <div className="mt-1 text-[11px] text-gold/80">
          Billed annually · Save ${(plan.monthly * 12 * ANNUAL_DISCOUNT).toFixed(0)}
        </div>
      )}

      <p className="mt-5 text-[13px] leading-relaxed text-muted">{plan.blurb}</p>

      <ul className="mt-6 space-y-2.5">
        {plan.features.map((f) => (
          <li key={f.label} className="flex items-start gap-2 text-[13px]">
            {f.included ? (
              <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-gold" />
            ) : (
              <X className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted/50" />
            )}
            <span className={f.included ? "text-text/90" : "text-muted/60 line-through"}>
              {f.label}
            </span>
          </li>
        ))}
      </ul>

      <div className="mt-7">
        {plan.cta.mode === "free" ? (
          <Link
            href="/pre-production"
            className="group flex w-full items-center justify-center gap-1.5 rounded-full border border-border-strong px-4 py-2.5 text-[13px] font-semibold text-text transition hover:border-gold/60 hover:text-gold"
          >
            {plan.cta.label}
            <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
          </Link>
        ) : plan.cta.mode === "contact" ? (
          <a
            href="mailto:info@deloarhossain.ca?subject=Mintflow%20Brokerage%20enquiry"
            className="group flex w-full items-center justify-center gap-1.5 rounded-full border border-border-strong px-4 py-2.5 text-[13px] font-semibold text-text transition hover:border-gold/60 hover:text-gold"
          >
            {plan.cta.label}
            <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
          </a>
        ) : (
          <button
            type="button"
            onClick={handleCta}
            className={[
              "group flex w-full items-center justify-center gap-1.5 rounded-full px-4 py-2.5 text-[13px] font-semibold transition",
              plan.featured
                ? "bg-gold text-black hover:bg-gold-light"
                : "border border-border-strong text-text hover:border-gold/60 hover:text-gold",
            ].join(" ")}
          >
            {plan.cta.label}
            <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
          </button>
        )}
      </div>
    </div>
  );
}

function WaitlistModal({
  tier,
  cadence,
  onClose,
}: {
  tier: "creator" | "studio";
  cadence: Cadence;
  onClose: () => void;
}) {
  const [email, setEmail] = useState("");
  const [state, setState] = useState<"idle" | "submitting" | "success" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState<string>("");

  // Trap ESC + lock body scroll while open.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  const submit = async () => {
    if (state === "submitting") return;
    setState("submitting");
    setErrorMsg("");
    try {
      const res = await fetch("/api/waitlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: email.trim(),
          tier,
          cadence,
          source: "/pricing",
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.error || "Could not save your spot.");
      }
      setState("success");
    } catch (err) {
      setState("error");
      setErrorMsg(err instanceof Error ? err.message : "Something went wrong.");
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="waitlist-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4 backdrop-blur-sm animate-fade-up"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-md overflow-hidden rounded-2xl border border-border/70 bg-bg-deep shadow-2xl">
        <div className="px-6 pt-6">
          <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-gold/80">
            {tier} waitlist
          </div>
          <h2 id="waitlist-title" className="mt-2 font-display text-2xl tracking-tight text-text">
            {state === "success" ? "You're on the list." : "Get grandfathered pricing."}
          </h2>
          <p className="mt-2.5 text-[13px] leading-relaxed text-muted">
            {state === "success"
              ? "We'll email you on launch day. No spam, no marketing list resold."
              : "Paid plans go live June 1, 2026. Drop your email — we'll lock you in at this price for 12 months."}
          </p>
        </div>

        {state !== "success" && (
          <form
            className="px-6 pt-5 pb-6"
            onSubmit={(e) => {
              e.preventDefault();
              submit();
            }}
          >
            <label htmlFor="waitlist-email" className="sr-only">
              Email address
            </label>
            <input
              id="waitlist-email"
              type="email"
              required
              autoFocus
              autoComplete="email"
              placeholder="you@yourbusiness.ca"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={state === "submitting"}
              className="w-full rounded-md border border-border bg-bg px-3 py-2.5 text-[14px] text-text placeholder:text-muted/50 focus:border-gold/60 focus:outline-none disabled:opacity-60"
            />

            {state === "error" && (
              <div className="mt-3 rounded-md border border-red-500/30 bg-red-500/5 px-3 py-2 text-[12px] text-red-300">
                {errorMsg}
              </div>
            )}

            <div className="mt-4 flex flex-col items-stretch gap-2 sm:flex-row sm:items-center">
              <button
                type="submit"
                disabled={state === "submitting" || !email}
                className="group inline-flex items-center justify-center gap-1.5 rounded-full bg-gold px-4 py-2.5 text-[13px] font-semibold text-black transition hover:bg-gold-light disabled:cursor-not-allowed disabled:opacity-60"
              >
                {state === "submitting" ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    Saving…
                  </>
                ) : (
                  <>
                    Save my spot
                    <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
                  </>
                )}
              </button>
              <button
                type="button"
                onClick={onClose}
                disabled={state === "submitting"}
                className="rounded-full px-4 py-2.5 text-[13px] text-muted transition hover:text-text"
              >
                Maybe later
              </button>
            </div>
          </form>
        )}

        {state === "success" && (
          <div className="px-6 pt-5 pb-6">
            <button
              type="button"
              onClick={onClose}
              className="inline-flex items-center justify-center gap-1.5 rounded-full bg-gold px-4 py-2.5 text-[13px] font-semibold text-black transition hover:bg-gold-light"
            >
              Done
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
