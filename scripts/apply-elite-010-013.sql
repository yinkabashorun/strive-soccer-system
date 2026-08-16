-- =============================================================
-- Strive Elite — apply migrations 010 → 013 in one paste
-- Run this in the Supabase SQL editor (Dashboard → SQL → New query).
-- Safe to run more than once (idempotent).
-- =============================================================

-- >>>>> 010_sessions.sql >>>>>
-- =====================================================================
-- Strive Elite — four sessions per week
-- =====================================================================
-- A week is now FOUR sessions (elite_homework.session = 1..4), each
-- starting with a plyometric warm-up. "sessions_completed" counts each
-- (week, session) group whose drills are all done. Duplicate-week carries
-- the session column across.
-- =====================================================================

alter table public.elite_homework
  add column if not exists session int not null default 1;
create index if not exists elite_homework_week_session_idx
  on public.elite_homework(player_id, week, session);

-- session-aware player summary --------------------------------------------
create or replace function public.elite_player_summary(p_player_id uuid)
returns table (
  current_streak     int,
  sessions_completed int,
  homework_total     int,
  homework_completed int,
  homework_pct       int,
  training_minutes   int,
  last_active        timestamptz
)
language plpgsql stable security definer set search_path = public as $fn$
begin
  if not (public.elite_is_coach() or public.elite_owns_player(p_player_id)) then
    raise exception 'not authorized';
  end if;

  return query
  with hw as (
    select * from public.elite_homework where player_id = p_player_id
  ),
  days as (
    select distinct ((completed_at at time zone 'America/New_York')::date) as d
    from hw
    where completed and completed_at is not null
  ),
  islands as (
    select d, (d - (row_number() over (order by d))::int) as grp from days
  ),
  runs as (
    select count(*)::int as len, max(d) as last_d from islands group by grp
  ),
  streak as (
    select coalesce((
      select len from runs
      where last_d >= ((now() at time zone 'America/New_York')::date - 1)
      order by last_d desc
      limit 1
    ), 0) as v
  ),
  sessions as (
    select count(*)::int as v from (
      select week, session from hw group by week, session
      having count(*) > 0 and bool_and(completed)
    ) w
  ),
  totals as (
    select
      count(*)::int as total,
      count(*) filter (where completed)::int as done,
      coalesce(sum(duration_min) filter (where completed), 0)::int as mins,
      max(completed_at) as last_at
    from hw
  )
  select
    (select v from streak),
    (select v from sessions),
    t.total,
    t.done,
    case when t.total > 0 then round(100.0 * t.done / t.total)::int else 0 end,
    t.mins,
    t.last_at
  from totals t;
end $fn$;

-- duplicate-week now carries the session column ---------------------------
create or replace function public.elite_duplicate_week(
  p_from_player uuid,
  p_week        int,
  p_to_player   uuid,
  p_to_week     int
)
returns int
language plpgsql volatile security definer set search_path = public as $fn$
declare
  n int;
begin
  if not public.elite_is_coach() then
    raise exception 'not authorized';
  end if;

  delete from public.elite_homework
  where player_id = p_to_player and week = p_to_week;

  insert into public.elite_homework
    (player_id, week, session, title, exercise, reps, duration_min, video_url, notes, sort)
  select p_to_player, p_to_week, session, title, exercise, reps, duration_min, video_url, notes, sort
  from public.elite_homework
  where player_id = p_from_player and week = p_week
  order by session, sort;

  get diagnostics n = row_count;
  return n;
end $fn$;

revoke execute on function public.elite_player_summary(uuid) from public, anon;
revoke execute on function public.elite_duplicate_week(uuid, int, uuid, int) from public, anon;
grant execute on function public.elite_player_summary(uuid) to authenticated, service_role;
grant execute on function public.elite_duplicate_week(uuid, int, uuid, int) to authenticated, service_role;


