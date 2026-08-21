-- 018: fix week notifications.
-- The 009 trigger notified "Week N is ready" the instant a weekly plan row
-- was INSERTED. Since the 014 VA-time model, plans are inserted days before
-- they unlock (Monday morning), so the trigger fired early AND the unlock
-- processor notified again on Monday: premature + duplicate notifications.
-- The app now owns notification timing (instant for a player's first week,
-- Monday unlock for every later week), so the trigger goes away.

drop trigger if exists elite_notify_new_week_trg on public.elite_weekly_plans;
drop function if exists public.elite_notify_new_week();
