-- Strive OS · course_sales
-- Populated by the Stripe webhook on successful checkout.

create table if not exists course_sales (
  id                        uuid primary key default gen_random_uuid(),
  stripe_session_id         text unique,
  stripe_payment_intent_id  text,
  buyer_email               text,
  buyer_name                text,
  amount_cents              integer not null default 0,
  currency                  text not null default 'usd',
  product                   text not null default 'Strive Dribbling Course',
  status                    text not null default 'paid'
                            check (status in ('paid','refunded','disputed','failed')),
  ghl_contact_id            text,
  metadata                  jsonb,
  created_at                timestamptz not null default now()
);

create index if not exists course_sales_created_idx on course_sales (created_at desc);
create index if not exists course_sales_status_idx on course_sales (status);
create index if not exists course_sales_email_idx on course_sales (buyer_email);

alter table course_sales enable row level security;
drop policy if exists "course_sales_all" on course_sales;
create policy "course_sales_all" on course_sales for all using (true) with check (true);
