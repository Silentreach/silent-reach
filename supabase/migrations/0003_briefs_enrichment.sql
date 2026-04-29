-- =====================================================================
-- Day 14 — Pre-Production: briefs + free-API enrichment cache + gear profile
-- =====================================================================

-- One row per generated brief. Replaces the localStorage 'history' for
-- signed-in users and hosts the new niche/enrichment/creative-direction
-- fields shipping in Day 14.
create table if not exists public.briefs (
  id                  uuid primary key default gen_random_uuid(),
  org_id              uuid not null references public.organizations(id) on delete cascade,
  user_id             uuid not null references public.users(id) on delete cascade,

  -- The niche picker chooses one of these on entry.
  niche               text not null check (niche in ('real_estate','construction','general')),

  -- Optional address data (Real Estate primarily, Construction optionally).
  address             text,
  lat                 double precision,
  lng                 double precision,
  enrichment          jsonb,                -- { schools, parks, amenities, landmarks, walkScore, ... }

  -- Form inputs the user filled — niche-specific shape, stored as jsonb.
  inputs              jsonb not null,

  -- 3-Direction Brainstorm: stage-1 returns 3 directions, user picks one,
  -- stage-2 expands the chosen direction into the full brief.
  creative_directions jsonb,                -- the 3 directions returned by stage 1
  chosen_direction    text,                 -- id of the picked direction

  -- The full brief output (PreShootOutput schema, niche-augmented).
  brief_json          jsonb,

  -- Day 15 will write production_deck here. Day 16 will write editor_playbook.
  production_deck     jsonb,
  editor_playbook     jsonb,

  status              text not null default 'draft' check (status in ('draft','generated','archived')),
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

create index if not exists briefs_user_id_idx        on public.briefs (user_id);
create index if not exists briefs_org_id_idx         on public.briefs (org_id);
create index if not exists briefs_created_at_idx     on public.briefs (created_at desc);

alter table public.briefs enable row level security;

drop policy if exists "briefs_org_scope" on public.briefs;
create policy "briefs_org_scope" on public.briefs
  for all
  using (
    org_id in (select org_id from public.users where id = auth.uid())
  )
  with check (
    org_id in (select org_id from public.users where id = auth.uid())
  );


-- Cache for free-API enrichment lookups (Nominatim, Overpass, Walk Score).
-- Stops Mintflow from hammering the free APIs and respects their rate
-- limits. cache_key is e.g. 'geocode:868 orono ave saanich bc' or
-- 'nearby:48.5152,-123.3651:1km'.
create table if not exists public.enrichment_cache (
  cache_key   text primary key,
  payload     jsonb not null,
  expires_at  timestamptz not null,
  created_at  timestamptz not null default now()
);

create index if not exists enrichment_cache_expires_idx
  on public.enrichment_cache (expires_at);

-- enrichment_cache is service-role only; no RLS policies needed.
alter table public.enrichment_cache enable row level security;


-- Gear profile per user. Day 15 (Production deck) reads this so a no-drone
-- user never sees aerial shot recommendations.
alter table public.users
  add column if not exists gear_profile jsonb not null default '{}'::jsonb;
