-- Store Report Generator — team directory
--
-- The dashboard grows a "Team" panel: everyone signed up to the app, split into
-- who is online right now and who is not.
--
-- The "online" half already exists — it is the Realtime presence channel from
-- 20260722000000_realtime_collab.sql. The *offline* half cannot come from there:
-- a person who is offline publishes nothing, so by definition presence has never
-- heard of them. The roster has to come from a table, and `public.profiles`
-- (20260723000000_account_approval.sql) is already exactly that table — one row
-- per account, created by the on_auth_user_created trigger.
--
-- So this migration only has to make that table readable and live.

-- ------------------------------------------------------------ read the roster

-- profiles RLS previously allowed exactly one row through: your own. That is
-- enough for "am I approved?", but the panel needs the whole list.
--
-- Scoped to approved accounts on purpose. An account sitting in /pending is a
-- stranger until an admin says otherwise, and this would otherwise hand it the
-- team's email addresses. The existing "Users can read own profile" policy stays
-- alongside this one — permissive policies OR together, so an unapproved user
-- keeps seeing their own row and loses nothing.
drop policy if exists "Approved users can read all profiles" on public.profiles;
create policy "Approved users can read all profiles"
  on public.profiles for select
  to authenticated
  using (public.is_approved());

-- Still no write policies: rows are created by the trigger, and `approved` is
-- only ever flipped by an admin through the dashboard (which bypasses RLS).

-- --------------------------------------------------------------- live roster

-- Presence updates itself over the websocket, so the online/offline split is
-- already live. This publication is for the other half of "live": someone signs
-- up, or an admin approves them, and the panel picks it up without a refresh.
--
-- `alter publication ... add table` errors if the table is already a member, so
-- this has to be guarded to stay re-runnable.
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'profiles'
  ) then
    alter publication supabase_realtime add table public.profiles;
  end if;
end;
$$;

-- Default replica identity (primary key) is right here, as it is for
-- public.reports: the client treats these events as "something changed, go and
-- look" and refetches the roster, so it never reads the payload itself. Rows are
-- four small columns, nowhere near Realtime's ~1MB record limit.
--
-- Note that Realtime applies the SELECT policy above to postgres_changes events,
-- so an unapproved client subscribed to this stream still receives nothing but
-- its own row.
