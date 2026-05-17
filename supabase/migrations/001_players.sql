-- Strive OS · players table
-- Columns are quoted to preserve camelCase, matching the Player type in lib/types.ts.

create table if not exists players (
  id              uuid primary key default gen_random_uuid(),
  name            text not null,
  age             integer not null,
  "parentName"    text not null,
  "parentEmail"   text not null,
  "parentPhone"   text not null,
  package         text not null check (package in ('Group','Private','Camp','Course')),
  "sessionsRemaining" integer not null default 0,
  "sessionsTotal" integer not null default 0,
  "paymentStatus" text not null check ("paymentStatus" in ('Paid','Unpaid','Partial')),
  "joinedAt"      date not null default current_date,
  coach           text not null,
  level           text not null check (level in ('Beginner','Intermediate','Advanced','Elite')),
  "progressNotes" text[] not null default '{}',
  "avatarColor"   text not null default '#2a2a2f',
  created_at      timestamptz not null default now()
);

create index if not exists players_name_idx on players (name);
create index if not exists players_payment_idx on players ("paymentStatus");

-- RLS: open for the internal OS (anon key reads/writes). Tighten when auth ships.
alter table players enable row level security;

drop policy if exists "players_all" on players;
create policy "players_all"
  on players
  for all
  using (true)
  with check (true);
