-- Tartarus multi-tenant schema (Supabase / Postgres)
-- Run this in the Supabase SQL editor. Every table is isolated by organization
-- through Row Level Security, so a user only ever sees rows for orgs they belong to.

-- ── Extensions ───────────────────────────────────────────────────────────────
create extension if not exists "pgcrypto";

-- ── Profiles (mirror of auth.users) ─────────────────────────────────────────
create table if not exists public.profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  email       text,
  full_name   text,
  avatar_url  text,
  created_at  timestamptz not null default now()
);
alter table public.profiles enable row level security;

-- ── Organizations and membership ─────────────────────────────────────────────
create table if not exists public.organizations (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  slug        text unique not null,
  created_by  uuid references auth.users(id) on delete set null,
  created_at  timestamptz not null default now()
);
alter table public.organizations enable row level security;

create type public.member_role as enum ('owner', 'admin', 'member');

create table if not exists public.memberships (
  org_id   uuid references public.organizations(id) on delete cascade,
  user_id  uuid references auth.users(id) on delete cascade,
  role     public.member_role not null default 'member',
  created_at timestamptz not null default now(),
  primary key (org_id, user_id)
);
alter table public.memberships enable row level security;

-- Helper: is the current user a member of this org?
create or replace function public.is_member(target_org uuid)
returns boolean language sql security definer stable set search_path = public as $$
  select exists (
    select 1 from public.memberships m
    where m.org_id = target_org and m.user_id = auth.uid()
  );
$$;

-- ── Connected repositories ────────────────────────────────────────────────────
create table if not exists public.repositories (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid not null references public.organizations(id) on delete cascade,
  full_name   text not null,                 -- "owner/name"
  provider    text not null default 'github',
  sentinel    boolean not null default false, -- zero-click hunting enabled
  created_at  timestamptz not null default now(),
  unique (org_id, full_name)
);
alter table public.repositories enable row level security;

-- ── Hunts ─────────────────────────────────────────────────────────────────────
create type public.hunt_status as enum ('queued','scanning','detonating','awaiting_approval','patching','done','denied','error');

create table if not exists public.hunts (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid not null references public.organizations(id) on delete cascade,
  repo        text not null,
  trigger     text not null default 'manual', -- manual | webhook | schedule
  status      public.hunt_status not null default 'queued',
  created_by  uuid references auth.users(id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
alter table public.hunts enable row level security;
create index if not exists hunts_org_created_idx on public.hunts (org_id, created_at desc);

-- ── Findings ──────────────────────────────────────────────────────────────────
create type public.severity as enum ('low','medium','high','critical');

create table if not exists public.findings (
  id            uuid primary key default gen_random_uuid(),
  hunt_id       uuid not null references public.hunts(id) on delete cascade,
  org_id        uuid not null references public.organizations(id) on delete cascade,
  vuln_type     text not null,
  severity      public.severity not null default 'high',
  file_path     text,
  confidence    numeric,
  exploit_proof text,                         -- sandbox stdout / evidence
  created_at    timestamptz not null default now()
);
alter table public.findings enable row level security;

-- ── Pull requests ─────────────────────────────────────────────────────────────
create table if not exists public.pull_requests (
  id           uuid primary key default gen_random_uuid(),
  finding_id   uuid references public.findings(id) on delete cascade,
  org_id       uuid not null references public.organizations(id) on delete cascade,
  url          text,
  number       integer,
  review_state text default 'open',           -- open | changes_requested | approved | merged
  created_at   timestamptz not null default now()
);
alter table public.pull_requests enable row level security;

-- ── Hunt event timeline (drives the live dashboard) ──────────────────────────
create table if not exists public.hunt_events (
  id        bigint generated always as identity primary key,
  hunt_id   uuid not null references public.hunts(id) on delete cascade,
  org_id    uuid not null references public.organizations(id) on delete cascade,
  kind      text not null,                    -- boot | phase | scan | verdict | approval_required | ...
  message   text not null,
  data      jsonb,
  ts        timestamptz not null default now()
);
alter table public.hunt_events enable row level security;
create index if not exists hunt_events_hunt_idx on public.hunt_events (hunt_id, id);

-- ── RLS policies ──────────────────────────────────────────────────────────────
-- Profiles: a user reads and edits only their own row.
create policy "profiles self read"  on public.profiles for select using (id = auth.uid());
create policy "profiles self write" on public.profiles for update using (id = auth.uid());

-- Organizations: members can read; any authed user can create.
create policy "org read"   on public.organizations for select using (public.is_member(id));
create policy "org insert" on public.organizations for insert with check (created_by = auth.uid());

-- Memberships: you can see rows for orgs you belong to.
create policy "membership read" on public.memberships for select using (public.is_member(org_id));

-- Org-scoped tables: full access limited to members of the row's org.
create policy "repos rw"    on public.repositories  for all using (public.is_member(org_id)) with check (public.is_member(org_id));
create policy "hunts rw"    on public.hunts         for all using (public.is_member(org_id)) with check (public.is_member(org_id));
create policy "findings rw" on public.findings      for all using (public.is_member(org_id)) with check (public.is_member(org_id));
create policy "prs rw"      on public.pull_requests for all using (public.is_member(org_id)) with check (public.is_member(org_id));
create policy "events rw"   on public.hunt_events   for all using (public.is_member(org_id)) with check (public.is_member(org_id));

-- ── On signup: create a profile and a personal org with owner membership ─────
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare new_org uuid;
begin
  insert into public.profiles (id, email, full_name, avatar_url)
  values (new.id, new.email,
          coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name'),
          new.raw_user_meta_data->>'avatar_url');

  insert into public.organizations (name, slug, created_by)
  values (coalesce(new.raw_user_meta_data->>'name', split_part(new.email,'@',1)) || '''s workspace',
          'org-' || substr(new.id::text, 1, 8), new.id)
  returning id into new_org;

  insert into public.memberships (org_id, user_id, role) values (new_org, new.id, 'owner');
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Realtime: let clients subscribe to live hunt events.
alter publication supabase_realtime add table public.hunt_events;
alter publication supabase_realtime add table public.hunts;
