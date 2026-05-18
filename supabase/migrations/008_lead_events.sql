-- Strive OS · lead_events
-- Every meaningful funnel event: lead captured, VSL view, checkout started,
-- checkout completed. Powers the Command Center analytics.

create table if not exists lead_events (
  id              uuid primary key default gen_random_uuid(),
  event_type      text not null check (event_type in (
                    'lead_captured','vsl_view','checkout_started',
                    'checkout_completed','refund','tag_added'
                  )),
  email           text,
  name            text,
  source          text,
  ghl_contact_id  text,
  metadata        jsonb,
  created_at      timestamptz not null default now()
);

create index if not exists lead_events_created_idx on lead_events (created_at desc);
create index if not exists lead_events_type_idx on lead_events (event_type);

alter table lead_events enable row level security;
drop policy if exists "lead_events_all" on lead_events;
create policy "lead_events_all" on lead_events for all using (true) with check (true);
