import Link from "next/link";
import { Mic, Palette, Sparkles } from "lucide-react";

export const metadata = {
  title: "Settings — Mintflow",
  description: "Brand voice and brand kit. Mintflow uses these to tune every generation to sound and look like you.",
};

const NAV = [
  { href: "/settings/voice",      label: "Voice",     icon: Mic },
  { href: "/settings/brand-kit",  label: "Brand kit", icon: Palette },
];

export default function SettingsLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="-mt-10">
      {/* Hero */}
      <section className="hero-glow border-b border-border/60">
        <div className="mx-auto max-w-5xl px-5 pt-20 pb-10 text-center md:pt-24">
          <div className="inline-flex items-center gap-2 rounded-full border border-gold/30 bg-gold/5 px-3 py-1 text-[11px] uppercase tracking-[0.25em] text-gold">
            <Sparkles className="h-3 w-3" />
            Settings
          </div>
          <h1 className="mt-5 font-display text-4xl leading-[1.05] tracking-tight md:text-5xl">
            <span className="display-gradient">Make Mintflow sound like you.</span>
          </h1>
          <p className="mx-auto mt-4 max-w-xl text-balance text-muted">
            Brand voice and brand kit. Set these once — every brief, caption pack, and thumbnail uses them automatically.
          </p>
        </div>
      </section>

      {/* Two-column layout: nav + content */}
      <section className="mx-auto max-w-5xl px-5 py-12">
        <div className="grid gap-8 md:grid-cols-[200px_1fr]">
          <nav className="space-y-1">
            {NAV.map((item) => {
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className="flex items-center gap-2.5 rounded-md px-3 py-2 text-sm text-muted transition hover:bg-surface hover:text-text"
                >
                  <Icon className="h-3.5 w-3.5 text-gold/70" />
                  {item.label}
                </Link>
              );
            })}
          </nav>
          <div>{children}</div>
        </div>
      </section>
    </div>
  );
}
