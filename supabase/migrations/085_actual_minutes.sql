-- 085: minutes trained are the ACTUAL minutes (Nov 24 2026, Coach Yinka:
-- "Minutes trained should be ACTUAL minutes trained").
--
-- The session player (the iPhone app and the website) times each drill from
-- the moment it comes on screen to the tap on Done, and sends that time
-- with the tick. It is kept here, on the drill's own row, and it is what
-- every total adds up (lib/elite/time-trained.ts creditedMinutes; the
-- coach's summary below).
--
--   actual_seconds   the time the drill really took. NULL for a drill that
--                    is not done, and for one finished before the app
--                    measured time: those keep the minutes the plan gave
--                    them, the only figure there is.
--
-- The database holds the rules itself, whatever code writes the row:
--   - a drill that is not done has no measured time
--   - one drill never counts more than twice the minutes the plan gives it
--     (ACTUAL_CAP_FACTOR in lib/elite/time-trained.ts), so a phone left
--     open overnight is not five hours of training
--
-- Idempotent. No existing row is changed: every row starts with NULL.

alter table public.elite_homework
  add column if not exists actual_seconds integer;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'elite_homework_actual_seconds_real' and conrelid = 'public.elite_homework'::regclass
  ) then
    alter table public.elite_homework
      add constraint elite_homework_actual_seconds_real
      check (actual_seconds is null or actual_seconds between 0 and 14400);
  end if;
end $$;

create or replace function public.elite_homework_actual_guard()
returns trigger language plpgsql as $fn$
begin
  if not new.completed then
    new.actual_seconds := null;
  elsif new.actual_seconds is not null then
    new.actual_seconds := least(new.actual_seconds, greatest(new.duration_min, 1) * 60 * 2);
  end if;
  return new;
end $fn$;

do $$
begin
  if not exists (
    select 1 from pg_trigger
    where tgname = 'elite_homework_actual_guard' and tgrelid = 'public.elite_homework'::regclass
  ) then
    create trigger elite_homework_actual_guard
      before insert or update on public.elite_homework
      for each row execute function public.elite_homework_actual_guard();
  end if;
end $$;

-- The coach's summary (roster cards, the player page): the same rule in SQL.
-- The function is 013's, with one line changed: the minutes.
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
      -- actual minutes (085): the measured time of each finished drill,
      -- or the plan's minutes for one finished before the app measured it
      coalesce(sum(
        case when actual_seconds is null then duration_min
             else round(actual_seconds / 60.0)::int end
      ) filter (where completed), 0)::int as mins,
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