-- >>>>> 011_progress_history.sql >>>>>
-- =====================================================================
-- Strive Elite — progress history
-- =====================================================================
-- elite_progress keeps only the current + previous rating per pillar. To
-- make long-term progress real (and chartable), append every rating to a
-- history table each time the coach applies a session plan.
-- =====================================================================

create table if not exists public.elite_progress_history (
  id         uuid primary key default gen_random_uuid(),
  player_id  uuid not null references public.elite_players(id) on delete cascade,
  metric     text not null,
  value      int not null check (value between 0 and 100),
  week       int not null default 1,
  created_at timestamptz not null default now()
);
create index if not exists elite_progress_history_idx
  on public.elite_progress_history(player_id, metric, created_at);

alter table public.elite_progress_history enable row level security;

drop policy if exists elite_progress_history_read on public.elite_progress_history;
create policy elite_progress_history_read on public.elite_progress_history
  for select using (public.elite_is_coach() or public.elite_owns_player(player_id));
drop policy if exists elite_progress_history_coach_write on public.elite_progress_history;
create policy elite_progress_history_coach_write on public.elite_progress_history
  for all using (public.elite_is_coach()) with check (public.elite_is_coach());


-- >>>>> 012_intake_memory_checkins.sql >>>>>
-- =====================================================================
-- Strive Elite — player intake, AI memory, and weekly check-ins
-- =====================================================================
-- Adds the data that lets us (a) onboard a player with a full intake
-- form, (b) give the AI real per-player memory (intake + a coach memory
-- note), and (c) run a structured weekly check-in loop.
--
-- Membership "paused" is represented with the existing 'canceled' status
-- (no enum change needed) — the UI labels it "Paused".
--
-- DO NOT run automatically — apply once the connector is unblocked, or
-- paste into the Supabase SQL editor.
-- =====================================================================

-- 1) intake + memory columns on elite_players -------------------------
alter table public.elite_players
  add column if not exists club            text not null default '',
  add column if not exists dominant_foot   text not null default '',
  add column if not exists self_assessment jsonb not null default '{}'::jsonb,
  add column if not exists coach_memory    text not null default '',
  add column if not exists onboarded_at    timestamptz;

-- 2) weekly check-ins --------------------------------------------------
create table if not exists public.elite_checkins (
  id                uuid primary key default gen_random_uuid(),
  player_id         uuid not null references public.elite_players(id) on delete cascade,
  week              int  not null default 1,
  rating            int  check (rating between 1 and 5),   -- how the week went
  energy            int  check (energy between 1 and 5),   -- energy / freshness
  went_well         text not null default '',
  struggled         text not null default '',
  note              text not null default '',
  coach_feedback    text not null default '',
  coach_feedback_at timestamptz,
  created_at        timestamptz not null default now()
);
create index if not exists elite_checkins_player_idx
  on public.elite_checkins(player_id, created_at desc);

alter table public.elite_checkins enable row level security;

-- player reads their own + their coach; player inserts their own;
-- coach (or admin) has full access (to write feedback).
drop policy if exists elite_checkins_read on public.elite_checkins;
create policy elite_checkins_read on public.elite_checkins
  for select using (public.elite_is_coach() or public.elite_owns_player(player_id));

drop policy if exists elite_checkins_player_insert on public.elite_checkins;
create policy elite_checkins_player_insert on public.elite_checkins
  for insert with check (public.elite_owns_player(player_id));

drop policy if exists elite_checkins_coach_write on public.elite_checkins;
create policy elite_checkins_coach_write on public.elite_checkins
  for all using (public.elite_is_coach()) with check (public.elite_is_coach());

-- 3) notify the coach's roster is unaffected; check-in feedback fires a
--    player-facing notification (inserted from application code).


-- >>>>> 013_multi_coach.sql >>>>>
-- =====================================================================
-- Strive Elite — multi-coach scoping (admin sees all, coach sees own)
-- =====================================================================
-- Today there is one coach (the owner), who is an ADMIN and sees every
-- player. This migration makes the model multi-coach-ready: a plain
-- 'coach' sees only players whose coach_id is theirs, while an 'admin'
-- sees everyone. Nothing changes for the owner (admin) — they keep full
-- visibility.
--
-- DO NOT run automatically — apply once the connector is unblocked.
-- =====================================================================

