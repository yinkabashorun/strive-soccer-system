-- =====================================================================
-- Strive Elite - a phone number per coach for upload texts
-- =====================================================================
-- Coach Yinka, Nov 5 2026: "whenever they upload a video, it should send
-- me a text ... to my phone number and to Coach Gary's phone number."
-- A coach's own number lives on their profile and is set by the coach in
-- the app (Calls page), so no number is written into the repository.
-- =====================================================================
alter table public.elite_profiles add column if not exists alert_phone text;
