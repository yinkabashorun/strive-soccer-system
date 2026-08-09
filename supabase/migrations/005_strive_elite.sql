-- =====================================================================
-- Strive Elite — premium coaching platform schema
-- =====================================================================
-- All Strive Elite tables are namespaced with an `elite_` prefix so they
-- coexist safely with the existing Strive OS tables (players, sessions,
-- leads, …) in the same Supabase project.
--
-- Roles: coach, player, admin. Players belong to a coach. Everything a
-- player owns (homework, progress, film, messages, reports) is readable by
-- that player and their coach, and writable per the rules below.
-- =====================================================================

create extension if not exists "pgcrypto";

do $$ begin
  create type strive_role as enum ('coach', 'player', 'admin');
exception when duplicate_object then null; end $$;

do $$ begin
  create type strive_sub_status as enum ('active','trialing','past_due','canceled','none');
exception when duplicate_object then null; end $$;

-- elite_profiles -------------------------------------------------------
create table if not exists public.elite_profiles (
  id           uuid primary key references auth.users(id) on delete cascade,
  role         strive_role not null default 'player',
  full_name    text not null default '',
  email        text not null default '',
  avatar_color text not null default '#E5FF3D',
  created_at   timestamptz not null default now()
);

-- elite_players --------------------------------------------------------
create table if not exists public.elite_players (
  id                  uuid primary key default gen_random_uuid(),
  profile_id          uuid references public.elite_profiles(id) on delete cascade,
  coach_id            uuid references public.elite_profiles(id) on delete set null,
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
create index if not exists elite_players_coach_idx on public.elite_players(coach_id);
create index if not exists elite_players_profile_idx on public.elite_players(profile_id);

-- elite_homework -------------------------------------------------------
create table if not exists public.elite_homework (
  id           uuid primary key default gen_random_uuid(),
  player_id    uuid not null references public.elite_players(id) on delete cascade,
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
create index if not exists elite_homework_player_idx on public.elite_homework(player_id);

-- elite_sessions -------------------------------------------------------
create table if not exists public.elite_sessions (
  id           uuid primary key default gen_random_uuid(),
  player_id    uuid not null references public.elite_players(id) on delete cascade,
  coach_id     uuid references public.elite_profiles(id) on delete set null,
  title        text not null default 'Training Session',
  focus        text not null default '',
  raw_notes    text not null default '',
  session_date timestamptz not null default now(),
  created_at   timestamptz not null default now()
);
create index if not exists elite_sessions_player_idx on public.elite_sessions(player_id);

-- elite_progress -------------------------------------------------------
create table if not exists public.elite_progress (
  id         uuid primary key default gen_random_uuid(),
  player_id  uuid not null references public.elite_players(id) on delete cascade,
  metric     text not null,
  value      int not null default 0 check (value between 0 and 100),
  prev_value int not null default 0,
  updated_at timestamptz not null default now(),
  unique (player_id, metric)
);
create index if not exists elite_progress_player_idx on public.elite_progress(player_id);

-- elite_film_uploads ---------------------------------------------------
create table if not exists public.elite_film_uploads (
  id          uuid primary key default gen_random_uuid(),
  player_id   uuid not null references public.elite_players(id) on delete cascade,
  title       text not null,
  url         text,
  thumbnail   text,
  coach_notes text,
  status      text not null default 'Uploaded',
  created_at  timestamptz not null default now()
);
create index if not exists elite_film_player_idx on public.elite_film_uploads(player_id);

-- elite_coach_notes ----------------------------------------------------
create table if not exists public.elite_coach_notes (
  id         uuid primary key default gen_random_uuid(),
  player_id  uuid not null references public.elite_players(id) on delete cascade,
  body       text not null,
  created_at timestamptz not null default now()
);
create index if not exists elite_notes_player_idx on public.elite_coach_notes(player_id);

-- elite_messages -------------------------------------------------------
create table if not exists public.elite_messages (
  id         uuid primary key default gen_random_uuid(),
  player_id  uuid not null references public.elite_players(id) on delete cascade,
  from_role  strive_role not null,
  from_name  text not null default '',
  body       text not null,
  read       boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists elite_messages_player_idx on public.elite_messages(player_id);

-- elite_weekly_plans ---------------------------------------------------
create table if not exists public.elite_weekly_plans (
  id         uuid primary key default gen_random_uuid(),
  player_id  uuid not null references public.elite_players(id) on delete cascade,
  week       int not null default 1,
  focus      text not null default '',
  objectives text[] not null default '{}',
  homework   jsonb not null default '[]',
  created_at timestamptz not null default now()
);
create index if not exists elite_plans_player_idx on public.elite_weekly_plans(player_id);

-- elite_parent_reports -------------------------------------------------
create table if not exists public.elite_parent_reports (
  id          uuid primary key default gen_random_uuid(),
  player_id   uuid not null references public.elite_players(id) on delete cascade,
  summary     text not null default '',
  improvement text not null default '',
  homework    text not null default '',
  next_focus  text not null default '',
  created_at  timestamptz not null default now()
);
create index if not exists elite_reports_player_idx on public.elite_parent_reports(player_id);

-- elite_achievements ---------------------------------------------------
create table if not exists public.elite_achievements (
  id         uuid primary key default gen_random_uuid(),
  player_id  uuid not null references public.elite_players(id) on delete cascade,
  title      text not null,
  detail     text not null default '',
  icon       text not null default 'Trophy',
  earned_at  timestamptz not null default now()
);
create index if not exists elite_achievements_player_idx on public.elite_achievements(player_id);

-- elite_subscriptions --------------------------------------------------
create table if not exists public.elite_subscriptions (
  id                     uuid primary key default gen_random_uuid(),
  profile_id             uuid references public.elite_profiles(id) on delete cascade,
  stripe_customer_id     text,
  stripe_subscription_id text,
  status                 strive_sub_status not null default 'none',
  plan                   text not null default '',
  current_period_end     timestamptz,
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now()
);
create index if not exists elite_subs_profile_idx on public.elite_subscriptions(profile_id);

-- =====================================================================
-- Helper functions
-- =====================================================================
create or replace function public.elite_is_coach()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.elite_profiles p
    where p.id = auth.uid() and p.role in ('coach','admin')
  );
$$;

create or replace function public.elite_owns_player(p_player_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.elite_players pl
    where pl.id = p_player_id and pl.profile_id = auth.uid()
  );
$$;

-- =====================================================================
-- Row Level Security
-- =====================================================================
alter table public.elite_profiles       enable row level security;
alter table public.elite_players        enable row level security;
alter table public.elite_homework       enable row level security;
alter table public.elite_sessions       enable row level security;
alter table public.elite_progress       enable row level security;
alter table public.elite_film_uploads   enable row level security;
alter table public.elite_coach_notes    enable row level security;
alter table public.elite_messages       enable row level security;
alter table public.elite_weekly_plans   enable row level security;
alter table public.elite_parent_reports enable row level security;
alter table public.elite_achievements   enable row level security;
alter table public.elite_subscriptions  enable row level security;

drop policy if exists elite_profiles_self on public.elite_profiles;
create policy elite_profiles_self on public.elite_profiles
  for select using (id = auth.uid() or public.elite_is_coach());
drop policy if exists elite_profiles_update_self on public.elite_profiles;
create policy elite_profiles_update_self on public.elite_profiles
  for update using (id = auth.uid());

drop policy if exists elite_players_read on public.elite_players;
create policy elite_players_read on public.elite_players
  for select using (public.elite_is_coach() or profile_id = auth.uid());
drop policy if exists elite_players_coach_write on public.elite_players;
create policy elite_players_coach_write on public.elite_players
  for all using (public.elite_is_coach()) with check (public.elite_is_coach());

-- generic per-player child-table policies
do $$
declare t text;
begin
  foreach t in array array[
    'elite_sessions','elite_progress','elite_film_uploads','elite_coach_notes',
    'elite_weekly_plans','elite_parent_reports','elite_achievements'
  ]
  loop
    execute format('drop policy if exists %I_read on public.%I;', t, t);
    execute format($f$
      create policy %1$I_read on public.%1$I
        for select using (public.elite_is_coach() or public.elite_owns_player(player_id));
    $f$, t);
    execute format('drop policy if exists %I_coach_write on public.%I;', t, t);
    execute format($f$
      create policy %1$I_coach_write on public.%1$I
        for all using (public.elite_is_coach()) with check (public.elite_is_coach());
    $f$, t);
  end loop;
end $$;

-- homework: coach full access; player can read + update their own rows.
drop policy if exists elite_homework_read on public.elite_homework;
create policy elite_homework_read on public.elite_homework
  for select using (public.elite_is_coach() or public.elite_owns_player(player_id));
drop policy if exists elite_homework_coach_write on public.elite_homework;
create policy elite_homework_coach_write on public.elite_homework
  for all using (public.elite_is_coach()) with check (public.elite_is_coach());
drop policy if exists elite_homework_player_complete on public.elite_homework;
create policy elite_homework_player_complete on public.elite_homework
  for update using (public.elite_owns_player(player_id))
  with check (public.elite_owns_player(player_id));

-- messages: coach full access; player reads their own + may insert.
drop policy if exists elite_messages_read on public.elite_messages;
create policy elite_messages_read on public.elite_messages
  for select using (public.elite_is_coach() or public.elite_owns_player(player_id));
drop policy if exists elite_messages_coach_write on public.elite_messages;
create policy elite_messages_coach_write on public.elite_messages
  for all using (public.elite_is_coach()) with check (public.elite_is_coach());
drop policy if exists elite_messages_player_insert on public.elite_messages;
create policy elite_messages_player_insert on public.elite_messages
  for insert with check (public.elite_owns_player(player_id));

-- film: player may upload their own film + read; coach full access.
drop policy if exists elite_film_player_insert on public.elite_film_uploads;
create policy elite_film_player_insert on public.elite_film_uploads
  for insert with check (public.elite_owns_player(player_id));

-- subscriptions: owner reads their own; coaches read all.
drop policy if exists elite_subs_read on public.elite_subscriptions;
create policy elite_subs_read on public.elite_subscriptions
  for select using (profile_id = auth.uid() or public.elite_is_coach());

-- =====================================================================
-- New-user trigger: create an elite_profiles row from auth metadata
-- =====================================================================
create or replace function public.handle_new_elite_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.elite_profiles (id, role, full_name, email, avatar_color)
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

drop trigger if exists on_auth_user_created_elite on auth.users;
create trigger on_auth_user_created_elite
  after insert on auth.users
  for each row execute function public.handle_new_elite_user();

-- =====================================================================
-- Storage bucket for film uploads
-- =====================================================================
insert into storage.buckets (id, name, public)
values ('elite-film', 'elite-film', false)
on conflict (id) do nothing;

drop policy if exists elite_film_read on storage.objects;
create policy elite_film_read on storage.objects
  for select using (bucket_id = 'elite-film' and auth.role() = 'authenticated');
drop policy if exists elite_film_write on storage.objects;
create policy elite_film_write on storage.objects
  for insert with check (bucket_id = 'elite-film' and auth.role() = 'authenticated');
