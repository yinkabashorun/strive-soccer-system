-- 076: the waitlist's pickup head start (Coach Yinka, Nov 22 2026: "48
-- hours"). The coach texts the list a pickup sign-up link 48 hours before
-- it is posted anywhere else. Each row remembers the last pickup link it
-- was sent, so one tap per event never texts the same person twice, and a
-- new event's link goes to everyone again. Written by the server only
-- (075's policies stand: coaches read and delete, nobody else).

alter table public.elite_waitlist
  add column if not exists pickup_link text,
  add column if not exists pickup_sent_at timestamptz;

alter table public.elite_waitlist
  add constraint elite_waitlist_pickup_link_https
  check (pickup_link is null or (pickup_link ~ '^https://' and length(pickup_link) <= 300));
