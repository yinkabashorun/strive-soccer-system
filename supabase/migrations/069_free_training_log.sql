-- =====================================================================
-- Strive Elite - the free app (Nov 18 2026)
-- =====================================================================
-- Coach Yinka's words: "a BeReal app for soccer players to share
-- training to friends they have added on the app, then also the
-- accountability piece". A free account posts a photo of today's
-- training with how long it was, sees the friends it added do the same,
-- and keeps a week against a target on the days it planned. No drills,
-- no courses, no plan from us. 13 and older.
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
-- PHOTOS live in a private bucket that no browser can read or write: the
-- server uploads after it has checked who is signed in, and hands out a
-- short-lived signed address only to the player who posted it, to a
-- friend the feed rule allows (lib/elite/tracker.ts mayViewPhoto), and
-- to coaches.
--
-- Written so each statement can be run on its own, in this order. No
-- DROP anywhere. Safe to run twice.
-- =====================================================================

set lock_timeout = '8s';

-- 1) The free account: the month and year the player was born (asked
--    first; under 13 is turned away and nothing is stored), the four quiz
--    answers (grade, level, season, goal), the weekly target, the days of
--    the week the player plans to train (0 = Monday ... 6 = Sunday), and
--    the link the player shares. Grade is what decides whether a player
--    logs gym work: high school and older. playing_for is the one line a
--    player writes for their profile (40 characters, no links; a coach
--    can clear it). starred_at and starred_by are the coaches' star: set
--    and taken back by a coach only (the server action checks, and no
--    browser can write this table at all: there is no write policy).
create table if not exists public.elite_trackers (
  profile_id     uuid primary key references public.elite_profiles(id) on delete cascade,
  phone          text,
  birth_year     smallint check (birth_year is null or (birth_year between 1900 and 2100)),
  birth_month    smallint check (birth_month is null or (birth_month between 1 and 12)),
  grade          text check (grade is null or grade in ('middle_or_younger', 'high_school', 'college_or_older')),
  level          text check (level is null or level in ('rec', 'travel', 'elite', 'high_school', 'college')),
  season         text check (season is null or season in ('in_season', 'off_season')),
  goal           text check (goal is null or goal in ('start', 'higher_team', 'college', 'pro')),
  target_minutes integer check (target_minutes is null or (target_minutes between 30 and 2400)),
  plan_days      smallint[] not null default '{}' check (plan_days <@ array[0, 1, 2, 3, 4, 5, 6]::smallint[]),
  quiz           jsonb not null default '{}'::jsonb,
  quiz_done_at   timestamptz,
  referral_code  text not null unique,
  referred_by    uuid references public.elite_profiles(id) on delete set null,
  playing_for    text check (playing_for is null or char_length(playing_for) between 1 and 40),
  starred_at     timestamptz,
  starred_by     uuid references public.elite_profiles(id) on delete set null,
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
--    counts toward the weekly target, and only a player in high school
--    or older can log it (the server action refuses anyone else).
--
--    A POST is a row with a photo: photo_path is the object in the
--    private bucket (<profile id>/<log id>.jpg) and caption is the one
--    optional line. A row with no photo is a private entry: it counts
--    for the week and shows no card. When a coach takes a post down,
--    removed_at and removed_by are set and the file is deleted; the
--    minutes stay.
create table if not exists public.elite_training_logs (
  id         uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.elite_trackers(profile_id) on delete cascade,
  trained_on date not null,
  minutes    integer not null check (minutes between 1 and 300),
  kind       text not null default 'training' check (kind in ('training', 'gym')),
  photo_path text,
  caption    text check (caption is null or char_length(caption) <= 80),
  removed_at timestamptz,
  removed_by uuid references public.elite_profiles(id) on delete set null,
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

-- 3) Friends. Two free accounts are friends when one joined with the
--    other's link, or opened it while signed in and said yes. One row per
--    pair, the smaller id first, so a pair can never be stored twice.
--    Friends see each other's first name, last initial, training time
--    and posts. There is no board of all players: a player only ever
--    reads their own pairs.
create table if not exists public.elite_tracker_friends (
  a          uuid not null references public.elite_trackers(profile_id) on delete cascade,
  b          uuid not null references public.elite_trackers(profile_id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (a, b),
  check (a < b)
);

create index if not exists elite_tracker_friends_b_idx
  on public.elite_tracker_friends (b);

alter table public.elite_tracker_friends enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'elite_tracker_friends'
      and policyname = 'elite_tracker_friends_own_read'
  ) then
    create policy elite_tracker_friends_own_read on public.elite_tracker_friends
      for select using (a = auth.uid() or b = auth.uid());
  end if;
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'elite_tracker_friends'
      and policyname = 'elite_tracker_friends_coach_read'
  ) then
    create policy elite_tracker_friends_coach_read on public.elite_tracker_friends
      for select using (public.elite_is_coach());
  end if;
