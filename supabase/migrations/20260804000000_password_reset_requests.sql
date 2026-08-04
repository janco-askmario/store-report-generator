-- Store Report Generator — self-serve password resets
--
-- There is no mailer on this project (the app lives on a subdomain whose DNS we
-- don't control, so a sending domain can't be verified), which leaves the usual
-- emailed recovery link off the table. Instead, /login lets someone set a new
-- password for their own address directly — and the admin, not an inbox, is what
-- proves the request was genuine.
--
-- That trade is only safe because of one rule, enforced in
-- app/api/password-reset/route.ts: **a reset immediately sets approved = false**.
-- Anyone can type a colleague's address and set a password on it, but doing so
-- locks the account instead of opening it. The worst an outsider achieves is a
-- nuisance lockout; they cannot read a single report until an admin re-approves,
-- and the admin is expected to check with the actual person before doing so.
--
-- Handling a request:
--   1. Table Editor -> password_reset_requests — who asked, when, from where.
--   2. Confirm with them, out of band, that it was really them.
--   3. Table Editor -> profiles -> set `approved` = true on their row.
--
-- Note the trap: an admin who resets their own password locks themselves out
-- too, and RLS keeps the app from being the way back in. The way back in is the
-- dashboard, or scripts/set-password.mts with the project's secret key.

-- ------------------------------------------------------- the request log

-- Every attempt lands here, including ones for addresses that have no account
-- (`matched` = false). Unmatched rows are the interesting ones: a burst of them
-- is somebody guessing at staff addresses, and a single one is usually a typo
-- from a teammate now waiting on an approval that has nothing behind it.
create table if not exists public.password_reset_requests (
  id           uuid primary key default gen_random_uuid(),
  email        text not null,
  -- Null when the address matched no account, and on purpose when the account is
  -- later deleted — the audit line outlives the user it referred to.
  user_id      uuid references auth.users (id) on delete set null,
  matched      boolean not null default false,
  -- Best-effort: the proxy's client address, for spotting a flood from one source.
  ip           text,
  requested_at timestamptz not null default now()
);

-- Both indexes exist for the rate-limit counts the route runs on every request:
-- "how many for this address lately" and "how many from this IP lately".
create index if not exists password_reset_requests_email_idx
  on public.password_reset_requests (email, requested_at desc);

create index if not exists password_reset_requests_ip_idx
  on public.password_reset_requests (ip, requested_at desc);

-- ------------------------------------------------------------------- RLS

-- Enabled with **no policies whatsoever**, which is the point: RLS denies by
-- default, so anon and authenticated callers can neither read nor write this
-- table. The only thing that touches it is the route handler holding the
-- project's secret key, which bypasses RLS — and the admin in the dashboard,
-- which does too.
--
-- Keeping it unreadable matters: the log is a list of real staff email
-- addresses, and the approval gate (20260723000000_account_approval.sql) exists
-- precisely to keep those away from accounts nobody has vouched for yet.
alter table public.password_reset_requests enable row level security;
