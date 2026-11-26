-- =====================================================================
-- 093: EMAIL CONFIRMATION (Nov 26 2026)
-- =====================================================================
-- Coach Yinka: "we must confirm email".
--
-- A new account gets a 6 digit code by email and types it in, in the
-- iPhone app or on the website (lib/elite/email-confirm.ts and
-- email-confirm-server.ts). No link to tap, nobody leaves the app.
--
-- WRITTEN, NOT APPLIED. Until it is applied, and while no email sender is
-- set up (RESEND_API_KEY), nobody is asked and nothing is refused: the
-- column is not on the profile row, so the gate stays open.
--
-- 1) elite_profiles.email_confirmed_at: null = not confirmed yet.
-- 2) elite_email_codes: the one live code of an account. Only a SHA-256
--    hash of the code (with the profile id mixed in) is stored, never the
--    code. tries counts wrong tries on this code (5 at most); sends counts
--    the codes sent since window_started_at (5 an hour, one a minute).
--    Row security on, one coach-read policy; the server writes with the
--    service role after checking who is signed in.
-- 3) EVERY ACCOUNT THAT EXISTS WHEN THIS RUNS IS MARKED CONFIRMED, so only
--    accounts made after it are asked. Asking older accounts later is a
--    separate decision (Coach Yinka's), not part of this file.
--
-- Additive. Nothing is dropped. Safe to run twice. Each statement can be
-- run on its own.
-- =====================================================================

set lock_timeout = '8s';

alter table public.elite_profiles
  add column if not exists email_confirmed_at timestamptz;

create table if not exists public.elite_email_codes (
  profile_id uuid primary key references public.elite_profiles(id) on delete cascade,
  code_hash text not null,
  email text not null,
  sent_at timestamptz not null default now(),
  window_started_at timestamptz not null default now(),
  expires_at timestamptz not null,
  tries int not null default 0,
  sends int not null default 1
);

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'elite_email_codes_hash_check'
      and conrelid = 'public.elite_email_codes'::regclass
  ) then
    alter table public.elite_email_codes
      add constraint elite_email_codes_hash_check check (code_hash ~ '^[0-9a-f]{64}$');
  end if;
  if not exists (
    select 1 from pg_constraint
    where conname = 'elite_email_codes_counts_check'
      and conrelid = 'public.elite_email_codes'::regclass
  ) then
    alter table public.elite_email_codes
      add constraint elite_email_codes_counts_check check (tries >= 0 and tries <= 100 and sends >= 0 and sends <= 100);
  end if;
end $$;

alter table public.elite_email_codes enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'elite_email_codes' and policyname = 'elite_email_codes_coach_read'
  ) then
    create policy elite_email_codes_coach_read on public.elite_email_codes
      for select using (public.elite_is_coach());
  end if;
end $$;

-- Every account made before this runs is confirmed (see 3 above).
update public.elite_profiles
  set email_confirmed_at = now()
  where email_confirmed_at is null;