end $$;

-- 4) Blocks. One row when a player blocks another. Making one ends the
--    friendship (the server removes the pair), and while a row exists in
--    EITHER direction the two cannot become friends again, by link or
--    any other way. The player who blocked can take it back from
--    Account; the player who was blocked is never told.
create table if not exists public.elite_tracker_blocks (
  blocker    uuid not null references public.elite_trackers(profile_id) on delete cascade,
  blocked    uuid not null references public.elite_trackers(profile_id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker, blocked),
  check (blocker <> blocked)
);

create index if not exists elite_tracker_blocks_blocked_idx
  on public.elite_tracker_blocks (blocked);

alter table public.elite_tracker_blocks enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'elite_tracker_blocks'
      and policyname = 'elite_tracker_blocks_own_read'
  ) then
    create policy elite_tracker_blocks_own_read on public.elite_tracker_blocks
      for select using (blocker = auth.uid());
  end if;
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'elite_tracker_blocks'
      and policyname = 'elite_tracker_blocks_coach_read'
  ) then
    create policy elite_tracker_blocks_coach_read on public.elite_tracker_blocks
      for select using (public.elite_is_coach());
  end if;
end $$;

-- 5) Props: one per player per post, given with one tap and taken back
--    with another. Only a friend who can see the post can give them (the
--    server checks before it writes). No comments, no messages.
create table if not exists public.elite_log_props (
  log_id     uuid not null references public.elite_training_logs(id) on delete cascade,
  profile_id uuid not null references public.elite_trackers(profile_id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (log_id, profile_id)
);

create index if not exists elite_log_props_profile_idx
  on public.elite_log_props (profile_id);

alter table public.elite_log_props enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'elite_log_props'
      and policyname = 'elite_log_props_own_read'
  ) then
    create policy elite_log_props_own_read on public.elite_log_props
      for select using (profile_id = auth.uid());
  end if;
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'elite_log_props'
      and policyname = 'elite_log_props_coach_read'
  ) then
    create policy elite_log_props_coach_read on public.elite_log_props
      for select using (public.elite_is_coach());
  end if;
end $$;

-- 6) Reports. A player reports a friend's post once, with a reason. The
--    post leaves that player's feed at once, the coaches are texted once
--    per post, and the report waits in the queue at /coach/free until a
--    coach removes the post or marks it "no action".
create table if not exists public.elite_post_reports (
  id          uuid primary key default gen_random_uuid(),
  log_id      uuid not null references public.elite_training_logs(id) on delete cascade,
  reporter_id uuid not null references public.elite_trackers(profile_id) on delete cascade,
  reason      text not null check (reason in ('not_training', 'inappropriate', 'bullying', 'other')),
  created_at  timestamptz not null default now(),
  resolved_at timestamptz,
  resolved_by uuid references public.elite_profiles(id) on delete set null,
  action      text check (action is null or action in ('removed', 'none')),
  unique (log_id, reporter_id)
);

