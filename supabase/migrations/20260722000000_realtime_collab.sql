-- Store Report Generator — realtime collaboration
--
-- Adds three things:
--   1. `public.reports` on the realtime publication, so the library updates live.
--   2. `public.report_updates` — an append-only log of Yjs CRDT updates, which is
--      what makes two people able to type in the same paragraph without either
--      side losing work.
--   3. RLS on `realtime.messages`, so the presence/broadcast channels can be
--      *private* (see the note further down — this one is a real access control
--      decision, not a formality).

-- ------------------------------------------------------------ reports stream

-- `alter publication ... add table` errors if the table is already a member, so
-- this has to be guarded to stay re-runnable.
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'reports'
  ) then
    alter publication supabase_realtime add table public.reports;
  end if;
end;
$$;

-- NOTE: deliberately NOT setting `replica identity full` on public.reports.
--
-- The obvious reason to set it is so DELETE payloads carry more than the primary
-- key. We don't need that: the library only needs the id to drop a card, and it
-- already holds the rest of the row in local state.
--
-- The reason NOT to set it is that `reports.data` embeds the store logo as a
-- base64 data URL, so rows are routinely hundreds of KB. Realtime drops any WAL
-- record over ~1MB (the client gets `errors: ["Error 413: Payload Too Large"]`
-- and no row at all). `replica identity full` puts old_record AND new_record in
-- every UPDATE payload, roughly doubling the size and making that truncation
-- likely on exactly the reports people are actively editing.
--
-- The client treats these events as "something changed, refetch" rather than as
-- data, so a truncated payload would be survivable — but there is no reason to
-- court it.

-- --------------------------------------------------------- CRDT update log

-- Every edit is a Yjs update: a small binary delta that merges with every other
-- update regardless of arrival order. Storing the log (rather than only the
-- final document) is what lets a client that was offline, or that joined late,
-- converge on exactly the same document as everyone else.
--
-- `payload` is base64 text rather than bytea on purpose. bytea round-trips
-- through PostgREST and Realtime as hex escape strings (`\x...`), which means
-- encoding glue on both read and write paths; base64 text is what the browser
-- already has after `fromUint8Array`. Updates are tens of bytes, so the ~33%
-- size overhead is noise.
create table if not exists public.report_updates (
  id         bigserial primary key,
  report_id  uuid not null references public.reports (id) on delete cascade,
  payload    text not null,
  -- Marks the one update that bootstrapped the document from the pre-existing
  -- `reports.data` blob. See the unique index below.
  is_seed    boolean not null default false,
  created_at timestamptz not null default now()
);

-- Updates are always read as "everything for this report, in order".
create index if not exists report_updates_report_id_idx
  on public.report_updates (report_id, id);

-- The bootstrap race: a report created before this migration (or created by
-- `createReport`) has content in `reports.data` but no CRDT history. The first
-- client to open it has to seed the document from that blob. If two clients open
-- it simultaneously and both seed, Yjs merges the two seeds and the report ends
-- up with every block duplicated — CRDTs merge concurrent inserts, they do not
-- deduplicate them.
--
-- This index makes seeding a race exactly one client can win. The loser gets a
-- 23505 unique violation, discards its seed, and reads the winner's instead.
create unique index if not exists report_updates_one_seed_per_report
  on public.report_updates (report_id)
  where is_seed;

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'report_updates'
  ) then
    alter publication supabase_realtime add table public.report_updates;
  end if;
end;
$$;

-- Only INSERTs are streamed here, and INSERT payloads always carry the full new
-- row regardless of replica identity, so the default (primary key) is correct.

alter table public.report_updates enable row level security;

-- Same shared-workspace model as public.reports: if you can read a report you
-- can read and extend its history.
drop policy if exists "Authenticated users can read report updates" on public.report_updates;
create policy "Authenticated users can read report updates"
  on public.report_updates for select
  to authenticated
  using (true);

drop policy if exists "Authenticated users can append report updates" on public.report_updates;
create policy "Authenticated users can append report updates"
  on public.report_updates for insert
  to authenticated
  with check (true);

-- Needed by compaction (below), which prunes history it has already folded into
-- a snapshot. There is no UPDATE policy: the log is append-only.
drop policy if exists "Authenticated users can prune report updates" on public.report_updates;
create policy "Authenticated users can prune report updates"
  on public.report_updates for delete
  to authenticated
  using (true);

-- ------------------------------------------------------------- compaction

-- An hour of active typing is a few thousand rows, and every client replays the
-- whole log on open. When a client notices the log has grown past its threshold
-- it folds everything it just applied into one snapshot row and drops the
-- originals.
--
-- Both statements share one transaction, so the log is never empty in between —
-- which matters, because a client seeing zero rows would decide the document
-- needs seeding and duplicate the entire report.
--
-- Rows inserted concurrently (id > p_max_id) are left alone: they may or may not
-- be included in the snapshot, and either way applying both converges, because
-- applying a Yjs update twice is a no-op.
create or replace function public.compact_report_updates(
  p_report_id uuid,
  p_payload   text,
  p_max_id    bigint
)
returns void
language plpgsql
-- security invoker: compaction runs with the caller's RLS, same as every other
-- write in this app.
security invoker
set search_path = public
as $$
begin
  insert into public.report_updates (report_id, payload, is_seed)
  values (p_report_id, p_payload, false);

  delete from public.report_updates
  where report_id = p_report_id
    and id <= p_max_id;
end;
$$;

-- --------------------------------------------- realtime channel authorization

-- Presence ("who is in which report") and the CRDT broadcast channel both run
-- over Realtime rather than the database. By default a Realtime topic is public:
-- anyone holding the anon key can subscribe to it, and the anon key ships inside
-- the browser bundle. That would let a logged-out visitor watch teammates'
-- email addresses appear and disappear, and read the live edit stream.
--
-- These policies gate `realtime.messages` so the client can mark those channels
-- `private: true`. Presence needs both: select to receive peers' state, insert to
-- publish its own.
drop policy if exists "Authenticated users can read realtime messages" on realtime.messages;
create policy "Authenticated users can read realtime messages"
  on realtime.messages for select
  to authenticated
  using (true);

drop policy if exists "Authenticated users can send realtime messages" on realtime.messages;
create policy "Authenticated users can send realtime messages"
  on realtime.messages for insert
  to authenticated
  with check (true);
