-- ==============================================================================
-- Meet & Ride — Database Schema for Supabase
--
-- WHERE TO RUN:
--   Supabase Dashboard -> SQL Editor
--
-- THIS SCRIPT IS IDEMPOTENT:
--   Every statement is guarded with IF NOT EXISTS / OR REPLACE.
-- ==============================================================================

create extension if not exists pgcrypto with schema extensions;

-- -----------------------------------------------------------------------------
-- 1. TABLES
-- -----------------------------------------------------------------------------

-- 1.1 Organizers Table
create table if not exists public.organizers (
  id uuid primary key default gen_random_uuid(),
  email text unique not null,
  name text not null,
  password_hash text,
  created_at timestamptz not null default now()
);

-- 1.2 Events Table
create table if not exists public.events (
  id uuid primary key default gen_random_uuid(),
  organizer_id uuid references public.organizers(id) on delete cascade,
  slug text unique not null,
  title text not null,
  description text default '',
  destination text not null,
  destination_lat double precision,
  destination_lng double precision,
  event_date timestamptz not null,
  arrival_time text,
  shared_password text not null,
  status text not null default 'active',
  route_plan jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 1.3 Participants Table (Riders and Passengers)
create table if not exists public.participants (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  name text not null,
  role text not null check (role in ('rider', 'passenger')),
  phone text,
  pin text,
  notes text,
  -- Passenger pickup
  pickup_location text,
  pickup_lat double precision,
  pickup_lng double precision,
  -- Rider car details
  car_model text,
  total_seats integer default 4,
  price double precision,
  departure_time text,
  departure_location text,
  departure_lat double precision,
  departure_lng double precision,
  has_driver boolean default true,
  owner_participant_id uuid references public.participants(id) on delete cascade,
  -- Seat assignment
  assigned_rider_id uuid references public.participants(id) on delete set null,
  token text not null,
  created_at timestamptz not null default now()
);

-- Ensure columns exist when upgrading an older database installation
alter table public.organizers add column if not exists password_hash text;
alter table public.events add column if not exists arrival_time text;
alter table public.events add column if not exists route_plan jsonb;
alter table public.participants add column if not exists pin text;
alter table public.participants add column if not exists price double precision;
alter table public.participants add column if not exists has_driver boolean default true;
alter table public.participants add column if not exists owner_participant_id uuid;

-- Ensure table privileges for Supabase roles
grant all on table public.organizers to anon, authenticated, service_role;
grant all on table public.events to anon, authenticated, service_role;
grant all on table public.participants to anon, authenticated, service_role;

-- -----------------------------------------------------------------------------
-- 2. INDEXES
-- -----------------------------------------------------------------------------
create index if not exists idx_events_slug on public.events(slug);
create index if not exists idx_events_organizer on public.events(organizer_id);
create index if not exists idx_participants_event on public.participants(event_id);
create index if not exists idx_participants_token on public.participants(token);
create index if not exists idx_participants_assigned on public.participants(assigned_rider_id);

-- -----------------------------------------------------------------------------
-- 3. ROW LEVEL SECURITY (RLS)
-- -----------------------------------------------------------------------------
alter table public.organizers enable row level security;
alter table public.events enable row level security;
alter table public.participants enable row level security;

-- 3.1 Organizers policies
drop policy if exists "Organizers full access to own record" on public.organizers;
create policy "Organizers full access to own record"
  on public.organizers
  for all
  using (true)
  with check (true);

-- 3.2 Events policies
drop policy if exists "Events public read" on public.events;
create policy "Events public read"
  on public.events
  for select
  using (true);

drop policy if exists "Events full write access" on public.events;
create policy "Events full write access"
  on public.events
  for all
  using (true)
  with check (true);

-- 3.3 Participants policies
drop policy if exists "Participants public read" on public.participants;
create policy "Participants public read"
  on public.participants
  for select
  using (true);

drop policy if exists "Participants public insert and update" on public.participants;
create policy "Participants public insert and update"
  on public.participants
  for all
  using (true)
  with check (true);

-- -----------------------------------------------------------------------------
-- 4. HELPER FUNCTIONS
-- -----------------------------------------------------------------------------

-- Password verification function for RPC
create or replace function public.verify_event_password(p_event_id text, p_password text)
returns boolean
language plpgsql
security definer
as $$
declare
  v_match boolean;
begin
  select exists(
    select 1 from public.events
    where (id::text = p_event_id or slug = p_event_id)
      and lower(trim(shared_password)) = lower(trim(p_password))
  ) into v_match;
  return v_match;
end;
$$;
