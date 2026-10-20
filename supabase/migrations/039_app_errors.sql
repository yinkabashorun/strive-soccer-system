-- =====================================================================
-- App error log - an error page can never again vanish without a trace
-- =====================================================================
-- Oct 19 2026, 6:30pm ET: the coach published a player's first week from
-- the studio, every write landed (session, 30 homework rows, progress,
-- plan, parent report, notification, the family's text), and the
-- browser showed an error page. Nothing recorded what failed: no error
-- boundary, no Sentry, nothing in the database. The Sept 26 audit had
-- flagged exactly this gap.
--
-- From now on every error page a player, parent or coach sees
-- (app/error.tsx and app/global-error.tsx) posts to /api/elite/errors,
-- which writes one row here: when, which side threw (client or server),
-- the route, Next's digest for a server error, the message and stack for
-- a client error, who was signed in, and the browser. The coach
-- dashboard shows the last 7 days (components/elite/AppErrorsCard.tsx)
-- and the daily digest adds a line when the last 24 hours had any, the
-- same way it watches the plan builder's heartbeat.
--
-- Written only by the service role (the API route); a signed-in coach
-- may read the log.
create table if not exists public.elite_app_errors (
  id          uuid primary key default gen_random_uuid(),
  occurred_at timestamptz not null default now(),
  side        text not null default 'client'
              check (side in ('client', 'server')),
  route       text not null default '',   -- path only, never a query string
  digest      text,                       -- Next's server error digest
  message     text not null default '',
  stack       text,                       -- client errors only
  viewer_role text,                       -- player | coach | admin | null
  player_id   uuid references public.elite_players(id) on delete set null,
  user_agent  text
);
create index if not exists elite_app_errors_time_idx
  on public.elite_app_errors(occurred_at desc);

alter table public.elite_app_errors enable row level security;

drop policy if exists "app errors: coach read" on public.elite_app_errors;
create policy "app errors: coach read" on public.elite_app_errors
  for select using (public.elite_is_coach());
