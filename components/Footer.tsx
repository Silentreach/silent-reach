"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import Logo from "@/components/Logo";

export default function Footer() {
  const pathname = usePathname();

  // Hide on chromeless auth routes (login, magic-link callback, etc.)
  if (pathname.startsWith("/login") || pathname.startsWith("/auth/")) {
    return null;
  }

  return (
    <footer className="border-t border-border/60 bg-bg-deep">
      <div className="mx-auto grid max-w-6xl gap-10 px-5 py-14 md:grid-cols-[1.5fr_1fr_1fr_1fr_1fr]">
        <div>
          <Logo size="md" muted />
          <p className="mt-4 max-w-xs text-sm leading-relaxed text-muted">
            From design to distribution.
            The production OS for BC video creators going past their followers.
          </p>
        </div>

        <FooterCol
          title="Pre-Production"
          links={[
            { href: "/pre-production", label: "Brief generator" },
            { href: "/pre-production#address", label: "Address research", soon: true },
          ]}
        />

        <FooterCol
          title="Production"
          links={[
            { href: "/production", label: "Shot deck" },
            { href: "/settings/gear", label: "Gear profile", soon: true },
          ]}
        />

        <FooterCol
          title="Post-Production"
          links={[
            { href: "/post-production", label: "Editor's playbook" },
            { href: "/thumbnail-studio", label: "Thumbnail studio" },
          ]}
        />

        <FooterCol
          title="Mintflow"
          links={[
            { href: "/distribution", label: "Distribution" },
            { href: "/pricing", label: "Pricing" },
            { href: "/about", label: "About" },
          ]}
        />
      </div>
      <div className="border-t border-border/50">
        <div className="mx-auto flex max-w-6xl flex-col items-start gap-3 px-5 py-5 text-[12px] text-muted md:flex-row md:items-center md:justify-between">
          <span className="flex flex-wrap items-center gap-3">
            <span>© {new Date().getFullYear()} Mintflow. Built in Victoria, BC.</span>
            <span className="text-muted/60">·</span>
            <span className="text-muted/80">
              Map data ©{" "}
              <a
                href="https://www.openstreetmap.org/copyright"
                target="_blank"
                rel="noopener noreferrer"
                className="underline decoration-muted/40 underline-offset-2 hover:text-gold"
              >
                OpenStreetMap
              </a>{" "}
              contributors, ODbL
            </span>
          </span>
          <span className="text-muted/70">Quiet content. Loud reach.</span>
        </div>
      </div>
    </footer>
  );
}

function FooterCol({
  title,
  links,
}: {
  title: string;
  links: { href: string; label: string; soon?: boolean }[];
}) {
  return (
    <div>
      <h4 className="mb-3 text-[11px] font-semibold uppercase tracking-[0.2em] text-gold/80">
        {title}
      </h4>
      <ul className="space-y-2 text-sm">
        {links.map((l) => (
          <li key={l.href + l.label}>
            <Link href={l.href} className="text-muted transition-colors hover:text-text">
              {l.label}
              {l.soon && <span className="ml-1.5 text-[10px] uppercase tracking-wider text-gold/60">Soon</span>}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
