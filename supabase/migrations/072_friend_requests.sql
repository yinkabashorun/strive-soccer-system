-- 072: friends by request (Coach Yinka, Nov 20 2026: "friend requests is
-- fine"). Opening a player's link no longer makes two players friends on
-- its own: it sends the link's owner a request, and only their Accept
-- makes the pair. A link posted publicly can no longer put a stranger in
-- a 13 year old's friends. Written only by our server (no policies: row
-- security on, the service role writes after checking who is asking).

create table if not exists public.elite_tracker_friend_requests (
  requester  uuid not null references public.elite_trackers(profile_id) on delete cascade,
  recipient  uuid not null references public.elite_trackers(profile_id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (requester, recipient),
  check (requester <> recipient)
);

create index if not exists elite_tracker_friend_requests_recipient_idx
  on public.elite_tracker_friend_requests (recipient);

alter table public.elite_tracker_friend_requests enable row level security;
