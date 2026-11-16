-- =====================================================================
-- Strive Elite - a week is announced once, a text is sent once
-- =====================================================================
-- Coach Yinka, Nov 12 2026: "This text is spamming me. Make sure this
-- never happens again to me or any client."
--
-- What happened: the hourly plan builder read a cached answer to "what
-- is this player's latest built week" (see lib/elite/supabase/
-- fresh-fetch.ts), rebuilt a live week every hour and sent the "week N
-- just went live" text each time: 117 times for one profile, 94 for
-- another. The cache is fixed in code. These two tables are the locks
-- that hold whatever a future bug does, because the database itself
-- refuses the second row:
--
-- 1) elite_week_announcements: one row per player per week. A week's
--    notification, email, push, text and parent report go out only to
--    the caller that inserted that row. A second caller hits the
--    primary key and sends nothing.
-- 2) elite_sms_sends: one row per number per exact text per day (hashes
--    only, no numbers or message text stored). The same words can never
--    reach the same phone twice in one day, whatever sent them.
-- =====================================================================

create table if not exists public.elite_week_announcements (
  player_id    uuid not null references public.elite_players(id) on delete cascade,
  week         int  not null check (week >= 1),
  announced_at timestamptz not null default now(),
  primary key (player_id, week)
);
alter table public.elite_week_announcements enable row level security;
create policy "week announcements: coach all" on public.elite_week_announcements
  for all using (public.elite_is_coach()) with check (public.elite_is_coach());

-- Every week a family has already been told about is on the ledger from
-- day one: each plan that was announced, and each built week up to the
-- one the player is on.
insert into public.elite_week_announcements (player_id, week)
select distinct w.player_id, w.week
from public.elite_weekly_plans w
where w.notified = true and w.week >= 1
on conflict do nothing;

insert into public.elite_week_announcements (player_id, week)
select distinct h.player_id, h.week
from public.elite_homework h
join public.elite_players p on p.id = h.player_id
where h.week >= 1 and h.week <= coalesce(p.current_week, 0)
on conflict do nothing;

create table if not exists public.elite_sms_sends (
  phone_hash text not null,
  body_hash  text not null,
  sent_on    date not null,
  sent_at    timestamptz not null default now(),
  primary key (phone_hash, body_hash, sent_on)
);
create index if not exists elite_sms_sends_sent_at_idx on public.elite_sms_sends(sent_at);
-- Service role only: no policy, so no signed-in user can read or write it.
alter table public.elite_sms_sends enable row level security;
