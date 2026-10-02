-- =====================================================================
-- Cron run log - the plan builder can never silently no-op again
-- =====================================================================
-- Every run of the weekly-plan builder (Vercel cron or the coach's own
-- "Build now" click) writes one row here: what it built, what it skipped,
-- every error by player. The coach dashboard reads the latest row, so a
-- run that built nothing, errored, or never fired at all is visible on the
-- first screen the coach opens - not something a parent has to report.
-- =====================================================================

create table if not exists public.elite_cron_runs (
  id       uuid primary key default gen_random_uuid(),
  job      text not null,
  ran_at   timestamptz not null default now(),
  trigger  text not null default 'cron',   -- cron | coach | skipped
  authed   boolean not null default false, -- CRON_SECRET set AND matched
  built    int not null default 0,
  skipped  int not null default 0,
  errors   jsonb not null default '[]',    -- [{ name, error }]
  summary  text not null default ''
);
create index if not exists elite_cron_runs_job_idx
  on public.elite_cron_runs(job, ran_at desc);

alter table public.elite_cron_runs enable row level security;

-- Written only by the service role (the cron and server actions); a
-- signed-in coach may read the log.
drop policy if exists "cron runs: coach read" on public.elite_cron_runs;
create policy "cron runs: coach read" on public.elite_cron_runs
  for select using (public.elite_is_coach());
