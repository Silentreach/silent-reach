"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { LayoutDashboard, FolderOpen, SlidersHorizontal, LogOut, ChevronDown } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

interface MeState {
  loaded: boolean;
  email: string | null;
  initials: string;
}

function makeInitials(email: string | null): string {
  if (!email) return "??";
  const local = email.split("@")[0] ?? "";
  const parts = local.split(/[._-]/).filter(Boolean);
  const first = parts[0]?.[0] ?? local[0] ?? "?";
  const second = parts[1]?.[0] ?? local[1] ?? "";
  return (first + second).toUpperCase();
}

export default function UserMenu() {
  const [me, setMe] = useState<MeState>({ loaded: false, email: null, initials: "??" });
  const [open, setOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement | null>(null);

  // Hydrate the current user once on mount.
  useEffect(() => {
    const supabase = createClient();
    let cancelled = false;
    supabase.auth.getUser().then(({ data }) => {
      if (cancelled) return;
      const email = data.user?.email ?? null;
      setMe({ loaded: true, email, initials: makeInitials(email) });
    });
    return () => {
      cancelled = true;
    };
  }, []);

  // Close on outside click + ESC.
  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (!dropdownRef.current) return;
      if (!dropdownRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  // Pre-hydration: render a neutral placeholder so the layout doesn't shift.
  if (!me.loaded) {
    return (
      <div className="h-7 w-16 animate-pulse rounded-full border border-border/60 bg-bg-deep/40" aria-hidden />
    );
  }

  // Logged out: simple Sign In pill.
  if (!me.email) {
    return (
      <Link
        href="/login"
        className="rounded-full border border-gold/40 bg-gold/10 px-3.5 py-1.5 text-[13px] font-medium text-gold transition hover:bg-gold/15"
      >
        Sign in
      </Link>
    );
  }

  // Logged in: avatar + dropdown.
  return (
    <div ref={dropdownRef} className="relative">
      <button
        type="button"
        aria-label="Account menu"
        aria-expanded={open}
        aria-haspopup="menu"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1.5 rounded-full border border-border/60 bg-bg-deep/40 py-1 pl-1 pr-2 text-[13px] text-text transition hover:border-gold/50"
      >
        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-gradient-to-br from-gold/30 to-gold/10 text-[11px] font-semibold text-gold">
          {me.initials}
        </span>
        <ChevronDown className={`h-3.5 w-3.5 text-muted transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 top-[calc(100%+8px)] z-40 w-60 overflow-hidden rounded-xl border border-border/70 bg-bg-deep/95 shadow-2xl backdrop-blur-xl"
        >
          <div className="border-b border-border/60 px-3.5 py-3">
            <div className="text-[10px] uppercase tracking-[0.2em] text-muted/80">Signed in as</div>
            <div className="mt-1 truncate text-[13px] text-text">{me.email}</div>
          </div>

          <div className="py-1">
            <MenuLink href="/dashboard" icon={<LayoutDashboard className="h-3.5 w-3.5" />}>
              Dashboard
            </MenuLink>
            <MenuLink href="/library" icon={<FolderOpen className="h-3.5 w-3.5" />}>
              Library
            </MenuLink>
            <MenuLink href="/settings" icon={<SlidersHorizontal className="h-3.5 w-3.5" />}>
              Settings
            </MenuLink>
          </div>

          <form action="/api/auth/signout" method="post" className="border-t border-border/60">
            <button
              type="submit"
              role="menuitem"
              className="flex w-full items-center gap-2 px-3.5 py-2.5 text-left text-[13px] text-muted transition hover:bg-bg/50 hover:text-text"
              onClick={() => setOpen(false)}
            >
              <LogOut className="h-3.5 w-3.5" />
              Sign out
            </button>
          </form>
        </div>
      )}
    </div>
  );
}

function MenuLink({
  href,
  icon,
  children,
}: {
  href: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      role="menuitem"
      className="flex items-center gap-2 px-3.5 py-2 text-[13px] text-muted transition hover:bg-bg/50 hover:text-text"
    >
      {icon}
      {children}
    </Link>
  );
}
