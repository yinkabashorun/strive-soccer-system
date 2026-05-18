-- Strive OS · creatives
-- Every UGC ad generated for the dribbling course funnel.

create table if not exists creatives (
  id                uuid primary key default gen_random_uuid(),
  title             text,
  audience          text check (audience in ('player','parent','both')),
  pain_point        text,
  transformation    text,
  tone              text,
  platform          text check (platform in ('TikTok','IG Reel','Meta Ad','YouTube Shorts')),
  hook              text,
  script            text,
  caption           text,
  cta               text,
  shot_list         text,
  voiceover_script  text,
  landing_angle     text,
  vsl_section       text,
  status            text not null default 'idea'
                    check (status in ('idea','script_ready','voiceover_ready','video_ready','published','winner','loser')),
  voiceover_audio_url text,
  fal_request_id    text,
  video_url         text,
  ghl_post_id       text,
  performance_notes text,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create index if not exists creatives_status_idx on creatives (status);
create index if not exists creatives_created_idx on creatives (created_at desc);

alter table creatives enable row level security;
drop policy if exists "creatives_all" on creatives;
create policy "creatives_all" on creatives for all using (true) with check (true);
