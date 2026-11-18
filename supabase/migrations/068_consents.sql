-- =====================================================================
-- Strive Elite - recorded agreement to the Terms and the Privacy Policy
-- =====================================================================
-- Every account accepts the Terms of Service and the Privacy Policy when
-- it is created, and again when the version changes (lib/elite/legal.ts).
-- One row per account per version: who, which version, when, where
-- (sign-up or the in-app screen), and for the in-app screen the name the
-- adult typed. Members are minors, so this is the record that a parent or
-- guardian agreed.
--
-- Append-only: there is no update or delete policy, rows are written by
-- the server after it has checked who is signed in, and they leave only
-- with the account itself (on delete cascade).
-- =====================================================================

create table if not exists public.elite_consents (
  id            uuid primary key default gen_random_uuid(),
  profile_id    uuid not null references public.elite_profiles(id) on delete cascade,
  version       text not null,
  source        text not null check (source in ('signup', 'in_app')),
  guardian_name text,
  user_agent    text,
  accepted_at   timestamptz not null default now(),
  unique (profile_id, version)
);

alter table public.elite_consents enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'elite_consents'
      and policyname = 'elite_consents_owner_read'
  ) then
    create policy elite_consents_owner_read on public.elite_consents
      for select using (profile_id = auth.uid());
  end if;
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'elite_consents'
      and policyname = 'elite_consents_coach_read'
  ) then
    create policy elite_consents_coach_read on public.elite_consents
      for select using (public.elite_is_coach());
  end if;
end $$;
