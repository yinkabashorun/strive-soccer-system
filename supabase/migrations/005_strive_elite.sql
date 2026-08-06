-- =====================================================================
-- Strive Elite — premium coaching platform schema
-- =====================================================================
-- Roles: coach, player, admin. Players belong to a coach. Everything a
-- player owns (homework, progress, film, messages, reports) is readable by
-- that player and their coach, and writable per the rules below.
--
-- Apply with the Supabase SQL editor or `supabase db push`.
-- =====================================================================

-- Extensions -----------------------------------------------------------
create extension if not exists "pgcrypto";

-- Enums ----------------------------------------------------------------
do $$ begin
  create type strive_role as enum ('coach', 'player', 'admin');
exception when duplicate_object then null; end $$;

do $$ begin
  create type strive_sub_status as enum ('active','trialing','past_due','canceled','none');
exception when duplicate_object then null; end $$;

-- profiles -------------------------------------------------------------
-- One row per auth user. Created by a trigger on auth.users.
create table if not exists public.profiles (
  id           uuid primary key references auth.users(id) on delete cascade,
  role         strive_role not null default 'player',
  full_name    text not null default '',
  email        text not null default '',
  avatar_color text not null default '#E5FF3D',
  created_at   timestamptz not null default now()
);

-- players --------------------------------------------------------------
create table if not exists public.players (
  id                  uuid primary key default gen_random_uuid(),
  profile_id          uuid references public.profiles(id) on delete cascade,
  coach_id            uuid references public.profiles(id) on delete set null,
  full_name           text not null,
  avatar_color        text not null default '#E5FF3D',
  age                 int not null default 0,
  position            text not null default '',
  level               text not null default 'Developing',
  current_week        int not null default 1,
  today_focus         text not null default '',
  goals               text[] not null default '{}',
  strengths           text[] not null default '{}',
  weaknesses          text[] not null default '{}',
  parent_name         text not null default '',
  parent_email        text not null default '',
  next_session_at     timestamptz,
  last_session_at     timestamptz,
  joined_at           date not null default now(),
  subscription_status strive_sub_status not null default 'none',
  created_at          timestamptz not null default now()
);
create index if not exists players_coach_idx on public.players(coach_id);
create index if not exists players_profile_idx on public.players(profile_id);

-- homework -------------------------------------------------------------
create table if not exists public.homework (
  id           uuid primary key default gen_random_uuid(),
  player_id    uuid not null references public.players(id) on delete cascade,
  week         int not null default 1,
  title        text not null,
  exercise     text not null default '',
  reps         text not null default '',
  video_url    text,
  notes        text,
  completed    boolean not null default false,
  completed_at timestamptz,
  sort         int not null default 0,
  created_at   timestamptz not null default now()
);
create index if not exists homework_player_idx on public.homework(player_id);

-- sessions -------------------------------------------------------------
create table if not exists public.sessions (
  id          uuid primary key default gen_random_uuid(),
  player_id   uuid not null references public.players(id) on delete cascade,
  coach_id    uuid references public.profiles(id) on delete set null,
  title       text not null default 'Training Session',
  focus       text not null default '',
  raw_notes   text not null default '',
  session_date timestamptz not null default now(),
  created_at  timestamptz not null default now()
);
create index if not exists sessions_player_idx on public.sessions(player_id);

-- progress -------------------------------------------------------------
create table if not exists public.progress (
  id         uuid primary key default gen_random_uuid(),
  player_id  uuid not null references public.players(id) on delete cascade,
  metric     text not null,
  value      int not null default 0 check (value between 0 and 100),
  prev_value int not null default 0,
  updated_at timestamptz not null default now(),
  unique (player_id, metric)
);
create index if not exists progress_player_idx on public.progress(player_id);

-- film_uploads ---------------------------------------------------------
create table if not exists public.film_uploads (
  id          uuid primary key default gen_random_uuid(),
  player_id   uuid not null references public.players(id) on delete cascade,
  title       text not null,
  url         text,
  thumbnail   text,
  coach_notes text,
  status      text not null default 'Uploaded',
  created_at  timestamptz not null default now()
);
create index if not exists film_player_idx on public.film_uploads(player_id);

-- coach_notes ----------------------------------------------------------
create table if not exists public.coach_notes (
  id         uuid primary key default gen_random_uuid(),
  player_id  uuid not null references public.players(id) on delete cascade,
  body       text not null,
  created_at timestamptz not null default now()
);
create index if not exists notes_player_idx on public.coach_notes(player_id);

-- messages -------------------------------------------------------------
create table if not exists public.messages (
  id         uuid primary key default gen_random_uuid(),
  player_id  uuid not null references public.players(id) on delete cascade,
  from_role  strive_role not null,
  from_name  text not null default '',
  body       text not null,
  read       boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists messages_player_idx on public.messages(player_id);

-- weekly_plans ---------------------------------------------------------
create table if not exists public.weekly_plans (
  id         uuid primary key default gen_random_uuid(),
  player_id  uuid not null references public.players(id) on delete cascade,
  week       int not null default 1,
  focus      text not null default '',
  objectives text[] not null default '{}',
  homework   jsonb not null default '[]',
  created_at timestamptz not null default now()
);
create index if not exists plans_player_idx on public.weekly_plans(player_id);

-- parent_reports -------------------------------------------------------
create table if not exists public.parent_reports (
  id          uuid primary key default gen_random_uuid(),
  player_id   uuid not null references public.players(id) on delete cascade,
  summary     text not null default '',
  improvement text not null default '',
  homework    text not null default '',
  next_focus  text not null default '',
  created_at  timestamptz not null default now()
);
create index if not exists reports_player_idx on public.parent_reports(player_id);

-- achievements ---------------------------------------------------------
create table if not exists public.achievements (
  id         uuid primary key default gen_random_uuid(),
  player_id  uuid not null references public.players(id) on delete cascade,
  title      text not null,
  detail     text not null default '',
  icon       text not null default 'Trophy',
  earned_at  timestamptz not null default now()
);
create index if not exists achievements_player_idx on public.achievements(player_id);

-- subscriptions --------------------------------------------------------
create table if not exists public.subscriptions (
  id                     uuid primary key default gen_random_uuid(),
  profile_id             uuid references public.profiles(id) on delete cascade,
  stripe_customer_id     text,
  stripe_subscription_id text,
  status                 strive_sub_status not null default 'none',
  plan                   text not null default '',
  current_period_end     timestamptz,
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now()
);
create index if not exists subs_profile_idx on public.subscriptions(profile_id);

-- =====================================================================
-- Helper functions
-- =====================================================================
create or replace function public.is_coach()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role in ('coach','admin')
  );
