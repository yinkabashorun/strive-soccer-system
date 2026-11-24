-- =====================================================================
-- Strive Elite - the free account's quiz, and starting a membership from it
-- =====================================================================
-- Nov 24 2026. A free account (069) made in the iPhone app takes the same
-- quiz a paying member takes, once (lib/elite/free-intake.ts). The offer
-- shown after it names the player's own weakest areas, and a membership
-- started later is built from these answers, so nothing is asked twice.
--
--   intake            the quiz answers, as lib/elite/free-intake.ts
--                     cleanFreeAnswers leaves them. Null until the quiz is
--                     answered. The free app's own four answers (grade,
--                     level, season, goal) are still written to their own
--                     columns, worked out from these.
--   intake_at         when the quiz was answered.
--   upgrade_checkout  the Stripe Checkout Session this account last opened
--                     to start a membership (lib/elite/free-upgrade-server.ts).
--                     Only a pointer: when the checkout's sheet closes, the
--                     app asks the server to read that session from Stripe,
--                     and what Stripe says about it decides. Never a card
--                     detail, never a payment.
--
-- The table's rules do not change: written only by the server (service
-- role, after it has checked who is signed in); the owner reads their own
-- row, a coach reads all, nobody writes directly. The new columns are
-- covered by the row policies 069 created.
--
-- Until this is applied the app asks nothing new of a free account: it
-- reads these columns best effort and a free account is sent to the
-- website's training log, exactly as before.
--
-- Idempotent: safe to run again. No DROP statements.
-- =====================================================================

set lock_timeout = '8s';

alter table public.elite_trackers
  add column if not exists intake jsonb;

alter table public.elite_trackers
  add column if not exists intake_at timestamptz;

alter table public.elite_trackers
  add column if not exists upgrade_checkout text;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'elite_trackers_intake_shape') then
    alter table public.elite_trackers
      add constraint elite_trackers_intake_shape
      check (intake is null or jsonb_typeof(intake) = 'object');
  end if;
  if not exists (select 1 from pg_constraint where conname = 'elite_trackers_upgrade_checkout_shape') then
    alter table public.elite_trackers
      add constraint elite_trackers_upgrade_checkout_shape
      check (upgrade_checkout is null or upgrade_checkout ~ '^cs_[A-Za-z0-9_]{8,200}$');
  end if;
end $$;

-- Already on since 069; stated again so this file stands on its own.
alter table public.elite_trackers enable row level security;
