-- Lets AI-generated copy (parent weekly report) use correct pronouns
-- instead of avoiding them entirely. Nullable - existing players get it
-- added by the coach; new ones are required to pick it at onboarding.
alter table public.elite_players add column if not exists gender text
  check (gender in ('boy', 'girl'));
