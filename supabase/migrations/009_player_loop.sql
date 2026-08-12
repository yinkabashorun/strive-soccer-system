-- =====================================================================
-- Strive Elite — player daily loop
-- =====================================================================
-- Adds per-drill minutes, rolled-up player metrics, a duplicate-week
-- helper, a one-call coach roster, and in-app new-week notifications.
-- All streak math is in America/New_York local days.
--
-- DO NOT run automatically — apply once the connector is unblocked.
-- =====================================================================

-- 0) per-drill minutes ------------------------------------------------
alter table public.elite_homework
  add column if not exists duration_min int not null default 15;

-- =====================================================================
-- 1) elite_player_summary(player_id)
--    current_streak, sessions_completed, homework_pct, training_minutes
-- =====================================================================
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
language plpgsql stable security definer set search_path = public as $$
begin
  if not (public.elite_is_coach() or public.elite_owns_player(p_player_id)) then
    raise exception 'not authorized';
  end if;

  return query
  with hw as (
    select * from public.elite_homework where player_id = p_player_id
  ),
  -- distinct NY-local days with at least one completed drill
  days as (
    select distinct ((completed_at at time zone 'America/New_York')::date) as d
    from hw
    where completed and completed_at is not null
  ),
  -- gaps-and-islands: consecutive days share (d - row_number)
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
  -- a "session" = a week where every assigned drill is completed
  sessions as (
    select count(*)::int as v from (
      select week from hw group by week
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
end $$;

-- =====================================================================
-- 2) elite_duplicate_week — clone a week's drills to a target player
-- =====================================================================
create or replace function public.elite_duplicate_week(
  p_from_player uuid,
  p_week        int,
  p_to_player   uuid,
  p_to_week     int
)
returns int
language plpgsql volatile security definer set search_path = public as $$
declare
  n int;
begin
  if not public.elite_is_coach() then
    raise exception 'not authorized';
  end if;

  -- replace any existing drills in the target week for a clean clone
  delete from public.elite_homework
  where player_id = p_to_player and week = p_to_week;

  insert into public.elite_homework
    (player_id, week, title, exercise, reps, duration_min, video_url, notes, sort)
  select p_to_player, p_to_week, title, exercise, reps, duration_min, video_url, notes, sort
  from public.elite_homework
  where player_id = p_from_player and week = p_week
  order by sort;

  get diagnostics n = row_count;
  return n;
end $$;

-- =====================================================================
-- 3) elite_coach_roster — every player + rolled-up metrics in one call
-- =====================================================================
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
  order by p.full_name;
end $$;

-- =====================================================================
-- 4) in-app notifications + new-week trigger
-- =====================================================================
create table if not exists public.elite_notifications (
  id         uuid primary key default gen_random_uuid(),
  player_id  uuid not null references public.elite_players(id) on delete cascade,
  kind       text not null default 'info',
  title      text not null,
  body       text not null default '',
  read       boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists elite_notifications_player_idx
  on public.elite_notifications(player_id);

alter table public.elite_notifications enable row level security;

drop policy if exists elite_notifications_read on public.elite_notifications;
create policy elite_notifications_read on public.elite_notifications
  for select using (public.elite_is_coach() or public.elite_owns_player(player_id));
drop policy if exists elite_notifications_player_update on public.elite_notifications;
create policy elite_notifications_player_update on public.elite_notifications
  for update using (public.elite_owns_player(player_id))
  with check (public.elite_owns_player(player_id));
drop policy if exists elite_notifications_coach_write on public.elite_notifications;
create policy elite_notifications_coach_write on public.elite_notifications
  for all using (public.elite_is_coach()) with check (public.elite_is_coach());

-- fire a notification when a new weekly plan lands
create or replace function public.elite_notify_new_week()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.elite_notifications (player_id, kind, title, body)
  values (
    new.player_id,
    'new_week',
    'Week ' || new.week || ' is ready',
    coalesce(nullif(new.focus, ''), 'Your coach set your focus for the week.')
  );
  return new;
end $$;

drop trigger if exists elite_notify_new_week_trg on public.elite_weekly_plans;
create trigger elite_notify_new_week_trg
  after insert on public.elite_weekly_plans
  for each row execute function public.elite_notify_new_week();

-- =====================================================================
-- 5) least-privilege grants (match 008 pattern)
-- =====================================================================
revoke execute on function public.elite_player_summary(uuid) from public, anon;
revoke execute on function public.elite_duplicate_week(uuid, int, uuid, int) from public, anon;
revoke execute on function public.elite_coach_roster() from public, anon;
revoke execute on function public.elite_notify_new_week() from public, anon;

grant execute on function public.elite_player_summary(uuid) to authenticated, service_role;
grant execute on function public.elite_duplicate_week(uuid, int, uuid, int) to authenticated, service_role;
grant execute on function public.elite_coach_roster() to authenticated, service_role;
do $$
begin
  begin grant execute on function public.elite_notify_new_week() to service_role; exception when undefined_object then null; end;
end $$;