$$;

-- true when the current user owns (is the profile behind) this player row
create or replace function public.owns_player(p_player_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.players pl
    where pl.id = p_player_id and pl.profile_id = auth.uid()
  );
$$;

-- =====================================================================
-- Row Level Security
-- =====================================================================
alter table public.profiles       enable row level security;
alter table public.players        enable row level security;
alter table public.homework       enable row level security;
alter table public.sessions       enable row level security;
alter table public.progress       enable row level security;
alter table public.film_uploads   enable row level security;
alter table public.coach_notes    enable row level security;
alter table public.messages       enable row level security;
alter table public.weekly_plans   enable row level security;
alter table public.parent_reports enable row level security;
alter table public.achievements   enable row level security;
alter table public.subscriptions  enable row level security;

-- profiles: a user reads/updates their own row; coaches read all.
drop policy if exists profiles_self on public.profiles;
create policy profiles_self on public.profiles
  for select using (id = auth.uid() or public.is_coach());
drop policy if exists profiles_update_self on public.profiles;
create policy profiles_update_self on public.profiles
  for update using (id = auth.uid());

-- players: coaches full access; a player reads their own player row.
drop policy if exists players_read on public.players;
create policy players_read on public.players
  for select using (public.is_coach() or profile_id = auth.uid());
drop policy if exists players_coach_write on public.players;
create policy players_coach_write on public.players
  for all using (public.is_coach()) with check (public.is_coach());

-- generic per-player child-table policies: coach full access; player
-- read-only on their own rows (except homework, where a player may flip
-- the completed flag — handled by an update policy below).
do $$
declare t text;
begin
  foreach t in array array[
    'sessions','progress','film_uploads','coach_notes',
    'weekly_plans','parent_reports','achievements'
  ]
  loop
    execute format('drop policy if exists %I_read on public.%I;', t, t);
    execute format($f$
      create policy %1$I_read on public.%1$I
        for select using (public.is_coach() or public.owns_player(player_id));
    $f$, t);
    execute format('drop policy if exists %I_coach_write on public.%I;', t, t);
    execute format($f$
      create policy %1$I_coach_write on public.%1$I
        for all using (public.is_coach()) with check (public.is_coach());
    $f$, t);
  end loop;
end $$;

-- homework: coach full access; player can read + update their own rows.
drop policy if exists homework_read on public.homework;
create policy homework_read on public.homework
  for select using (public.is_coach() or public.owns_player(player_id));
drop policy if exists homework_coach_write on public.homework;
create policy homework_coach_write on public.homework
  for all using (public.is_coach()) with check (public.is_coach());
drop policy if exists homework_player_complete on public.homework;
create policy homework_player_complete on public.homework
  for update using (public.owns_player(player_id))
  with check (public.owns_player(player_id));

-- messages: coach full access; player reads their own + may insert.
drop policy if exists messages_read on public.messages;
create policy messages_read on public.messages
  for select using (public.is_coach() or public.owns_player(player_id));
drop policy if exists messages_coach_write on public.messages;
create policy messages_coach_write on public.messages
  for all using (public.is_coach()) with check (public.is_coach());
drop policy if exists messages_player_insert on public.messages;
create policy messages_player_insert on public.messages
  for insert with check (public.owns_player(player_id));

-- film: player may upload their own film + read; coach full access.
drop policy if exists film_player_insert on public.film_uploads;
create policy film_player_insert on public.film_uploads
  for insert with check (public.owns_player(player_id));

-- subscriptions: owner reads their own; coaches read all.
drop policy if exists subs_read on public.subscriptions;
create policy subs_read on public.subscriptions
  for select using (profile_id = auth.uid() or public.is_coach());

-- =====================================================================
-- New-user trigger: create a profile row from auth metadata
-- =====================================================================
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, role, full_name, email, avatar_color)
  values (
    new.id,
    coalesce((new.raw_user_meta_data->>'role')::strive_role, 'player'),
    coalesce(new.raw_user_meta_data->>'full_name', ''),
    coalesce(new.email, ''),
    coalesce(new.raw_user_meta_data->>'avatar_color', '#E5FF3D')
  )
  on conflict (id) do nothing;
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- =====================================================================
-- Storage bucket for film uploads
-- =====================================================================
insert into storage.buckets (id, name, public)
values ('film', 'film', false)
on conflict (id) do nothing;

-- Authenticated users can read film in their coach/player scope; uploads
-- are namespaced under the player id as the first path segment.
drop policy if exists film_read on storage.objects;
create policy film_read on storage.objects
  for select using (bucket_id = 'film' and auth.role() = 'authenticated');
drop policy if exists film_write on storage.objects;
create policy film_write on storage.objects
  for insert with check (bucket_id = 'film' and auth.role() = 'authenticated');
