-- =====================================================================
-- Strive Elite - parent phone for SMS + onboarding-reminder tracking
-- =====================================================================
-- Player/parent notifications are moving to SMS via GHL (no Twilio, no
-- A2P 10DLC wait - GHL already has a registered number). SMS needs a
-- phone number, which nothing in this app captured before now.
-- onboarding_reminder_sent_at lets the reminder cron nudge a stale
-- signup without re-texting the same family every single day.
-- =====================================================================

alter table public.elite_players add column if not exists parent_phone text;
alter table public.elite_players add column if not exists onboarding_reminder_sent_at timestamptz;
