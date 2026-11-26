-- =====================================================================
-- 091: A PAYING MEMBER'S EARNED MONTH IS THEIR NEXT MONTH FREE (Nov 26 2026)
-- =====================================================================
-- Coach Yinka: "a paying member should get their next month free".
--
-- Bring your squad (086): three teammates who train earn a month of
-- Strive Pro. A free player starts it with one tap. A player who already
-- pays by card had nothing to start: the card promised them a month of
-- what they already had, and the tap was refused. Now that month becomes
-- a credit on their Stripe account for the month's price, so their next
-- charge is nothing (lib/elite/squad-pass-server.ts creditPass,
-- lib/elite/pro-server.ts creditNextMonth).
--
-- Two columns on the earned month's own row say that this is how it was
-- used:
--   credited_at       when it was turned into a free month. The server
--                     claims the month with this write BEFORE it asks
--                     Stripe, and takes it back if Stripe says no, so two
--                     taps or a retry can never use one month twice.
--   stripe_credit_id  Stripe's own record of the credit, for the books.
-- A month used this way is closed the moment it is used (started, ended):
-- it is never "running", so the hourly job that ends earned months never
-- touches it. The check below holds that.
--
-- Additive. No row is changed, nothing is dropped. Safe to run twice.
-- UNTIL THIS IS APPLIED the claim is refused by the database, nothing is
-- sent to Stripe, and a paying member's earned month is kept as it was.
-- =====================================================================

set lock_timeout = '8s';

alter table public.elite_pro_passes
  add column if not exists credited_at timestamptz;

alter table public.elite_pro_passes
  add column if not exists stripe_credit_id text;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'elite_pro_passes_credit_is_closed'
      and conrelid = 'public.elite_pro_passes'::regclass
  ) then
    alter table public.elite_pro_passes
      add constraint elite_pro_passes_credit_is_closed
      check (credited_at is null or (started_at is not null and ended_at is not null));
  end if;
end $$;
