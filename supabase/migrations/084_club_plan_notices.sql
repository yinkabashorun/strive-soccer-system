-- =====================================================================
-- 084: ONE NOTIFICATION WHEN A CLUB PLANS A SESSION OR A GAME (Nov 24 2026)
-- =====================================================================
-- The free app's third notification, and the only one about clubs: when a
-- club's training session is planned, or a game between two clubs is on
-- (the other captain accepted), the members of the club(s) hear about it
-- once: "<Club>: <session or game> <day> at <time>. Tap I'm in."
--
-- This table is the lock that makes "once" true, the same claim-first
-- pattern as elite_week_announcements (066) and elite_free_notices (078):
-- before a notification is sent to a player for a plan, the server inserts
-- (plan_id, profile_id) here. Only the caller whose insert succeeds may
-- send. A retry, a second request or a bug that announces the same plan
-- again hits the key and sends nothing. A table that cannot be written
-- sends nothing either.
--
-- elite_free_notices could not carry it: its kind is held to
-- ('friend_post', 'props') by a check, and this file drops nothing.
--
-- Written by the server only (service role). Row security is on; the only
-- policy is a coach read.
--
-- Safe to run twice. No DROP. UNTIL THIS IS APPLIED no club notification
-- is sent at all, and planning a session or a game works exactly as
-- before. NOT APPLIED until Coach Yinka's word.
-- =====================================================================

set lock_timeout = '8s';

create table if not exists public.elite_plan_notices (
  plan_id    uuid not null references public.elite_club_plans(id) on delete cascade,
  profile_id uuid not null references public.elite_profiles(id) on delete cascade,
  sent_at    timestamptz not null default now(),
  primary key (plan_id, profile_id)
);

alter table public.elite_plan_notices enable row level security;

do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'public'
      and tablename = 'elite_plan_notices' and policyname = 'elite_plan_notices_coach_read') then
    create policy elite_plan_notices_coach_read on public.elite_plan_notices
      for select using (public.elite_is_coach());
  end if;
end $$;
