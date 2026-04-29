import type { Metadata } from "next";
import PricingPlans from "@/components/PricingPlans";

export const metadata: Metadata = {
  title: "Pricing",
  description:
    "Free for your first brief. Creator $29 / month CAD for solo creators. Studio $79 / month for agencies. Brokerage on request.",
};

export default function PricingPage() {
  return (
    <div className="-mt-10">
      {/* ============ HERO ============ */}
      <section className="hero-glow relative overflow-hidden">
        <div className="mx-auto max-w-4xl px-5 pt-24 pb-12 text-center md:pt-32">
          <div className="inline-flex items-center gap-2 rounded-full border border-gold/30 bg-gold/5 px-3 py-1 text-[11px] uppercase tracking-[0.25em] text-gold">
            Pricing
          </div>
          <h1 className="mt-7 font-display text-[42px] leading-[1.02] tracking-[-0.025em] sm:text-5xl md:text-[64px]">
            <span className="display-gradient">Pick a tier when you&rsquo;re ready.</span>
          </h1>
          <p className="mx-auto mt-6 max-w-xl text-base leading-relaxed text-muted md:text-lg">
            Mintflow is in private beta until June 1, 2026. Join the waitlist and
            we&rsquo;ll grandfather you at this price for 12 months.
          </p>
        </div>
      </section>

      {/* ============ PLANS (client component for the toggle + modal) ============ */}
      <section className="border-t border-border/60">
        <PricingPlans />
      </section>

      {/* ============ FAQ ============ */}
      <section className="border-t border-border/60 bg-bg-deep">
        <div className="mx-auto max-w-3xl px-5 py-20">
          <h2 className="font-display text-3xl tracking-tight text-text md:text-4xl">
            Common questions
          </h2>
          <div className="mt-10 space-y-8 text-[15px] leading-relaxed text-muted">
            <Faq q="When do paid plans go live?">
              We&rsquo;re activating paid tiers on June 1, 2026. Until then, the app
              runs on invite codes and the Free tier is open to everyone on the list.
              Anyone who joins the waitlist before launch is grandfathered at the
              current price for twelve months.
            </Faq>
            <Faq q="What does the Free tier actually include?">
              One brief per month, full Pre-Production output, one watermarked
              Distribution reel. Enough to fall in love. Not enough to run a business.
            </Faq>
            <Faq q="Is there a trial for Studio?">
              Yes. Fourteen days, no credit card. After expiry, the account drops to
              Free unless you upgrade. Studio adds Shot Review, the LUT pack, and
              voice-over scripts when those ship in v2.
            </Faq>
            <Faq q="What&rsquo;s in Brokerage?">
              Ten seats, white-label brand kit, priority support, and an API path for
              brokerages running multi-agent workflows. Talk to us.
            </Faq>
            <Faq q="Annual billing?">
              Two months free when paid annually. Annual billing activates with the
              June 1 launch.
            </Faq>
            <Faq q="Cancellations?">
              Cancel any time, no email back-and-forth. Annual prepayments are not
              refundable mid-term, but we&rsquo;ll honor the remaining months.
            </Faq>
          </div>
        </div>
      </section>
    </div>
  );
}

function Faq({ q, children }: { q: string; children: React.ReactNode }) {
  return (
    <div>
      <h3 className="font-display text-lg text-text md:text-xl">{q}</h3>
      <p className="mt-2.5">{children}</p>
    </div>
  );
}
