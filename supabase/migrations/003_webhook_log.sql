-- Strive OS · GHL webhook activity log

create table if not exists ghl_sync_log (
  id          uuid primary key default gen_random_uuid(),
  event       text,
  contact_id  text,
  name        text,
  status      text not null check (status in ('ok','error')),
  detail      text,
  received_at timestamptz not null default now()
);

create index if not exists ghl_sync_log_received_idx on ghl_sync_log (received_at desc);
create index if not exists ghl_sync_log_status_idx on ghl_sync_log (status);

alter table ghl_sync_log enable row level security;

drop policy if exists "ghl_sync_log_all" on ghl_sync_log;
create policy "ghl_sync_log_all"
  on ghl_sync_log
  for all
  using (true)
  with check (true);
