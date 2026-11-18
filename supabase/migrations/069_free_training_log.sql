-- =====================================================================
-- Strive Elite - the free training log (Nov 18 2026)
-- =====================================================================
-- A free account logs the training a player does on their own, against a
-- weekly target, and shares the week. No drills, no courses, no plan.
--
-- ISOLATED FROM MEMBERS ON PURPOSE: a free account is an elite_profiles
-- row (role 'player') with a row in elite_trackers and NO row in
-- elite_players. The plan builder, the live-week audit, the roster, the
-- digest, the push counts and every other member query read
-- elite_players, so none of them can ever see a free account.
--
-- Every table is written by the server only (service role, after it has
-- checked who is signed in). RLS: the owner reads their own rows, a coach
-- reads all, nobody writes directly. Rows leave with the account (on
-- delete cascade from elite_profiles).
--
-- Written so each statement can be run on its own, in this order. No
-- DROP anywhere. Safe to run twice.
-- =====================================================================

set lock_timeout = '8s';

-- 1) The free account: the three quiz answers, the weekly target, and the
--    link the player shares.
create table if not exists public.elite_trackers (
  profile_id     uuid primary key references public.elite_profiles(id) on delete cascade,
  phone          text,
  level          text check (level is null or level in ('rec', 'travel', 'elite', 'high_school', 'college')),
  season         text check (season is null or season in ('in_season', 'off_season')),
  goal           text check (goal is null or goal in ('start', 'higher_team', 'college', 'pro')),
  target_minutes integer check (target_minutes is null or (target_minutes between 30 and 2400)),
  quiz           jsonb not null default '{}'::jsonb,
  quiz_done_at   timestamptz,
  referral_code  text not null unique,
  referred_by    uuid references public.elite_profiles(id) on delete set null,
  created_at     timestamptz not null default now()
);

create index if not exists elite_trackers_referred_by_idx
  on public.elite_trackers (referred_by);

alter table public.elite_trackers enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'elite_trackers'
      and policyname = 'elite_trackers_owner_read'
  ) then
    create policy elite_trackers_owner_read on public.elite_trackers
      for select using (profile_id = auth.uid());
  end if;
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'elite_trackers'
      and policyname = 'elite_trackers_coach_read'
  ) then
    create policy elite_trackers_coach_read on public.elite_trackers
      for select using (public.elite_is_coach());
  end if;
end $$;

-- 2) One row per thing logged: the day (New York date), the minutes, and
--    whether it was training or gym work. Gym is kept apart: it never
--    counts toward the weekly target, and only a high school or college
--    player can log it (the server action refuses anyone else).
create table if not exists public.elite_training_logs (
  id         uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.elite_trackers(profile_id) on delete cascade,
  trained_on date not null,
  minutes    integer not null check (minutes between 1 and 300),
  kind       text not null default 'training' check (kind in ('training', 'gym')),
  created_at timestamptz not null default now()
);

create index if not exists elite_training_logs_profile_day_idx
  on public.elite_training_logs (profile_id, trained_on);

alter table public.elite_training_logs enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'elite_training_logs'
      and policyname = 'elite_training_logs_owner_read'
  ) then
    create policy elite_training_logs_owner_read on public.elite_training_logs
      for select using (profile_id = auth.uid());
  end if;
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'elite_training_logs'
      and policyname = 'elite_training_logs_coach_read'
  ) then
    create policy elite_training_logs_coach_read on public.elite_training_logs
      for select using (public.elite_is_coach());
  end if;
end $$;

-- 3) The recommended weekly target, by season. A coach edits the two rows
--    at /coach/free.
create table if not exists public.elite_target_table (
  season      text primary key check (season in ('in_season', 'off_season')),
  minutes     integer not null check (minutes between 30 and 2400),
  minutes_max integer check (minutes_max is null or (minutes_max > minutes and minutes_max <= 2400)),
  updated_at  timestamptz not null default now()
);

alter table public.elite_target_table enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'elite_target_table'
      and policyname = 'elite_target_table_read'
  ) then
    create policy elite_target_table_read on public.elite_target_table
      for select using (auth.uid() is not null);
  end if;
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'elite_target_table'
      and policyname = 'elite_target_table_coach_write'
  ) then
    create policy elite_target_table_coach_write on public.elite_target_table
      for all using (public.elite_is_coach()) with check (public.elite_is_coach());
  end if;
end $$;

-- Coach Yinka's numbers (Nov 18 2026): in season, 4 extra hours a week.
-- Off season, 6 to 12 hours a week. These are training hours; gym work
-- is tracked apart and has no target. An existing row is never
-- overwritten.
insert into public.elite_target_table (season, minutes, minutes_max)
values ('in_season', 240, null), ('off_season', 360, 720)
on conflict (season) do nothing;

-- 4) App-wide switches a coach flips. First one: whether anyone can make
--    a free account. CLOSED until a coach opens it at /coach/free.
create table if not exists public.elite_settings (
  key        text primary key,
  value      jsonb not null,
  updated_at timestamptz not null default now()
);

alter table public.elite_settings enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'elite_settings'
      and policyname = 'elite_settings_coach_all'
  ) then
    create policy elite_settings_coach_all on public.elite_settings
      for all using (public.elite_is_coach()) with check (public.elite_is_coach());
  end if;
end $$;

insert into public.elite_settings (key, value)
values ('free_signup_open', 'false'::jsonb)
on conflict (key) do nothing;
