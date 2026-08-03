-- Store Report Generator — team directory repair
--
-- Symptom: the Team drawer lists only the people who have signed in recently,
-- not everybody with an account.
--
-- The panel joins two sources (see components/TeamPanel.tsx): the presence
-- channel, which knows who is connected *right now*, and `public.profiles`,
-- which is supposed to know everyone who ever signed up. When the roster half
-- comes back with just your own row, what is left on screen is you plus whoever
-- happens to be online — exactly the reported symptom. There are only two ways
-- that happens, and this migration closes both. It is idempotent: running it
-- when nothing is wrong changes nothing.
--
--   1. The rows are missing. `profiles` is filled by the on_auth_user_created
--      trigger plus a one-off backfill in 20260723000000_account_approval.sql.
--      An account created while the trigger was absent — or in a project where
--      that migration was applied after the accounts existed and the backfill
--      raced them — never got a row. Such a user cannot use the app at all:
--      is_approved() is false for them, so RLS shows them nothing and the
--      middleware parks them on /pending.
--
--   2. The read policy is missing. Base `profiles` RLS lets you read exactly one
--      row: your own. Reading the whole roster needs the policy added in
--      20260730000000_team_directory.sql — if that file was never applied to
--      this project, the query silently returns one row instead of erroring,
--      because RLS filters rather than fails.
--
-- Which one it was, before running the fixes below:
--
--   select
--     (select count(*) from auth.users)        as accounts,
--     (select count(*) from public.profiles)   as profile_rows,
--     (select count(*) from public.profiles
--       where email is null)                   as rows_without_email;
--
--   select p.email, p.approved, p.created_at
--   from public.profiles p order by p.created_at;
--
-- Equal counts and a full email column mean it was cause 2.

-- ------------------------------------------------- 1. rows for every account

-- Deliberately `approved = false`, unlike the original backfill. That one ran at
-- a moment when every existing account was known to be the team; this one runs
-- at an unknown moment and must not hand access to whatever signed up in the
-- meantime. Nobody loses anything: an account with no row had no access either,
-- and now it is at least visible in the drawer, marked "Pending", which is the
-- prompt an admin needs.
insert into public.profiles (id, email, approved, created_at)
select u.id, u.email, false, u.created_at
from auth.users u
on conflict (id) do nothing;

-- --------------------------------------------------------- 2. email in sync

-- The panel drops rows without an email — it keys everything (presence, colours,
-- pictures) on the address, so a row without one has nothing to show. This also
-- catches anyone who changed their address after signing up.
update public.profiles p
set email = u.email
from auth.users u
where u.id = p.id
  and u.email is not null
  and p.email is distinct from u.email;

-- ------------------------------------------------------- 3. the read policy

-- Same policy as 20260730000000_team_directory.sql. Repeated here so this file
-- is a complete fix on its own: drop-then-create makes it safe either way.
drop policy if exists "Approved users can read all profiles" on public.profiles;
create policy "Approved users can read all profiles"
  on public.profiles for select
  to authenticated
  using (public.is_approved());

-- Realtime applies that same SELECT policy to postgres_changes events, so the
-- roster also stops being live without it — a new sign-up would not appear in
-- the drawer until a reload.
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

-- ------------------------------------------------------------- approving

-- Anyone inserted by step 1 shows up as "Pending" and still cannot sign in.
-- Approve them in Table Editor → profiles → `approved`, or list the addresses
-- you recognise here and run it:
--
--   update public.profiles set approved = true
--   where email in (
--     'jacques@example.com',
--     'mario@example.com',
--     'mika@example.com',
--     'trisha@example.com'
--   );
--
-- Check what you would be approving first — `select email, approved from
-- public.profiles where not approved order by created_at;`
