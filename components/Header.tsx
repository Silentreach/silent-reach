"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import Logo from "@/components/Logo";
import UserMenu from "@/components/UserMenu";

interface NavItem {
  href: string;
  label: string;
  /** True if any sub-route under href should highlight this link */
  prefixMatch?: boolean;
}

const NAV: NavItem[] = [
  { href: "/pre-production",  label: "Pre-Production",  prefixMatch: true },
  { href: "/production",      label: "Production",      prefixMatch: true },
  { href: "/post-production", label: "Post-Production", prefixMatch: true },
  { href: "/distribution",    label: "Distribution",    prefixMatch: true },
  { href: "/pricing",         label: "Pricing"                            },
];

export default function Header() {
  const pathname = usePathname();

  // Hide nav on chromeless auth routes (login, magic-link callback, etc.)
  if (pathname.startsWith("/login") || pathname.startsWith("/auth/")) {
    return null;
  }

  return (
    <header className="sticky top-0 z-30 border-b border-border/70 bg-bg/80 backdrop-blur-xl">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-6 px-5 py-3.5">
        <Link href="/" aria-label="Mintflow home" className="shrink-0">
          <Logo size="sm" />
        </Link>

        <nav className="hidden items-center gap-1 text-[13px] md:flex">
          {NAV.map((item) => {
            const active = item.prefixMatch
              ? pathname === item.href || pathname.startsWith(item.href + "/")
              : pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={[
                  "relative rounded-full px-3 py-1.5 transition-colors",
                  active ? "text-gold" : "text-muted hover:text-text",
                ].join(" ")}
              >
                {item.label}
                {active && (
                  <span className="absolute inset-x-2 -bottom-px h-px bg-gold/70" />
                )}
              </Link>
            );
          })}
        </nav>

        <UserMenu />
      </div>

      {/* Mobile pillar strip — keeps the four-pillar story visible on phones */}
      <div className="md:hidden border-t border-border/50 bg-bg-deep/40">
        <nav className="mx-auto flex max-w-6xl items-center gap-1 overflow-x-auto px-5 py-2 text-[12px] [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {NAV.map((item) => {
            const active = item.prefixMatch
              ? pathname === item.href || pathname.startsWith(item.href + "/")
              : pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={[
                  "shrink-0 rounded-full px-2.5 py-1 transition-colors",
                  active ? "text-gold" : "text-muted hover:text-text",
                ].join(" ")}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
      </div>
    </header>
  );
}