-- 1) helpers ----------------------------------------------------------
create or replace function public.elite_is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.elite_profiles p
    where p.id = auth.uid() and p.role = 'admin'
  );
$$;

-- true when the caller may manage this player: an admin, or the player's
-- assigned coach.
create or replace function public.elite_coach_manages(p_player_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select public.elite_is_admin() or exists (
    select 1 from public.elite_players pl
    where pl.id = p_player_id and pl.coach_id = auth.uid()
  );
$$;

revoke execute on function public.elite_is_admin() from public, anon;
revoke execute on function public.elite_coach_manages(uuid) from public, anon;
grant execute on function public.elite_is_admin() to authenticated, service_role;
grant execute on function public.elite_coach_manages(uuid) to authenticated, service_role;

-- 2) scope elite_players ---------------------------------------------
drop policy if exists elite_players_read on public.elite_players;
create policy elite_players_read on public.elite_players
  for select using (
    public.elite_is_admin()
    or coach_id = auth.uid()
    or profile_id = auth.uid()
  );

drop policy if exists elite_players_coach_write on public.elite_players;
create policy elite_players_coach_write on public.elite_players
  for all using (public.elite_is_admin() or coach_id = auth.uid())
  with check (public.elite_is_admin() or coach_id = auth.uid());

-- 3) scope every per-player child table to the managing coach ---------
do $$
declare t text;
begin
  foreach t in array array[
    'elite_sessions','elite_progress','elite_film_uploads','elite_coach_notes',
    'elite_weekly_plans','elite_parent_reports','elite_achievements',
    'elite_progress_history','elite_checkins'
  ]
  loop
    -- read: managing coach or the owning player
    execute format('drop policy if exists %I_read on public.%I;', t, t);
    execute format($f$
      create policy %1$I_read on public.%1$I
        for select using (
          public.elite_coach_manages(player_id) or public.elite_owns_player(player_id)
        );
    $f$, t);
    -- coach write: only the managing coach
    execute format('drop policy if exists %I_coach_write on public.%I;', t, t);
    execute format($f$
      create policy %1$I_coach_write on public.%1$I
        for all using (public.elite_coach_manages(player_id))
        with check (public.elite_coach_manages(player_id));
    $f$, t);
  end loop;
end $$;

-- homework: managing coach full access; player reads + completes own ---
drop policy if exists elite_homework_read on public.elite_homework;
create policy elite_homework_read on public.elite_homework
  for select using (
    public.elite_coach_manages(player_id) or public.elite_owns_player(player_id)
  );
drop policy if exists elite_homework_coach_write on public.elite_homework;
create policy elite_homework_coach_write on public.elite_homework
  for all using (public.elite_coach_manages(player_id))
  with check (public.elite_coach_manages(player_id));

-- messages: managing coach full access; player reads/inserts own -------
drop policy if exists elite_messages_read on public.elite_messages;
create policy elite_messages_read on public.elite_messages
  for select using (
    public.elite_coach_manages(player_id) or public.elite_owns_player(player_id)
  );
drop policy if exists elite_messages_coach_write on public.elite_messages;
create policy elite_messages_coach_write on public.elite_messages
  for all using (public.elite_coach_manages(player_id))
  with check (public.elite_coach_manages(player_id));

-- notifications: managing coach + owning player -----------------------
drop policy if exists elite_notifications_read on public.elite_notifications;
create policy elite_notifications_read on public.elite_notifications
  for select using (
    public.elite_coach_manages(player_id) or public.elite_owns_player(player_id)
  );
drop policy if exists elite_notifications_coach_write on public.elite_notifications;
create policy elite_notifications_coach_write on public.elite_notifications
  for all using (public.elite_coach_manages(player_id))
  with check (public.elite_coach_manages(player_id));

