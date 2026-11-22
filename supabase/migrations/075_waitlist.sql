-- 075: THE WAITLIST FOR THE FREE APP (Nov 22 2026).
--
-- Coach Yinka: "how can we get a waitlist", then "make what makes sense
-- with our exact situation". The free app (069) is built and live with
-- sign-up switched off, and the App Store app is not out yet. While free
-- sign-up is closed, /join is the waitlist: a player 13 or older leaves
-- a name, a phone and who they play for, gets their own link to send to
-- teammates, and is texted once when the app opens. Bringing 3 teammates
-- puts a player in the first group the coaches let in.
--
-- Nothing is stored for a player under 13 (the free app's own age rule,
-- checked before the form and again on the server).
--
-- Written by the server only (the join route uses the service role).
-- Coaches read the list at /coach/free and may remove a row on request.

create table if not exists public.elite_waitlist (
  id uuid primary key default gen_random_uuid(),
  first_name text not null check (char_length(first_name) between 1 and 60),
  last_name text not null check (char_length(last_name) between 1 and 60),
  -- E.164, one row per number
  phone text not null unique check (phone ~ '^\+[0-9]{10,15}$'),
  birth_month smallint not null check (birth_month between 1 and 12),
  birth_year smallint not null,
  -- "Who do you play for?", optional, the free app's Playing for rule
  team text check (team is null or char_length(team) <= 40),
  -- this player's own link code, and the code of whoever sent them
  code text not null unique check (code ~ '^[A-HJ-NP-Z2-9]{8}$'),
  referred_by text,
  source text check (source is null or char_length(source) <= 40),
  created_at timestamptz not null default now(),
  -- when the "the app is open" text went to this number
  invited_at timestamptz
);

create index if not exists elite_waitlist_referred_by_idx on public.elite_waitlist (referred_by);
create index if not exists elite_waitlist_created_idx on public.elite_waitlist (created_at);

alter table public.elite_waitlist enable row level security;

create policy "Coaches read the waitlist"
  on public.elite_waitlist for select
  using (public.elite_is_coach());

create policy "Coaches remove from the waitlist"
  on public.elite_waitlist for delete
  using (public.elite_is_coach());
