-- Strive OS · funnel_settings
-- Editable config for each funnel. Default row: the dribbling course.

create table if not exists funnel_settings (
  id                  uuid primary key default gen_random_uuid(),
  slug                text unique not null,
  product_name        text not null default 'Strive Dribbling Course',
  vsl_url             text,
  checkout_url        text,
  offer_price_cents   integer not null default 9700,
  currency            text not null default 'usd',
  lead_magnet_url     text,
  top_cta             text default 'Get the Dribbling Course',
  current_offer       text,
  main_promise        text,
  objections_handled  text[] not null default '{}',
  testimonials        text[] not null default '{}',
  conversion_notes    text,
  updated_at          timestamptz not null default now()
);

alter table funnel_settings enable row level security;
drop policy if exists "funnel_settings_all" on funnel_settings;
create policy "funnel_settings_all" on funnel_settings for all using (true) with check (true);

-- Seed the default funnel row so the editor always has something to load.
insert into funnel_settings (slug, product_name, offer_price_cents, top_cta, main_promise)
values (
  'dribbling-course',
  'Strive Dribbling Course',
  9700,
  'Get the Dribbling Course · $97',
  'Become unrecognizable on the ball in 30 days · 5 minutes a day'
)
on conflict (slug) do nothing;