create index if not exists elite_post_reports_reporter_idx
  on public.elite_post_reports (reporter_id);

create index if not exists elite_post_reports_open_idx
  on public.elite_post_reports (created_at) where resolved_at is null;

alter table public.elite_post_reports enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'elite_post_reports'
      and policyname = 'elite_post_reports_own_read'
  ) then
    create policy elite_post_reports_own_read on public.elite_post_reports
      for select using (reporter_id = auth.uid());
  end if;
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'elite_post_reports'
      and policyname = 'elite_post_reports_coach_read'
  ) then
    create policy elite_post_reports_coach_read on public.elite_post_reports
      for select using (public.elite_is_coach());
  end if;
end $$;

-- 7) The photos. A PRIVATE bucket, JPEG only, 3 MB a file. There is no
--    policy that lets a signed-in player read or write an object here,
--    on purpose: the server uploads (service role, after the ownership
--    check) and every read is a short-lived signed address the server
--    made for someone the feed rule allows. The one policy lets a coach
--    read, the same as every other free table.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('tracker-posts', 'tracker-posts', false, 3000000, array['image/jpeg'])
on conflict (id) do nothing;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage' and tablename = 'objects'
      and policyname = 'tracker_posts_coach_read'
  ) then
    create policy tracker_posts_coach_read on storage.objects
      for select using (bucket_id = 'tracker-posts' and public.elite_is_coach());
  end if;
end $$;

-- 8) The recommended weekly target, by season. A coach edits the two rows
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

-- 9) Clubs. Any free player can start one (their club teammates, a new
--    tournament team) and is its captain; a coach can make one too (the
--    Dec 19 Strive Elite 5v5 teams, kind 'coach', no captain). A club
--    has its own link, and joining it makes the player friends with every
--    member already on it, both ways, as ordinary pairs in
--    elite_tracker_friends, so the feed and the week board work with
--    nothing new; a blocked pair is never paired by a club. Leaving a club
--    takes the player off the roster and leaves every friendship as it is.
--    At most 20 members a club and 3 clubs a player (the server's rules).
--    A player's clubs show on their profile, to their friends and coaches.
--    Rosters stay; ending a club (its captain) or archiving it (a coach)
--    sets archived_at, which stops new joins and keeps the roster.
create table if not exists public.elite_tracker_clubs (
  id          uuid primary key default gen_random_uuid(),
  name        text not null check (char_length(name) between 1 and 40),
  join_code   text not null unique,
  kind        text not null default 'player' check (kind in ('player', 'coach')),
  captain_id  uuid references public.elite_trackers(profile_id) on delete set null,
  created_by  uuid references public.elite_profiles(id) on delete set null,
  created_at  timestamptz not null default now(),
  archived_at timestamptz
);

create index if not exists elite_tracker_clubs_captain_idx
  on public.elite_tracker_clubs (captain_id);

alter table public.elite_tracker_clubs enable row level security;

create table if not exists public.elite_tracker_club_members (
  club_id    uuid not null references public.elite_tracker_clubs(id) on delete cascade,
  profile_id uuid not null references public.elite_trackers(profile_id) on delete cascade,
  joined_at  timestamptz not null default now(),
  primary key (club_id, profile_id)
);

create index if not exists elite_tracker_club_members_profile_idx
  on public.elite_tracker_club_members (profile_id);

alter table public.elite_tracker_club_members enable row level security;

-- Is the signed-in player on this club? Read with the definer's rights so
-- the roster policy below can ask it without reading its own table
-- through itself.
create or replace function public.elite_is_club_member(p_club uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.elite_tracker_club_members
    where club_id = p_club and profile_id = auth.uid()
  );
$$;

-- A club's name reported by one of its members. It waits in the coach
-- queue at /coach/free until a coach renames the club, archives it, or
-- says no action.
create table if not exists public.elite_club_reports (
  id          uuid primary key default gen_random_uuid(),
  club_id     uuid not null references public.elite_tracker_clubs(id) on delete cascade,
  reporter_id uuid not null references public.elite_trackers(profile_id) on delete cascade,
  created_at  timestamptz not null default now(),
  resolved_at timestamptz,
  resolved_by uuid references public.elite_profiles(id) on delete set null,
  action      text check (action is null or action in ('renamed', 'archived', 'none')),
  unique (club_id, reporter_id)
);

alter table public.elite_club_reports enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'elite_tracker_clubs'
      and policyname = 'elite_tracker_clubs_member_read'
  ) then
    create policy elite_tracker_clubs_member_read on public.elite_tracker_clubs
      for select using (public.elite_is_club_member(id));
  end if;
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'elite_tracker_clubs'
      and policyname = 'elite_tracker_clubs_coach_read'
  ) then
    create policy elite_tracker_clubs_coach_read on public.elite_tracker_clubs
      for select using (public.elite_is_coach());
  end if;
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'elite_tracker_club_members'
      and policyname = 'elite_tracker_club_members_member_read'
  ) then
    create policy elite_tracker_club_members_member_read on public.elite_tracker_club_members
      for select using (public.elite_is_club_member(club_id));
  end if;
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'elite_tracker_club_members'
      and policyname = 'elite_tracker_club_members_coach_read'
  ) then
    create policy elite_tracker_club_members_coach_read on public.elite_tracker_club_members
      for select using (public.elite_is_coach());
  end if;
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'elite_club_reports'
      and policyname = 'elite_club_reports_own_read'
  ) then
    create policy elite_club_reports_own_read on public.elite_club_reports
      for select using (reporter_id = auth.uid());
  end if;
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'elite_club_reports'
      and policyname = 'elite_club_reports_coach_read'
  ) then
    create policy elite_club_reports_coach_read on public.elite_club_reports
      for select using (public.elite_is_coach());
  end if;
