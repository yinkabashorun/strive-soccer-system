-- =====================================================================
-- Strive Pro - the low-ticket membership (Coach Yinka, Nov 20 2026)
-- =====================================================================
-- "Forget about the high ticket mentorship ... lets focus on the low
-- ticket for now and having the app ready." Strive Pro is $29 a month,
-- paid by card through Stripe Checkout, no invite code. A Pro member is
-- an ordinary member row (elite_players) on tier 'pro': the same hourly
-- plan builder builds their week from the intake, the drills they finish
-- and their weekly check-in, and they get the Courses tab. What Pro does
-- NOT get (Film Room, the coach chat, calls, Send a clip, the progress
-- video, the parent report, the 3-month program) is ONE pure rule in
-- lib/elite/tiers.ts, never a database flag.
--
-- 1) 'pro' joins the allowed tiers, the way 032 and 042 widened the
--    pillar check. The 008/029 privilege guard already stops a player
--    from changing their own tier; it needs no change.
-- 2) elite_subscriptions.stripe_checkout_session_id, unique: Stripe
--    resends a webhook it is not sure arrived, and one paid checkout must
--    write one subscription row, never two (the webhook upserts on it).
--    And an index on stripe_subscription_id, which every subscription
--    update and cancellation looks a row up by.
--
-- Idempotent: safe to run twice. Nothing existing changes: every current
-- row keeps its tier, and no row is touched.
-- =====================================================================

-- 1) the tier --------------------------------------------------------
alter table public.elite_players drop constraint if exists elite_players_tier_check;
alter table public.elite_players add constraint elite_players_tier_check
  check (tier in ('elite', 'complete', 'pro'));

-- 2) one row per paid checkout --------------------------------------
alter table public.elite_subscriptions
  add column if not exists stripe_checkout_session_id text;

create unique index if not exists elite_subs_checkout_session_idx
  on public.elite_subscriptions(stripe_checkout_session_id);
-- (A plain unique index, not a partial one, so the webhook's upsert can
-- name it as its conflict target. Older rows with no session id stay
-- allowed: Postgres never counts two NULLs as the same value.)

create index if not exists elite_subs_stripe_sub_idx
  on public.elite_subscriptions(stripe_subscription_id);
