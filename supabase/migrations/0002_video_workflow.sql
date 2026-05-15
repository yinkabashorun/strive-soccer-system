-- ============================================================================
-- Strive OS · 0002 video workflow migration
--
-- Adds the hybrid Higgsfield workflow:
--   - new post status `awaiting_video` (script written, video not generated yet)
--   - higgsfield_prompt column — the exact Claude.ai prompt Yinka pastes
--   - Higgsfield avatar / webproduct / mode defaults in config
--
-- Safe to re-run.
-- ============================================================================

alter table public.posts
  add column if not exists higgsfield_prompt text;

alter table public.config
  add column if not exists higgsfield_avatar_id text default '94950cff-b90a-4416-8384-ce554ff387e1',
  add column if not exists higgsfield_avatar_name text default 'Malik',
  add column if not exists higgsfield_avatar_type text default 'preset',
  add column if not exists higgsfield_webproduct_id text default '61d71e62-5acf-41d7-85b6-58798582d1d6',
  add column if not exists higgsfield_webproduct_url text default 'https://totalballmastery.netlify.app',
  add column if not exists higgsfield_mode text default 'UGC',
  add column if not exists higgsfield_duration_sec integer default 15;
