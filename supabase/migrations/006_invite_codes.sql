-- =====================================================================
-- Strive Elite — invite codes (paid-mentorship access gate)
-- =====================================================================
-- A player can only create an account by redeeming a single-use invite
-- code that the coach generates (and hands out after payment). Redemption
-- happens server-side with the service role, so RLS here only needs to let
-- the coach manage codes.
-- =====================================================================

create table if not exists public.invite_codes (
  id         uuid primary key default gen_random_uuid(),
  code       text not null unique,
  created_by uuid references public.profiles(id) on delete set null,
  note       text not null default '',
  used_by    uuid references public.profiles(id) on delete set null,
  used_at    timestamptz,
  expires_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists invite_codes_code_idx on public.invite_codes(code);

alter table public.invite_codes enable row level security;

-- Only coaches/admins can see or manage codes. Redemption/validation runs
-- through the service-role key, which bypasses RLS.
drop policy if exists invite_codes_coach_all on public.invite_codes;
create policy invite_codes_coach_all on public.invite_codes
  for all using (public.is_coach()) with check (public.is_coach());
