"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import Logo from "@/components/Logo";

interface NavItem {
  href: string;
  label: string;
  /** Pillar grouping for visual subtlety */
  pillar?: "pre" | "prod" | "post";
}

const NAV: NavItem[] = [
  { href: "/pre-shoot",        label: "Brief",       pillar: "pre" },
  { href: "/production",       label: "Production",  pillar: "prod" },
  { href: "/post-upload",      label: "Pack",        pillar: "post" },
  { href: "/thumbnail-studio", label: "Thumbnails",  pillar: "post" },
];

export default function Header() {
  const pathname = usePathname();
  return (
    <header className="sticky top-0 z-30 border-b border-border/70 bg-bg/80 backdrop-blur-xl">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-3.5">
        <Logo size="sm" />
        <nav className="flex items-center gap-1 text-[13px]">
          {NAV.map((item) => {
            const active = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={[
                  "relative rounded-full px-3 py-1.5 transition-colors",
                  active
                    ? "text-gold"
                    : "text-muted hover:text-text",
                ].join(" ")}
              >
                {item.label}
                {active && (
                  <span className="absolute inset-x-2 -bottom-px h-px bg-gold/70" />
                )}
              </Link>
            );
          })}
          <span className="mx-2 hidden h-4 w-px bg-border md:inline-block" />
          <Link
            href="/history"
            className={[
              "hidden rounded-full px-3 py-1.5 transition-colors md:inline-block",
              pathname === "/history" ? "text-gold" : "text-muted hover:text-text",
            ].join(" ")}
          >
            History
          </Link>
        </nav>
      </div>
    </header>
  );
}
