-- 086: BRING YOUR SQUAD, the referral loop (Nov 24 2026; the rules are in
-- lib/elite/squad-pass.ts). Three teammates who join with a player's link
-- and post their first training earn that player a month of Strive Pro.
--
--   elite_squad_counts   one row per teammate who trained, and who brought
--                        them. The teammate's id is the key, so a teammate
--                        counts once, for one player, for good; it is not a
--                        foreign key, so the count stays if that teammate
--                        later deletes their account.
--   elite_pro_passes     one row per month earned (number 1, 2, 3 ...). The
--                        key (profile, number) is what makes earning it
--                        happen once however many times the count is added
--                        up. started_at / ends_at: when the player started
--                        it and when it runs to; ended_at: when the hourly
--                        job closed it.
--
-- Only the server writes either table. Coaches can read both.
-- Idempotent. No existing row is changed.

create table if not exists public.elite_squad_counts (
  teammate   uuid primary key,
  profile_id uuid not null references public.elite_profiles(id) on delete cascade,
  counted_at timestamptz not null default now()
);
create index if not exists elite_squad_counts_profile_idx on public.elite_squad_counts (profile_id);

create table if not exists public.elite_pro_passes (
  id         uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.elite_profiles(id) on delete cascade,
  number     integer not null check (number between 1 and 6),
  days       integer not null check (days between 1 and 90),
  earned_at  timestamptz not null default now(),
  started_at timestamptz,
  ends_at    timestamptz,
  ended_at   timestamptz,
  unique (profile_id, number),
  check ((started_at is null) = (ends_at is null))
);
create index if not exists elite_pro_passes_due_idx on public.elite_pro_passes (ends_at) where ended_at is null;

alter table public.elite_squad_counts enable row level security;
alter table public.elite_pro_passes enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'elite_squad_counts' and policyname = 'squad counts: coach read'
  ) then
    create policy "squad counts: coach read" on public.elite_squad_counts
      for select using (public.elite_is_coach());
  end if;
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'elite_pro_passes' and policyname = 'pro passes: coach read'
  ) then
    create policy "pro passes: coach read" on public.elite_pro_passes
      for select using (public.elite_is_coach());
  end if;
end
$$;

-- Send to a parent (lib/elite/parent-link.ts): the player's own link to the
-- page their parent pays from. A long random code, made the first time the
-- player asks for the link and kept. NULL until then.
alter table public.elite_trackers
  add column if not exists parent_code text;
create unique index if not exists elite_trackers_parent_code_idx
  on public.elite_trackers (parent_code) where parent_code is not null;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'elite_trackers_parent_code_shape' and conrelid = 'public.elite_trackers'::regclass
  ) then
    alter table public.elite_trackers
      add constraint elite_trackers_parent_code_shape check (parent_code is null or parent_code ~ '^[a-z2-7]{26}$');
  end if;
end $$;
