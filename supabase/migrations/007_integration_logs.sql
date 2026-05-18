-- Strive OS · integration_logs
-- Per-service event log for debugging Stripe / GHL / AI integrations.

create table if not exists integration_logs (
  id          uuid primary key default gen_random_uuid(),
  service     text not null check (service in ('stripe','ghl','anthropic','fal','elevenlabs','supabase','ugc')),
  event       text,
  status      text not null check (status in ('ok','error','warn','info')),
  detail      text,
  metadata    jsonb,
  received_at timestamptz not null default now()
);

create index if not exists integration_logs_received_idx on integration_logs (received_at desc);
create index if not exists integration_logs_service_idx on integration_logs (service);
create index if not exists integration_logs_status_idx on integration_logs (status);

alter table integration_logs enable row level security;
drop policy if exists "integration_logs_all" on integration_logs;
create policy "integration_logs_all" on integration_logs for all using (true) with check (true);
