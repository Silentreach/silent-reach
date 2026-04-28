-- =====================================================================
-- Day 6 — Storage migration: brand_kit, voice_notes, reel outcomes
-- =====================================================================

alter table public.organizations
  add column if not exists brand_kit jsonb not null default '{}'::jsonb;

alter table public.users
  add column if not exists voice_notes text not null default '',
  add column if not exists migrated_localstorage_at timestamptz;

alter table public.reels
  add column if not exists outcome_status text default 'pending',
  add column if not exists outcome_reach  integer,
  add column if not exists outcome_notes  text,
  add column if not exists outcome_updated_at timestamptz;

create table if not exists public.library_items (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.users(id) on delete cascade,
  org_id      uuid not null references public.organizations(id) on delete cascade,
  kind        text not null,
  text        text not null,
  source      text,
  tags        text[] default '{}'::text[],
  created_at  timestamptz not null default now()
);

create index if not exists library_items_user_id_idx on public.library_items (user_id);
create index if not exists library_items_org_id_idx  on public.library_items (org_id);

alter table public.library_items enable row level security;

drop policy if exists "library_all_self" on public.library_items;
create policy "library_all_self" on public.library_items
  for all using (user_id = auth.uid())
  with check (user_id = auth.uid());
