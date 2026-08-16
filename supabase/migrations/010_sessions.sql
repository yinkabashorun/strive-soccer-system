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
