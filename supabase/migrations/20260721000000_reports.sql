-- Store Report Generator — reports table
--
-- The whole report body stays as a single jsonb blob (matching `ReportData` in
-- lib/types.ts) rather than being spread across columns. The report shape is
-- driven by the PDF layout and changes often; normalising it would mean a
-- migration every time a block or note field is added.

create table if not exists public.reports (
  id          uuid primary key default gen_random_uuid(),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  created_by  uuid references auth.users (id) on delete set null,
  data        jsonb not null default '{}'::jsonb
);

-- The library lists reports newest-first.
create index if not exists reports_updated_at_idx
  on public.reports (updated_at desc);

-- ---------------------------------------------------------------- updated_at

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists reports_set_updated_at on public.reports;
create trigger reports_set_updated_at
  before update on public.reports
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------- RLS

alter table public.reports enable row level security;

-- Shared team workspace: any signed-in user works on any report, matching how
-- the reports were shared before (one browser, one team). `created_by` is kept
-- for attribution only, it does not gate access.
--
-- IMPORTANT: this makes every authenticated account a full member of the
-- workspace, so public sign-ups must stay disabled in the Supabase dashboard
-- (Authentication -> Sign In / Providers -> "Allow new users to sign up" off).
-- Invite teammates from Authentication -> Users instead.
--
-- To silo reports per user instead, replace `true` below with
-- `(select auth.uid()) = created_by`.

drop policy if exists "Authenticated users can read reports" on public.reports;
create policy "Authenticated users can read reports"
  on public.reports for select
  to authenticated
  using (true);

drop policy if exists "Authenticated users can create reports" on public.reports;
create policy "Authenticated users can create reports"
  on public.reports for insert
  to authenticated
  with check ((select auth.uid()) = created_by);

drop policy if exists "Authenticated users can update reports" on public.reports;
create policy "Authenticated users can update reports"
  on public.reports for update
  to authenticated
  using (true)
  with check (true);

drop policy if exists "Authenticated users can delete reports" on public.reports;
create policy "Authenticated users can delete reports"
  on public.reports for delete
  to authenticated
  using (true);
