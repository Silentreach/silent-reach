import Link from "next/link";
import { ArrowRight, Mic, Palette } from "lucide-react";

export default function SettingsIndex() {
  return (
    <div className="space-y-4">
      <Card
        href="/settings/voice"
        icon={Mic}
        title="Voice"
        body="Paste 3–5 of your best captions or hooks. Mintflow will match your vocabulary, rhythm, and emoji policy on every generation."
        cta="Set up your voice"
      />
      <Card
        href="/settings/brand-kit"
        icon={Palette}
        title="Brand kit"
        body="Brand name, tagline, two colors, optional logo. The Thumbnail Studio reads from here so you stop retyping."
        cta="Set up your brand kit"
      />
    </div>
  );
}

function Card({
  href, icon: Icon, title, body, cta,
}: { href: string; icon: typeof Mic; title: string; body: string; cta: string }) {
  return (
    <Link
      href={href}
      className="pillar-card group block rounded-2xl border border-border bg-surface p-6 transition hover:border-gold/60"
    >
      <div className="flex items-start justify-between">
        <Icon className="h-5 w-5 text-gold" />
        <span className="inline-flex items-center gap-1 text-sm text-gold transition-transform group-hover:translate-x-0.5">
          {cta} <ArrowRight className="h-3.5 w-3.5" />
        </span>
      </div>
      <h2 className="mt-5 font-display text-xl tracking-tight">{title}</h2>
      <p className="mt-2 text-sm leading-relaxed text-muted">{body}</p>
    </Link>
  );
}
