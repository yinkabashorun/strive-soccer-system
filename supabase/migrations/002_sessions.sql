-- Strive OS · sessions table
-- Columns quoted to preserve camelCase, matching the Session type in lib/types.ts.

create table if not exists sessions (
  id          uuid primary key default gen_random_uuid(),
  title       text not null,
  date        date not null,
  "startTime" text not null,
  "endTime"   text not null,
  location    text not null,
  coach       text not null,
  capacity    integer not null default 0,
  enrolled    text[] not null default '{}',
  attended    text[] not null default '{}',
  type        text not null check (type in ('Group','Private','Camp')),
  notes       text,
  created_at  timestamptz not null default now()
);

create index if not exists sessions_date_idx on sessions (date);
create index if not exists sessions_coach_idx on sessions (coach);

alter table sessions enable row level security;

drop policy if exists "sessions_all" on sessions;
create policy "sessions_all"
  on sessions
  for all
  using (true)
  with check (true);