end $$;

-- 10) The coaches' private note on a starred player. Its own table, read
--     and written by coaches only, so a player can never read it, even
--     their own (the player's row in elite_trackers is readable by them).
create table if not exists public.elite_tracker_star_notes (
  profile_id uuid primary key references public.elite_trackers(profile_id) on delete cascade,
  note       text not null default '' check (char_length(note) <= 280),
  updated_at timestamptz not null default now()
);

alter table public.elite_tracker_star_notes enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'elite_tracker_star_notes'
      and policyname = 'elite_tracker_star_notes_coach_read'
  ) then
    create policy elite_tracker_star_notes_coach_read on public.elite_tracker_star_notes
      for select using (public.elite_is_coach());
  end if;
end $$;

-- 11) A player's "Playing for" line reported by a friend. It waits in the
--     coach queue until a coach clears the line or says no action.
create table if not exists public.elite_line_reports (
  id          uuid primary key default gen_random_uuid(),
  profile_id  uuid not null references public.elite_trackers(profile_id) on delete cascade,
  reporter_id uuid not null references public.elite_trackers(profile_id) on delete cascade,
  created_at  timestamptz not null default now(),
  resolved_at timestamptz,
  resolved_by uuid references public.elite_profiles(id) on delete set null,
  action      text check (action is null or action in ('cleared', 'none')),
  unique (profile_id, reporter_id)
);

alter table public.elite_line_reports enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'elite_line_reports'
      and policyname = 'elite_line_reports_own_read'
  ) then
    create policy elite_line_reports_own_read on public.elite_line_reports
      for select using (reporter_id = auth.uid());
  end if;
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'elite_line_reports'
      and policyname = 'elite_line_reports_coach_read'
  ) then
    create policy elite_line_reports_coach_read on public.elite_line_reports
      for select using (public.elite_is_coach());
  end if;
end $$;

-- 12) App-wide switches a coach flips. First one: whether anyone can make
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
