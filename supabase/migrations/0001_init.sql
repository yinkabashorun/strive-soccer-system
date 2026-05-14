-- ============================================================================
-- Strive OS · Supabase schema
--
-- Paste this into the Supabase SQL editor and run.
-- Tables are idempotent — safe to re-run.
-- ============================================================================

-- AI-generated post candidates (the queue).
create table if not exists public.posts (
  id              text primary key,
  hook            text not null,
  script          text not null,
  caption         text not null,
  cta             text not null,
  idea            text,
  pillar          text not null,
  goal            text not null,
  platform        text not null default 'TikTok',

  video_prompt    text not null,
  voiceover_script text not null,
  video_url       text,
  voice_url       text,
  poster_url      text,
  duration_sec    integer default 28,

  video_model     text default 'higgsfield/v1-fast',
  voice_model     text default 'elevenlabs/eleven_turbo_v2_5',

  virality_score  integer,
  virality_notes  text,

  status          text not null default 'awaiting_approval',
    -- queued | rendering | awaiting_approval | approved | scheduled | posted | rejected | failed
  scheduled_for   timestamptz,
  posted_at       timestamptz,
  ghl_post_id     text,

  reject_reason   text,
  generated_by    text default 'studio', -- studio | cron | regenerate

  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index if not exists posts_status_idx        on public.posts (status);
create index if not exists posts_scheduled_for_idx on public.posts (scheduled_for);
create index if not exists posts_created_at_idx    on public.posts (created_at desc);


-- Operator settings — a single-row config blob. Keyed by `singleton = 'main'`.
create table if not exists public.config (
  singleton             text primary key default 'main' check (singleton = 'main'),

  -- Posting schedule
  post_time_local       time      not null default '09:00',
  post_timezone         text      not null default 'America/New_York',
  post_days             text[]    not null default array['mon','tue','wed','thu','fri','sat','sun'],

  -- Pillar rotation (one pillar per day, indexed 0=Sun..6=Sat)
  pillar_rotation       text[]    not null default array[
    'Ball Mastery','Ball Mastery','Player Spotlight','Mindset','Offer','Education','Behind the Scenes'
  ],

  -- Goal rotation
  goal_rotation         text[]    not null default array[
    'Brand','Lead-gen','Lead-gen','Lead-gen','Lead-gen','Lead-gen','Course'
  ],

  -- CTA library — editable from /settings
  cta_lead_gen          text not null default 'DM TRAINING or comment below — spots cap at 6. Sessions start May 20.',
  cta_brand             text not null default 'Follow @strivesoccerfc — new drill every day.',
  cta_course            text not null default 'Link in bio: 30 Day Dribbling Masterclass at totalballmastery.netlify.app · $60.',
  cta_camp              text not null default 'Camp July 21–23 with DC United coach. $75/player. Comment CAMP to lock a spot.',
  cta_booking           text not null default 'Comment TRAINING or visit strivesoccer100x.com — sessions start May 20.',

  -- Auto-approval flag. When false (default), every generated post lands in
  -- awaiting_approval and waits for Yinka's tap. When true, cron schedules
  -- immediately.
  auto_approve          boolean not null default false,

  updated_at            timestamptz not null default now()
);

insert into public.config (singleton) values ('main')
on conflict (singleton) do nothing;


-- Provider connection log — every external call gets a row. Useful for
-- debugging when something fails in the field.
create table if not exists public.provider_log (
  id          bigserial primary key,
  provider    text not null, -- anthropic | higgsfield | elevenlabs | ghl
  action      text not null, -- generate | render_video | render_voice | schedule | error
  ok          boolean not null,
  status_code integer,
  duration_ms integer,
  payload     jsonb,
  error       text,
  created_at  timestamptz not null default now()
);

create index if not exists provider_log_created_idx on public.provider_log (created_at desc);


-- ============================================================================
-- RLS — start permissive, tighten after first launch.
-- Server-only routes use the SERVICE_ROLE key which bypasses RLS.
-- ============================================================================

alter table public.posts        enable row level security;
alter table public.config       enable row level security;
alter table public.provider_log enable row level security;

drop policy if exists "service writes posts"        on public.posts;
drop policy if exists "service writes config"       on public.config;
drop policy if exists "service writes provider_log" on public.provider_log;

create policy "service writes posts"        on public.posts        for all using (true) with check (true);
create policy "service writes config"       on public.config       for all using (true) with check (true);
create policy "service writes provider_log" on public.provider_log for all using (true) with check (true);
