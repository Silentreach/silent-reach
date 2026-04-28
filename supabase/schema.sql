-- =====================================================================
-- Mintflow multi-tenant schema
-- Run once in Supabase SQL Editor: https://supabase.com/dashboard/project/_/sql
--
-- Design notes:
--   * Every "tenant" is an `organization`. A user belongs to exactly one org.
--     For solo users (Deloar at Silent Story) the org is just "you".
--     For agencies later, multiple users live under one org.
--   * `users` extends Supabase's built-in `auth.users` with profile + org_id.
--   * SaaS billing columns (plan_tier, subscription_status, stripe_customer_id)
--     are placeholders — we do NOT integrate Stripe yet. They sit as defaults
--     ("trial" / null) so the schema is ready to flip on later without a
--     migration.
--   * RLS is ON for every user-facing table. Server routes use the service-role
--     key when they need to bypass RLS (admin invite mint, usage logging).
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. ORGANIZATIONS
-- ---------------------------------------------------------------------
create table if not exists public.organizations (
  id                    uuid primary key default gen_random_uuid(),
  name                  text not null,
  slug                  text unique,
  plan_tier             text not null default 'trial',
  subscription_status   text not null default 'active',
  stripe_customer_id    text,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- 2. USERS
-- ---------------------------------------------------------------------
create table if not exists public.users (
  id              uuid primary key references auth.users(id) on delete cascade,
  email           text not null unique,
  full_name       text,
  org_id          uuid not null references public.organizations(id) on delete cascade,
  role            text not null default 'member',
  is_super_admin  boolean not null default false,
  niche           text default 'real_estate',
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index if not exists users_org_id_idx on public.users (org_id);

-- ---------------------------------------------------------------------
-- 3. INVITE_CODES
-- ---------------------------------------------------------------------
create table if not exists public.invite_codes (
  code            text primary key,
  created_by      uuid references public.users(id) on delete set null,
  intended_email  text,
  org_id          uuid references public.organizations(id) on delete set null,
  redeemed_at     timestamptz,
  redeemed_by     uuid references public.users(id) on delete set null,
  expires_at      timestamptz not null default (now() + interval '30 days'),
  notes           text,
  created_at      timestamptz not null default now()
);

create index if not exists invite_codes_intended_email_idx on public.invite_codes (intended_email);

-- ---------------------------------------------------------------------
-- 4. REELS
-- ---------------------------------------------------------------------
create table if not exists public.reels (
  id                uuid primary key default gen_random_uuid(),
  org_id            uuid not null references public.organizations(id) on delete cascade,
  user_id           uuid not null references public.users(id) on delete cascade,
  title             text,
  source_video_url  text,
  duration_sec      numeric,
  content_type      text default 'real_estate',
  packages_json     jsonb,
  rendered_urls     jsonb,
  status            text not null default 'draft',
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create index if not exists reels_org_id_idx on public.reels (org_id);
create index if not exists reels_user_id_idx on public.reels (user_id);

-- ---------------------------------------------------------------------
-- 5. VOICE_SAMPLES
-- ---------------------------------------------------------------------
create table if not exists public.voice_samples (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.users(id) on delete cascade,
  org_id      uuid not null references public.organizations(id) on delete cascade,
  text        text not null,
  source      text default 'manual',
  created_at  timestamptz not null default now()
);

create index if not exists voice_samples_user_id_idx on public.voice_samples (user_id);

-- ---------------------------------------------------------------------
-- 6. USAGE_LOG
-- ---------------------------------------------------------------------
create table if not exists public.usage_log (
  id              uuid primary key default gen_random_uuid(),
  org_id          uuid not null references public.organizations(id) on delete cascade,
  user_id         uuid references public.users(id) on delete set null,
  feature         text not null,
  model           text not null,
  input_tokens    integer not null default 0,
  output_tokens   integer not null default 0,
  cost_usd_cents  integer not null default 0,
  created_at      timestamptz not null default now()
);

create index if not exists usage_log_org_id_created_at_idx on public.usage_log (org_id, created_at desc);

-- ---------------------------------------------------------------------
-- 7. updated_at trigger
-- ---------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_orgs_updated_at on public.organizations;
create trigger trg_orgs_updated_at
  before update on public.organizations
  for each row execute function public.set_updated_at();

drop trigger if exists trg_users_updated_at on public.users;
create trigger trg_users_updated_at
  before update on public.users
  for each row execute function public.set_updated_at();

drop trigger if exists trg_reels_updated_at on public.reels;
create trigger trg_reels_updated_at
  before update on public.reels
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------
-- 8. ROW LEVEL SECURITY
-- ---------------------------------------------------------------------
alter table public.organizations enable row level security;
alter table public.users         enable row level security;
alter table public.invite_codes  enable row level security;
alter table public.reels         enable row level security;
alter table public.voice_samples enable row level security;
alter table public.usage_log     enable row level security;

create or replace function public.current_org_id()
returns uuid language sql stable security definer as $$
  select org_id from public.users where id = auth.uid();
$$;

-- ---------------------------------------------------------------------
-- 9. RLS POLICIES
-- ---------------------------------------------------------------------
drop policy if exists "org_select_own" on public.organizations;
create policy "org_select_own" on public.organizations
  for select using (id = public.current_org_id());

drop policy if exists "org_update_own" on public.organizations;
create policy "org_update_own" on public.organizations
  for update using (
    id = public.current_org_id()
    and exists (
      select 1 from public.users
      where users.id = auth.uid() and users.role in ('owner', 'admin')
    )
  );

drop policy if exists "users_select_self_or_org" on public.users;
create policy "users_select_self_or_org" on public.users
  for select using (
    id = auth.uid() or org_id = public.current_org_id()
  );

drop policy if exists "users_update_self" on public.users;
create policy "users_update_self" on public.users
  for update using (id = auth.uid());

drop policy if exists "reels_all_in_org" on public.reels;
create policy "reels_all_in_org" on public.reels
  for all using (org_id = public.current_org_id())
  with check (org_id = public.current_org_id());

drop policy if exists "voice_all_self" on public.voice_samples;
create policy "voice_all_self" on public.voice_samples
  for all using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists "usage_select_in_org" on public.usage_log;
create policy "usage_select_in_org" on public.usage_log
  for select using (org_id = public.current_org_id());

-- ---------------------------------------------------------------------
-- 10. AUTO-CREATE org+user when a new auth.users row appears
-- ---------------------------------------------------------------------
create or replace function public.handle_new_auth_user()
returns trigger language plpgsql security definer as $$
declare
  v_org_id   uuid;
  v_org_name text;
  v_role     text;
  v_super    boolean := false;
begin
  if (new.raw_user_meta_data ->> 'org_id') is not null then
    v_org_id := (new.raw_user_meta_data ->> 'org_id')::uuid;
    v_role   := coalesce(new.raw_user_meta_data ->> 'role', 'member');
  else
    v_org_name := coalesce(new.raw_user_meta_data ->> 'org_name',
                           split_part(new.email, '@', 1));
    insert into public.organizations (name)
      values (v_org_name)
      returning id into v_org_id;
    v_role := 'owner';
  end if;

  if new.email in ('dh.nfchs.f@gmail.com', 'info@deloarhossain.ca') then
    v_super := true;
    v_role  := 'owner';
  end if;

  insert into public.users (id, email, org_id, role, is_super_admin, full_name)
    values (
      new.id,
      new.email,
      v_org_id,
      v_role,
      v_super,
      new.raw_user_meta_data ->> 'full_name'
    );

  return new;
end;
$$;

drop trigger if exists trg_handle_new_auth_user on auth.users;
create trigger trg_handle_new_auth_user
  after insert on auth.users
  for each row execute function public.handle_new_auth_user();
