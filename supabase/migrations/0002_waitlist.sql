-- =====================================================================
-- Day 13 — Pricing waitlist (pre-Stripe)
-- =====================================================================
-- Captures interest in paid tiers before Stripe is wired. Promised
-- benefit: grandfathered pricing for 12 months once paid plans go live.
-- Public can insert (via service-role API route) but only super_admins
-- can read. No update / delete from the client.
-- =====================================================================

create table if not exists public.waitlist (
  id          uuid primary key default gen_random_uuid(),
  email       text not null,
  tier        text not null check (tier in ('creator','studio','brokerage')),
  cadence     text not null default 'monthly' check (cadence in ('monthly','annual')),
  source      text,                    -- which page / button drove the signup
  user_agent  text,                    -- coarse attribution
  created_at  timestamptz not null default now()
);

-- Email is lowercased in the API route before insert; this lets us
-- use ON CONFLICT (email, tier) directly without a functional index.
create unique index if not exists waitlist_email_tier_uniq
  on public.waitlist (email, tier);

create index if not exists waitlist_created_at_idx
  on public.waitlist (created_at desc);

alter table public.waitlist enable row level security;

-- Read access: super_admins only (used by an /admin/waitlist view later).
drop policy if exists "waitlist_read_super_admin" on public.waitlist;
create policy "waitlist_read_super_admin" on public.waitlist
  for select
  using (
    exists (
      select 1 from public.users u
      where u.id = auth.uid() and u.is_super_admin = true
    )
  );

-- No client-side insert/update/delete. The /api/waitlist route uses
-- the service-role client (bypasses RLS) to insert.
