-- =====================================================================
-- Strive Elite — invite codes (paid-mentorship access gate)
-- =====================================================================
-- A player can only create an account by redeeming a single-use invite
-- code that the coach generates (and hands out after payment). Redemption
-- happens server-side with the service role, so RLS here only needs to let
-- the coach manage codes.
-- =====================================================================

create table if not exists public.elite_invite_codes (
  id         uuid primary key default gen_random_uuid(),
  code       text not null unique,
  created_by uuid references public.elite_profiles(id) on delete set null,
  note       text not null default '',
  used_by    uuid references public.elite_profiles(id) on delete set null,
  used_at    timestamptz,
  expires_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists elite_invite_codes_code_idx on public.elite_invite_codes(code);

alter table public.elite_invite_codes enable row level security;

drop policy if exists elite_invite_codes_coach_all on public.elite_invite_codes;
create policy elite_invite_codes_coach_all on public.elite_invite_codes
  for all using (public.elite_is_coach()) with check (public.elite_is_coach());
