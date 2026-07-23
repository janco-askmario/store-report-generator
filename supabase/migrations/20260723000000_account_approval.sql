-- Store Report Generator — account approval gate
--
-- Changes the access model from "any authenticated account is a full member of
-- the workspace" to "any *approved* authenticated account is". This lets public
-- sign-up stay ON (so employees self-register) without letting outsiders in:
-- a new account can sign in, but sees nothing and can do nothing until an admin
-- approves it.
--
-- Approving someone: Supabase dashboard -> Table Editor -> profiles -> set
-- `approved` = true on their row. Rejecting: delete the user in
-- Authentication -> Users (cascades to their profile row).
--
-- This supersedes the note in 20260721000000_reports.sql that sign-ups must stay
-- disabled — approval is now what gates access, not the "signups off" switch.

-- ------------------------------------------------------------------ profiles

-- One row per auth user, carrying the approval flag. `email` is duplicated from
-- auth.users purely so the admin can tell who is who in the Table Editor without
-- joining against the auth schema.
create table if not exists public.profiles (
  id         uuid primary key references auth.users (id) on delete cascade,
  email      text,
  approved   boolean not null default false,
  created_at timestamptz not null default now()
);

-- Every existing account predates this table, so has no profile row. Backfill
-- them as approved — they are the current, trusted team, and must not be locked
-- out (this includes the admin running the migration). Only accounts created
-- AFTER this point start life unapproved.
insert into public.profiles (id, email, approved)
select id, email, true
from auth.users
on conflict (id) do nothing;

-- New sign-ups get an unapproved profile automatically. SECURITY DEFINER so the
-- insert runs regardless of RLS / the caller's role (the trigger fires as the
-- auth admin role).
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, approved)
  values (new.id, new.email, false)
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- --------------------------------------------------------------- is_approved

-- The single source of truth every policy below leans on. SECURITY DEFINER so it
-- can read public.profiles without being subject to that table's RLS (which
-- would otherwise recurse), and so a policy can call it cheaply.
create or replace function public.is_approved()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.profiles
    where id = (select auth.uid()) and approved
  );
$$;

grant execute on function public.is_approved() to authenticated;

-- ----------------------------------------------------------- profiles RLS

alter table public.profiles enable row level security;

-- A user may read their own row (so the app can show approval status). Nobody
-- writes through the API: rows are created by the trigger above and the
-- `approved` flag is only ever flipped by an admin, whose dashboard/service-role
-- access bypasses RLS.
drop policy if exists "Users can read own profile" on public.profiles;
create policy "Users can read own profile"
  on public.profiles for select
  to authenticated
  using ((select auth.uid()) = id);

-- ------------------------------------------------------- re-gate data tables

-- Everything below is the same set of policies the earlier migrations created,
-- with the `using (true)` / bare `with check` swapped for `public.is_approved()`.
-- Unapproved accounts now fall through every policy and see an empty, read-only
-- app until approved.

-- reports -------------------------------------------------------------------
drop policy if exists "Authenticated users can read reports" on public.reports;
create policy "Authenticated users can read reports"
  on public.reports for select
  to authenticated
  using (public.is_approved());

drop policy if exists "Authenticated users can create reports" on public.reports;
create policy "Authenticated users can create reports"
  on public.reports for insert
  to authenticated
  with check ((select auth.uid()) = created_by and public.is_approved());

drop policy if exists "Authenticated users can update reports" on public.reports;
create policy "Authenticated users can update reports"
  on public.reports for update
  to authenticated
  using (public.is_approved())
  with check (public.is_approved());

drop policy if exists "Authenticated users can delete reports" on public.reports;
create policy "Authenticated users can delete reports"
  on public.reports for delete
  to authenticated
  using (public.is_approved());

-- block_templates -----------------------------------------------------------
drop policy if exists "Authenticated users can read block templates" on public.block_templates;
create policy "Authenticated users can read block templates"
  on public.block_templates for select
  to authenticated
  using (public.is_approved());

drop policy if exists "Authenticated users can create block templates" on public.block_templates;
create policy "Authenticated users can create block templates"
  on public.block_templates for insert
  to authenticated
  with check ((select auth.uid()) = created_by and public.is_approved());

drop policy if exists "Authenticated users can delete block templates" on public.block_templates;
create policy "Authenticated users can delete block templates"
  on public.block_templates for delete
  to authenticated
  using (public.is_approved());

-- report_updates (CRDT edit log) --------------------------------------------
drop policy if exists "Authenticated users can read report updates" on public.report_updates;
create policy "Authenticated users can read report updates"
  on public.report_updates for select
  to authenticated
  using (public.is_approved());

drop policy if exists "Authenticated users can append report updates" on public.report_updates;
create policy "Authenticated users can append report updates"
  on public.report_updates for insert
  to authenticated
  with check (public.is_approved());

drop policy if exists "Authenticated users can prune report updates" on public.report_updates;
create policy "Authenticated users can prune report updates"
  on public.report_updates for delete
  to authenticated
  using (public.is_approved());

-- realtime channels (presence + CRDT broadcast) -----------------------------
-- Without this an unapproved (or the moment before redirect) client could still
-- subscribe to presence and watch teammates' emails. Gate it the same way.
drop policy if exists "Authenticated users can read realtime messages" on realtime.messages;
create policy "Authenticated users can read realtime messages"
  on realtime.messages for select
  to authenticated
  using (public.is_approved());

drop policy if exists "Authenticated users can send realtime messages" on realtime.messages;
create policy "Authenticated users can send realtime messages"
  on realtime.messages for insert
  to authenticated
  with check (public.is_approved());