-- 4) scope the roster + summary + duplicate RPCs ----------------------
create or replace function public.elite_coach_roster()
returns table (
  player_id           uuid,
  full_name           text,
  avatar_color        text,
  current_week        int,
  subscription_status strive_sub_status,
  last_active         timestamptz,
  current_streak      int,
  homework_pct        int,
  training_minutes    int,
  sessions_completed  int
)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.elite_is_coach() then
    raise exception 'not authorized';
  end if;

  return query
  select
    p.id, p.full_name, p.avatar_color, p.current_week, p.subscription_status,
    s.last_active, s.current_streak, s.homework_pct, s.training_minutes,
    s.sessions_completed
  from public.elite_players p
  left join lateral public.elite_player_summary(p.id) s on true
  where public.elite_is_admin() or p.coach_id = auth.uid()
  order by p.full_name;
end $$;

create or replace function public.elite_player_summary(p_player_id uuid)
returns table (
  current_streak     int,
  sessions_completed int,
  homework_total     int,
  homework_completed int,
  homework_pct       int,
  training_minutes   int,
  last_active        timestamptz
)
language plpgsql stable security definer set search_path = public as $fn$
begin
  if not (public.elite_coach_manages(p_player_id) or public.elite_owns_player(p_player_id)) then
    raise exception 'not authorized';
  end if;

  return query
  with hw as (
    select * from public.elite_homework where player_id = p_player_id
  ),
  days as (
    select distinct ((completed_at at time zone 'America/New_York')::date) as d
    from hw where completed and completed_at is not null
  ),
  islands as (
    select d, (d - (row_number() over (order by d))::int) as grp from days
  ),
  runs as (
    select count(*)::int as len, max(d) as last_d from islands group by grp
  ),
  streak as (
    select coalesce((
      select len from runs
      where last_d >= ((now() at time zone 'America/New_York')::date - 1)
      order by last_d desc limit 1
    ), 0) as v
  ),
  sessions as (
    select count(*)::int as v from (
      select week, session from hw group by week, session
      having count(*) > 0 and bool_and(completed)
    ) w
  ),
  totals as (
    select
      count(*)::int as total,
      count(*) filter (where completed)::int as done,
      coalesce(sum(duration_min) filter (where completed), 0)::int as mins,
      max(completed_at) as last_at
    from hw
  )
  select
    (select v from streak), (select v from sessions),
    t.total, t.done,
    case when t.total > 0 then round(100.0 * t.done / t.total)::int else 0 end,
    t.mins, t.last_at
  from totals t;
end $fn$;

create or replace function public.elite_duplicate_week(
  p_from_player uuid, p_week int, p_to_player uuid, p_to_week int
)
returns int language plpgsql volatile security definer set search_path = public as $fn$
declare n int;
begin
  if not (public.elite_coach_manages(p_from_player) and public.elite_coach_manages(p_to_player)) then
    raise exception 'not authorized';
  end if;

  delete from public.elite_homework
  where player_id = p_to_player and week = p_to_week;

  insert into public.elite_homework
    (player_id, week, session, title, exercise, reps, duration_min, video_url, notes, sort)
  select p_to_player, p_to_week, session, title, exercise, reps, duration_min, video_url, notes, sort
  from public.elite_homework
  where player_id = p_from_player and week = p_week
  order by session, sort;

  get diagnostics n = row_count;
  return n;
end $fn$;

revoke execute on function public.elite_coach_roster() from public, anon;
revoke execute on function public.elite_player_summary(uuid) from public, anon;
revoke execute on function public.elite_duplicate_week(uuid, int, uuid, int) from public, anon;
grant execute on function public.elite_coach_roster() to authenticated, service_role;
grant execute on function public.elite_player_summary(uuid) to authenticated, service_role;
grant execute on function public.elite_duplicate_week(uuid, int, uuid, int) to authenticated, service_role;


