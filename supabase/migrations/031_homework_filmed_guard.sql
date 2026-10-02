-- =====================================================================
-- The database refuses an unfilmed drill. Full stop.
-- =====================================================================
-- Every code fix so far (onlyWithVideo, bank-conform at two gates, the
-- hard delete of unfilmed drills) lives in application code, which a
-- future edit can bypass. This can't be bypassed: a homework row must
-- link a bank drill (drill_id) AND carry its video (video_url), or the
-- insert is rejected and the publish fails loudly (the cron logs it and
-- texts the coach) instead of a player quietly getting a drill with no
-- video. Applies to every writer, present and future: the publish path,
-- the clone-week function, the backfill, and anything written tomorrow.
--
-- Existing legacy rows (old weeks, no drill_id) are untouched: the check
-- runs on INSERT, and on UPDATE only when video_url/drill_id themselves
-- change - so marking an old row completed still works, and the backfill
-- can still link a legacy row (it sets both columns together).
-- =====================================================================

-- Run log additions (030): the live-week audit result, and whether the
-- run finished at all (a crash/timeout leaves finished = false).
alter table public.elite_cron_runs
  add column if not exists issues jsonb not null default '[]',
  add column if not exists finished boolean not null default true;

create or replace function public.elite_guard_homework_filmed()
returns trigger language plpgsql security invoker set search_path = public as $$
begin
  if tg_op = 'INSERT'
     or new.video_url is distinct from old.video_url
     or new.drill_id is distinct from old.drill_id then
    if new.drill_id is null or coalesce(new.video_url, '') = '' then
      raise exception 'homework "%" must link a filmed bank drill (drill_id + video_url)', new.title
        using errcode = 'check_violation';
    end if;
  end if;
  return new;
end $$;

drop trigger if exists elite_homework_filmed_guard on public.elite_homework;
create trigger elite_homework_filmed_guard
  before insert or update on public.elite_homework
  for each row execute function public.elite_guard_homework_filmed();

-- The clone-week function (009/010) copied video_url but predates
-- drill_id - it must carry the link too, or every clone would now be
-- rejected.
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
    (player_id, week, session, title, exercise, reps, duration_min, video_url, drill_id, notes, sort)
  select p_to_player, p_to_week, session, title, exercise, reps, duration_min, video_url, drill_id, notes, sort
  from public.elite_homework
  where player_id = p_from_player and week = p_week
  order by session, sort;

  get diagnostics n = row_count;
  return n;
end $fn$;
